/**
 * Email d'invitation du comptable : une entreprise lui donne accès, en lecture
 * seule, à sa facturation sur Qonforme.
 *
 * Email automatique au nom de Qonforme : vouvoiement, aucune invitation à
 * répondre, aucune promesse de contact humain (CLAUDE.md). Nom de l'entreprise
 * et nom saisi par l'artisan sont des textes libres : toujours échappés.
 */
import { escapeHtml } from "./transfer-declared"
import { longDate } from "@/components/invoices/invoice-view"
import { INVITE_TTL_DAYS } from "@/lib/accountant/rules"

export interface AccountantInvitationEmail {
  companyName: string
  /** Prénom et nom de l'artisan, s'ils sont connus. */
  inviterName: string | null
  /** Nom ou cabinet saisi par l'artisan. */
  label: string | null
  email: string
  url: string
  expiresAt: string
}

export function buildAccountantInvitationEmail(d: AccountantInvitationEmail): { subject: string; html: string } {
  // Une ligne : le nom entre aussi dans l'objet de l'email
  const company = d.companyName.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || "Une entreprise"
  const who = d.inviterName?.trim() ? `${escapeHtml(d.inviterName.trim())} (${escapeHtml(company)})` : escapeHtml(company)
  const subject = `${company} vous donne accès à sa facturation sur Qonforme`
  const preheader = `Accès en lecture seule : factures émises, avoirs et exports comptables.`
  const greeting = d.label?.trim() ? `Bonjour ${escapeHtml(d.label.trim())},` : "Bonjour,"
  const until = longDate(d.expiresAt.slice(0, 10))

  const items = [
    "les factures émises et les avoirs, avec leur statut de paiement ;",
    "les totaux et la TVA facturée par période ;",
    "le fichier des écritures comptables (FEC), l'export des ventes (CSV) et les PDF de la période.",
  ]

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#2563EB;">Qonforme</p>
          <h1 style="margin:8px 0 0;font-size:21px;line-height:1.3;color:#0F172A;">${escapeHtml(company)} vous donne accès à sa facturation</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">${greeting}</p>
          <p style="margin:12px 0 0;font-size:15px;color:#334155;line-height:1.6;">
            ${who} vous invite à consulter sa facturation sur Qonforme, <strong style="color:#0F172A;">en lecture seule</strong>. Vous y trouverez :
          </p>
          <ul style="margin:10px 0 0;padding-left:20px;font-size:14px;color:#334155;line-height:1.7;">
            ${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
          </ul>
          <p style="margin:14px 0 0;font-size:14px;color:#475569;line-height:1.6;">
            Pour accepter, créez un compte Qonforme gratuit ou connectez-vous avec cette adresse :
            <strong style="color:#0F172A;">${escapeHtml(d.email)}</strong>. Aucune entreprise n'est à renseigner.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <a href="${escapeHtml(d.url)}" style="display:inline-block;padding:12px 22px;background:#2563EB;border-radius:999px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">Accepter l'invitation</a>
        </td></tr>
        <tr><td style="padding:12px 32px 32px;">
          <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
            Ce lien est personnel et valable ${INVITE_TTL_DAYS} jours, jusqu'au ${escapeHtml(until)}. Ne le transférez pas.
            Vos consultations et téléchargements sont enregistrés et visibles par l'entreprise, qui peut retirer l'accès à tout moment.
          </p>
          <p style="margin:12px 0 0;font-size:13px;color:#64748B;line-height:1.6;">
            Vous ne connaissez pas cette entreprise ? Ignorez cet email : aucun accès n'est ouvert sans votre acceptation.
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">Email automatique envoyé par Qonforme.</p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
