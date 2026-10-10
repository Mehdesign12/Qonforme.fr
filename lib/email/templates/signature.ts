/**
 * Emails de la signature en ligne (DECISIONS-STRATEGIQUES.md § 11 « Les emails ») :
 * - au client, au nom de l'entreprise (les réponses vont à l'artisan) : demande
 *   de signature, code de vérification, relance avant expiration, confirmation
 *   avec le PDF signé (et l'acompte), accusé de réception d'une rétractation,
 *   demande d'acompte différée (signature sur place chez un particulier) ;
 * - à l'artisan, au nom de Qonforme, sans inviter à répondre : signature reçue,
 *   refus avec son motif, rétractation.
 *
 * Vouvoiement, aucune promesse de contact humain, « signature électronique
 * simple » seulement. Toute donnée saisie (noms, motif, message) est échappée.
 */
import { amountBlock, ctaButton, emailBase, fmtDate, fmtEur } from "./base"
import { formatIbanGroups } from "@/lib/payment-link/iban"
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

/** Acompte annoncé au client : montant, et coordonnées du virement quand il est à régler. */
export interface EmailDeposit {
  amount: number
  percent: number
  reference: string
  timing: "now" | "later"
  requestOn: string | null
  account: { holder: string; iban: string; bic: string | null } | null
}

function depositBlock(d: EmailDeposit, consumer: boolean, accent: string): string {
  const title = `Acompte de ${e(fmtEur(d.amount))}${d.percent ? ` (${e(String(d.percent).replace(".", ","))} %)` : ""}`
  if (d.timing === "later" || !d.account) {
    return `
    <div style="margin-top:24px;padding:18px 20px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0F172A;">${title}</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">
        ${d.requestOn
          ? `Signé sur place : aucun paiement ne peut vous être demandé avant 7 jours (Code de la consommation, art. L221-10). Les coordonnées du virement vous seront envoyées le ${e(fmtDate(d.requestOn))}.`
          : "Les coordonnées du virement vous seront communiquées par l'entreprise."}
      </p>
    </div>`
  }
  const row = (label: string, value: string, mono = false) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#64748B;width:120px;vertical-align:top;">${label}</td>
        <td style="padding:8px 0;font-size:14px;color:#0F172A;font-weight:600;${mono ? "font-family:'SFMono-Regular',Menlo,Consolas,monospace;" : ""}word-break:break-all;">${value}</td>
      </tr>`
  return `
    <div style="margin-top:24px;padding:18px 20px;background-color:${accent}0D;border:1px solid ${accent}33;border-radius:10px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0F172A;">${title} à régler par virement</p>
      <p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">Indiquez bien la référence : elle permet à l'entreprise de reconnaître votre virement.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${row("Bénéficiaire", e(d.account.holder))}
        ${row("IBAN", e(formatIbanGroups(d.account.iban)), true)}
        ${d.account.bic ? row("BIC", e(d.account.bic), true) : ""}
        ${row("Montant", e(fmtEur(d.amount)))}
        ${row("Référence", e(d.reference))}
      </table>
      ${consumer ? `<p style="margin:8px 0 0;font-size:12px;color:#475569;line-height:1.6;">Si vous vous rétractez dans le délai, l'acompte vous est remboursé dans les 14 jours (art. L221-24).</p>` : ""}
    </div>`
}

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
      source: "email-signature",
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
    html: emailBase({ source: "email-signature", accentColor: d.accentColor, companyName: e(d.companyName), preheader: `Code de signature : ${d.code}`, body }),
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
  /** Lien « Changer d'avis » : formulaire de rétractation en ligne (particulier). */
  withdrawUrl?: string | null
  /** Réparation urgente demandée à la signature sur place (art. L221-10, 4°, et L221-28, 8°). */
  urgentRepair?: boolean
  deposit?: EmailDeposit | null
}): { subject: string; html: string } {
  const subject = `${DocLabel(d.docType)} ${d.docNumber} signé — ${d.companyName}`
  const consumer = d.clientKind === "consumer"
  const contact = [d.companyName, d.companyAddress, d.companyEmail].filter(Boolean).map((x) => e(x)).join(", ")

  const withdrawal = consumer ? `
    <div style="margin-top:24px;padding:18px 20px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0F172A;">Votre droit de rétractation</p>
      <p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">
        Vous pouvez vous rétracter sans donner de motif dans un délai de ${WITHDRAWAL_DAYS} jours à compter de la signature${d.withdrawalDeadline ? `, soit jusqu'au <strong>${e(fmtDate(d.withdrawalDeadline))}</strong> inclus` : ""}
        (Code de la consommation, art. L221-18 et L221-19). Pour l'exercer, ${d.withdrawUrl ? `utilisez le bouton « Changer d'avis » ci-dessous, ou envoyez` : "envoyez"} avant la fin de ce délai le formulaire ci-dessous,
        ou toute autre déclaration sans ambiguïté, à : ${contact}.
      </p>
      ${d.urgentRepair ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">Vous avez demandé une réparation urgente : le droit de rétractation ne s'applique pas aux travaux strictement nécessaires pour répondre à l'urgence (art. L221-28, 8°).</p>` : ""}
      <p style="margin:0 0 8px;font-size:13px;color:#334155;line-height:1.6;">
        ${d.earlyStartRequested
          ? "Vous avez demandé que les travaux commencent avant la fin de ce délai. Si vous vous rétractez ensuite, vous devrez le montant correspondant aux travaux réalisés jusqu'à votre rétractation, proportionnel au prix total (art. L221-25)."
          : "Vous n'avez pas demandé que les travaux commencent avant la fin de ce délai."}
        ${d.context === "in_person" && !d.urgentRepair ? " Signé sur place : aucun paiement ne peut vous être demandé avant 7 jours (art. L221-10)." : " Un acompte éventuellement versé vous est remboursé en cas de rétractation."}
      </p>
      ${d.withdrawUrl ? `<p style="margin:12px 0 0;"><a href="${e(d.withdrawUrl)}" style="display:inline-block;padding:10px 18px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;font-weight:600;color:#0F172A;text-decoration:none;">Changer d'avis</a></p>` : ""}
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
    ${d.deposit ? depositBlock(d.deposit, consumer, d.accentColor) : ""}
    ${withdrawal}
    ${d.pageUrl ? ctaButton("Revoir le document", e(d.pageUrl), d.accentColor) : ""}
    ${small("Signature électronique simple, proposée par Qonforme, le logiciel de facturation de l'entreprise.")}
  `
  return {
    subject,
    html: emailBase({ source: "email-signature", accentColor: d.accentColor, companyName: e(d.companyName), preheader: e(`${DocLabel(d.docType)} ${d.docNumber} signé — votre exemplaire est joint`), body }),
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
  outcome: "signed" | "refused" | "withdrawn"
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
  /** Acompte proposé au client à la signature. */
  deposit?: { amount: number; reference: string; timing: "now" | "later"; requestOn: string | null } | null
  /** Acompte réglé dans les paramètres, mais pas d'IBAN valide : rien n'a été proposé. */
  depositMissingIban?: boolean
  /** Rétractation : le devis avait déjà donné lieu à une facture. */
  invoiced?: boolean
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
    const depositText = d.deposit
      ? d.deposit.timing === "later" && d.deposit.requestOn
        ? `La demande d'acompte de ${fmtEur(d.deposit.amount)} partira toute seule le ${fmtDate(d.deposit.requestOn)}, avec vos coordonnées bancaires et la référence « ${d.deposit.reference} ». À réception du virement, émettez la facture d'acompte.`
        : `Vos coordonnées bancaires ont été données au client pour l'acompte de ${fmtEur(d.deposit.amount)}, avec la référence « ${d.deposit.reference} ». À réception du virement, émettez la facture d'acompte.`
      : d.depositMissingIban
        ? "Aucun acompte n'a été proposé au client : ajoutez votre IBAN dans Paramètres › Entreprise pour qu'il le soit à la prochaine signature."
        : ""
    const body = `
      ${p(`Bonne nouvelle : <strong>${e(who)}</strong> a signé ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> (${e(fmtEur(d.totalTtc))} TTC) le ${e(paris(d.at))}.`)}
      ${signer ? p(`Signataire : ${e(signer)}.`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${d.clientOrderNumber ? p(`Numéro de commande du client : <strong>${e(d.clientOrderNumber)}</strong>. Reportez-le sur vos factures.`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${p(`${d.docType === "quote" ? "Le devis est passé à « Accepté »" : "Le bon de commande est passé à « Confirmé »"} et ne se modifie plus. ${e(next)}`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
      ${depositText ? p(e(depositText), "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${ctaButton(`Ouvrir ${docLabel(d.docType) === "devis" ? "le devis" : "le bon de commande"}`, e(d.docUrl), accent)}
      ${small("Le PDF signé et son dossier de preuve sont disponibles sur la fiche du document.")}
    `
    return { subject, html: qonformeBase(e(subject), body) }
  }

  if (d.outcome === "withdrawn") {
    const subject = `${who} se rétracte : ${DocLabel(d.docType).toLowerCase()} ${d.docNumber}`
    const body = `
      ${p(`<strong>${e(who)}</strong> a exercé son droit de rétractation sur ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> (${e(fmtEur(d.totalTtc))} TTC) le ${e(paris(d.at))}, en ligne.`)}
      ${d.message ? `<div style="margin:0 0 16px;padding:14px 18px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">${e(d.message)}</div>` : ""}
      ${p(`${d.docType === "quote" ? "Le devis est passé à « Rétracté »" : "Le bon de commande est passé à « Annulé »"}. Un accusé de réception a été envoyé au client.`, "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
      ${p("À faire : rembourser toute somme reçue (acompte compris) au plus tard 14 jours après la rétractation (Code de la consommation, art. L221-24). Si les travaux ont commencé à sa demande expresse, le client doit le montant des travaux réalisés jusqu'à sa rétractation (art. L221-25).", "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
      ${d.invoiced ? p("Une facture a déjà été émise sur ce devis : annulez-la par un avoir.", "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;") : ""}
      ${ctaButton(`Ouvrir ${yourDoc(d.docType)}`, e(d.docUrl), accent)}
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

/* ------------------------------------------------------------------ */
/* 5. Relance avant expiration (au client)                             */
/* ------------------------------------------------------------------ */

export function buildSignatureExpiryReminderEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  accentColor: string
  totalTtc: number
  expiresAt: string
  daysLeft: number
  url: string
}): { subject: string; html: string } {
  const when = d.daysLeft <= 0 ? "aujourd'hui" : d.daysLeft === 1 ? "demain" : `dans ${d.daysLeft} jours`
  const subject = `${DocLabel(d.docType)} ${d.docNumber} : à signer avant le ${paris(d.expiresAt, false)}`
  const body = `
    ${p("Bonjour,", "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`${theDoc(d.docType).charAt(0).toUpperCase()}${theDoc(d.docType).slice(1)} <strong>${e(d.docNumber)}</strong> de ${e(d.companyName)}, d'un montant de ${e(fmtEur(d.totalTtc))} TTC, attend toujours votre réponse. Le lien de signature expire ${e(when)}, le ${e(paris(d.expiresAt, false))}.`)}
    ${p("Vous pouvez le relire en entier, puis le signer ou le refuser en ligne. Après cette date, il faudra demander une nouvelle version à l'entreprise.")}
    ${ctaButton("Consulter et signer", e(d.url), d.accentColor)}
    ${small("Ce lien vous est personnel : ne le transférez pas. Si vous avez déjà répondu à l'entreprise, ignorez cet email.")}
    ${small("Signature électronique simple, proposée par Qonforme, le logiciel de facturation de l'entreprise.")}
  `
  return {
    subject,
    html: emailBase({ source: "email-signature", accentColor: d.accentColor, companyName: e(d.companyName), preheader: e(`Le lien de signature expire ${when}`), body }),
  }
}

/* ------------------------------------------------------------------ */
/* 6. Accusé de réception de la rétractation (au client)               */
/* ------------------------------------------------------------------ */

/**
 * Accusé de réception sur support durable, envoyé sans délai quand la
 * rétractation est faite en ligne (C. consom. art. L221-21).
 */
export function buildWithdrawalAckEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  accentColor: string
  name: string
  signedAt: Date
  withdrawnAt: Date
  message: string | null
}): { subject: string; html: string } {
  const subject = `Votre rétractation est enregistrée — ${DocLabel(d.docType).toLowerCase()} ${d.docNumber}`
  const body = `
    ${p(`Bonjour ${e(d.name)},`, "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`Nous accusons réception de votre rétractation du contrat conclu avec ${e(d.companyName)} : ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong>, signé le ${e(paris(d.signedAt, false))}.`)}
    ${p(`Rétractation enregistrée le ${e(paris(d.withdrawnAt))} (heure de Paris). ${e(d.companyName)} en est informée.`)}
    ${d.message ? `<div style="margin:0 0 16px;padding:14px 18px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">${e(d.message)}</div>` : ""}
    ${p("Toute somme versée, acompte compris, doit vous être remboursée au plus tard 14 jours après votre rétractation, par le même moyen de paiement (Code de la consommation, art. L221-24). Si vous aviez demandé que les travaux commencent avant la fin du délai, le montant des travaux déjà réalisés reste dû (art. L221-25).", "margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;")}
    ${small("Conservez cet email : il vaut accusé de réception sur support durable (art. L221-21).")}
  `
  return {
    subject,
    html: emailBase({ source: "email-signature", accentColor: d.accentColor, companyName: e(d.companyName), preheader: e(`Rétractation enregistrée : ${d.docNumber}`), body }),
  }
}

/* ------------------------------------------------------------------ */
/* 7. Demande d'acompte différée (au client, J+8 après une signature   */
/*    sur place chez un particulier)                                   */
/* ------------------------------------------------------------------ */

export function buildDepositRequestEmail(d: {
  docType: SignatureDocType
  docNumber: string
  companyName: string
  accentColor: string
  name: string | null
  signedAt: Date
  deposit: EmailDeposit
}): { subject: string; html: string } {
  const subject = `Acompte de ${fmtEur(d.deposit.amount)} — ${DocLabel(d.docType).toLowerCase()} ${d.docNumber}`
  const body = `
    ${p(d.name ? `Bonjour ${e(d.name)},` : "Bonjour,", "margin:0 0 6px;font-size:15px;color:#475569;")}
    ${p(`Vous avez signé ${theDoc(d.docType)} <strong>${e(d.docNumber)}</strong> de ${e(d.companyName)} le ${e(paris(d.signedAt, false))}. Comme prévu, voici les coordonnées pour régler l'acompte.`)}
    ${depositBlock({ ...d.deposit, timing: "now" }, true, d.accentColor)}
    ${small("Si vous avez déjà réglé cet acompte ou si vous vous êtes rétracté, ignorez cet email.")}
  `
  return {
    subject,
    html: emailBase({ source: "email-signature", accentColor: d.accentColor, companyName: e(d.companyName), preheader: e(`Acompte de ${fmtEur(d.deposit.amount)} à régler par virement`), body }),
  }
}
