/**
 * Template 3 — Offre lancement (J+10)
 *
 * Dernier email de la séquence. Envoyé aux prospects qui n'ont PAS converti.
 * Ton : offre, urgence douce. Dernier rappel.
 */

import { outreachBase, outreachCta, type OutreachTemplateData } from "./base-outreach"

export function buildOffreLancement(data: OutreachTemplateData): {
  subject: string
  html: string
} {
  const subject = `Offre de lancement — Qonforme à 9€/mois pour les ${data.metier}s`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Bonjour,
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      C'est notre dernier message à propos de la facturation électronique obligatoire.
      Nous voulions vous informer de notre <strong>offre de lancement</strong> pour
      les ${data.metier}s comme <strong>${data.nom_entreprise}</strong>.
    </p>

    <!-- Offre -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:2px solid #2563EB;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background-color:#2563EB;padding:16px 24px;text-align:center;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;">
            Offre Starter — spécial ${data.metier}s
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;background-color:#FFFFFF;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">
                ✅ Factures Factur-X conformes 2026
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">
                ✅ Devis, bons de commande, avoirs
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">
                ✅ Envoi par email en 1 clic
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">
                ✅ Lookup SIREN automatique
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">
                ✅ Export comptable FEC
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;">
                ✅ Dashboard et suivi des paiements
              </td>
            </tr>
          </table>

          <div style="text-align:center;margin-top:20px;">
            <p style="margin:0;">
              <span style="font-size:36px;font-weight:800;color:#2563EB;">9€</span>
              <span style="font-size:15px;color:#64748B;">/mois HT</span>
            </p>
            <p style="margin:4px 0 0;font-size:13px;color:#94A3B8;">
              Sans engagement · Annulable à tout moment
            </p>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:15px;color:#1E293B;line-height:1.6;">
      L'échéance de septembre 2026 approche. <strong>Anticipez dès maintenant</strong>
      pour éviter les sanctions et les problèmes de dernière minute.
    </p>

    ${outreachCta("Créer mon compte →", `${data.baseUrl}/signup`, data.sendId, data.baseUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#64748B;line-height:1.5;">
      C'est le dernier email de notre part sur ce sujet. Si vous êtes déjà équipé
      ou si vous ne souhaitez plus recevoir nos messages,
      <a href="${data.baseUrl}/api/outreach/unsubscribe?id=${data.sendId}" style="color:#64748B;text-decoration:underline;">cliquez ici</a>.
    </p>
  `

  return {
    subject,
    html: outreachBase({
      preheader: `Offre de lancement Qonforme : 9€/mois pour les ${data.metier}s — conformité 2026 garantie`,
      body,
      data,
    }),
  }
}
