/**
 * Template de base commun à tous les emails Qonforme (piste « C · Éditorial »,
 * choisie par le fondateur le 19/10/2026).
 * Rendu en tableaux HTML et styles en ligne pour la compatibilité maximale avec
 * les clients mail : Outlook et Gmail ignorent les polices web et les coins
 * arrondis, et retombent sur les piles de secours ci-dessous.
 *
 * Polices : hébergées sur le site (public/email-fonts/), jamais chez un tiers :
 * un lien Google Fonts enverrait l'adresse IP du destinataire à Google à chaque
 * ouverture de l'email. Elles ne s'affichent que dans Apple Mail et sur iPhone.
 *
 * « Propulsé par Qonforme » est un lien vers le site avec sa provenance
 * (lib/utils/powered-by.ts), sans traceur dans l'email.
 */
import { poweredByUrl } from "@/lib/utils/powered-by"

/** Piles de polices : la première est la police web, les suivantes le repli. */
export const FONT_DISPLAY = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif"
export const FONT_SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif"
export const FONT_BODY = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
export const FONT_MONO = "'DM Mono',Menlo,Consolas,'Courier New',monospace"

/** Couleurs de l'encre et des filets (le fond des emails est chaud, pas gris-bleu). */
const INK = "#15171C"
const MUTED = "#4F5257"
const RULE = "#DAD7CF"

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")
}

/** `@font-face` des polices du site, servies par public/email-fonts/. */
function fontFaces(): string {
  const f = `${siteUrl()}/email-fonts`
  return `
    @font-face{font-family:'Bricolage Grotesque';font-weight:700;font-style:normal;src:url(${f}/BricolageGrotesque-700.woff) format('woff');}
    @font-face{font-family:'Instrument Serif';font-weight:400;font-style:italic;src:url(${f}/InstrumentSerif-400-italic.woff2) format('woff2');}
    @font-face{font-family:'DM Sans';font-weight:400 700;font-style:normal;src:url(${f}/DMSans.woff2) format('woff2');}
    @font-face{font-family:'DM Mono';font-weight:400;font-style:normal;src:url(${f}/DMMono-400.woff2) format('woff2');}`
}

export function emailBase({
  accentColor = "#2563EB",
  companyName,
  preheader,
  body,
  source = "email",
  reference,
  headline,
  headlineAccent,
}: {
  accentColor?: string
  companyName: string
  preheader: string
  body: string
  /** Provenance du lien « Propulsé par Qonforme » (« email-facture », « email-devis »…). */
  source?: string
  /** Numéro du document, en haut à droite (« N° F-2026-018 »). */
  reference?: string
  /** Titre en deux voix : première ligne en caractères droits, seconde en italique à la couleur de l'entreprise. */
  headline?: string
  headlineAccent?: string
}): string {
  const qonforme = `<a href="${poweredByUrl(source)}" style="color:${INK};font-weight:700;text-decoration:underline;" target="_blank" rel="noopener">Qonforme</a>`
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${preheader}</title>
  <style>
    ${fontFaces()}
    @media only screen and (max-width:620px){
      .q-pad{padding-left:24px !important;padding-right:24px !important;}
      .q-h1{font-size:32px !important;}
      .q-h1 span{font-size:37px !important;}
      .q-total{font-size:40px !important;}
      .q-stack{display:block !important;width:100% !important;text-align:left !important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ECEAE4;font-family:${FONT_BODY};">
  <!-- Preheader invisible -->
  <span style="display:none;font-size:1px;color:#ECEAE4;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECEAE4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid ${RULE};border-radius:6px;">

          <!-- Filet à la couleur de l'entreprise -->
          <tr>
            <td height="6" style="height:6px;line-height:6px;font-size:0;background-color:${accentColor};border-radius:6px 6px 0 0;">&nbsp;</td>
          </tr>

          <!-- En-tête : entreprise et numéro -->
          <tr>
            <td class="q-pad" style="padding:36px 48px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${FONT_DISPLAY};font-weight:700;font-size:17px;letter-spacing:-0.3px;color:${INK};">${companyName}</td>
                  ${reference ? `<td align="right" style="font-family:${FONT_MONO};font-size:11.5px;letter-spacing:0.6px;color:${MUTED};">${reference}</td>` : ""}
                </tr>
              </table>
            </td>
          </tr>

          ${headline ? `
          <!-- Titre en deux voix -->
          <tr>
            <td class="q-pad" style="padding:44px 48px 0;">
              <div class="q-h1" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:40px;line-height:1.1;letter-spacing:-1.4px;color:${INK};">${headline}${headlineAccent ? `<br/><span style="font-family:${FONT_SERIF};font-style:italic;font-weight:400;font-size:46px;letter-spacing:-0.5px;color:${accentColor};">${headlineAccent}</span>` : ""}</div>
            </td>
          </tr>` : ""}

          <!-- Corps -->
          <tr>
            <td class="q-pad" style="padding:${headline ? "24px" : "40px"} 48px 0;font-family:${FONT_BODY};">
              ${body}
            </td>
          </tr>

          <!-- Pied -->
          <tr>
            <td class="q-pad" style="padding:40px 48px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};">
                <tr>
                  <td class="q-stack" style="padding:18px 0 22px;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${MUTED};">Envoyé par <strong style="font-weight:600;">${companyName}</strong> avec ${qonforme}</td>
                  <td class="q-stack" align="right" style="padding:18px 0 22px;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${MUTED};">Répondez à cet email pour toute question</td>
                </tr>
              </table>
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

/**
 * Bouton principal : encre, coins peu arrondis, aligné à gauche. Le paramètre
 * `color` n'est plus utilisé : la couleur de l'entreprise vit dans le filet du
 * haut, le titre et le filet du total ; le bouton garde l'encre pour le contraste.
 */
export function ctaButton(label: string, href: string, color?: string): string {
  void color
  return `
  <table cellpadding="0" cellspacing="0" style="margin:30px 0 0;">
    <tr>
      <td style="background-color:${INK};border-radius:4px;">
        <a href="${href}"
           style="display:inline-block;padding:16px 30px;color:#FFFFFF;font-family:${FONT_DISPLAY};font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.1px;">
          ${label}&nbsp;&nbsp;→
        </a>
      </td>
    </tr>
  </table>`
}

/** Note de l'artisan : un filet et une étiquette, sans encadré coloré. */
export function notesBlock(notes: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${RULE};">
    <tr>
      <td style="padding:14px 0 0;">
        <p style="margin:0 0 4px;font-family:${FONT_MONO};font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">Notes</p>
        <p style="margin:0;font-size:14px;color:#2B2E35;line-height:1.6;">${notes}</p>
      </td>
    </tr>
  </table>`
}

/** Étiquette en petites capitales à chasse fixe (« TOTAL TTC », « VIREMENT SUR »). */
export function monoLabel(text: string): string {
  return `<span style="font-family:${FONT_MONO};font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${text}</span>`
}

/** Bloc récap montants */
/**
 * Retenue de garantie (loi n° 71-584 du 16 juillet 1971) : le total TTC ne
 * change pas ; la retenue se règle à sa libération, le reste à l'échéance.
 */
export function retentionBlock(totalTtc: number, retention: { rate: number; amount: number } | null | undefined): string {
  if (!retention || !(retention.amount > 0)) return ""
  const now = Math.round((totalTtc - retention.amount) * 100) / 100
  const rate = String(Math.round(retention.rate * 100) / 100).replace(".", ",")
  return `
  <p style="margin:12px 0 0;font-size:13px;color:#2B2E35;line-height:1.6;">
    Retenue de garantie de ${rate}&nbsp;% : <strong>${fmtEur(retention.amount)}</strong>, à régler à sa libération,
    un an après la réception des travaux. Montant à régler à l'échéance : <strong>${fmtEur(now)}</strong>.
  </p>`
}

/**
 * Total TTC en grand, sous-total HT et TVA à droite. Le filet du haut prend la
 * couleur de l'entreprise (`accentColor`).
 */
export function amountBlock(subtotalHt: number, totalVat: number, totalTtc: number, accentColor: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0"
         style="margin-top:28px;border-top:2px solid ${accentColor};border-bottom:1px solid ${RULE};">
    <tr>
      <td class="q-stack" valign="bottom" style="padding:22px 0 20px;">
        ${monoLabel("Total TTC")}
        <div class="q-total" style="font-family:${FONT_BODY};font-weight:400;font-size:44px;line-height:1;letter-spacing:-1.4px;color:${INK};margin-top:6px;">${fmtEur(totalTtc)}</div>
      </td>
      <td class="q-stack" align="right" valign="bottom" style="padding:22px 0 20px;font-size:13px;line-height:1.7;color:${MUTED};">
        <div>Sous-total HT <strong style="color:${INK};font-weight:600;margin-left:14px;">${fmtEur(subtotalHt)}</strong></div>
        <div>TVA <strong style="color:${INK};font-weight:600;margin-left:14px;">${fmtEur(totalVat)}</strong></div>
      </td>
    </tr>
  </table>`
}
