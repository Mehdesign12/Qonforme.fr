/**
 * Emails adressés au fondateur (pas aux clients) : nouvel inscrit, nouvel abonnement.
 * Volontairement sobres : quelques lignes et un lien vers la fiche du compte dans l'admin.
 * Aucune donnée de document (factures, clients) n'y figure.
 */
import { PLANS, TAX_SUFFIX, formatEuros, type BillingPeriod, type PlanId } from "@/lib/stripe/plans"
import { escapeHtml } from "@/lib/email/templates/onboarding"

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"

export type SignupMethod = "email" | "google"

const METHOD_LABEL: Record<SignupMethod, string> = { email: "email et mot de passe", google: "Google" }

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 16px 8px 0;font-family:${FONT};font-size:14px;color:#6B7280;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-family:${FONT};font-size:14px;font-weight:600;color:#15171C;">${value}</td>
  </tr>`
}

function shell(title: string, rows: string, link: { label: string; href: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#F6F5F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:24px;">
    <tr><td style="font-family:${FONT};font-size:18px;font-weight:700;color:#15171C;padding-bottom:12px;">${escapeHtml(title)}</td></tr>
    <tr><td><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td style="padding-top:20px;"><a href="${escapeHtml(link.href)}" style="font-family:${FONT};font-size:14px;font-weight:600;color:#2563EB;">${escapeHtml(link.label)}</a></td></tr>
  </table></body></html>`
}

/** Date et heure de Paris, lisibles (« 23 oct. 2026, 14:05 »). */
export function parisStamp(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function buildNewSignupNotice(params: {
  email: string
  method: SignupMethod
  userId: string | null
  baseUrl: string
  now?: Date
}): { subject: string; html: string } {
  const { email, method, userId, baseUrl, now } = params
  const link = userId ? `${baseUrl}/admin/users/${encodeURIComponent(userId)}` : `${baseUrl}/admin/users`
  return {
    subject: `Nouvel inscrit : ${email}`,
    html: shell(
      "Un nouveau compte vient d'être créé",
      row("Adresse", escapeHtml(email)) + row("Méthode", METHOD_LABEL[method]) + row("Date", escapeHtml(parisStamp(now))),
      { label: "Ouvrir la fiche dans l'admin", href: link },
    ),
  }
}

export function buildNewSubscriptionNotice(params: {
  email: string | null
  plan: PlanId
  period: BillingPeriod
  /** « essai » : bac à sable Stripe, aucun vrai paiement. */
  mode: "live" | "test"
  userId: string
  baseUrl: string
  now?: Date
}): { subject: string; html: string } {
  const { email, plan, period, mode, userId, baseUrl, now } = params
  const info = PLANS[plan]
  const price = period === "yearly" ? info.yearlyPrice : info.monthlyPrice
  const every = period === "yearly" ? "par an" : "par mois"
  const amount = `${formatEuros(price)}${TAX_SUFFIX} ${every}`
  const tag = mode === "test" ? " (essai, bac à sable)" : ""
  return {
    subject: `Nouvel abonnement${tag} : ${info.name} ${period === "yearly" ? "annuel" : "mensuel"}`,
    html: shell(
      `Un compte vient de prendre une formule${tag}`,
      row("Compte", escapeHtml(email ?? "adresse inconnue")) +
        row("Formule", `${escapeHtml(info.name)} · ${period === "yearly" ? "annuel" : "mensuel"}`) +
        row("Montant", escapeHtml(amount)) +
        row("Date", escapeHtml(parisStamp(now))),
      { label: "Ouvrir la fiche dans l'admin", href: `${baseUrl}/admin/users/${encodeURIComponent(userId)}` },
    ),
  }
}
