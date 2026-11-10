/**
 * Emails de reprise (compte arrêté à une étape) et emails envoyés à la main
 * depuis Admin › Utilisateurs. Même coque que les conseils de démarrage
 * (onboardingLayout) : au nom de Qonforme, vouvoiement, lien de désinscription,
 * aucune promesse de contact humain ni de délai, seulement ce que l'application
 * fait aujourd'hui (DECISIONS-STRATEGIQUES.md § 2, CLAUDE.md).
 *
 * Tout texte venu du compte ou de l'admin (prénom, client, phrase ajoutée) est échappé.
 */
import { appBaseUrl } from "@/lib/onboarding/unsubscribe"
import { fmtEur } from "@/lib/email/templates/base"
import {
  aside, button, escapeHtml as e, hello, onboardingLayout, p, steps, textLink, unbreakable,
} from "@/lib/email/templates/onboarding"

export {
  REPRISE_TEMPLATES, MANUAL_TEMPLATES, TEMPLATE_LABELS, isManualTemplate, templateLabel,
  type RepriseTemplate, type ManualTemplate, type AccountTemplate,
} from "@/lib/email/account-templates"
import type { AccountTemplate } from "@/lib/email/account-templates"

export interface DraftQuoteFact {
  id: string
  number: string | null
  clientName: string | null
  totalTtc: number | null
  clientHasEmail: boolean
}

export interface AccountEmailContext {
  firstName?: string | null
  /** « 6 novembre 2026 ». */
  signupDate: string
  unsubscribeUrl: string | null
  /** Brouillon de devis jamais envoyé (le plus ancien). */
  draftQuote?: DraftQuoteFact | null
  /** Saisies de la fenêtre « Bienvenue » gardées (user_metadata.signup_draft). */
  hasSignupDraft?: boolean
  /** Documents en attente, pour « ce que vous aviez commencé ». */
  pending?: { draftQuotes: number; draftInvoices: number; quotesAwaiting: number }
  /** Phrase ajoutée à la main par l'admin (texte brut). */
  note?: string | null
  /** Email libre : objet et texte (paragraphes séparés par une ligne vide). */
  freeSubject?: string | null
  freeBody?: string | null
}

const reason = (signupDate: string) =>
  `Vous recevez cet e-mail parce que vous avez créé votre compte Qonforme le ${unbreakable(signupDate)}.`

/** Texte brut de l'admin : échappé, retours à la ligne gardés. */
function plain(text: string): string {
  return e(text.trim()).replace(/\r?\n/g, "<br />")
}

function noteBlock(note: string | null | undefined): string {
  return note && note.trim() ? aside(plain(note)) : ""
}

const quoteRef = (q: DraftQuoteFact) => (q.number ? `devis ${q.number}` : "devis")

/** Construit l'email d'un modèle de reprise ou d'envoi à la main. */
export function buildAccountEmail(template: AccountTemplate, ctx: AccountEmailContext): { subject: string; html: string } {
  const base = appBaseUrl()
  const footer = { reason: reason(ctx.signupDate), unsubscribeUrl: ctx.unsubscribeUrl }
  const finish = `${base}/dashboard?inscription=reprendre`
  const dashboard = `${base}/dashboard`
  const layout = (subject: string, preheader: string, body: string[]) => ({
    subject,
    html: onboardingLayout({ title: subject, preheader, body: body.join(""), footer }),
  })

  switch (template) {
    case "reprise_company_1":
    case "manual_company": {
      return layout("Votre entreprise en 10 secondes", "Tapez votre SIREN : nom, adresse et numéro de TVA se remplissent seuls.", [
        p(hello(ctx.firstName)),
        p("Il reste une étape pour terminer votre inscription&nbsp;: votre entreprise. Le plus sûr est de taper votre <strong>numéro SIREN</strong> (9&nbsp;chiffres)&nbsp;: nom, adresse et numéro de TVA se remplissent seuls."),
        aside("<strong>Où trouver votre SIREN&nbsp;?</strong><br />Sur votre avis de situation Insee, votre extrait Kbis ou l'attestation d'immatriculation du guichet des formalités."),
        noteBlock(ctx.note),
        button("Terminer mon inscription", finish),
        p("Entreprise toute récente, pas encore au répertoire&nbsp;? Saisissez-la à la main, ça marche aussi.", "margin:20px 0 0;font-size:14px;"),
      ])
    }

    case "reprise_company_2": {
      const intro = ctx.hasSignupDraft
        ? "Ce que vous avez saisi à l'inscription est gardé&nbsp;: vous reprenez exactement où vous en étiez."
        : "Terminer votre inscription prend une minute&nbsp;: votre entreprise, votre métier, votre prénom."
      return layout("Votre inscription vous attend", "Reprenez où vous en étiez : entreprise, métier, prénom.", [
        p(hello(ctx.firstName)),
        p(intro),
        p("Ensuite, vos devis sont gratuits et sans limite&nbsp;; votre métier préremplit le catalogue de vos prestations."),
        button("Reprendre mon inscription", finish),
      ])
    }

    case "reprise_company_3": {
      return layout("Une question pour finir votre inscription ?", "Écrivez-nous depuis la page Contact.", [
        p(hello(ctx.firstName)),
        p("Votre entreprise n'est pas encore enregistrée dans Qonforme. Si quelque chose vous bloque (entreprise introuvable, numéro refusé, autre question), écrivez-nous&nbsp;: la réponse arrive par e-mail."),
        button("Nous écrire", `${base}/contact`),
        p(`Ou ${textLink("terminer mon inscription", finish)}.`, "margin:20px 0 0;font-size:14px;"),
        p("C'est notre dernier message à ce sujet.", "margin:16px 0 0;font-size:14px;"),
      ])
    }

    case "manual_first_quote": {
      return layout("Votre premier devis en 3 minutes", "Choisissez le client, ajoutez vos prestations : le PDF est prêt.", [
        p(hello(ctx.firstName)),
        p("Votre espace est prêt. Un devis est gratuit, et sans limite de nombre&nbsp;:"),
        steps([
          { title: "Choisissez le client", text: "Ou créez-le sans quitter le devis&nbsp;: avec son SIREN, ses coordonnées se remplissent seules." },
          { title: "Ajoutez vos prestations", text: "Depuis le catalogue de votre métier, ou ligne par ligne. Le devis s'enregistre tout seul pendant la saisie." },
          { title: "Envoyez-le", text: "Par e-mail avec le PDF joint, ou téléchargez le PDF pour le remettre vous-même." },
        ]),
        noteBlock(ctx.note),
        button("Faire mon premier devis", `${base}/quotes/new`),
      ])
    }

    case "reprise_quote_send_1":
    case "manual_quote_send": {
      const q = ctx.draftQuote
      const what = q
        ? `Votre ${e(quoteRef(q))}${q.clientName ? ` pour <strong>${e(q.clientName)}</strong>` : ""}${typeof q.totalTtc === "number" ? ` (${fmtEur(q.totalTtc)})` : ""} est enregistré en brouillon. Il ne reste qu'à l'envoyer.`
        : "Votre devis est enregistré en brouillon. Il ne reste qu'à l'envoyer."
      const how = q && !q.clientHasEmail
        ? "Votre client n'a pas d'adresse e-mail sur sa fiche&nbsp;: tapez-la dans la fenêtre d'envoi, ou téléchargez le PDF pour le lui remettre vous-même."
        : "Envoyez-le par e-mail avec le PDF joint, ou téléchargez le PDF pour le lui remettre vous-même."
      const subject = q?.number ? `Votre devis ${q.number} est prêt à partir` : "Votre devis est prêt à partir"
      return layout(subject, "Il ne reste qu'à l'envoyer à votre client.", [
        p(hello(ctx.firstName)),
        p(what),
        p(how),
        noteBlock(ctx.note),
        button("Envoyer mon devis", q ? `${base}/quotes/${q.id}` : `${base}/quotes`),
      ])
    }

    case "reprise_quote_send_2": {
      const q = ctx.draftQuote
      return layout(q?.number ? `Votre devis ${q.number} attend toujours` : "Votre devis attend toujours", "Un clic pour l'envoyer, ou le PDF pour le remettre vous-même.", [
        p(hello(ctx.firstName)),
        p(`Votre ${q ? e(quoteRef(q)) : "devis"}${q?.clientName ? ` pour ${e(q.clientName)}` : ""} est toujours en brouillon. Une fois envoyé, il apparaît comme «&nbsp;Envoyé&nbsp;» et, quand votre client donne son accord, il se convertit en facture sans rien ressaisir.`),
        button("Ouvrir mon devis", q ? `${base}/quotes/${q.id}` : `${base}/quotes`),
        p("C'est notre dernier message à ce sujet.", "margin:20px 0 0;font-size:14px;"),
      ])
    }

    case "reprise_inactive_14": {
      const pending = ctx.pending ?? { draftQuotes: 0, draftInvoices: 0, quotesAwaiting: 0 }
      const lines: string[] = []
      if (pending.draftQuotes) lines.push(`${pending.draftQuotes} devis en brouillon`)
      if (pending.quotesAwaiting) lines.push(`${pending.quotesAwaiting} devis envoyé${pending.quotesAwaiting > 1 ? "s" : ""} en attente de réponse`)
      if (pending.draftInvoices) lines.push(`${pending.draftInvoices} facture${pending.draftInvoices > 1 ? "s" : ""} en brouillon`)
      return layout("Ce que vous aviez commencé", "Vos documents vous attendent, là où vous les avez laissés.", [
        p(hello(ctx.firstName)),
        p("Vos documents vous attendent, là où vous les avez laissés&nbsp;:"),
        lines.length ? aside(lines.map(e).join("<br />")) : "",
        button("Retrouver mon tableau de bord", dashboard),
        p("Nous ne vous écrirons plus à ce sujet.", "margin:20px 0 0;font-size:14px;"),
      ])
    }

    case "manual_free": {
      const subject = (ctx.freeSubject ?? "").trim() || "Un mot de Qonforme"
      const paragraphs = (ctx.freeBody ?? "").split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean)
      return layout(subject, paragraphs[0]?.slice(0, 120) ?? "", [
        p(hello(ctx.firstName)),
        ...paragraphs.map((para) => p(plain(para))),
        button("Ouvrir Qonforme", dashboard),
      ])
    }
  }
}
