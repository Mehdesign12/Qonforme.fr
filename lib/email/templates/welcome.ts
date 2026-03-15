/**
 * Email de bienvenue envoyé immédiatement après la création d'un compte.
 *
 * Règles appliquées :
 * - Sujet court, personnalisé, <55 caractères
 * - Preheader distinct du sujet (visible dans la boîte de réception avant ouverture)
 * - Un seul CTA principal — pas de dispersion
 * - 3 étapes d'onboarding intégrées dans l'email
 * - Ton "tu", chaleureux, cohérent avec le reste du site
 * - HTML inline-styles pour compatibilité maximale (Gmail, Outlook, Apple Mail…)
 */

const ACCENT = "#2563EB"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qonforme.fr"

export function buildWelcomeEmail({
  firstName,
}: {
  firstName: string
}): { subject: string; html: string } {
  const subject = `Bienvenue sur Qonforme, ${firstName} 👋`

  const preheader = `Ton espace est prêt — 5 minutes suffisent pour créer ta première facture conforme EN 16931.`

  const steps = [
    {
      n: "1",
      title: "Renseigne les infos de ton entreprise",
      desc: "Nom, adresse, SIREN, TVA. Ces données apparaîtront sur toutes tes factures.",
      href: `${APP_URL}/settings/company`,
      cta: "Configurer mon entreprise →",
    },
    {
      n: "2",
      title: "Ajoute ton premier client",
      desc: "Recherche par SIREN pour préremplir automatiquement les coordonnées.",
      href: `${APP_URL}/clients`,
      cta: "Ajouter un client →",
    },
    {
      n: "3",
      title: "Crée ta première facture",
      desc: "Sélectionne le client, renseigne la prestation. Ton Factur-X EN 16931 est généré en 1 clic.",
      href: `${APP_URL}/invoices/new`,
      cta: "Créer une facture →",
    },
  ]

  const stepsHtml = steps
    .map(
      (s) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #F1F5F9;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <!-- Numéro -->
            <td style="width:36px;vertical-align:top;padding-top:2px;">
              <div style="
                width:28px;height:28px;
                background-color:${ACCENT};
                border-radius:50%;
                display:inline-flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:700;color:#fff;
                text-align:center;line-height:28px;
              ">${s.n}</div>
            </td>
            <!-- Texte -->
            <td style="padding-left:14px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#0F172A;">${s.title}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748B;line-height:1.55;">${s.desc}</p>
              <a href="${s.href}" style="font-size:13px;color:${ACCENT};font-weight:600;text-decoration:none;">${s.cta}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
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

          <!-- ── HEADER ──────────────────────────────────────────── -->
          <tr>
            <td style="background-color:${ACCENT};border-radius:12px 12px 0 0;padding:32px 40px 28px;">
              <h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                Qonforme
              </h1>
              <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:400;">
                Facturation électronique conforme à la réglementation 2026
              </p>
            </td>
          </tr>

          <!-- ── CORPS ───────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#FFFFFF;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">

              <!-- Accroche -->
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
                Bienvenue, ${firstName}&nbsp;!
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.65;">
                Ton compte est actif. Tu peux dès maintenant créer des factures, devis, bons de commande et avoirs — tous conformes à la réglementation française de facturation électronique 2026.
              </p>

              <!-- CTA principal -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background-color:${ACCENT};border-radius:8px;">
                    <a href="${APP_URL}/dashboard"
                       style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
                      Accéder à mon tableau de bord →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Séparateur -->
              <div style="height:1px;background-color:#F1F5F9;margin:0 0 28px;"></div>

              <!-- Section 3 étapes -->
              <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0F172A;">
                Pour bien démarrer — 3 étapes (5 min)
              </h3>
              <p style="margin:0 0 16px;font-size:13px;color:#94A3B8;">
                Suis ces étapes dans l'ordre pour être opérationnel en quelques minutes.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${stepsHtml}
              </table>

              <!-- Séparateur -->
              <div style="height:1px;background-color:#F1F5F9;margin:28px 0;"></div>

              <!-- Bloc valeur / réassurance -->
              <table cellpadding="0" cellspacing="0" width="100%"
                     style="background-color:#EFF6FF;border-radius:10px;border:1px solid #BFDBFE;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.08em;">
                      Ce qui est inclus dans ton plan
                    </p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      ${[
                        "Factur-X EN 16931 certifié — généré automatiquement en 1 clic",
                        "Devis, bons de commande et avoirs inclus",
                        "Guide de transmission Chorus Pro pas-à-pas",
                        "Archivage légal 10 ans inclus",
                        "Envoi des documents par email avec PDF joint",
                      ]
                        .map(
                          (item) => `
                      <tr>
                        <td style="padding:4px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:18px;vertical-align:top;padding-top:1px;">
                                <span style="font-size:14px;color:#10B981;">✓</span>
                              </td>
                              <td style="padding-left:8px;font-size:13px;color:#1E3A5F;line-height:1.5;">${item}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>`
                        )
                        .join("")}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Note finale -->
              <p style="margin:28px 0 0;font-size:13px;color:#94A3B8;line-height:1.6;">
                Une question ? Réponds directement à cet email ou écris-nous à
                <a href="mailto:contact@qonforme.fr" style="color:${ACCENT};text-decoration:none;">contact@qonforme.fr</a>.
                On répond sous 24h.
              </p>

            </td>
          </tr>

          <!-- ── FOOTER ───────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                <strong style="color:#64748B;">Qonforme</strong> — facturation électronique conforme à la réglementation française 2026.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#CBD5E1;">
                Tu peux résilier à tout moment depuis les paramètres de ton compte.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
