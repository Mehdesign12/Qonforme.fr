/**
 * GET /api/cron/send-reminders
 *
 * Route appelée chaque jour par cron-job.org (ou tout autre scheduler externe).
 * Envoie les relances des factures impayées et des devis restés sans réponse.
 *
 * Sécurité : le header Authorization: Bearer {CRON_SECRET} est requis.
 * Dans cron-job.org, configurer le header "Authorization" avec la valeur
 * "Bearer {valeur de CRON_SECRET}" dans les paramètres avancés du job.
 *
 * Les relances automatiques font partie des formules payantes : un compte sans
 * formule garde ses documents, mais ses clients ne sont pas relancés.
 *
 * Deux modes, selon que la migration 20261003_invoice_number_at_issue_and_reminders.sql
 * est appliquée ou non (chaque push part en production avant elle) :
 *
 * - Réglages (table `document_reminders` présente) : chaque compte choisit ses
 *   relances dans Paramètres › Relances (rappel avant échéance, relances à
 *   J+7, J+15, J+30, J+45, relance des devis sans réponse). Le planning est
 *   calculé par lib/reminders/schedule.ts, en heure de Paris. Chaque étape est
 *   réservée au journal (index unique) AVANT l'envoi de l'email : deux
 *   exécutions simultanées ou un second passage le même jour n'envoient jamais
 *   deux fois la même relance. Si l'email échoue, la réservation est libérée et
 *   l'étape repartira au prochain passage.
 *
 * - Historique (table absente) : comportement d'avant, J+30 puis J+45 sur les
 *   factures, suivi par les colonnes reminder_1_sent_at / reminder_2_sent_at.
 *
 * Dans les deux modes, une relance ne change plus le statut de la facture : le
 * retard se lit sur la date d'échéance. (Avant, la relance passait la facture
 * en « overdue », ce qui la faisait sortir des montants « en attente » et
 * « en retard » du tableau de bord.)
 */

import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { sendEmail, type EmailAttachment } from "@/lib/email/resend"
import { buildReminderEmail } from "@/lib/email/templates/reminder"
import { paymentLinkFor } from "@/lib/payment-link/server"
import { shareLinkForEmail } from "@/lib/signature/share"
import { buildQuoteFollowupEmail } from "@/lib/email/templates/quote-followup"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { canIssueInvoices } from "@/lib/stripe/access"
import { addDays, daysBetween, todayInParis } from "@/lib/utils/paris-date"
import { settingsFromRow, BEFORE_DUE_CHOICES, type ReminderSettings, type ReminderSettingsRow } from "@/lib/reminders/settings"
import { planInvoiceReminder, planQuoteFollowup } from "@/lib/reminders/schedule"
import {
  SETTINGS_COLUMNS, claimReminderStage, loadReminderLog, releaseReminderStage, reminderLogAvailable,
} from "@/lib/reminders/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Génération des PDF de devis et envoi des emails, un par un
export const maxDuration = 60

/** Statuts d'une facture émise et non réglée (lib/utils/document-status.ts, canRemindInvoice). */
const REMINDABLE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"]

type DbError = { message: string; code?: string }
type Summary = { sent: number; skipped: number; errors: string[] }
const summary = (): Summary => ({ sent: 0, skipped: 0, errors: [] })

interface ClientJoin {
  id?: string
  name?: string | null
  email?: string | null
  siren?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
  vat_number?: string | null
}

/** Une jointure PostgREST arrive en objet ou en tableau selon le schéma. */
function one(join: unknown): ClientJoin | null {
  if (Array.isArray(join)) return (join[0] as ClientJoin) ?? null
  return (join as ClientJoin) ?? null
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Lit toutes les pages d'une requête (PostgREST plafonne à 1 000 lignes par réponse). */
async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>,
): Promise<{ rows: T[]; error: DbError | null }> {
  const size = 1000
  const rows: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) return { rows, error }
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < size) return { rows, error: null }
  }
}

const chunks = <T,>(list: T[], size = 150): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

/* ------------------------------------------------------------------ */
/* Caches par compte : entreprise et formule                            */
/* ------------------------------------------------------------------ */

const COMPANY_FIELDS = "name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email"

interface CompanyInfo {
  name: string | null
  iban: string | null
  accent_color: string | null
  email: string | null
  [key: string]: unknown
}

function accountCaches(admin: SupabaseClient) {
  const companies = new Map<string, CompanyInfo>()
  const plans = new Map<string, boolean>()

  async function company(userId: string): Promise<CompanyInfo> {
    const cached = companies.get(userId)
    if (cached) return cached
    const { data } = await admin.from("companies").select(COMPANY_FIELDS).eq("user_id", userId).maybeSingle()
    const value = (data as CompanyInfo | null) ?? { name: null, iban: null, accent_color: null, email: null }
    companies.set(userId, value)
    return value
  }

  /** Comptes qui ont une formule ; en cas d'erreur de lecture, on s'abstient (la relance repartira). */
  async function loadPlans(userIds: string[]): Promise<void> {
    const missing = userIds.filter((id) => !plans.has(id))
    for (const chunk of chunks(missing)) {
      const { data, error } = await admin.from("subscriptions").select("user_id,status").in("user_id", chunk)
      if (error) {
        console.error("[cron] Lecture des abonnements en échec :", error.message)
        for (const id of chunk) plans.set(id, false)
        continue
      }
      const status = new Map((data ?? []).map((r) => [r.user_id as string, r.status as string]))
      for (const id of chunk) plans.set(id, canIssueInvoices(status.get(id)))
    }
  }

  return { company, loadPlans, hasPlan: (userId: string) => plans.get(userId) === true }
}

/* ------------------------------------------------------------------ */
/* Route                                                                */
/* ------------------------------------------------------------------ */

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
  // Client admin (service role — accès à toutes les factures, bypass RLS)
  const admin = createAdminClient()
  const today = todayInParis()

  const probe = await reminderLogAvailable(admin)
  if (probe.error) {
    console.error("[cron/send-reminders] Journal des relances illisible :", probe.error.message)
    return NextResponse.json({ error: "Journal des relances illisible" }, { status: 500 })
  }

  const results = probe.available
    ? await runWithSettings(admin, today)
    : await runLegacy(admin, today)

  const duration = Date.now() - startedAt
  const hasErrors = Object.values(results).some((r) => typeof r === "object" && r !== null && "errors" in r && (r as Summary).errors.length > 0)

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

/* ------------------------------------------------------------------ */
/* Mode « réglages » : planning par compte et journal des envois        */
/* ------------------------------------------------------------------ */

const INVOICE_FIELDS =
  "id, user_id, invoice_number, status, issue_date, due_date, sent_at, subtotal_ht, total_vat, total_ttc, client:clients(id,name,email,siren)"

const QUOTE_FIELDS =
  "id, user_id, quote_number, status, issue_date, valid_until, sent_at, converted_invoice_id, subtotal_ht, total_vat, total_ttc, notes, lines, client:clients(id,name,email,address,zip_code,city,siren,vat_number)"

interface InvoiceRow {
  id: string
  user_id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  sent_at: string | null
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  client: unknown
}

interface QuoteRow {
  id: string
  user_id: string
  quote_number: string
  status: string
  issue_date: string
  valid_until: string
  sent_at: string | null
  converted_invoice_id: string | null
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  lines: unknown
  client: unknown
}

/** Réglages des comptes ; un compte dont la lecture a échoué est absent (aucune relance ce jour-là). */
async function loadSettings(admin: SupabaseClient, userIds: string[]): Promise<Map<string, ReminderSettings>> {
  const settings = new Map<string, ReminderSettings>()
  for (const chunk of chunks(userIds)) {
    const { data, error } = await admin.from("reminder_settings").select(SETTINGS_COLUMNS).in("user_id", chunk)
    if (error && !isMissingSchemaError(error)) {
      console.error("[cron] Lecture des réglages en échec :", error.message)
      continue
    }
    const rows = new Map(((data ?? []) as (ReminderSettingsRow & { user_id: string })[]).map((r) => [r.user_id, r]))
    for (const id of chunk) settings.set(id, settingsFromRow(rows.get(id) ?? null))
  }
  return settings
}

async function runWithSettings(admin: SupabaseClient, today: string) {
  const accounts = accountCaches(admin)
  const invoices = summary()
  const quotes = summary()

  /* ── Factures émises, non réglées, échues ou bientôt échues ── */
  const horizon = addDays(today, Math.max(...BEFORE_DUE_CHOICES))
  const invRes = await selectAll<InvoiceRow>((from, to) =>
    admin.from("invoices").select(INVOICE_FIELDS)
      .in("status", REMINDABLE_STATUSES)
      .eq("is_archived", false)
      .not("invoice_number", "is", null)
      .lte("due_date", horizon)
      .order("id", { ascending: true })
      .range(from, to),
  )
  if (invRes.error) {
    invoices.errors.push(`Lecture des factures : ${invRes.error.message}`)
  } else if (invRes.rows.length > 0) {
    const userIds = Array.from(new Set(invRes.rows.map((r) => r.user_id)))
    await accounts.loadPlans(userIds)
    const withPlan = userIds.filter(accounts.hasPlan)
    const settings = await loadSettings(admin, withPlan)
    const candidates = invRes.rows.filter((r) => accounts.hasPlan(r.user_id) && settings.has(r.user_id))
    const logRes = await loadReminderLog(admin, "invoice", candidates.map((r) => r.id))

    if (logRes.error) {
      invoices.errors.push(`Lecture du journal : ${logRes.error.message}`)
    } else {
      for (const inv of candidates) {
        const plan = planInvoiceReminder({
          invoice: inv,
          settings: settings.get(inv.user_id)!,
          today,
          log: logRes.log.get(inv.id) ?? [],
        })
        if (!plan) continue

        const client = one(inv.client)
        const clientEmail = client?.email?.trim()
        if (!clientEmail) { invoices.skipped++; continue }

        const claim = await claimReminderStage(admin, {
          user_id: inv.user_id, document_type: "invoice", document_id: inv.id, stage: plan.stage, sent_to: clientEmail,
        })
        if ("taken" in claim) { invoices.skipped++; continue }
        if ("error" in claim) { invoices.errors.push(`${inv.invoice_number}: ${claim.error.message}`); continue }

        try {
          const company = await accounts.company(inv.user_id)
          const companyName = company.name?.trim() || "Votre prestataire"
          const paymentUrl = await paymentLinkFor({ invoiceId: inv.id, userId: inv.user_id, admin })
          const { subject, html } = buildReminderEmail({
            reminderNumber: plan.reminderNumber,
            kind: plan.kind,
            daysLate: plan.daysLate,
            isLast: plan.isLast,
            invoiceNumber: inv.invoice_number,
            issueDate: inv.issue_date,
            dueDate: inv.due_date,
            subtotalHt: inv.subtotal_ht,
            totalVat: inv.total_vat,
            totalTtc: inv.total_ttc,
            companyName,
            companyIban: company.iban,
            accentColor: company.accent_color ?? "#2563EB",
            clientName: client?.name ?? "",
            clientIsProfessional: Boolean(client?.siren?.trim()),
            paymentUrl: paymentUrl ?? undefined,
          })
          await sendEmail({
            to: clientEmail,
            subject,
            html,
            fromName: companyName,
            replyTo: company.email ?? undefined,
            cc: company.email ? [company.email] : [],
            ccSubject: `Copie — Relance — Facture ${inv.invoice_number} pour ${client?.name ?? ""}`,
          })
          invoices.sent++
          console.log(`[cron] Relance ${plan.stage} envoyée : ${inv.invoice_number} → ${clientEmail}`)
        } catch (err) {
          await releaseReminderStage(admin, claim.id)
          invoices.errors.push(`${inv.invoice_number}: ${errorText(err)}`)
          console.error(`[cron] Erreur relance ${inv.invoice_number}:`, err)
        }
      }
    }
  }

  /* ── Devis envoyés sans réponse (comptes qui l'ont activé) ── */
  const setRes = await selectAll<ReminderSettingsRow & { user_id: string }>((from, to) =>
    admin.from("reminder_settings").select(SETTINGS_COLUMNS)
      .eq("quote_followup_enabled", true)
      .order("user_id", { ascending: true })
      .range(from, to),
  )
  if (setRes.error) {
    if (!isMissingSchemaError(setRes.error)) quotes.errors.push(`Lecture des réglages : ${setRes.error.message}`)
  } else if (setRes.rows.length > 0) {
    const quoteSettings = new Map(setRes.rows.map((r) => [r.user_id, settingsFromRow(r)]))
    await accounts.loadPlans(Array.from(quoteSettings.keys()))
    const userIds = Array.from(quoteSettings.keys()).filter(accounts.hasPlan)

    const rows: QuoteRow[] = []
    for (const chunk of chunks(userIds)) {
      const res = await selectAll<QuoteRow>((from, to) =>
        admin.from("quotes").select(QUOTE_FIELDS)
          .in("user_id", chunk)
          .eq("status", "sent")
          .is("converted_invoice_id", null)
          .gte("valid_until", today)
          .order("id", { ascending: true })
          .range(from, to),
      )
      if (res.error) quotes.errors.push(`Lecture des devis : ${res.error.message}`)
      rows.push(...res.rows)
    }

    const logRes = await loadReminderLog(admin, "quote", rows.map((q) => q.id))
    if (logRes.error) {
      quotes.errors.push(`Lecture du journal : ${logRes.error.message}`)
    } else {
      for (const q of rows) {
        const plan = planQuoteFollowup({
          quote: q, settings: quoteSettings.get(q.user_id)!, today, log: logRes.log.get(q.id) ?? [],
        })
        if (!plan) continue

        const client = one(q.client)
        const clientEmail = client?.email?.trim()
        if (!clientEmail) { quotes.skipped++; continue }

        const claim = await claimReminderStage(admin, {
          user_id: q.user_id, document_type: "quote", document_id: q.id, stage: plan.stage, sent_to: clientEmail,
        })
        if ("taken" in claim) { quotes.skipped++; continue }
        if ("error" in claim) { quotes.errors.push(`${q.quote_number}: ${claim.error.message}`); continue }

        try {
          const company = await accounts.company(q.user_id)
          const companyName = company.name?.trim() || "Votre prestataire"

          // Le devis joint, comme à l'envoi ; sans PDF, la relance part quand même
          let attachments: EmailAttachment[] = []
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdf = await generateQuotePdf({ quote: { ...q, client } as any, company: company as any })
            attachments = [{ filename: `${q.quote_number}.pdf`, content: Buffer.from(pdf) }]
          } catch (err) {
            console.error(`[cron] PDF du devis ${q.quote_number} non généré :`, err)
          }

          // Lien de signature (formule active, réglage activé) ou de consultation ;
          // null tant que la migration de la signature n'est pas appliquée
          const share = await shareLinkForEmail(admin, q.user_id, "quote", q.id)

          const { subject, html } = buildQuoteFollowupEmail({
            quoteNumber: q.quote_number,
            issueDate: q.issue_date,
            validUntil: q.valid_until,
            sentDate: plan.sentDay,
            subtotalHt: q.subtotal_ht,
            totalVat: q.total_vat,
            totalTtc: q.total_ttc,
            companyName,
            accentColor: company.accent_color ?? "#2563EB",
            clientName: client?.name ?? "",
            followupNumber: plan.followupNumber,
            hasAttachment: attachments.length > 0,
            quoteUrl: share?.url,
            quoteLinkMode: share?.mode,
          })
          await sendEmail({
            to: clientEmail,
            subject,
            html,
            fromName: companyName,
            replyTo: company.email ?? undefined,
            cc: company.email ? [company.email] : [],
            ccSubject: `Copie — Relance — Devis ${q.quote_number} pour ${client?.name ?? ""}`,
            attachments,
          })
          quotes.sent++
          console.log(`[cron] Relance ${plan.stage} envoyée : ${q.quote_number} → ${clientEmail}`)
        } catch (err) {
          await releaseReminderStage(admin, claim.id)
          quotes.errors.push(`${q.quote_number}: ${errorText(err)}`)
          console.error(`[cron] Erreur relance ${q.quote_number}:`, err)
        }
      }
    }
  }

  return { mode: "settings", invoices, quotes }
}

/* ------------------------------------------------------------------ */
/* Mode « historique » : J+30 et J+45, avant la migration               */
/* ------------------------------------------------------------------ */

async function runLegacy(admin: SupabaseClient, today: string) {
  const accounts = accountCaches(admin)
  const results = { reminder_1: summary(), reminder_2: summary() }

  const base = () =>
    admin.from("invoices")
      .select("*, client:clients(id,name,email,siren)")
      .in("status", REMINDABLE_STATUSES)
      .eq("is_archived", false)
      .not("invoice_number", "is", null)

  // Relance 1 (J+30) : échue depuis 30 jours au moins, pas encore relancée
  const { data: r1Invoices, error: r1Err } = await base()
    .lte("due_date", addDays(today, -30))
    .is("reminder_1_sent_at", null)
  // Relance 2 (J+45) : échue depuis 45 jours au moins, relance 1 déjà partie
  const { data: r2Invoices, error: r2Err } = await base()
    .lte("due_date", addDays(today, -45))
    .not("reminder_1_sent_at", "is", null)
    .is("reminder_2_sent_at", null)

  if (r1Err) results.reminder_1.errors.push(`Lecture : ${r1Err.message}`)
  if (r2Err) results.reminder_2.errors.push(`Lecture : ${r2Err.message}`)

  await accounts.loadPlans(Array.from(new Set([...(r1Invoices ?? []), ...(r2Invoices ?? [])].map((i) => i.user_id as string))))

  for (const [n, list] of [[1, r1Invoices], [2, r2Invoices]] as const) {
    const res = n === 1 ? results.reminder_1 : results.reminder_2
    for (const invoice of list ?? []) {
      const client = one(invoice.client)
      const clientEmail = client?.email?.trim()
      if (!clientEmail) { res.skipped++; continue }
      if (!accounts.hasPlan(invoice.user_id)) { res.skipped++; continue }

      try {
        const company     = await accounts.company(invoice.user_id)
        const companyName = company.name?.trim() || "Votre prestataire"
        const paymentUrl  = await paymentLinkFor({ invoiceId: invoice.id, userId: invoice.user_id, admin })

        const { subject, html } = buildReminderEmail({
          reminderNumber: n,
          kind: "after_due",
          daysLate: Math.max(0, daysBetween(String(invoice.due_date).slice(0, 10), today)),
          isLast: n === 2,
          invoiceNumber:  invoice.invoice_number,
          issueDate:      invoice.issue_date,
          dueDate:        invoice.due_date,
          subtotalHt:     invoice.subtotal_ht,
          totalVat:       invoice.total_vat,
          totalTtc:       invoice.total_ttc,
          companyName,
          companyIban:    company.iban,
          accentColor:    company.accent_color ?? "#2563EB",
          clientName:     client?.name ?? "",
          clientIsProfessional: Boolean(client?.siren?.trim()),
          paymentUrl: paymentUrl ?? undefined,
        })

        await sendEmail({
          to:       clientEmail,
          subject,
          html,
          fromName: companyName,
          replyTo:  company.email ?? undefined,
          cc:       company.email ? [company.email] : [],
          ccSubject: `Copie — Relance ${n} — Facture ${invoice.invoice_number} pour ${client?.name ?? ""}`,
        })

        // Le statut ne change plus : seule la date de la relance est notée
        await admin
          .from("invoices")
          .update(n === 1 ? { reminder_1_sent_at: new Date().toISOString() } : { reminder_2_sent_at: new Date().toISOString() })
          .eq("id", invoice.id)

        res.sent++
        console.log(`[cron] R${n} envoyée : ${invoice.invoice_number} → ${clientEmail}`)
      } catch (err) {
        res.errors.push(`${invoice.invoice_number}: ${errorText(err)}`)
        console.error(`[cron] Erreur R${n} ${invoice.invoice_number}:`, err)
      }
    }
  }

  return { mode: "legacy", ...results }
}
