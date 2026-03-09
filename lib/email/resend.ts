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
 * From : "Qonforme <onboarding@resend.dev>" (domaine de test Resend)
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY est manquante dans les variables d'environnement")
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from: "Qonforme <onboarding@resend.dev>",
    to:   opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
    cc: opts.cc,
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
