/**
 * Emails de la discussion avec Christophe : accusé de réception au visiteur, réponse
 * de Christophe, et notification de l'équipe. Le texte saisi est toujours échappé.
 * Aucun délai de réponse n'est promis.
 */
import { emailBase, ctaButton, FONT_BODY } from "@/lib/email/templates/base"

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
const paragraphs = (text: string) =>
  text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#2B2E35;">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("")

const greeting = (name: string | null) => (name ? `Bonjour ${esc(name.split(/\s+/)[0])},` : "Bonjour,")

export function buildVisitorReceiptEmail(d: { name: string | null; link: string }): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#2B2E35;">${greeting(d.name)}</p>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#2B2E35;">Nous avons bien reçu votre message. Christophe vous répondra par email, à cette adresse.</p>
    <p style="margin:0 0 6px;font-size:16px;line-height:1.65;color:#2B2E35;">Pour ajouter un détail ou retrouver la conversation, ouvrez le lien ci-dessous.</p>
    ${ctaButton("Ouvrir la conversation", esc(d.link))}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#4F5257;">Vous recevez cet email parce que vous avez écrit à Qonforme. Votre adresse ne sert qu'à vous répondre.</p>`
  return {
    subject: "Votre message à Qonforme est bien reçu",
    html: emailBase({ companyName: "Qonforme", preheader: "Votre message est bien reçu.", replyNote: "", body, source: "email-contact", headline: "Message", headlineAccent: "bien reçu." }),
  }
}

export function buildVisitorReplyEmail(d: {
  name: string | null
  reply: string
  original: string | null
  attachments: string[]
  link: string
}): { subject: string; html: string } {
  const quote = d.original
    ? `<div style="margin:26px 0 0;border-left:3px solid #E7E4DC;padding:2px 0 2px 16px;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:#4F5257;"><div style="font-weight:600;margin-bottom:4px;">Votre message</div>${esc(d.original.slice(0, 600)).replace(/\n/g, "<br/>")}${d.original.length > 600 ? "…" : ""}</div>`
    : ""
  const files = d.attachments.length
    ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4F5257;">Pièce${d.attachments.length > 1 ? "s" : ""} jointe${d.attachments.length > 1 ? "s" : ""} : ${d.attachments.map(esc).join(", ")}. Elle${d.attachments.length > 1 ? "s sont" : " est"} à retrouver dans la conversation.</p>`
    : ""
  const body = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#2B2E35;">${greeting(d.name)}</p>
    ${paragraphs(d.reply)}
    ${files}
    <p style="margin:6px 0 2px;font-size:16px;font-weight:600;color:#15171C;">Christophe</p>
    <p style="margin:0 0 4px;font-size:14px;color:#4F5257;">Responsable service client, Qonforme</p>
    ${ctaButton("Ouvrir la conversation", esc(d.link))}
    ${quote}`
  return {
    subject: "Christophe vous répond",
    html: emailBase({ companyName: "Qonforme", preheader: esc(d.reply.slice(0, 90)), replyNote: "", body, source: "email-contact", headline: "Christophe vous", headlineAccent: "répond." }),
  }
}

export function buildTeamNotificationEmail(d: {
  name: string | null
  email: string
  message: string
  source: string
  path: string | null
  isNew: boolean
  attachments: number
  inboxUrl: string
}): { subject: string; html: string } {
  const who = d.name ? `${esc(d.name)} (${esc(d.email)})` : esc(d.email)
  const body = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#2B2E35;"><strong>${who}</strong> ${d.isNew ? "vient d'écrire" : "a répondu"} : ${esc(d.source)}${d.path ? `, depuis ${esc(d.path)}` : ""}.</p>
    <div style="margin:0 0 14px;border-left:3px solid #E7E4DC;padding:2px 0 2px 16px;font-size:15px;line-height:1.6;color:#2B2E35;">${esc(d.message.slice(0, 1500)).replace(/\n/g, "<br/>")}</div>
    ${d.attachments ? `<p style="margin:0 0 14px;font-size:14px;color:#4F5257;">${d.attachments} pièce${d.attachments > 1 ? "s" : ""} jointe${d.attachments > 1 ? "s" : ""}.</p>` : ""}
    ${ctaButton("Répondre dans l'admin", esc(d.inboxUrl))}`
  return {
    subject: `${d.isNew ? "Nouveau message" : "Nouvelle réponse"} de ${d.name ?? d.email}`,
    html: emailBase({ companyName: "Qonforme", preheader: esc(d.message.slice(0, 90)), replyNote: "", body, source: "email-contact" }),
  }
}
