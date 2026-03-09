/**
 * Template de base commun à tous les emails Qonforme.
 * Rendu en HTML inline-styles pour compatibilité maximale avec les clients mail.
 */

export function emailBase({
  accentColor = "#2563EB",
  companyName,
  preheader,
  body,
}: {
  accentColor?: string
  companyName: string
  preheader: string
  body: string
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${preheader}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- Preheader invisible -->
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header bande couleur -->
          <tr>
            <td style="background-color:${accentColor};border-radius:12px 12px 0 0;padding:28px 40px;">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${companyName}
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.80);font-size:13px;">
                Propulsé par <strong>Qonforme</strong>
              </p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="background-color:#FFFFFF;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                Cet email a été envoyé par <strong>${companyName}</strong> via Qonforme.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#CBD5E1;">
                Si vous avez des questions, répondez directement à cet email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Formate un montant en EUR avec séparateurs français */
export function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n)
}

/** Formate une date ISO en français */
export function fmtDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    }).format(new Date(d))
  } catch {
    return d
  }
}

/** Bouton CTA centré */
export function ctaButton(label: string, href: string, color: string): string {
  return `
  <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr>
      <td style="background-color:${color};border-radius:8px;">
        <a href="${href}"
           style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

/** Bloc récap montants */
export function amountBlock(subtotalHt: number, totalVat: number, totalTtc: number, accentColor: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0"
         style="margin-top:28px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
    <tr style="background-color:#F8FAFC;">
      <td style="padding:12px 20px;font-size:13px;color:#64748B;">Sous-total HT</td>
      <td style="padding:12px 20px;font-size:13px;color:#1E293B;text-align:right;font-weight:500;">${fmtEur(subtotalHt)}</td>
    </tr>
    <tr>
      <td style="padding:12px 20px;font-size:13px;color:#64748B;border-top:1px solid #E2E8F0;">TVA</td>
      <td style="padding:12px 20px;font-size:13px;color:#1E293B;text-align:right;font-weight:500;border-top:1px solid #E2E8F0;">${fmtEur(totalVat)}</td>
    </tr>
    <tr style="background-color:${accentColor}10;">
      <td style="padding:16px 20px;font-size:16px;font-weight:700;color:${accentColor};border-top:2px solid ${accentColor}30;">
        Total TTC
      </td>
      <td style="padding:16px 20px;font-size:18px;font-weight:700;color:${accentColor};text-align:right;border-top:2px solid ${accentColor}30;">
        ${fmtEur(totalTtc)}
      </td>
    </tr>
  </table>`
}
