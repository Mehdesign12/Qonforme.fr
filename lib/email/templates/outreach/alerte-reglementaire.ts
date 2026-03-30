/**
 * Template 1 — Alerte réglementaire (J0)
 *
 * Ton : informatif, créer l'urgence sans être commercial.
 * Objectif : informer le prospect de l'obligation légale.
 */

import { outreachBase, outreachCta, type OutreachTemplateData } from "./base-outreach"

export function buildAlerteReglementaire(data: OutreachTemplateData): {
  subject: string
  html: string
} {
  const subject = `Facturation électronique obligatoire en 2026 — ${data.nom_entreprise}, êtes-vous prêt ?`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Bonjour,
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      En tant que <strong>${data.metier}</strong> à <strong>${data.ville || "votre ville"}</strong>,
      vous êtes directement concerné par la <strong>réforme de la facturation électronique</strong> :
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-left:4px solid #2563EB;background-color:#EFF6FF;border-radius:0 8px 8px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1E40AF;">📅 Ce qui change pour vous :</p>
          <ul style="margin:0;padding-left:20px;font-size:14px;color:#1E293B;line-height:1.8;">
            <li><strong>Septembre 2026</strong> — Obligation de <strong>recevoir</strong> des factures électroniques</li>
            <li><strong>Septembre 2027</strong> — Obligation d'<strong>émettre</strong> vos factures au format Factur-X</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Concrètement, <strong>toutes vos factures</strong> (devis acceptés, avoirs, bons de commande)
      devront respecter la norme européenne <strong>EN 16931</strong> et être transmises
      via une Plateforme de Dématérialisation Partenaire (PDP).
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Les sanctions en cas de non-conformité : <strong>15 € par facture</strong> non conforme,
      plafonné à 15 000 € par an.
    </p>

    <p style="margin:0 0 8px;font-size:15px;color:#1E293B;line-height:1.6;">
      <strong>Qonforme</strong> est un logiciel de facturation spécialement conçu pour
      les ${data.metier}s et TPE, déjà conforme Factur-X. En quelques minutes,
      vous pouvez créer et envoyer des factures aux normes.
    </p>

    ${outreachCta("En savoir plus →", `${data.baseUrl}/facturation/${slugify(data.metier)}`, data.sendId, data.baseUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#64748B;line-height:1.5;">
      Cet email vous est adressé car <strong>${data.nom_entreprise}</strong>
      est référencé comme ${data.metier} dans le registre Sirene de l'INSEE.
    </p>
  `

  return {
    subject,
    html: outreachBase({
      preheader: `Facturation électronique obligatoire en 2026 — ce qui change pour les ${data.metier}s`,
      body,
      data,
    }),
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
