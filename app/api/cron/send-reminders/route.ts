/**
 * GET /api/cron/send-reminders
 *
 * Route appelée quotidiennement par cron-job.org (ou tout autre scheduler externe).
 * Envoie automatiquement les relances de paiement aux clients ayant des factures impayées.
 *
 * Sécurité : le header Authorization: Bearer {CRON_SECRET} est requis.
 * Dans cron-job.org, configurer le header "Authorization" avec la valeur
 * "Bearer {valeur de CRON_SECRET}" dans les paramètres avancés du job.
 *
 * Logique :
 *  - Relance 1 (J+30) : due_date <= aujourd'hui - 30j  ET reminder_1_sent_at IS NULL
 *  - Relance 2 (J+45) : due_date <= aujourd'hui - 45j  ET reminder_1_sent_at IS NOT NULL
 *                                                       ET reminder_2_sent_at IS NULL
 *  - Statuts éligibles : 'sent', 'overdue' (pas draft, paid, cancelled, credited, archived)
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildReminderEmail } from "@/lib/email/templates/reminder"
import { fmtEur } from "@/lib/email/templates/base"
import { openApnsClient } from "@/lib/push/apns"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // ── Authentification du cron ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/send-reminders] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()

  // ── Client admin (service role — accès à toutes les factures, bypass RLS) ──
  const admin = createAdminClient()

  // Connexion APNs ouverte une seule fois pour tout le run (Apple traite une
  // reconnexion par notification comme un usage abusif) — `null` tant que
  // APNS_KEY_ID/APNS_TEAM_ID/APNS_PRIVATE_KEY ne sont pas définis, auquel cas
  // les relances continuent par email seul, sans aucune régression.
  const apns = openApnsClient()

  const now   = new Date()
  const j30   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const j45   = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString()

  // ── Requête : factures éligibles pour relance 1 (J+30) ────────────────────
  const { data: r1Invoices, error: r1Err } = await admin
    .from("invoices")
    .select("*, client:clients(id,name,email)")
    .in("status", ["sent", "overdue"])
    .eq("is_archived", false)
    .lte("due_date", j30)
    .is("reminder_1_sent_at", null)

  // ── Requête : factures éligibles pour relance 2 (J+45) ────────────────────
  const { data: r2Invoices, error: r2Err } = await admin
    .from("invoices")
    .select("*, client:clients(id,name,email)")
    .in("status", ["sent", "overdue"])
    .eq("is_archived", false)
    .lte("due_date", j45)
    .not("reminder_1_sent_at", "is", null)
    .is("reminder_2_sent_at", null)

  if (r1Err) console.error("[cron] Erreur requête R1:", r1Err)
  if (r2Err) console.error("[cron] Erreur requête R2:", r2Err)

  const results = {
    reminder_1: { sent: 0, skipped: 0, errors: [] as string[], push_sent: 0 },
    reminder_2: { sent: 0, skipped: 0, errors: [] as string[], push_sent: 0 },
  }

  // ── Cache des entreprises (évite de requêter N fois pour le même user) ─────
  const companyCache = new Map<string, {
    name: string; iban: string | null; accent_color: string | null; email: string | null
  }>()

  async function getCompany(userId: string) {
    if (companyCache.has(userId)) return companyCache.get(userId)!
    const { data } = await admin
      .from("companies")
      .select("name,iban,accent_color,email")
      .eq("user_id", userId)
      .single()
    const result = data ?? { name: "Votre prestataire", iban: null, accent_color: null, email: null }
    companyCache.set(userId, result)
    return result
  }

  // ── Cache des jetons push (un utilisateur peut avoir plusieurs appareils) ──
  const pushTokensCache = new Map<string, string[]>()

  async function getPushTokens(userId: string): Promise<string[]> {
    if (pushTokensCache.has(userId)) return pushTokensCache.get(userId)!
    const { data } = await admin.from("push_tokens").select("token").eq("user_id", userId)
    const tokens = (data ?? []).map((row) => row.token)
    pushTokensCache.set(userId, tokens)
    return tokens
  }

  /**
   * Notifie l'utilisateur Qonforme (pas le client final) qu'une de ses
   * factures reste impayée. Best-effort total : n'importe quelle erreur ici
   * est avalée et loguée — un push manqué ne doit jamais faire échouer une
   * relance email déjà envoyée (qui, elle, ne sera pas retentée le lendemain).
   */
  async function notifyOwnerByPush(
    invoice: { id: string; user_id: string; invoice_number: string; total_ttc: number },
    reminderNumber: 1 | 2,
    clientName: string,
  ): Promise<boolean> {
    if (!apns) return false

    try {
      const tokens = await getPushTokens(invoice.user_id)
      if (tokens.length === 0) return false

      const title = reminderNumber === 2
        ? "⚠️ Facture toujours impayée"
        : "Facture en retard de paiement"
      const body = reminderNumber === 2
        ? `${clientName || "Votre client"} n'a toujours pas réglé la facture ${invoice.invoice_number} (${fmtEur(invoice.total_ttc)}), 45 jours après l'échéance.`
        : `${clientName || "Votre client"} n'a pas encore réglé la facture ${invoice.invoice_number} (${fmtEur(invoice.total_ttc)}).`

      const outcomes = await Promise.all(
        tokens.map((token) => apns.send(token, { title, body, path: `/invoices/${invoice.id}` })),
      )

      const staleTokens = outcomes.filter((o) => o.shouldRemove).map((o) => o.token)
      if (staleTokens.length > 0) {
        await admin.from("push_tokens").delete().in("token", staleTokens)
        pushTokensCache.set(invoice.user_id, tokens.filter((t) => !staleTokens.includes(t)))
      }

      return outcomes.some((o) => o.ok)
    } catch (err) {
      console.error(`[cron] Push non envoyé pour la facture ${invoice.invoice_number}:`, err)
      return false
    }
  }

  // ── Traitement des relances 1 ──────────────────────────────────────────────
  for (const invoice of r1Invoices ?? []) {
    const clientEmail = invoice.client?.email
    if (!clientEmail) { results.reminder_1.skipped++; continue }

    try {
      const company     = await getCompany(invoice.user_id)
      const companyName = company.name?.trim() || "Votre prestataire"
      const accentColor = company.accent_color ?? "#2563EB"

      const { subject, html } = buildReminderEmail({
        reminderNumber: 1,
        invoiceNumber:  invoice.invoice_number,
        issueDate:      invoice.issue_date,
        dueDate:        invoice.due_date,
        subtotalHt:     invoice.subtotal_ht,
        totalVat:       invoice.total_vat,
        totalTtc:       invoice.total_ttc,
        companyName,
        companyIban:    company.iban,
        accentColor,
        clientName:     invoice.client?.name ?? "",
      })

      await sendEmail({
        to:       clientEmail,
        subject,
        html,
        fromName: companyName,
        replyTo:  company.email ?? undefined,
        cc:       company.email ? [company.email] : [],
        ccSubject: `Copie — Relance 1 — Facture ${invoice.invoice_number} pour ${invoice.client?.name ?? ""}`,
      })

      await admin
        .from("invoices")
        .update({ reminder_1_sent_at: now.toISOString(), status: "overdue" })
        .eq("id", invoice.id)

      results.reminder_1.sent++
      console.log(`[cron] R1 envoyée : ${invoice.invoice_number} → ${clientEmail}`)

      if (await notifyOwnerByPush(invoice, 1, invoice.client?.name ?? "")) {
        results.reminder_1.push_sent++
      }
    } catch (err) {
      const msg = `${invoice.invoice_number}: ${err instanceof Error ? err.message : String(err)}`
      results.reminder_1.errors.push(msg)
      console.error(`[cron] Erreur R1 ${invoice.invoice_number}:`, err)
    }
  }

  // ── Traitement des relances 2 ──────────────────────────────────────────────
  for (const invoice of r2Invoices ?? []) {
    const clientEmail = invoice.client?.email
    if (!clientEmail) { results.reminder_2.skipped++; continue }

    try {
      const company     = await getCompany(invoice.user_id)
      const companyName = company.name?.trim() || "Votre prestataire"
      const accentColor = company.accent_color ?? "#2563EB"

      const { subject, html } = buildReminderEmail({
        reminderNumber: 2,
        invoiceNumber:  invoice.invoice_number,
        issueDate:      invoice.issue_date,
        dueDate:        invoice.due_date,
        subtotalHt:     invoice.subtotal_ht,
        totalVat:       invoice.total_vat,
        totalTtc:       invoice.total_ttc,
        companyName,
        companyIban:    company.iban,
        accentColor,
        clientName:     invoice.client?.name ?? "",
      })

      await sendEmail({
        to:       clientEmail,
        subject,
        html,
        fromName: companyName,
        replyTo:  company.email ?? undefined,
        cc:       company.email ? [company.email] : [],
        ccSubject: `Copie — Relance 2 — Facture ${invoice.invoice_number} pour ${invoice.client?.name ?? ""}`,
      })

      await admin
        .from("invoices")
        .update({ reminder_2_sent_at: now.toISOString() })
        .eq("id", invoice.id)

      results.reminder_2.sent++
      console.log(`[cron] R2 envoyée : ${invoice.invoice_number} → ${clientEmail}`)

      if (await notifyOwnerByPush(invoice, 2, invoice.client?.name ?? "")) {
        results.reminder_2.push_sent++
      }
    } catch (err) {
      const msg = `${invoice.invoice_number}: ${err instanceof Error ? err.message : String(err)}`
      results.reminder_2.errors.push(msg)
      console.error(`[cron] Erreur R2 ${invoice.invoice_number}:`, err)
    }
  }

  apns?.close()

  const duration = Date.now() - startedAt
  const hasErrors = results.reminder_1.errors.length > 0 || results.reminder_2.errors.length > 0

  // ── Persist du log en base ────────────────────────────────────────────────
  await admin.from("cron_logs").insert({
    job_name:    "send-reminders",
    status:      hasErrors ? "error" : "ok",
    results,
    duration_ms: duration,
  })

  console.log("[cron/send-reminders] Terminé :", results)
  return NextResponse.json({ ok: true, results })
}
