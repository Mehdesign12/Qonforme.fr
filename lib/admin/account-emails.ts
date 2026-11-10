/**
 * Emails d'un compte vus et envoyés depuis l'admin (Admin › Utilisateurs) :
 * historique, modèle conseillé selon le blocage, préparation et envoi à la main.
 * Côté serveur seulement (clé service_role).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { sendEmail } from "@/lib/email/resend"
import { sendAccountEmail } from "@/lib/email/journal"
import { adminNotifyAddress } from "@/lib/email/admin-notify"
import { buildAccountEmail, type ManualTemplate } from "@/lib/email/templates/reprise"
import { loadRepriseFacts, type RepriseFacts } from "@/lib/onboarding/reprise-facts"
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/onboarding/unsubscribe"
import { SEQUENCE_MIN_GAP_HOURS } from "@/lib/onboarding/sequence"

export interface AccountEmailRow {
  id: string
  category: string
  template: string
  subject: string
  sent_to: string
  status: string
  error: string | null
  sent_by: string | null
  sent_at: string
  delivered_at: string | null
  bounced_at: string | null
  opened_at: string | null
  first_clicked_at: string | null
  click_count: number
}

const ROW_COLUMNS =
  "id,category,template,subject,sent_to,status,error,sent_by,sent_at,delivered_at,bounced_at,opened_at,first_clicked_at,click_count"

export type EmailHistory =
  | { kind: "ok"; rows: AccountEmailRow[] }
  /** Migration 20261110_account_emails.sql pas encore appliquée. */
  | { kind: "unavailable" }
  | { kind: "error" }

export async function loadEmailHistory(admin: SupabaseClient, userId: string, limit = 50): Promise<EmailHistory> {
  const { data, error } = await admin
    .from("account_emails")
    .select(ROW_COLUMNS)
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(limit)
  if (error) return isMissingSchemaError(error) ? { kind: "unavailable" } : { kind: "error" }
  return { kind: "ok", rows: (data ?? []) as AccountEmailRow[] }
}

/** Dernier email de chaque compte (liste des utilisateurs). null : lecture impossible. */
export async function loadLastEmails(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AccountEmailRow> | null> {
  const last = new Map<string, AccountEmailRow>()
  if (userIds.length === 0) return last
  const { data, error } = await admin
    .from("account_emails")
    .select(`user_id,${ROW_COLUMNS}`)
    .in("user_id", userIds)
    .order("sent_at", { ascending: false })
    .limit(2000)
  if (error) return isMissingSchemaError(error) ? last : null
  for (const row of (data ?? []) as (AccountEmailRow & { user_id: string })[]) {
    if (!last.has(row.user_id)) last.set(row.user_id, row)
  }
  return last
}

/** Modèle conseillé pour un envoi à la main, selon l'étape où le compte s'est arrêté. */
export function suggestedTemplate(f: Pick<RepriseFacts, "hasSiren" | "oldestDraftQuote" | "quotesSent">, quotes: number): ManualTemplate {
  if (!f.hasSiren) return "manual_company"
  if (f.oldestDraftQuote && f.quotesSent === 0) return "manual_quote_send"
  if (quotes === 0) return "manual_first_quote"
  return "manual_free"
}

export interface ManualEmailInput {
  template: ManualTemplate
  note?: string | null
  freeSubject?: string | null
  freeBody?: string | null
}

export interface AccountContext {
  userId: string
  email: string
  firstName: string
  signupDate: string
  hasSignupDraft: boolean
  facts: RepriseFacts
  quotes: number
  optedOut: boolean
}

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })

/** Tout ce qu'il faut pour préparer un email à la main. `null` : compte introuvable. */
export async function loadAccountContext(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ctx: AccountContext } | { missing: true } | { error: string }> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) {
    const status = (error as { status?: number }).status
    return status === 404 || status === 400 ? { missing: true } : { error: error.message }
  }
  const user = data?.user
  if (!user?.email) return { missing: true }

  const [reprise, prefs, quotes] = await Promise.all([
    loadRepriseFacts(admin, [userId]),
    admin.from("email_preferences").select("onboarding_emails").eq("user_id", userId).maybeSingle(),
    admin.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ])
  if (reprise.error) return { error: reprise.error.message }
  if (prefs.error && !isMissingSchemaError(prefs.error)) return { error: prefs.error.message }
  if (quotes.error) return { error: quotes.error.message }

  const meta = (user.user_metadata ?? {}) as { first_name?: unknown; signup_draft?: unknown }
  return {
    ctx: {
      userId,
      email: user.email,
      firstName: typeof meta.first_name === "string" ? meta.first_name.trim() : "",
      signupDate: LONG_DATE.format(new Date(user.created_at)),
      hasSignupDraft: !!meta.signup_draft && typeof meta.signup_draft === "object",
      facts: reprise.facts.get(userId)!,
      quotes: quotes.count ?? 0,
      optedOut: (prefs.data as { onboarding_emails?: boolean } | null)?.onboarding_emails === false,
    },
  }
}

export function buildManualEmail(ctx: AccountContext, input: ManualEmailInput) {
  return buildAccountEmail(input.template, {
    firstName: ctx.firstName,
    signupDate: ctx.signupDate,
    unsubscribeUrl: unsubscribePageUrl(ctx.userId),
    draftQuote: ctx.facts.oldestDraftQuote,
    hasSignupDraft: ctx.hasSignupDraft,
    note: input.note,
    freeSubject: input.freeSubject,
    freeBody: input.freeBody,
  })
}

/** Raison de refuser l'envoi à la main, ou null. */
export function manualSendBlocker(ctx: AccountContext, input: ManualEmailInput, now = new Date()): string | null {
  if (ctx.optedOut) return "Ce compte s'est désinscrit des conseils : aucun email ne lui est envoyé."
  if (input.template === "manual_quote_send" && !ctx.facts.oldestDraftQuote) return "Ce compte n'a pas de devis en brouillon."
  if (input.template === "manual_free" && (!input.freeSubject?.trim() || !input.freeBody?.trim())) return "Écrivez un objet et un texte."
  const last = ctx.facts.lastEmailAt
  if (last && now.getTime() - new Date(last).getTime() < SEQUENCE_MIN_GAP_HOURS * 3_600_000) {
    return `Ce compte a reçu un email il y a moins de ${SEQUENCE_MIN_GAP_HOURS} heures : attendez avant d'en envoyer un autre.`
  }
  return null
}

export async function sendManualEmail(admin: SupabaseClient, ctx: AccountContext, input: ManualEmailInput, sentBy: string | null) {
  const { subject, html } = buildManualEmail(ctx, input)
  const headers = listUnsubscribeHeaders(ctx.userId) ?? undefined
  return sendAccountEmail(admin, { userId: ctx.userId, category: "manual", template: input.template, to: ctx.email, subject, html, headers, sentBy })
}

/** Essai envoyé à l'adresse du fondateur, jamais au journal du compte. */
export async function sendTestEmail(ctx: AccountContext, input: ManualEmailInput): Promise<{ to: string } | { error: string }> {
  const to = adminNotifyAddress()
  if (!to) return { error: "Aucune adresse d'admin (ADMIN_NOTIFY_EMAIL ou ADMIN_EMAIL) pour recevoir l'essai." }
  const { subject, html } = buildManualEmail(ctx, input)
  try {
    await sendEmail({ to, subject: `[Essai pour ${ctx.email}] ${subject}`, html, fromName: "Qonforme" })
    return { to }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
