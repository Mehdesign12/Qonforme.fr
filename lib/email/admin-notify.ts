/**
 * Emails au fondateur : nouvel inscrit, nouvel abonnement.
 *
 * Adresse : ADMIN_NOTIFY_EMAIL, sinon ADMIN_EMAIL (déjà utilisée par l'admin et le résumé SEO).
 * Sans adresse valide, ou sans clé Resend, rien ne part et rien n'échoue.
 *
 * **Ne lève jamais** : une panne d'envoi ne doit jamais ralentir ni casser une inscription
 * ou une activation de formule. Aucun email n'est envoyé pour les clients ici.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { SITE_ORIGIN } from "@/lib/seo/site"
import { buildNewSignupNotice, buildNewSubscriptionNotice, type SignupMethod } from "@/lib/email/templates/admin-notice"
import type { BillingPeriod, PlanId } from "@/lib/stripe/plans"

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Adresse du fondateur ; null si absente ou invalide. */
export function adminNotifyAddress(): string | null {
  for (const raw of [process.env.ADMIN_NOTIFY_EMAIL, process.env.ADMIN_EMAIL]) {
    const value = raw?.trim()
    if (value && VALID_EMAIL.test(value)) return value
  }
  return null
}

/** Origine des liens : l'admin vit sur le domaine de l'application. */
export function adminBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || SITE_ORIGIN).replace(/\/+$/, "")
}

type Notice = { subject: string; html: string }

async function deliver(build: (baseUrl: string) => Notice | Promise<Notice>, label: string): Promise<void> {
  try {
    const to = adminNotifyAddress()
    if (!to || !process.env.RESEND_API_KEY) return
    const { subject, html } = await build(adminBaseUrl())
    await sendEmail({ to, subject, html, fromName: "Qonforme" })
  } catch (err) {
    console.error(`[admin-notify] ${label} :`, err)
  }
}

/** Un compte vient d'être créé (email et mot de passe, ou Google). */
export function notifyNewSignup(params: { email: string | null | undefined; method: SignupMethod; userId: string | null }): Promise<void> {
  const email = params.email?.trim()
  if (!email) return Promise.resolve()
  return deliver((baseUrl) => buildNewSignupNotice({ email, method: params.method, userId: params.userId, baseUrl }), "nouvel inscrit")
}

/** Un compte vient d'activer sa première formule (`mode` : bac à sable ou production). */
export function notifyNewSubscription(params: {
  userId: string
  plan: PlanId
  period: BillingPeriod
  mode: "live" | "test"
}): Promise<void> {
  return deliver(async (baseUrl) => {
    let email: string | null = null
    try {
      const { data } = await createAdminClient().auth.admin.getUserById(params.userId)
      email = data?.user?.email ?? null
    } catch {
      // L'adresse n'est qu'une commodité : l'email part quand même, avec le lien vers la fiche
    }
    return buildNewSubscriptionNotice({ ...params, email, baseUrl })
  }, "nouvel abonnement")
}
