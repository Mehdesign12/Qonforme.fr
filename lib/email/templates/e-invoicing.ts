/**
 * Emails de la facturation électronique (canevas, planches E1 et E2) :
 * réception active, résumé des factures reçues, relève en échec.
 * Au nom de Qonforme, vouvoiement, aucune promesse de délai ni de contact humain.
 */
import { emailBase, ctaButton, monoLabel, FONT_BODY, FONT_MONO } from "@/lib/email/templates/base"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)

const FOOT = `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#4F5257;">Cet email vous est envoyé parce que vous avez raccordé Qonforme à une plateforme agréée. Réglez les notifications dans Paramètres › Facturation électronique.</p>`

function addressBlock(address: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border:1px solid #E7E4DC;border-radius:8px;">
    <tr><td style="padding:16px 18px;">
      ${monoLabel("Votre adresse de facturation électronique")}
      <div style="margin-top:6px;font-family:${FONT_MONO};font-size:20px;color:#15171C;">${esc(address)}</div>
    </td></tr>
  </table>`
}

export function buildReceptionActiveEmail(p: { firstName?: string | null; companyName: string; address: string | null }): { subject: string; html: string } {
  const hello = p.firstName ? `Bonjour ${esc(p.firstName)}, le` : "Le"
  const steps = [
    "Vos fournisseurs retrouvent cette adresse dans l'annuaire : vous n'avez rien à leur envoyer.",
    "Chaque facture reçue apparaît dans « Factures reçues », avec son fichier d'origine.",
    "Vous décidez : prendre en charge, approuver ou refuser avec un motif.",
  ]
  const body = `
    <p style="margin:0;font-size:16px;line-height:1.6;color:#2B2E35;">${hello} raccordement de ${esc(p.companyName)} à ${SUPERPDP_LABEL} est terminé. Les factures que vos fournisseurs vous envoient par la plateforme arrivent désormais dans Qonforme.</p>
    ${p.address ? addressBlock(p.address) : ""}
    <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${steps.map((s, i) => `<tr><td valign="top" style="padding:6px 10px 6px 0;font-family:${FONT_BODY};font-weight:700;color:#2563EB;">${i + 1}</td><td style="padding:6px 0;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:#2B2E35;">${s}</td></tr>`).join("")}
    </table>
    ${ctaButton("Ouvrir « Factures reçues »", `${APP_URL}/received-invoices`)}
    ${FOOT}`
  return {
    subject: "Votre réception de factures électroniques est active",
    html: emailBase({
      companyName: "Qonforme",
      preheader: `${p.companyName} reçoit désormais ses factures par ${SUPERPDP_LABEL}.`,
      headline: "Votre réception est",
      headlineAccent: "active.",
      body,
      source: "email-facturation-electronique",
      replyNote: "",
    }),
  }
}

export function buildReceivedDigestEmail(p: {
  companyName: string
  count: number
  invoices: { supplier: string; number: string | null; amount: string | null }[]
  each?: boolean
}): { subject: string; html: string } {
  const plural = p.count > 1
  const intro = p.each
    ? `Une nouvelle facture fournisseur est arrivée pour ${esc(p.companyName)} par ${SUPERPDP_LABEL}.`
    : `${p.count} nouvelle${plural ? "s" : ""} facture${plural ? "s" : ""} fournisseur${plural ? "s sont arrivées" : " est arrivée"} pour ${esc(p.companyName)} par ${SUPERPDP_LABEL}.`
  const rows = p.invoices.slice(0, 10).map((i, idx, arr) => `<tr>
      <td style="padding:12px 0;${idx < arr.length - 1 ? "border-bottom:1px solid #E7E4DC;" : ""}font-family:${FONT_BODY};font-size:14px;color:#15171C;">${esc(i.supplier)}${i.number ? `<br/><span style="font-family:${FONT_MONO};font-size:12px;color:#4F5257;">${esc(i.number)}</span>` : ""}</td>
      <td align="right" style="padding:12px 0;${idx < arr.length - 1 ? "border-bottom:1px solid #E7E4DC;" : ""}font-family:${FONT_BODY};font-size:14px;font-weight:600;color:#15171C;">${i.amount ? esc(i.amount) : ""}</td>
    </tr>`).join("")
  const more = p.count > 10 ? `<p style="margin:10px 0 0;font-size:13px;color:#4F5257;">Et ${p.count - 10} autre${p.count - 10 > 1 ? "s" : ""}.</p>` : ""
  const body = `
    <p style="margin:0;font-size:16px;line-height:1.6;color:#2B2E35;">${intro}</p>
    ${rows ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #E7E4DC;">${rows}</table>${more}` : ""}
    ${ctaButton("Voir les factures reçues", `${APP_URL}/received-invoices`)}
    ${FOOT}`
  return {
    subject: p.each ? "Nouvelle facture reçue" : `${p.count} nouvelle${plural ? "s" : ""} facture${plural ? "s" : ""} reçue${plural ? "s" : ""}`,
    html: emailBase({
      companyName: "Qonforme",
      preheader: intro.replace(/<[^>]+>/g, ""),
      headline: p.each ? "Une facture" : "Vos factures",
      headlineAccent: p.each ? "vient d'arriver." : "du jour.",
      body,
      source: "email-factures-recues",
      replyNote: "",
    }),
  }
}

export function buildSyncFailureEmail(p: { companyName: string }): { subject: string; html: string } {
  const body = `
    <p style="margin:0;font-size:16px;line-height:1.6;color:#2B2E35;">Qonforme n'est plus autorisé à lire les factures reçues de ${esc(p.companyName)} sur ${SUPERPDP_LABEL} : l'autorisation a expiré ou a été retirée. Vos factures déjà reçues restent dans Qonforme ; les nouvelles n'y arrivent plus tant que vous n'autorisez pas à nouveau.</p>
    ${ctaButton("Autoriser à nouveau", `${APP_URL}/facturation-electronique`)}
    ${FOOT}`
  return {
    subject: "Vos factures reçues n'arrivent plus dans Qonforme",
    html: emailBase({
      companyName: "Qonforme",
      preheader: "L'autorisation donnée à Qonforme a expiré : autorisez à nouveau.",
      headline: "Autorisation",
      headlineAccent: "à renouveler.",
      body,
      source: "email-facturation-electronique",
      replyNote: "",
    }),
  }
}
