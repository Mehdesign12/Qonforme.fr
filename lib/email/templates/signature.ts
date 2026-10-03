/**
 * Emails de la signature en ligne (DECISIONS-STRATEGIQUES.md § 11 « Les emails ») :
 * - au client, au nom de l'entreprise (les réponses vont à l'artisan) : demande
 *   de signature, code de vérification, confirmation avec le PDF signé ;
 * - à l'artisan, au nom de Qonforme, sans inviter à répondre : signature reçue
 *   ou refus avec son motif.
 *
 * Vouvoiement, aucune promesse de contact humain, « signature électronique
 * simple » seulement. Toute donnée saisie (noms, motif, message) est échappée.
 */
import { amountBlock, ctaButton, emailBase, fmtDate, fmtEur } from "./base"
import { escapeHtml, refusalLabel, WITHDRAWAL_DAYS } from "@/lib/signature/rules"
import type { ClientKind, RefusalReason, SignatureContext, SignatureDocType } from "@/lib/signature/types"

const e = escapeHtml

const docLabel = (t: SignatureDocType) => (t === "quote" ? "devis" : "bon de commande")
const DocLabel = (t: SignatureDocType) => (t === "quote" ? "Devis" : "Bon de commande")
const theDoc = (t: SignatureDocType) => (t === "quote" ? "le devis" : "le bon de commande")
const yourDoc = (t: SignatureDocType) => (t === "quote" ? "votre devis" : "votre bon de commande")

function paris(d: Date | string, withTime = true): string {
  const date = typeof d === "string" ? new Date(d) : d
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(date)
}

const p = (html: string, style = "margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;") => `<p style="${style}">${html}</p>`
const small = (html: string) => p(html, "margin:16px 0 0;font-size:13px;color:#64748B;line-height:1.6;")

/* ------------------------------------------------------------------ */
/* 1. Demande de signature (au client)                                 */
/* ------------------------------------------------------------------ */

export function buildSignatureRequestEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  accentColor: string
  subtotalHt: number
  totalVat: number
  totalTtc: number
  expiresAt: string
  url: string
  codeRequired: boolean
}): { subject: string; html: string } {
  const subject = `${DocLabel(d.docType)} ${d.docNumber} à signer — ${d.companyName}`
  const body = `
    ${p("Bonjour,", "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`${e(d.companyName)} vous adresse ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong>. Vous pouvez le lire en entier en ligne, le télécharger, puis le signer ou le refuser.`)}
    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}
    ${ctaButton("Consulter et signer", e(d.url), d.accentColor)}
    ${small(`Ce lien vous est personnel : ne le transférez pas. Il est valable jusqu'au ${e(paris(d.expiresAt, false))}.${d.codeRequired ? " Pour signer, un code à 6 chiffres vous sera envoyé par email." : ""} Le PDF est aussi joint à cet email.`)}
    ${small("Signature électronique simple, proposée par Qonforme, le logiciel de facturation de l'entreprise.")}
  `
  return {
    subject,
    html: emailBase({
      accentColor: d.accentColor,
      companyName: e(d.companyName),
      preheader: e(`${DocLabel(d.docType)} ${d.docNumber} — ${fmtEur(d.totalTtc)} TTC — à consulter et signer en ligne`),
      body,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 2. Code de vérification (au client)                                 */
/* ------------------------------------------------------------------ */

export function buildSignatureCodeEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  accentColor: string
  code: string
  ttlMinutes: number
}): { subject: string; html: string } {
  const subject = `Votre code de signature : ${d.code}`
  const body = `
    ${p("Bonjour,", "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`Voici le code pour signer ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> de ${e(d.companyName)} :`)}
    <p style="margin:8px 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;color:#0F172A;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${e(d.code)}</p>
    ${small(`Il est valable ${d.ttlMinutes} minutes. Si vous n'avez pas demandé ce code, ignorez cet email : personne ne pourra signer sans lui.`)}
  `
  return {
    subject,
    html: emailBase({ accentColor: d.accentColor, companyName: e(d.companyName), preheader: `Code de signature : ${d.code}`, body }),
  }
}

/* ------------------------------------------------------------------ */
/* 3. Confirmation de signature (au client, avec le PDF signé)         */
/* ------------------------------------------------------------------ */

/**
 * Pour un particulier, c'est la confirmation sur support durable : elle
 * reprend les conditions du droit de rétractation et le formulaire type de
 * l'annexe à l'article R221-1 du Code de la consommation (art. L221-13).
 */
export function buildSignatureConfirmationEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  companyAddress: string | null
  companyEmail: string | null
  accentColor: string
  signerName: string
  signedAt: Date
  totalTtc: number
  clientKind: ClientKind
  context: SignatureContext
  earlyStartRequested: boolean
  withdrawalDeadline: string | null
  pageUrl: string | null
}): { subject: string; html: string } {
  const subject = `${DocLabel(d.docType)} ${d.docNumber} signé — ${d.companyName}`
  const consumer = d.clientKind === "consumer"
  const contact = [d.companyName, d.companyAddress, d.companyEmail].filter(Boolean).map((x) => e(x)).join(", ")

  const withdrawal = consumer ? `
    <div style="margin-top:24px;padding:18px 20px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0F172A;">Votre droit de rétractation</p>
      <p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">
        Vous pouvez vous rétracter sans donner de motif dans un délai de ${WITHDRAWAL_DAYS} jours à compter de la signature${d.withdrawalDeadline ? `, soit jusqu'au <strong>${e(fmtDate(d.withdrawalDeadline))}</strong> inclus` : ""}
        (Code de la consommation, art. L221-18 et L221-19). Pour l'exercer, envoyez avant la fin de ce délai le formulaire ci-dessous,
        ou toute autre déclaration sans ambiguïté, à : ${contact}.
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">
        ${d.earlyStartRequested
          ? "Vous avez demandé que les travaux commencent avant la fin de ce délai. Si vous vous rétractez ensuite, vous devrez le montant correspondant aux travaux réalisés jusqu'à votre rétractation, proportionnel au prix total (art. L221-25)."
          : "Vous n'avez pas demandé que les travaux commencent avant la fin de ce délai."}
        ${d.context === "in_person" ? " Signé sur place : aucun paiement ne peut vous être demandé avant 7 jours (art. L221-10)." : " Un acompte éventuellement versé vous est remboursé en cas de rétractation."}
      </p>
      <p style="margin:16px 0 6px;font-size:13px;font-weight:700;color:#0F172A;">Formulaire de rétractation</p>
      <p style="margin:0;font-size:12px;color:#475569;line-height:1.7;">
        (Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)<br/>
        À l'attention de ${contact} :<br/>
        Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la prestation de services ci-dessous :
        ${e(DocLabel(d.docType))} ${e(d.docNumber)}<br/>
        Commandé le : ${e(paris(d.signedAt, false))}<br/>
        Nom du (des) consommateur(s) :<br/>
        Adresse du (des) consommateur(s) :<br/>
        Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :<br/>
        Date :<br/>
        (*) Rayez la mention inutile.
      </p>
    </div>` : ""

  const body = `
    ${p(`Bonjour ${e(d.signerName)},`, "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`Vous avez signé ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> de ${e(d.companyName)} le ${e(paris(d.signedAt))} (heure de Paris), pour ${e(fmtEur(d.totalTtc))} TTC.`)}
    ${p(`Votre exemplaire signé est joint à cet email, avec son dossier de preuve. Conservez-le avec vos documents${d.docType === "quote" ? " : le devis signé vaut commande" : ""}.`)}
    ${withdrawal}
    ${d.pageUrl ? ctaButton("Revoir le document", e(d.pageUrl), d.accentColor) : ""}
    ${small("Signature électronique simple, proposée par Qonforme, le logiciel de facturation de l'entreprise.")}
  `
  return {
    subject,
    html: emailBase({ accentColor: d.accentColor, companyName: e(d.companyName), preheader: e(`${DocLabel(d.docType)} ${d.docNumber} signé — votre exemplaire est joint`), body }),
  }
}

/* ------------------------------------------------------------------ */
/* 4. Notification à l'artisan (au nom de Qonforme)                    */
/* ------------------------------------------------------------------ */

function qonformeBase(preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${preheader}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:32px 16px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background-color:#0F172A;border-radius:12px 12px 0 0;padding:22px 40px;">
        <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">Qonforme</p>
      </td></tr>
      <tr><td style="background-color:#FFFFFF;padding:36px 40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">${body}</td></tr>
      <tr><td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:18px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94A3B8;">Email automatique de Qonforme, envoyé pour votre compte.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

export function buildSignatureNotificationEmail(d: {
  outcome: "signed" | "refused"
  docType: SignatureDocType
  docNumber: string
  clientName: string | null
  signerName: string | null
  signerRole: string | null
  at: Date
  totalTtc: number
  clientOrderNumber?: string | null
  clientKind: ClientKind
  context: SignatureContext | null
  earlyStartRequested?: boolean
  withdrawalDeadline?: string | null
  reason?: RefusalReason | null
  message?: string | null
  docUrl: string
}): { subject: string; html: string } {
  const who = d.clientName || d.signerName || "Votre client"
  const signer = [d.signerName, d.signerRole].filter(Boolean).join(", ")
  const accent = "#2563EB"

  if (d.outcome === "signed") {
    const subject = `${DocLabel(d.docType)} ${d.docNumber} signé par ${who}`
    const next = d.docType === "quote"
      ? d.clientKind === "consumer"
        ? d.context === "in_person"
          ? `Prochaine étape : l'acompte. Signé sur place chez un particulier, aucun paiement ne peut être demandé avant 7 jours (Code de la consommation, art. L221-10). ${d.earlyStartRequested ? "Le client a demandé un démarrage avant la fin du délai de rétractation." : "Le client n'a pas demandé de démarrage avant la fin du délai de rétractation."}`
          : `Prochaine étape : l'acompte, s'il est prévu. Le client dispose d'un délai de rétractation de ${WITHDRAWAL_DAYS} jours${d.withdrawalDeadline ? `, jusqu'au ${fmtDate(d.withdrawalDeadline)}` : ""} ; ${d.earlyStartRequested ? "il a demandé que les travaux commencent avant la fin de ce délai." : "il n'a pas demandé de démarrage avant la fin de ce délai."}`
        : "Prochaine étape : l'acompte, s'il est prévu, puis la facture."
      : "La commande est confirmée."
    const body = `
      ${p(`Bonne nouvelle : <strong>${e(who)}</strong> a signé ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> (${e(fmtEur(d.totalTtc))} TTC) le ${e(paris(d.at))}.`)}
      ${signer ? p(`Signataire : ${e(signer)}.`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${d.clientOrderNumber ? p(`Numéro de commande du client : <strong>${e(d.clientOrderNumber)}</strong>. Reportez-le sur vos factures.`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${p(`${d.docType === "quote" ? "Le devis est passé à « Accepté »" : "Le bon de commande est passé à « Confirmé »"} et ne se modifie plus. ${e(next)}`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
      ${ctaButton(`Ouvrir ${docLabel(d.docType) === "devis" ? "le devis" : "le bon de commande"}`, e(d.docUrl), accent)}
      ${small("Le PDF signé et son dossier de preuve sont disponibles sur la fiche du document.")}
    `
    return { subject, html: qonformeBase(e(subject), body) }
  }

  const subject = `${DocLabel(d.docType)} ${d.docNumber} refusé par ${who}`
  const body = `
    ${p(`<strong>${e(who)}</strong> a refusé ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> (${e(fmtEur(d.totalTtc))} TTC) le ${e(paris(d.at))}.`)}
    ${p(`Motif : <strong>${e(refusalLabel(d.reason))}</strong>`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
    ${d.message ? `<div style="margin:0 0 16px;padding:14px 18px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">${e(d.message)}</div>` : ""}
    ${p(d.docType === "quote" ? "Le devis est passé à « Refusé ». Vous pouvez le dupliquer pour proposer une nouvelle version." : "Le bon de commande garde son statut : annulez-le ou proposez une nouvelle version depuis sa fiche.", "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
    ${ctaButton(`Ouvrir ${yourDoc(d.docType)}`, e(d.docUrl), accent)}
  `
  return { subject, html: qonformeBase(e(subject), body) }
}
