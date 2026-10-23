/**
 * Email de confirmation d'abonnement (canevas « Abonnement activé », carte 6).
 * Envoyé une seule fois, à la première activation d'une formule payante.
 *
 * Règles : montant tel que payé (pas de HT/TTC en dur, `TAX_SUFFIX`), vouvoiement,
 * aucune promesse de contact humain, aucune fonction non livrée.
 */
import { emailBase, ctaButton, fmtEur, fmtDate, monoLabel, FONT_BODY } from "@/lib/email/templates/base"
import { PLANS, TAX_SUFFIX, type BillingPeriod, type PlanId } from "@/lib/stripe/plans"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")

function row(label: string, value: string, last = false): string {
  return `<tr>
    <td style="padding:12px 0;${last ? "" : "border-bottom:1px solid #E7E4DC;"}font-family:${FONT_BODY};font-size:14px;color:#4F5257;">${label}</td>
    <td align="right" style="padding:12px 0;${last ? "" : "border-bottom:1px solid #E7E4DC;"}font-family:${FONT_BODY};font-size:14px;font-weight:600;color:#15171C;">${value}</td>
  </tr>`
}

export function buildSubscriptionActivatedEmail({
  plan,
  period,
  nextPaymentAt,
  amount,
}: {
  plan: PlanId
  period: BillingPeriod
  nextPaymentAt: Date | null
  /** Montant payé ; à défaut, le prix de la grille. */
  amount?: number
}): { subject: string; html: string } {
  const info = PLANS[plan]
  const price = amount ?? (period === "yearly" ? info.yearlyPrice : info.monthlyPrice)
  const every = period === "yearly" ? "par an" : "par mois"
  const priceText = `${fmtEur(price)}${TAX_SUFFIX} ${every}`

  const rows =
    row("Formule", `${info.name} · ${priceText}`) +
    row("Payé aujourd'hui", `${fmtEur(price)}${TAX_SUFFIX}`, !nextPaymentAt) +
    (nextPaymentAt ? row("Prochain paiement", fmtDate(nextPaymentAt.toISOString()), true) : "")

  const body = `
    <p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:#2B2E35;">Votre paiement est bien passé. Vos factures peuvent partir dès maintenant, avec leurs relances.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid #E7E4DC;">${rows}</table>
    ${ctaButton("Ouvrir Qonforme", `${APP_URL}/dashboard`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E7E4DC;">
      <tr><td style="padding:14px 0 0;">
        ${monoLabel("À savoir")}
        <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#2B2E35;">Remboursé pendant ${GUARANTEE_DAYS} jours, à demander dans Paramètres › Abonnement. Votre facture d'abonnement s'y télécharge aussi.</p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#4F5257;">Qonforme est édité par Diez Agency LLC.</p>`

  return {
    subject: `Votre abonnement ${info.name} est actif`,
    html: emailBase({
      companyName: "Qonforme",
      preheader: `${info.name} est activé : vos factures peuvent partir.`,
      body,
      source: "email-abonnement",
      headline: `Votre abonnement ${info.name},`,
      headlineAccent: "actif.",
    }),
  }
}
