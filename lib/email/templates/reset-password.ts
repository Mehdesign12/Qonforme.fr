import { emailBase, ctaButton } from "./base"

/**
 * Template email de réinitialisation de mot de passe — Qonforme.
 * Envoyé via Resend (branding complet, pas l'email générique Supabase).
 */
export function buildResetPasswordEmail({
  resetUrl,
}: {
  resetUrl: string
}): { subject: string; html: string } {
  const subject = "Réinitialise ton mot de passe Qonforme"

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
      Réinitialise ton mot de passe
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Tu as demandé la réinitialisation de ton mot de passe.<br/>
      Clique sur le bouton ci-dessous pour en choisir un nouveau.
    </p>

    ${ctaButton("Choisir un nouveau mot de passe", resetUrl, "#2563EB")}

    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-top:32px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
      <tr style="background-color:#FEF9EC;">
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            ⚠️ <strong>Ce lien est valable 1 heure.</strong>
            Si tu n'as pas fait cette demande, ignore cet email —
            ton mot de passe ne sera pas modifié.
          </p>
        </td>
      </tr>
    </table>

    <hr style="margin:32px 0;border:none;border-top:1px solid #E2E8F0;" />

    <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;">
      Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :<br/>
      <span style="color:#2563EB;word-break:break-all;font-size:11px;">${resetUrl}</span>
    </p>
  `

  const html = emailBase({
    accentColor: "#2563EB",
    companyName: "Qonforme",
    preheader: "Réinitialisez votre mot de passe Qonforme — lien valable 1 heure",
    body,
  })

  return { subject, html }
}
