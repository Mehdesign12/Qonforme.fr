import { emailBase, fmtEur, fmtDate, amountBlock, ctaButton, retentionBlock } from "./base"
import { INDEMNITE_FORFAITAIRE, SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT } from "@/lib/outils/penalites"

/**
 * Relance d'une facture : rappel avant l'échéance, ou relance d'une facture
 * échue. Vouvoiement, ton courtois, sans menace : la dernière relance demande
 * un règlement rapide et invite à répondre en cas de difficulté.
 *
 * Client professionnel (SIREN renseigné) : rappel neutre des pénalités de
 * retard et de l'indemnité forfaitaire de 40 €, dues de plein droit entre
 * professionnels (Code de commerce, art. L441-10 et D441-5 ; taux et montants
 * dans lib/outils/penalites.ts). Ces règles ne s'appliquent pas à un
 * particulier : rien n'est mentionné pour un client sans SIREN.
 */
export interface ReminderEmailData {
  /** Rang de la relance pour cette facture (1 pour la première). */
  reminderNumber: number
  /** « before_due » : rappel avant l'échéance ; « after_due » (défaut) : facture échue. */
  kind?: "before_due" | "after_due"
  /** Jours de retard au jour de l'envoi (facture échue). */
  daysLate?: number
  /**
   * Dernière relance programmée : à partir de la 2ᵉ relance, demande de
   * règlement plus nette (« Dernière relance »). Par défaut : vrai.
   */
  isLast?: boolean
  invoiceNumber:  string
  issueDate:      string
  dueDate:        string
  subtotalHt:     number
  totalVat:       number
  totalTtc:       number
  companyName:    string
  companyIban?:   string | null
  accentColor:    string
  clientName:     string
  /** Client professionnel : mention des pénalités de retard et de l'indemnité de 40 €. */
  clientIsProfessional?: boolean
  /**
   * Lien vers la page de règlement de la facture. Fourni par la page de
   * règlement par virement ; affiche un bouton « Régler la facture ».
   */
  paymentUrl?: string
  /** Retenue de garantie (formule Artisan) : à régler à sa libération, pas à l'échéance. */
  retention?: { rate: number; amount: number } | null
}

/** Échappe un texte inséré dans le HTML de l'email. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`

/** « 12,40 % » */
const percent = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

/** Rappel des pénalités et de l'indemnité forfaitaire (client professionnel, facture échue). */
export function latePaymentNotice(): string {
  return `Entre professionnels, tout retard de paiement fait courir de plein droit des pénalités de retard
    au taux indiqué sur la facture ou, à défaut, au taux de la Banque centrale européenne majoré de 10 points
    (${percent(TAUX_PENALITES_DEFAUT)} l'an au ${SEMESTRE_REFERENCE.libelle}), ainsi qu'une indemnité forfaitaire
    pour frais de recouvrement de ${INDEMNITE_FORFAITAIRE} € (Code de commerce, articles L441-10 et D441-5).`
}

export function buildReminderEmail(d: ReminderEmailData): { subject: string; html: string } {
  const before = d.kind === "before_due"
  const firm = !before && d.reminderNumber >= 2 && (d.isLast ?? true)
  const late = Math.max(0, d.daysLate ?? 0)
  const number = esc(d.invoiceNumber)
  const company = esc(d.companyName)

  // ── Sujet et aperçu de la boîte de réception ───────────────────────────────
  const subject = before
    ? `Rappel — Facture ${d.invoiceNumber} à régler d'ici le ${fmtDate(d.dueDate)} — ${d.companyName}`
    : firm
      ? `Dernière relance — Facture ${d.invoiceNumber} en attente de règlement — ${d.companyName}`
      : `Relance — Facture ${d.invoiceNumber} en attente de règlement — ${d.companyName}`

  const preheader = before
    ? `Facture ${d.invoiceNumber} — ${fmtEur(d.totalTtc)} TTC — échéance le ${fmtDate(d.dueDate)}`
    : `Facture ${d.invoiceNumber} — ${fmtEur(d.totalTtc)} TTC — échue le ${fmtDate(d.dueDate)}`

  // ── Bandeau ──────────────────────────────────────────────────────────────────
  const banner = (tone: "info" | "warn", title: string, text: string) => {
    const c = tone === "warn"
      ? { bg: "#FFFBEB", line: "#FDE68A", title: "#92400E", text: "#78350F" }
      : { bg: "#EFF6FF", line: "#BFDBFE", title: "#1E40AF", text: "#1E3A8A" }
    return `<table width="100%" cellpadding="0" cellspacing="0"
         style="margin-bottom:24px;background-color:${c.bg};border:1px solid ${c.line};border-radius:8px;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:${c.title};text-transform:uppercase;letter-spacing:0.6px;">${title}</p>
            <p style="margin:4px 0 0;font-size:13px;color:${c.text};line-height:1.5;">${text}</p>
          </td>
        </tr>
      </table>`
  }

  const intro = before
    ? `Nous nous permettons de vous rappeler que la facture <strong>${number}</strong>,
       émise le <strong>${fmtDate(d.issueDate)}</strong>, arrive à échéance le
       <strong>${fmtDate(d.dueDate)}</strong>.`
    : firm
      ? `Nous revenons vers vous au sujet de la facture <strong>${number}</strong>, émise le
         <strong>${fmtDate(d.issueDate)}</strong>, dont l'échéance était fixée au
         <strong style="color:#B45309;">${fmtDate(d.dueDate)}</strong>. Sauf erreur de notre part,
         elle reste à ce jour impayée malgré nos précédents messages.`
      : `Sauf erreur de notre part, la facture <strong>${number}</strong>, émise le
         <strong>${fmtDate(d.issueDate)}</strong> et arrivée à échéance le
         <strong style="color:#B45309;">${fmtDate(d.dueDate)}</strong>, n'a pas encore été réglée.`

  const alert = before
    ? banner("info", "Rappel avant échéance", "Si le règlement est déjà programmé, merci de ne pas tenir compte de ce message.")
    : firm
      ? banner("warn", "Dernière relance", `Cette facture est échue depuis ${days(late)}. Nous vous remercions de procéder au règlement dès réception de ce message.`)
      : banner("warn", "Relance de paiement", `Cette facture est échue depuis ${days(late)}.`)

  const situationRow = before
    ? `<td style="padding:10px 20px;font-size:13px;color:#64748B;">Échéance</td>
       <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.dueDate)}</td>`
    : `<td style="padding:10px 20px;font-size:13px;color:#64748B;">Retard</td>
       <td style="padding:10px 20px;font-size:13px;font-weight:700;color:#B45309;text-align:right;">${days(late)}</td>`

  const accent = d.accentColor || "#2563EB"

  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">${intro}</p>

    ${alert}

    <!-- Bloc détails facture -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
      <tr style="background-color:#F8FAFC;">
        <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:600;color:#94A3B8;letter-spacing:0.8px;text-transform:uppercase;">
          Facture concernée
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;border-top:1px solid #F1F5F9;">Numéro</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${number}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'émission</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'échéance</td>
        <td style="padding:10px 20px;font-size:13px;font-weight:700;color:${before ? "#1E293B" : "#B45309"};text-align:right;">${fmtDate(d.dueDate)}</td>
      </tr>
      ${before ? "" : `<tr style="background-color:#FAFAFA;">${situationRow}</tr>`}
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, accent)}
    ${retentionBlock(d.totalTtc, d.retention)}

    ${d.paymentUrl ? ctaButton("Régler la facture", esc(d.paymentUrl), accent) : ""}

    ${d.companyIban ? `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-top:16px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:0;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#15803D;text-transform:uppercase;letter-spacing:0.6px;">
            Coordonnées bancaires pour le règlement
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;letter-spacing:0.5px;">
            ${esc(d.companyIban)}
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#15803D;">
            Merci d'indiquer la référence <strong>${number}</strong> lors du virement.
          </p>
        </td>
      </tr>
    </table>` : ""}

    ${!before && d.clientIsProfessional ? `
    <p style="margin:20px 0 0;font-size:12px;color:#64748B;line-height:1.6;">${latePaymentNotice()}</p>` : ""}

    <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.6;">
      ${before
        ? `Si vous avez une question sur cette facture, répondez simplement à cet email.`
        : `Si vous avez déjà procédé au règlement, merci de ne pas tenir compte de ce message. Si une difficulté
           vous empêche de régler cette facture, répondez simplement à cet email afin que nous en parlions.`
      }
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#475569;">
      Cordialement,<br/>
      <strong style="color:#1E293B;">${company}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      accentColor: accent,
      companyName: company,
      preheader:   esc(preheader),
      body,
    }),
  }
}
