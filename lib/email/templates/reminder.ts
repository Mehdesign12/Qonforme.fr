import { emailBase, fmtEur, fmtDate, amountBlock } from "./base"

export interface ReminderEmailData {
  reminderNumber: 1 | 2       // 1 = J+30 (courtois), 2 = J+45 (ferme)
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
}

export function buildReminderEmail(d: ReminderEmailData): { subject: string; html: string } {
  const isSecond = d.reminderNumber === 2

  // ── Sujet ────────────────────────────────────────────────────────────────
  const subject = isSecond
    ? `⚠️ Rappel urgent — Facture ${d.invoiceNumber} impayée — ${d.companyName}`
    : `Rappel — Facture ${d.invoiceNumber} en attente de règlement — ${d.companyName}`

  // ── Preheader (texte aperçu boîte de réception) ──────────────────────────
  const preheader = isSecond
    ? `Deuxième rappel — ${fmtEur(d.totalTtc)} TTC — facture ${d.invoiceNumber} impayée depuis plus de 45 jours`
    : `Rappel de paiement — ${fmtEur(d.totalTtc)} TTC — facture ${d.invoiceNumber} échue le ${fmtDate(d.dueDate)}`

  // ── Bandeau d'alerte en haut du corps ────────────────────────────────────
  const alertBanner = isSecond
    ? `<table width="100%" cellpadding="0" cellspacing="0"
         style="margin-bottom:24px;background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.6px;">
              ⚠️ Deuxième et dernier rappel
            </p>
            <p style="margin:4px 0 0;font-size:13px;color:#B91C1C;line-height:1.5;">
              Cette facture est impayée depuis plus de 45 jours. Sans règlement de votre part,
              nous nous réservons le droit d'engager une procédure de recouvrement.
            </p>
          </td>
        </tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0"
         style="margin-bottom:24px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.6px;">
              Rappel de paiement
            </p>
            <p style="margin:4px 0 0;font-size:13px;color:#78350F;line-height:1.5;">
              Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de cette facture.
            </p>
          </td>
        </tr>
      </table>`

  // ── Corps principal ───────────────────────────────────────────────────────
  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">
      ${isSecond
        ? `Nous revenons vers vous concernant la facture <strong>${d.invoiceNumber}</strong>,
           dont l'échéance était fixée au <strong style="color:#DC2626;">${fmtDate(d.dueDate)}</strong>
           et qui reste à ce jour impayée malgré notre premier rappel.`
        : `Nous vous contactons au sujet de la facture <strong>${d.invoiceNumber}</strong>,
           émise le <strong>${fmtDate(d.issueDate)}</strong> et dont la date d'échéance
           du <strong style="color:#DC2626;">${fmtDate(d.dueDate)}</strong> est dépassée.`
      }
    </p>

    ${alertBanner}

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
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${d.invoiceNumber}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'émission</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'échéance</td>
        <td style="padding:10px 20px;font-size:13px;font-weight:700;color:#DC2626;text-align:right;">${fmtDate(d.dueDate)}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Relance</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">
          N°${d.reminderNumber} sur 2
        </td>
      </tr>
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}

    ${d.companyIban ? `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-top:16px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:0;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#15803D;text-transform:uppercase;letter-spacing:0.6px;">
            Coordonnées bancaires pour le règlement
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;letter-spacing:0.5px;">
            ${d.companyIban}
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#15803D;">
            Merci d'indiquer la référence <strong>${d.invoiceNumber}</strong> lors du virement.
          </p>
        </td>
      </tr>
    </table>` : ""}

    <p style="margin:28px 0 0;font-size:14px;color:#475569;line-height:1.6;">
      ${isSecond
        ? `Si vous avez déjà effectué le paiement, nous vous prions de bien vouloir ignorer ce message
           et de nous transmettre votre confirmation de virement.
           Dans le cas contraire, merci de procéder au règlement dans les meilleurs délais.`
        : `Si vous avez déjà procédé au règlement, veuillez ignorer ce message et nous en informer
           afin que nous puissions mettre à jour nos dossiers. Dans le cas contraire, merci de
           régulariser cette situation dans les meilleurs délais.`
      }
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#475569;">
      Cordialement,<br/>
      <strong style="color:#1E293B;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      accentColor: isSecond ? "#DC2626" : d.accentColor,
      companyName: d.companyName,
      preheader,
      body,
    }),
  }
}
