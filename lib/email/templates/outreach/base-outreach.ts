/**
 * Template de base pour les emails d'outreach B2B.
 * Différent du template transactionnel (pas de "Propulsé par Qonforme" en header).
 * Inclut :
 * - Pixel de tracking ouverture
 * - Lien de désinscription obligatoire
 * - Footer Qonforme
 */

export interface OutreachTemplateData {
  nom_entreprise: string
  metier: string
  ville: string
  sendId: string        // ID du campaign_send pour le tracking
  baseUrl: string       // ex: "https://qonforme.fr"
}

export function outreachBase({
  preheader,
  body,
  data,
}: {
  preheader: string
  body: string
  data: OutreachTemplateData
}): string {
  const unsubscribeUrl = `${data.baseUrl}/api/outreach/unsubscribe?id=${data.sendId}`
  const trackingPixelUrl = `${data.baseUrl}/api/tracking/open?id=${data.sendId}`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${preheader}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#2563EB;border-radius:12px 12px 0 0;padding:24px 40px;">
              <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">
                Qonforme
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">
                Facturation électronique pour artisans et TPE
              </p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="background-color:#FFFFFF;padding:36px 40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                Qonforme.fr — Facturation électronique pour artisans et TPE
              </p>
              <p style="margin:8px 0 0;">
                <a href="${unsubscribeUrl}"
                   style="font-size:11px;color:#94A3B8;text-decoration:underline;">
                  Se désinscrire de ces emails
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- Pixel de tracking ouverture (1x1 transparent) -->
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
</body>
</html>`
}

/** Bouton CTA pour outreach */
export function outreachCta(label: string, href: string, sendId: string, baseUrl: string): string {
  // Lien tracké via redirect
  const trackedHref = `${baseUrl}/api/tracking/click?id=${sendId}&url=${encodeURIComponent(href)}`

  return `
  <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr>
      <td style="background-color:#2563EB;border-radius:8px;">
        <a href="${trackedHref}"
           style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}
