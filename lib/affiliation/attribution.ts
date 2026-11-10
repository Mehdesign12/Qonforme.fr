/**
 * Attribution d'une visite, d'une inscription et d'un paiement à un partenaire.
 *
 * Visite : /api/affiliation/visit (appelée par RefTracker quand l'adresse porte
 * `?ref=code`) compte la visite et pose le cookie `q_ref` (90 jours, dernier lien
 * suivi). Inscription : /api/auth/signup et le retour de Google lisent ce cookie
 * et rattachent le compte. Paiement : le webhook Stripe (`invoice.paid`) écrit la
 * commission ; un remboursement l'annule.
 *
 * Aucune de ces fonctions ne lève : une panne ici ne doit jamais empêcher une
 * inscription, une connexion ni l'activation d'une formule. Sans la migration
 * 20261110_affiliation.sql, elles ne font rien.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { commissionCents, isValidCode, parseRefCookie, withinCommissionWindow } from "@/lib/affiliation/model"

type Db = SupabaseClient

function warn(where: string, error: { code?: string | null; message?: string | null } | null | undefined | unknown) {
  const e = error as { code?: string; message?: string } | null
  if (e && "code" in (e as object) && isMissingSchemaError(e)) return
  console.error(`[affiliation] ${where} :`, e?.message ?? e)
}

/** Partenaire actif d'un code, null sinon. */
export async function activePartnerByCode(db: Db, code: string): Promise<{ id: string; code: string } | null> {
  if (!isValidCode(code)) return null
  const { data, error } = await db.from("affiliate_partners").select("id, code, status").eq("code", code).maybeSingle()
  if (error) {
    warn("lecture du code", error)
    return null
  }
  if (!data || data.status !== "active") return null
  return { id: data.id as string, code: data.code as string }
}

/** Plafond de visites comptées par partenaire et par heure (protège les chiffres d'un envoi en boucle). */
export const VISITS_PER_HOUR_CAP = 2000

export async function recordVisit(db: Db, partnerId: string, path: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count, error: countError } = await db
      .from("affiliate_visits")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .gte("created_at", since)
    if (countError) {
      warn("compte des visites", countError)
      return false
    }
    if ((count ?? 0) >= VISITS_PER_HOUR_CAP) return false
    const { error } = await db.from("affiliate_visits").insert({ partner_id: partnerId, path })
    if (error) {
      warn("visite", error)
      return false
    }
    return true
  } catch (err) {
    warn("visite", err)
    return false
  }
}

/** Lit le cookie `q_ref` et rattache un compte qui vient d'être créé. Rend vrai si le compte est rattaché. */
export async function attributeSignup(
  db: Db,
  input: { userId: string; cookie: string | null | undefined; method: "email" | "google"; landingPath?: string | null },
): Promise<boolean> {
  try {
    const ref = parseRefCookie(input.cookie)
    if (!ref) return false
    const partner = await activePartnerByCode(db, ref.code)
    if (!partner) return false
    const { error } = await db.from("affiliate_referrals").upsert(
      { user_id: input.userId, partner_id: partner.id, code: partner.code, method: input.method, landing_path: input.landingPath ?? null },
      { onConflict: "user_id", ignoreDuplicates: true },
    )
    if (error) {
      warn("inscription", error)
      return false
    }
    return true
  } catch (err) {
    warn("inscription", err)
    return false
  }
}

export interface PaidInvoice {
  stripeInvoiceId: string
  userId: string
  livemode: boolean
  amountPaidCents: number
  paidAt: Date
  plan: string | null
  billingPeriod: string | null
}

/**
 * Commission d'une facture Stripe payée, si le compte a été amené par un
 * partenaire et que le paiement tombe dans la durée prévue. Idempotent (une
 * ligne par facture). Rend le montant de la commission en centimes, 0 sinon.
 */
export async function recordInvoiceCommission(db: Db, invoice: PaidInvoice): Promise<number> {
  try {
    if (!(invoice.amountPaidCents > 0)) return 0
    const { data: ref, error: refError } = await db
      .from("affiliate_referrals")
      .select("partner_id, signed_up_at")
      .eq("user_id", invoice.userId)
      .maybeSingle()
    if (refError) {
      warn("lecture du rattachement", refError)
      return 0
    }
    if (!ref) return 0
    const { data: partner, error: pError } = await db
      .from("affiliate_partners")
      .select("id, commission_rate, commission_months")
      .eq("id", ref.partner_id)
      .maybeSingle()
    if (pError || !partner) {
      if (pError) warn("lecture du partenaire", pError)
      return 0
    }
    const rate = Number(partner.commission_rate)
    const months = Number(partner.commission_months)
    if (!withinCommissionWindow(new Date(ref.signed_up_at as string), invoice.paidAt, months)) return 0
    const cents = commissionCents(invoice.amountPaidCents, rate)
    const { error } = await db.from("affiliate_commissions").upsert(
      {
        partner_id: partner.id,
        user_id: invoice.userId,
        stripe_invoice_id: invoice.stripeInvoiceId,
        livemode: invoice.livemode,
        plan: invoice.plan,
        billing_period: invoice.billingPeriod,
        amount_paid_cents: invoice.amountPaidCents,
        rate,
        commission_cents: cents,
        paid_at: invoice.paidAt.toISOString(),
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
    )
    if (error) {
      warn("commission", error)
      return 0
    }
    return cents
  } catch (err) {
    warn("commission", err)
    return 0
  }
}

/** Remboursement d'une facture (avoir Stripe) : sa commission est annulée, sauf si elle a déjà été versée. */
export async function voidInvoiceCommission(db: Db, stripeInvoiceId: string): Promise<void> {
  try {
    const { error } = await db
      .from("affiliate_commissions")
      .update({ state: "void", voided_at: new Date().toISOString() })
      .eq("stripe_invoice_id", stripeInvoiceId)
      .eq("state", "earned")
    if (error) warn("annulation", error)
  } catch (err) {
    warn("annulation", err)
  }
}

/** Garantie de 30 jours appliquée : toutes les commissions non versées du compte sont annulées. */
export async function voidUserCommissions(db: Db, userId: string): Promise<void> {
  try {
    const { error } = await db
      .from("affiliate_commissions")
      .update({ state: "void", voided_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("state", "earned")
    if (error) warn("annulation (garantie)", error)
  } catch (err) {
    warn("annulation (garantie)", err)
  }
}
