/**
 * Template 2 — Invitation démo (J+5)
 *
 * Envoyé uniquement aux prospects qui n'ont PAS cliqué sur le template 1.
 * Ton : solution, simplicité. Montrer que c'est facile.
 */

import { outreachBase, outreachCta, type OutreachTemplateData } from "./base-outreach"

export function buildInvitationDemo(data: OutreachTemplateData): {
  subject: string
  html: string
} {
  const subject = `Créez votre première facture conforme en 3 clics — ${data.nom_entreprise}`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Bonjour,
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      La semaine dernière, nous vous informions de l'obligation de facturation électronique
      pour les ${data.metier}s. Aujourd'hui, on vous montre <strong>à quel point c'est simple</strong>
      de s'y conformer.
    </p>

    <p style="margin:0 0 20px;font-size:15px;color:#1E293B;line-height:1.6;">
      Avec <strong>Qonforme</strong>, en 3 étapes :
    </p>

    <!-- Étapes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:12px 16px;border-left:3px solid #2563EB;background-color:#F8FAFC;border-radius:0 8px 8px 0;margin-bottom:8px;">
          <p style="margin:0;font-size:14px;color:#1E293B;">
            <strong style="color:#2563EB;">1.</strong> Renseignez le SIREN de votre client — ses infos se remplissent automatiquement
          </p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;border-left:3px solid #2563EB;background-color:#F8FAFC;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#1E293B;">
            <strong style="color:#2563EB;">2.</strong> Ajoutez vos lignes de prestation — TVA, mentions légales, tout est géré
          </p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;border-left:3px solid #2563EB;background-color:#F8FAFC;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#1E293B;">
            <strong style="color:#2563EB;">3.</strong> Envoyez — votre facture Factur-X conforme part directement par email
          </p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
            💬 <em>« J'ai remplacé mon fichier Excel par Qonforme en 10 minutes.
            Mes factures sont maintenant conformes et mes clients les reçoivent directement. »</em>
          </p>
          <p style="margin:8px 0 0;font-size:13px;color:#15803D;font-weight:600;">
            — Un ${data.metier} à ${data.ville || "Paris"}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:15px;color:#1E293B;line-height:1.6;">
      <strong>Essayez la démo interactive</strong> — aucune inscription requise, 2 minutes :
    </p>

    ${outreachCta("Essayer la démo gratuite →", `${data.baseUrl}/demo`, data.sendId, data.baseUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#64748B;line-height:1.5;">
      Cet email vous est adressé car <strong>${data.nom_entreprise}</strong>
      est référencé comme ${data.metier} dans le registre Sirene de l'INSEE.
    </p>
  `

  return {
    subject,
    html: outreachBase({
      preheader: `Créez votre première facture conforme en 3 clics — démo interactive gratuite`,
      body,
      data,
    }),
  }
}
