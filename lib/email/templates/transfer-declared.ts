/**
 * Email à l'artisan : son client indique avoir fait le virement depuis la page
 * de règlement. Rien n'est marqué payé : l'artisan vérifie son compte puis
 * confirme lui-même (« Marquer payée »).
 *
 * Email automatique de Qonforme : vouvoiement, aucune invitation à répondre,
 * aucune promesse de contact humain (CLAUDE.md). La note du client est un
 * texte libre venu d'une page publique : toujours échappée.
 *
 * Délais cités : virement SEPA crédité au plus tard à la fin du jour ouvrable
 * suivant (directive (UE) 2015/2366, art. 83, § 1) ; virement instantané en
 * dix secondes au plus (règlement (UE) 260/2012 modifié par le règlement
 * (UE) 2024/886, art. 5 bis).
 */
import { fmtEur } from "./base"
import { longDate } from "@/components/invoices/invoice-view"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export interface TransferDeclaredEmail {
  invoiceNumber: string
  clientName: string | null
  amount: number
  transferDate: string
  note: string | null
  invoiceUrl: string
}

export function buildTransferDeclaredEmail(d: TransferDeclaredEmail): { subject: string; html: string } {
  const who = d.clientName?.trim() || "Votre client"
  const subject = `Virement déclaré pour la facture ${d.invoiceNumber}`
  const preheader = `${who} indique avoir viré ${fmtEur(d.amount)} le ${longDate(d.transferDate)}.`
  const note = d.note?.trim()
    ? `<p style="margin:16px 0 0;padding:12px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;color:#334155;line-height:1.5;white-space:pre-line;">
         <strong style="display:block;margin-bottom:4px;color:#64748B;font-weight:600;">Note du client</strong>${escapeHtml(d.note.trim())}
       </p>`
    : ""

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
          <h1 style="margin:8px 0 0;font-size:21px;line-height:1.3;color:#0F172A;">Virement déclaré pour la facture ${escapeHtml(d.invoiceNumber)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
            ${escapeHtml(who)} indique, depuis la page de règlement, avoir effectué un virement de
            <strong style="color:#0F172A;">${fmtEur(d.amount)}</strong> le <strong style="color:#0F172A;">${longDate(d.transferDate)}</strong>.
          </p>
          ${note}
          <p style="margin:16px 0 0;font-size:14px;color:#475569;line-height:1.6;">
            Un virement classique est crédité au plus tard le jour ouvrable qui suit son exécution par la banque
            de votre client, un virement instantané en quelques secondes. Vérifiez votre compte bancaire, puis
            marquez la facture comme payée à réception des fonds : rien n'est marqué payé automatiquement.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <a href="${escapeHtml(d.invoiceUrl)}" style="display:inline-block;padding:12px 22px;background:#2563EB;border-radius:999px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">Voir la facture</a>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">Email automatique envoyé par Qonforme.</p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
