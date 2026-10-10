/**
 * Tâches quotidiennes de la signature en ligne, lancées par le cron des
 * relances (app/api/cron/send-reminders) :
 *
 * 1. Relance avant expiration (DECISIONS § 11, « Actions » et « Réglages ») :
 *    un email au client quelques jours avant l'expiration d'un lien de
 *    signature encore sans réponse. Une seule par lien, réservée en base
 *    (`expiry_reminder_sent_at`) AVANT l'envoi : deux passages du cron
 *    n'envoient jamais deux fois ; si l'email échoue, la réservation est
 *    libérée et la relance repartira au passage suivant.
 * 2. Demande d'acompte différée : signé sur place chez un particulier, aucun
 *    paiement avant 7 jours (C. consom. art. L221-10) ; les coordonnées du
 *    virement partent à J+8, même réservation avant envoi
 *    (`deposit_requested_at`).
 *
 * Migration 20261010_signature_withdrawal_deposit_reminder.sql absente :
 * `available: false`, rien n'est envoyé.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { buildDepositRequestEmail, buildSignatureExpiryReminderEmail } from "@/lib/email/templates/signature"
import { MIN_GAP_DAYS } from "@/lib/reminders/schedule"
import { loadReminderLog } from "@/lib/reminders/store"
import { canIssueInvoices } from "@/lib/stripe/access"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { decryptToken, tokenMatches } from "@/lib/signature/crypto"
import { depositOfRow, publicDeposit, type BankDetails } from "@/lib/signature/deposit"
import { publicState } from "@/lib/signature/public"
import { maskEmail, parisDay, planExpiryReminder } from "@/lib/signature/rules"
import {
  linkUrl, loadBankDetails, loadCompany, loadDocument, ownerEmail, recordEvent, type CompanyInfo,
} from "@/lib/signature/server"
import { SETTINGS_BASE_COLUMNS, SETTINGS_EXTRA_COLUMNS, settingsFromRow } from "@/lib/signature/settings"
import type { SignatureRow, SignatureSettings } from "@/lib/signature/types"
import { daysBetween } from "@/lib/utils/paris-date"

type Summary = { sent: number; skipped: number; errors: string[] }
const summary = (): Summary => ({ sent: 0, skipped: 0, errors: [] })
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Liens lus par passage : bien au-delà du volume attendu, sans risquer le délai de la fonction. */
const BATCH = 300

export interface SignatureJobsResult {
  available: boolean
  expiry: Summary
  deposits: Summary
}

function caches(admin: SupabaseClient) {
  const companies = new Map<string, CompanyInfo | null>()
  const banks = new Map<string, BankDetails | null>()
  return {
    async company(userId: string) {
      if (!companies.has(userId)) companies.set(userId, await loadCompany(admin, userId))
      return companies.get(userId) ?? null
    },
    async bank(userId: string) {
      if (!banks.has(userId)) banks.set(userId, await loadBankDetails(admin, userId))
      return banks.get(userId) ?? null
    },
  }
}

/** Réglages des comptes (valeurs par défaut sans ligne). Un compte illisible est absent : rien ne part pour lui. */
async function loadSettings(admin: SupabaseClient, userIds: string[]): Promise<Map<string, SignatureSettings>> {
  const out = new Map<string, SignatureSettings>()
  for (let i = 0; i < userIds.length; i += 150) {
    const chunk = userIds.slice(i, i + 150)
    const { data, error } = await admin
      .from("signature_settings")
      .select(`user_id,${SETTINGS_BASE_COLUMNS},${SETTINGS_EXTRA_COLUMNS}`)
      .in("user_id", chunk)
    if (error) {
      console.error("[signature/jobs] réglages illisibles :", error.message)
      continue
    }
    const rows = new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [String(r.user_id), r]))
    for (const id of chunk) out.set(id, settingsFromRow(rows.get(id) ?? null))
  }
  return out
}

/** Comptes avec une formule (la signature en ligne en fait partie). En cas d'erreur de lecture : aucun. */
async function loadPlans(admin: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < userIds.length; i += 150) {
    const chunk = userIds.slice(i, i + 150)
    const { data, error } = await admin.from("subscriptions").select("user_id,status").in("user_id", chunk)
    if (error) {
      console.error("[signature/jobs] abonnements illisibles :", error.message)
      continue
    }
    for (const r of data ?? []) if (canIssueInvoices(r.status as string)) out.add(String(r.user_id))
  }
  return out
}

export async function runSignatureJobs(admin: SupabaseClient, now: Date = new Date()): Promise<SignatureJobsResult> {
  const expiry = summary()
  const deposits = summary()
  const cache = caches(admin)
  const nowIso = now.toISOString()
  const today = parisDay(now)

  /* ── 1. Relance avant expiration ── */
  const horizon = new Date(now.getTime() + 31 * 86_400_000).toISOString()
  const pending = await admin
    .from("document_signatures")
    .select("*")
    .eq("status", "pending")
    .eq("mode", "sign")
    .is("expiry_reminder_sent_at", null)
    .not("sent_at", "is", null)
    .gt("expires_at", nowIso)
    .lte("expires_at", horizon)
    .order("expires_at", { ascending: true })
    .limit(BATCH)
  if (pending.error) {
    if (isMissingSchemaError(pending.error)) return { available: false, expiry, deposits }
    expiry.errors.push(`lecture : ${pending.error.message}`)
  }
  const links = (pending.data ?? []) as SignatureRow[]
  const users = Array.from(new Set(links.map((l) => l.user_id)))
  const [settings, plans] = await Promise.all([loadSettings(admin, users), loadPlans(admin, users)])

  // Une relance de devis (lib/reminders) envoyée il y a moins de MIN_GAP_DAYS jours suffit pour l'instant
  const quoteIds = links.filter((l) => l.document_type === "quote").map((l) => l.document_id)
  const followups = quoteIds.length ? await loadReminderLog(admin, "quote", quoteIds) : null

  for (const row of links) {
    const label = row.document_number
    try {
      const s = settings.get(row.user_id)
      if (!s || !plans.has(row.user_id)) { expiry.skipped++; continue }
      const plan = planExpiryReminder(row, s, now)
      if (!plan) { expiry.skipped++; continue }
      const recent = (followups?.log.get(row.document_id) ?? []).some((e) => daysBetween(parisDay(new Date(e.sent_at)), today) < MIN_GAP_DAYS)
      if (recent) { expiry.skipped++; continue }

      const doc = await loadDocument(admin, row.document_type, row.document_id, row.user_id)
      if (publicState(row, doc, now) !== "sign" || !doc) { expiry.skipped++; continue }
      const token = decryptToken(row.token_ciphertext)
      if (!token || !tokenMatches(token, row.token_hash)) { expiry.skipped++; continue }
      const to = row.sent_to?.trim() || doc.client?.email?.trim()
      if (!to) { expiry.skipped++; continue }

      // Réservation avant l'envoi
      const { data: claimed } = await admin.from("document_signatures")
        .update({ expiry_reminder_sent_at: nowIso })
        .eq("id", row.id).eq("status", "pending").is("expiry_reminder_sent_at", null)
        .select("id")
      if (!claimed || claimed.length === 0) { expiry.skipped++; continue }

      const company = await cache.company(row.user_id)
      const companyName = company?.name?.trim() || "L'entreprise"
      const { subject, html } = buildSignatureExpiryReminderEmail({
        docType: row.document_type, docNumber: row.document_number, companyName, accentColor: company?.accent_color ?? "#2563EB",
        totalTtc: doc.total_ttc, expiresAt: row.expires_at, daysLeft: plan.daysLeft, url: linkUrl(token),
      })
      try {
        const replyTo = company?.email?.trim() || (await ownerEmail(admin, row.user_id, company)) || undefined
        await sendEmail({ to, subject, html, fromName: companyName, replyTo })
      } catch (err) {
        await admin.from("document_signatures").update({ expiry_reminder_sent_at: null }).eq("id", row.id)
        await recordEvent(admin, row, "email_failed", {}, { what: "expiry_reminder" })
        expiry.errors.push(`${label}: ${errorText(err)}`)
        continue
      }
      await recordEvent(admin, row, "expiry_reminder_sent", {}, { to: maskEmail(to), days_left: plan.daysLeft })
      expiry.sent++
    } catch (err) {
      expiry.errors.push(`${label}: ${errorText(err)}`)
    }
  }

  /* ── 2. Demandes d'acompte différées (J+8) ── */
  const due = await admin
    .from("document_signatures")
    .select("*")
    .eq("status", "signed")
    .is("deposit_requested_at", null)
    .not("deposit_request_on", "is", null)
    .lte("deposit_request_on", today)
    .limit(BATCH)
  if (due.error) {
    if (isMissingSchemaError(due.error)) return { available: false, expiry, deposits }
    deposits.errors.push(`lecture : ${due.error.message}`)
  }
  for (const row of (due.data ?? []) as SignatureRow[]) {
    const label = row.document_number
    try {
      const bank = await cache.bank(row.user_id)
      const deposit = publicDeposit(depositOfRow(row), bank, today)
      // IBAN retiré depuis la signature : rien à envoyer, l'artisan voit l'acompte non demandé sur la fiche
      if (!deposit?.account || !row.signer_email) { deposits.skipped++; continue }

      const { data: claimed } = await admin.from("document_signatures")
        .update({ deposit_requested_at: nowIso })
        .eq("id", row.id).eq("status", "signed").is("deposit_requested_at", null)
        .select("id")
      if (!claimed || claimed.length === 0) { deposits.skipped++; continue }

      const company = await cache.company(row.user_id)
      const companyName = company?.name?.trim() || "L'entreprise"
      const { subject, html } = buildDepositRequestEmail({
        docType: row.document_type, docNumber: row.document_number, companyName, accentColor: company?.accent_color ?? "#2563EB",
        name: row.signer_name, signedAt: new Date(row.signed_at ?? nowIso), deposit,
      })
      try {
        const replyTo = company?.email?.trim() || (await ownerEmail(admin, row.user_id, company)) || undefined
        await sendEmail({ to: row.signer_email, subject, html, fromName: companyName, replyTo })
      } catch (err) {
        await admin.from("document_signatures").update({ deposit_requested_at: null }).eq("id", row.id)
        await recordEvent(admin, row, "email_failed", {}, { what: "deposit_request" })
        deposits.errors.push(`${label}: ${errorText(err)}`)
        continue
      }
      await recordEvent(admin, row, "deposit_requested", {}, { amount: deposit.amount, deferred: true })
      deposits.sent++
    } catch (err) {
      deposits.errors.push(`${label}: ${errorText(err)}`)
    }
  }

  return { available: true, expiry, deposits }
}
