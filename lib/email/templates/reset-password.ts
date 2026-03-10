import { emailBase, ctaButton } from "./base"

/**
 * Email de réinitialisation de mot de passe — envoyé par Supabase Auth automatiquement.
 * Ce template est utilisé uniquement si on passe par une API custom (optionnel).
 * Dans notre cas, Supabase envoie l'email nativement avec le lien de reset.
 *
 * Ce template sert de référence si l'on souhaite personnaliser l'email via
 * un "custom SMTP" ou un hook "send email" côté Supabase.
 */
export function buildResetPasswordEmail({
  resetUrl,
}: {
  resetUrl: string
}): { subject: string; html: string } {
  const subject = "Réinitialisation de ton mot de passe Qonforme"

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
      Réinitialise ton mot de passe
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Tu as demandé la réinitialisation de ton mot de passe Qonforme.<br/>
      Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </p>

    ${ctaButton("Choisir un nouveau mot de passe", resetUrl, "#2563EB")}

    <p style="margin:28px 0 0;font-size:13px;color:#94A3B8;line-height:1.6;">
      Ce lien est valable <strong>1 heure</strong>. Si tu n'as pas demandé de réinitialisation,
      tu peux ignorer cet email — ton mot de passe ne sera pas modifié.
    </p>

    <hr style="margin:28px 0;border:none;border-top:1px solid #E2E8F0;" />

    <p style="margin:0;font-size:12px;color:#CBD5E1;">
      Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :<br/>
      <span style="color:#2563EB;word-break:break-all;">${resetUrl}</span>
    </p>
  `

  const html = emailBase({
    accentColor: "#2563EB",
    companyName: "Qonforme",
    preheader: "Réinitialisez votre mot de passe Qonforme",
    body,
  })

  return { subject, html }
}
