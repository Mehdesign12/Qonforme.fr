/**
 * Emails du démarrage d'un compte neuf (DECISIONS-STRATEGIQUES.md § 8 et § 10) :
 * séquence (premier devis, relance à 7 jours, du devis à la facture, ce que
 * change Essentiel), rappel « plus tard » et devis d'essai envoyé à soi-même.
 * L'email de bienvenue (J0) reste dans welcome.ts.
 *
 * Règles (CLAUDE.md, DECISIONS § 2) :
 * - au nom de Qonforme, vouvoiement, aucune invitation à répondre ni promesse
 *   de contact humain, aucun message signé d'une personne ;
 * - seulement ce que l'application fait aujourd'hui : ni signature en ligne ni
 *   lien de paiement (masqués tant que leurs migrations manquent), ni
 *   transmission par plateforme agréée ;
 * - aucune urgence inventée : prix et garantie lus dans lib/stripe ;
 * - chaque email de la séquence porte un lien de désinscription en un clic
 *   (art. L34-5 du CPCE, voir lib/onboarding/unsubscribe.ts) et un accès direct
 *   au tableau de bord (§ 8).
 *
 * HTML en styles en ligne (Gmail, Outlook, Apple Mail). Tout texte venu du
 * compte (prénom, entreprise) est échappé.
 */
import { FREE_FEATURES, PLANS, formatEuros } from "@/lib/stripe/plans"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"
import { REMINDER_TARGETS } from "@/lib/onboarding/reminder"
import type { ReminderTarget } from "@/lib/onboarding/types"
import { appBaseUrl } from "@/lib/onboarding/unsubscribe"
import { fmtEur } from "@/lib/email/templates/base"

const ACCENT = "#2563EB"
const INK = "#0F172A"
const TEXT = "#475569"
const MUTED = "#94A3B8"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const e = escapeHtml

/** « Bonjour Thomas, » ou « Bonjour, ». */
function hello(firstName: string | null | undefined): string {
  const name = firstName?.trim()
  return name ? `Bonjour ${e(name)},` : "Bonjour,"
}

function p(html: string, extra = ""): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};${extra}">${html}</p>`
}

function button(label: string, href: string): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 0;">
    <tr>
      <td style="background-color:${ACCENT};border-radius:999px;">
        <a href="${e(href)}" style="display:inline-block;padding:13px 26px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">${e(label)}</a>
      </td>
    </tr>
  </table>`
}

function textLink(label: string, href: string): string {
  return `<a href="${e(href)}" style="color:${ACCENT};font-weight:600;text-decoration:none;">${e(label)}</a>`
}

function bullets(items: string[]): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 18px;">
    ${items.map((item) => `
    <tr>
      <td style="width:20px;vertical-align:top;padding:3px 0;font-size:14px;color:#10B981;">✓</td>
      <td style="padding:3px 0 3px 6px;font-size:14px;line-height:1.55;color:${TEXT};">${item}</td>
    </tr>`).join("")}
  </table>`
}

function steps(items: { title: string; text: string }[]): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 20px;">
    ${items.map((s, i) => `
    <tr>
      <td style="width:30px;vertical-align:top;padding:8px 0;">
        <div style="width:24px;height:24px;border-radius:50%;background-color:#EFF6FF;color:${ACCENT};font-size:12px;font-weight:700;text-align:center;line-height:24px;">${i + 1}</div>
      </td>
      <td style="padding:8px 0 8px 8px;vertical-align:top;">
        <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${INK};">${s.title}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:${TEXT};">${s.text}</p>
      </td>
    </tr>`).join("")}
  </table>`
}

/** Encadré gris clair (choix secondaires, rappel des conditions). */
function aside(html: string): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:8px 0 20px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
    <tr><td style="padding:16px 20px;font-size:14px;line-height:1.6;color:${TEXT};">${html}</td></tr>
  </table>`
}

export interface LayoutFooter {
  /** Pourquoi la personne reçoit cet email. */
  reason: string
  /** Lien de désinscription (séquence) ; absent pour un email demandé (rappel, devis d'essai). */
  unsubscribeUrl?: string | null
}

/** Coque Qonforme : bandeau, corps, pied avec la raison d'envoi et la désinscription. */
export function onboardingLayout({
  title,
  preheader,
  body,
  footer,
}: {
  title: string
  preheader: string
  body: string
  footer: LayoutFooter
}): string {
  const base = appBaseUrl()
  const unsubscribe = footer.unsubscribeUrl
    ? `<p style="margin:8px 0 0;font-size:12px;color:${MUTED};">
         <a href="${e(footer.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Ne plus recevoir ces conseils</a>
         &nbsp;·&nbsp;
         <a href="${e(`${base}/settings/notifications`)}" style="color:#64748B;text-decoration:underline;">Gérer mes e-mails</a>
       </p>`
    : ""
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${e(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">${e(preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${ACCENT};border-radius:12px 12px 0 0;padding:24px 36px;">
              <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Qonforme</p>
              <p style="margin:2px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Le logiciel de devis et de facturation des artisans du bâtiment</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;padding:36px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-0.3px;">${e(title)}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:18px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:${MUTED};">${e(footer.reason)}</p>
              ${unsubscribe}
              <p style="margin:8px 0 0;font-size:11px;color:#CBD5E1;">Qonforme, ${e(base.replace(/^https?:\/\//, ""))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/* ------------------------------------------------------------------ */
/* Séquence                                                            */
/* ------------------------------------------------------------------ */

export type SequenceEmailStep = "first_quote" | "nudge_7d" | "quote_to_invoice" | "essentiel"

export interface SequenceEmailContext {
  firstName?: string | null
  /** Lien signé de désinscription (lib/onboarding/unsubscribe.ts). */
  unsubscribeUrl: string | null
  /** Date d'inscription, pour la raison d'envoi (« le 3 octobre 2026 »). */
  signupDate: string
  /** Essentiel : une facture attend en brouillon (sinon : un devis accepté). */
  hasDraftInvoice?: boolean
}

/** « 5 octobre 2026 » sans coupure de ligne. */
const unbreakable = (date: string) => date.replace(/ /g, " ")

const sequenceReason = (signupDate: string) =>
  `Vous recevez ces conseils de démarrage parce que vous avez créé votre compte Qonforme le ${unbreakable(signupDate)}. Ils s'arrêtent d'eux-mêmes après 30 jours.`

export function buildSequenceEmail(step: SequenceEmailStep, ctx: SequenceEmailContext): { subject: string; html: string } {
  const base = appBaseUrl()
  const dashboard = `${base}/dashboard`
  const footer = { reason: sequenceReason(ctx.signupDate), unsubscribeUrl: ctx.unsubscribeUrl }
  const essentiel = PLANS.starter

  switch (step) {
    case "first_quote": {
      const subject = "Votre premier devis en quelques minutes"
      const body = [
        p(hello(ctx.firstName)),
        p("Votre espace Qonforme est prêt. Pour commencer, le plus utile est un devis&nbsp;: il est gratuit, et sans limite de nombre."),
        steps([
          { title: "Choisissez le client", text: "Ou créez-le&nbsp;: avec son numéro SIREN, ses coordonnées se remplissent seules." },
          { title: "Ajoutez vos prestations", text: "Quantité, prix et taux de TVA ligne par ligne. L'aperçu du devis se met à jour pendant la saisie." },
          { title: "Envoyez-le", text: "Par e-mail avec le PDF joint, ou téléchargez le PDF pour le transmettre vous-même." },
        ]),
        button("Faire mon premier devis", `${base}/quotes/new`),
        aside(`Pas de client sous la main&nbsp;? ${textLink("Envoyez-vous un devis d'essai", `${base}/demarrer?choix=essai`)}&nbsp;: un exemple à votre nom, sur votre adresse, sans numéro. Il n'apparaît pas dans vos devis.`),
        p(`Vous préférez d'abord regarder&nbsp;? ${textLink("Passer au tableau de bord", dashboard)}.`, "margin:0;font-size:14px;"),
      ].join("")
      return {
        subject,
        html: onboardingLayout({ title: subject, preheader: "Choisissez le client, ajoutez vos prestations : le PDF est prêt à envoyer.", body, footer }),
      }
    }

    case "nudge_7d": {
      const subject = "Un devis, quand vous voulez"
      const body = [
        p(hello(ctx.firstName)),
        p(`Vous avez créé votre compte le ${e(unbreakable(ctx.signupDate))}. Rien ne presse&nbsp;: vos devis restent gratuits et illimités, et votre tableau de bord est accessible à tout moment, même sans document.`),
        button("Explorer le tableau de bord", dashboard),
        aside([
          `<strong style="color:${INK};">Pour démarrer, trois façons au choix&nbsp;:</strong><br />`,
          `${textLink("Faire un vrai devis", `${base}/quotes/new`)}, pour un client&nbsp;;<br />`,
          `${textLink("M'envoyer un devis d'essai", `${base}/demarrer?choix=essai`)}, pour voir ce que reçoivent vos clients&nbsp;;<br />`,
          `${textLink("Facturer un chantier terminé", `${base}/invoices/new`)}&nbsp;: la préparation est gratuite.`,
        ].join("")),
        p("C'est notre dernier message à ce sujet.", "margin:0;font-size:14px;"),
      ].join("")
      return {
        subject,
        html: onboardingLayout({ title: subject, preheader: "Votre compte reste ouvert : devis gratuits, tableau de bord accessible à tout moment.", body, footer }),
      }
    }

    case "quote_to_invoice": {
      const subject = "Votre devis est parti : la suite, c'est la facture"
      const body = [
        p(hello(ctx.firstName)),
        p("Votre premier devis est envoyé. Voici la suite, sans rien ressaisir&nbsp;:"),
        steps([
          { title: "Votre client donne son accord", text: "Ouvrez le devis et marquez-le comme accepté." },
          { title: "Le chantier est fini", text: "Depuis la fiche du devis, «&nbsp;Convertir en facture&nbsp;»&nbsp;: client, lignes et montants sont repris dans une facture en brouillon." },
          { title: "Vous vérifiez, puis vous envoyez", text: `La facture se prépare gratuitement. La formule ${e(essentiel.name)} (${formatEuros(essentiel.monthlyPrice)}&nbsp;HT par mois) se choisit seulement au moment de l'envoyer.` },
        ]),
        button("Voir mes devis", `${base}/quotes`),
        p(`Ou ${textLink("passer au tableau de bord", dashboard)}.`, "margin:16px 0 0;font-size:14px;"),
      ].join("")
      return {
        subject,
        html: onboardingLayout({ title: subject, preheader: "Chantier terminé ? Le devis devient une facture sans rien ressaisir.", body, footer }),
      }
    }

    case "essentiel": {
      const subject = `Avant votre première facture : ce que change ${essentiel.name}`
      const intro = ctx.hasDraftInvoice
        ? "Une facture vous attend en brouillon. Vous pouvez la modifier et la télécharger avec le filigrane «&nbsp;Brouillon&nbsp;» autant que vous voulez&nbsp;; pour l'envoyer à votre client, il faut une formule."
        : "Un de vos devis est accepté&nbsp;: la facture viendra quand le chantier sera fini. Vous pourrez la préparer gratuitement&nbsp;; pour l'envoyer à votre client, il faudra une formule."
      const body = [
        p(hello(ctx.firstName)),
        p(intro),
        `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${INK};">Avec ${e(essentiel.name)}</p>`,
        bullets(essentiel.features.map(e)),
        `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${INK};">Ce qui reste gratuit</p>`,
        bullets(FREE_FEATURES.map(e)),
        aside([
          `<strong style="color:${INK};">${formatEuros(essentiel.monthlyPrice)}&nbsp;HT par mois</strong>, ou ${formatEuros(essentiel.yearlyPrice)}&nbsp;HT par an.<br />`,
          "Sans engagement&nbsp;: la formule se résilie à tout moment depuis Paramètres › Abonnement.<br />",
          `Satisfait ou remboursé ${GUARANTEE_DAYS}&nbsp;jours, depuis Paramètres › Abonnement, sans avoir à nous écrire.`,
        ].join("")),
        button(ctx.hasDraftInvoice ? "Retrouver ma facture" : `Voir la formule ${essentiel.name}`, ctx.hasDraftInvoice ? `${base}/invoices?filtre=brouillons` : `${base}/settings/billing`),
        p(`Ou ${textLink("passer au tableau de bord", dashboard)}.`, "margin:16px 0 0;font-size:14px;"),
      ].join("")
      return {
        subject,
        html: onboardingLayout({
          title: subject,
          preheader: `${formatEuros(essentiel.monthlyPrice)} HT par mois, sans engagement, satisfait ou remboursé ${GUARANTEE_DAYS} jours.`,
          body,
          footer,
        }),
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rappel « plus tard »                                                */
/* ------------------------------------------------------------------ */

export function buildLaterReminderEmail({
  firstName,
  target,
  requestedOn,
}: {
  firstName?: string | null
  target: ReminderTarget
  /** Jour de la demande, « vendredi 3 octobre ». */
  requestedOn: string
}): { subject: string; html: string } {
  const base = appBaseUrl()
  const t = REMINDER_TARGETS[target]
  const subject = `Votre rappel : ${t.action}`
  const body = [
    p(hello(firstName)),
    p(`Vous nous avez demandé, ${e(unbreakable(requestedOn))}, de vous rappeler de ${e(t.action)}. C'est le moment&nbsp;: le lien ci-dessous vous y mène directement.`),
    button(t.label, `${base}${t.path}`),
    target === "dashboard" ? "" : p(`Vous préférez d'abord regarder&nbsp;? ${textLink("Passer au tableau de bord", `${base}/dashboard`)}.`, "margin:20px 0 0;font-size:14px;"),
  ].join("")
  return {
    subject,
    html: onboardingLayout({
      title: subject,
      preheader: "Le rappel que vous avez programmé dans Qonforme.",
      body,
      footer: { reason: "Vous recevez cet e-mail parce que vous avez programmé ce rappel dans Qonforme. Il n'est envoyé qu'une fois." },
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Devis d'essai envoyé à soi-même                                     */
/* ------------------------------------------------------------------ */

export function buildTrialQuoteEmail({
  firstName,
  companyName,
  accentColor,
  totalTtc,
  validUntil,
}: {
  firstName?: string | null
  companyName: string
  accentColor?: string | null
  totalTtc: number
  /** Date lisible, « 2 novembre 2026 ». */
  validUntil: string
}): { subject: string; html: string } {
  const base = appBaseUrl()
  const accent = /^#[0-9a-f]{3,8}$/i.test(accentColor ?? "") ? (accentColor as string) : ACCENT
  const subject = "Exemple : votre devis tel que vos clients le reçoivent"
  const preview = `
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:4px 0 24px;border:1px dashed #CBD5E1;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:${accent};padding:16px 22px;">
        <p style="margin:0;color:#FFFFFF;font-size:17px;font-weight:700;">${e(companyName)}</p>
        <p style="margin:2px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Propulsé par Qonforme</p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 22px;font-size:14px;line-height:1.6;color:${TEXT};">
        <p style="margin:0 0 8px;">Bonjour,</p>
        <p style="margin:0 0 12px;">Veuillez trouver ci-joint votre devis, valable jusqu'au <strong style="color:${INK};">${e(validUntil)}</strong>.</p>
        <p style="margin:0;font-size:15px;color:${INK};">Total TTC&nbsp;: <strong>${fmtEur(totalTtc)}</strong></p>
      </td>
    </tr>
  </table>`
  const body = [
    p(hello(firstName)),
    p("Voici, à titre d'exemple, un devis à votre nom tel que vos clients le reçoivent&nbsp;: l'e-mail ci-dessous et le PDF joint. Il porte la mention «&nbsp;Exemple&nbsp;», n'a pas de numéro et n'apparaît ni dans vos devis ni dans vos chiffres."),
    `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B91C1C;">Exemple</p>`,
    preview,
    p("Votre logo, votre couleur et vos mentions se règlent dans Paramètres › Modèles de documents&nbsp;; vos prestations, dans le catalogue."),
    button("Faire un vrai devis", `${base}/quotes/new`),
    p(`Ou ${textLink("passer au tableau de bord", `${base}/dashboard`)}.`, "margin:16px 0 0;font-size:14px;"),
  ].join("")
  return {
    subject,
    html: onboardingLayout({
      title: subject,
      preheader: "Un devis d'exemple à votre nom, sans numéro, avec le PDF joint.",
      body,
      footer: { reason: "Vous recevez cet e-mail parce que vous avez demandé un devis d'essai depuis Qonforme. Rien n'a été envoyé à un client." },
    }),
  }
}
