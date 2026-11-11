/**
 * Formules offertes par l'admin (testeurs) et comptes créés depuis l'admin.
 *
 * Une formule offerte = ligne `subscriptions` active, sans abonnement Stripe,
 * `granted_by_admin` (migration 20261111_admin_granted_subscriptions.sql). Elle
 * ouvre les mêmes droits qu'une formule payée (`canIssueInvoices` lit le statut).
 * Jamais posée sur un compte qui a un abonnement Stripe en cours : celui-là
 * change de formule par `PATCH /api/admin/users/[id]/plan` (Stripe et base).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export type GrantPlan = "starter" | "pro"
export type GrantPeriod = "monthly" | "yearly"
/** Durée de la formule offerte, en mois ; null : sans limite. */
export type GrantDuration = 1 | 3 | 6 | 12 | null

export const GRANT_DURATIONS: { value: GrantDuration; label: string }[] = [
  { value: null, label: "Sans limite" },
  { value: 1, label: "1 mois" },
  { value: 3, label: "3 mois" },
  { value: 6, label: "6 mois" },
  { value: 12, label: "1 an" },
]

export const GRANT_MIGRATION_MISSING =
  "La migration 20261111_admin_granted_subscriptions.sql n'est pas appliquée : appliquez-la dans Supabase, puis réessayez."

export type GrantResult = { ok: true; until: string | null } | { ok: false; status: number; error: string }

export interface GrantInput {
  plan: GrantPlan
  period: GrantPeriod
  months: GrantDuration
  note?: string | null
}

/** Lit et contrôle le corps d'une demande (création de compte ou formule offerte). */
export function parseGrantInput(raw: unknown): GrantInput | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  if (b.plan !== "starter" && b.plan !== "pro") return { error: "Formule invalide." }
  const period: GrantPeriod = b.period === "yearly" ? "yearly" : "monthly"
  const months = b.months === null || b.months === undefined || b.months === "" ? null : Number(b.months)
  if (months !== null && ![1, 3, 6, 12].includes(months)) return { error: "Durée invalide." }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null
  return { plan: b.plan, period, months: months as GrantDuration, note }
}

/** Fin de la formule offerte : même jour, `months` mois plus tard. */
export function grantUntil(months: GrantDuration, now: Date = new Date()): string | null {
  if (months === null) return null
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString()
}

/** Ligne d'abonnement offerte (lue par la fiche admin et la page Abonnement). */
export function isGranted(sub: { granted_by_admin?: boolean | null; stripe_subscription_id?: string | null } | null | undefined): boolean {
  return !!sub?.granted_by_admin && !sub?.stripe_subscription_id
}

/** Un abonnement Stripe en cours empêche d'offrir une formule par-dessus. */
export function hasLiveStripeSubscription(sub: { status?: string | null; stripe_subscription_id?: string | null } | null | undefined): boolean {
  return !!sub?.stripe_subscription_id && (sub.status === "active" || sub.status === "past_due")
}

/** Offre (ou remplace) la formule d'un compte sans abonnement Stripe en cours. */
export async function grantPlan(db: SupabaseClient, userId: string, input: GrantInput, now: Date = new Date()): Promise<GrantResult> {
  const { data: current, error: readError } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (readError) {
    console.error("[admin/grant] Lecture de l'abonnement impossible:", readError)
    return { ok: false, status: 503, error: "Lecture de l'abonnement impossible. Réessayez." }
  }
  if (current && !("granted_by_admin" in current)) return { ok: false, status: 409, error: GRANT_MIGRATION_MISSING }
  if (hasLiveStripeSubscription(current)) {
    return {
      ok: false,
      status: 409,
      error: "Ce compte a un abonnement payant en cours : changez sa formule avec « Passer en … », pas en l'offrant.",
    }
  }

  const until = grantUntil(input.months, now)
  const row = {
    user_id: userId,
    plan: input.plan,
    billing_period: input.period,
    status: "active",
    current_period_end: until,
    canceled_at: null,
    // L'ancien abonnement Stripe terminé reste dans Stripe ; la ligne devient offerte
    stripe_subscription_id: null,
    stripe_price_id: null,
    granted_by_admin: true,
    granted_note: input.note ?? null,
    granted_at: now.toISOString(),
  }
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "user_id" })
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, status: 409, error: GRANT_MIGRATION_MISSING }
    console.error("[admin/grant] Écriture impossible:", error)
    return { ok: false, status: 500, error: "La formule n'a pas pu être enregistrée. Réessayez." }
  }
  return { ok: true, until }
}

/**
 * Formules offertes arrivées à échéance : passées en « canceled ».
 * Appelée par /api/cron/onboarding ; ne lève jamais (migration absente : rien).
 */
export async function expireGrantedPlans(db: SupabaseClient, now: Date = new Date()): Promise<number> {
  try {
    const { data, error } = await db
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now.toISOString() })
      .eq("granted_by_admin", true)
      .is("stripe_subscription_id", null)
      .eq("status", "active")
      .lt("current_period_end", now.toISOString())
      .select("user_id")
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[admin/grant] Échéance des formules offertes impossible:", error)
      return 0
    }
    return data?.length ?? 0
  } catch (err) {
    console.error("[admin/grant] Échéance des formules offertes impossible:", err)
    return 0
  }
}

export const PASSWORD_MIN = 8

export interface NewUserInput {
  email: string
  password: string
  firstName: string | null
  grant: GrantInput | null
  testAccount: boolean
}

export function parseNewUser(raw: unknown): NewUserInput | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Adresse email invalide." }
  const password = typeof b.password === "string" ? b.password : ""
  if (password.length < PASSWORD_MIN) return { error: `Mot de passe trop court (${PASSWORD_MIN} caractères au moins).` }
  if (password.length > 72) return { error: "Mot de passe trop long (72 caractères au plus)." }
  const firstName = typeof b.firstName === "string" ? b.firstName.trim().slice(0, 80) || null : null
  let grant: GrantInput | null = null
  if (b.plan === "starter" || b.plan === "pro") {
    const g = parseGrantInput(b)
    if ("error" in g) return g
    grant = g
  } else if (b.plan !== undefined && b.plan !== null && b.plan !== "" && b.plan !== "none") {
    return { error: "Formule invalide." }
  }
  return { email, password, firstName, grant, testAccount: b.testAccount === true }
}
