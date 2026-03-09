import { Resend } from "resend"

export interface EmailAttachment {
  filename: string
  content: Buffer
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  cc?: string[]
  attachments?: EmailAttachment[]
}

/**
 * Envoie un email via Resend.
 *
 * MODE SANDBOX (RESEND_TEST_EMAIL défini) :
 *   Tous les emails sont redirigés vers RESEND_TEST_EMAIL.
 *   Le vrai destinataire apparaît dans le sujet : "[TEST → client@x.fr] Sujet original".
 *   Utile tant que le domaine d'envoi n'est pas vérifié sur resend.com/domains.
 *
 * MODE PRODUCTION (RESEND_FROM_EMAIL + domaine vérifié) :
 *   Les emails partent directement vers le vrai destinataire.
 *   Supprimer RESEND_TEST_EMAIL pour activer ce mode.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY est manquante dans les variables d'environnement")
  }

  const resend = new Resend(apiKey)

  // ── Détection du mode sandbox ─────────────────────────────────────────────
  const testEmail = process.env.RESEND_TEST_EMAIL  // ex: "qonforme@gmail.com"
  const fromEmail = process.env.RESEND_FROM_EMAIL  // ex: "factures@qonforme.fr" (prod)
  const isSandbox = !!testEmail

  const finalTo      = isSandbox ? testEmail! : opts.to
  const finalSubject = isSandbox
    ? `[TEST → ${opts.to}] ${opts.subject}`
    : opts.subject
  // En sandbox on vide le CC pour éviter d'envoyer des copies non souhaitées
  const finalCc     = isSandbox ? [] : (opts.cc ?? [])
  const fromAddress = fromEmail
    ? `Qonforme <${fromEmail}>`
    : "Qonforme <onboarding@resend.dev>"

  const { data, error } = await resend.emails.send({
    from:    fromAddress,
    to:      finalTo,
    subject: finalSubject,
    html:    opts.html,
    replyTo: opts.replyTo,
    cc:      finalCc.length > 0 ? finalCc : undefined,
    attachments: opts.attachments?.map(a => ({
      filename: a.filename,
      content:  a.content,
    })),
  })

  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? "Réponse vide"}`)
  }

  return { id: data.id }
}
