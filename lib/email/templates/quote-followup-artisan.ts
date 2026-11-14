/**
 * Email de suivi à l'artisan, environ 10 jours après l'envoi d'un devis (ou le
 * téléchargement de son PDF) : « Le devis … a-t-il été accepté ? ». Canevas validé
 * par le fondateur le 14/11/2026 (https://claude.ai/artifact/VR72sLaFRCUhotx7ci9c2S).
 *
 * Au nom de Qonforme, vouvoiement, désinscription des conseils. Rien n'est envoyé
 * au client : le bouton ouvre la fiche du devis sur la confirmation. Tout texte
 * venu du compte (prénom, client, numéro) est échappé.
 */
import { appBaseUrl } from "@/lib/onboarding/unsubscribe"
import { fmtEur } from "@/lib/email/templates/base"
import { aside, button, escapeHtml as e, hello, onboardingLayout, p, textLink, unbreakable } from "@/lib/email/templates/onboarding"

export interface QuoteFollowupContext {
  quoteId: string
  quoteNumber: string | null
  clientName: string | null
  totalTtc: number | null
  /** « sent » : envoyé par Qonforme ou marqué envoyé ; « downloaded » : seulement téléchargé en PDF. */
  origin: "sent" | "downloaded"
  firstName?: string | null
  unsubscribeUrl: string | null
}

export function buildQuoteFollowupEmail(ctx: QuoteFollowupContext): { subject: string; html: string } {
  const base = appBaseUrl()
  const ref = ctx.quoteNumber ? `le devis ${ctx.quoteNumber}` : "votre devis"
  const client = ctx.clientName?.trim() || null
  const amount = ctx.totalTtc != null ? ` (${fmtEur(ctx.totalTtc)})` : ""
  const subject = client ? `Votre devis pour ${client}, accepté ?` : "Votre devis, accepté ?"
  const what = ctx.origin === "sent"
    ? `Vous avez envoyé ${e(ref)}${e(amount)}${client ? ` à ${e(client)}` : ""} il y a une dizaine de jours.`
    : `Vous avez téléchargé ${e(ref)}${e(amount)}${client ? ` pour ${e(client)}` : ""} il y a une dizaine de jours.`
  const quoteUrl = `${base}/quotes/${encodeURIComponent(ctx.quoteId)}`
  const body = [
    p(hello(ctx.firstName)),
    p(`${what} Votre client l'a accepté&nbsp;? Indiquez-le en un clic&nbsp;: Qonforme prépare la facture à partir du devis, il ne vous reste qu'à la relire. Rien n'est envoyé à votre client.`),
    button("Oui, créer la facture", `${quoteUrl}?accepte=1`),
    p(`Pas encore de réponse&nbsp;? ${textLink("Ouvrir le devis", quoteUrl)} : «&nbsp;Renvoyer&nbsp;» le lui renvoie par email.`, "margin:20px 0 0;font-size:14px;"),
    ctx.origin === "downloaded"
      ? aside("La prochaine fois, envoyez-le par Qonforme&nbsp;: vous voyez quand votre client l'ouvre, et il peut signer en ligne (avec Essentiel).")
      : "",
  ].join("")
  return {
    subject,
    html: onboardingLayout({
      title: subject,
      preheader: "Un clic pour marquer le devis accepté et préparer la facture.",
      body,
      footer: {
        reason: `Vous recevez cet e-mail parce que ${unbreakable(ref)} attend la réponse de votre client. Il n'est envoyé qu'une fois par devis.`,
        unsubscribeUrl: ctx.unsubscribeUrl,
      },
    }),
  }
}
