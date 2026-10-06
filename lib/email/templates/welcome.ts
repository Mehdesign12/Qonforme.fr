/**
 * Email de bienvenue envoyé immédiatement après la création d'un compte.
 *
 * Depuis l'inscription en deux champs (06/10/2026), le compte n'a en général
 * pas encore de prénom : objet « Bienvenue sur Qonforme », titre « Bienvenue ! »,
 * et la première étape renvoie au tableau de bord, où la fenêtre « Bienvenue »
 * termine l'inscription (entreprise, métier et TVA, prénom). Un prénom fourni
 * (API, ancien parcours) personnalise encore l'objet et le titre.
 *
 * Règles appliquées :
 * - Sujet court, <55 caractères
 * - Preheader distinct du sujet (visible dans la boîte de réception avant ouverture)
 * - Un seul CTA principal — pas de dispersion
 * - 3 étapes d'onboarding intégrées dans l'email
 * - Vouvoiement, comme le reste du site
 * - Uniquement ce que le produit fait aujourd'hui (CLAUDE.md) : ni « conforme
 *   EN 16931 », ni délai de réponse promis, ni contact humain
 * - HTML inline-styles pour compatibilité maximale (Gmail, Outlook, Apple Mail…)
 */
import { PLANS, FREE_FEATURES, formatEuros } from "@/lib/stripe/plans"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"
import { escapeHtml } from "@/lib/email/templates/onboarding"

const ACCENT = "#2563EB"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qonforme.fr"

export function buildWelcomeEmail({
  firstName: rawFirstName,
  unsubscribeUrl,
}: {
  /** Facultatif : absent depuis l'inscription en deux champs. */
  firstName?: string | null
  /**
   * Lien signé de désinscription des conseils de démarrage (premier email de la
   * séquence, lib/onboarding/sequence.ts) ; absent tant que la séquence n'est
   * pas active (migration 20261003_onboarding_emails.sql).
   */
  unsubscribeUrl?: string | null
}): { subject: string; html: string } {
  const name = rawFirstName?.trim() || ""
  const subject = name ? `Bienvenue sur Qonforme, ${name}` : "Bienvenue sur Qonforme"
  // Saisi par l'utilisateur : échappé avant d'entrer dans le HTML
  const title = name ? `Bienvenue, ${escapeHtml(name)}&nbsp;!` : "Bienvenue&nbsp;!"

  const preheader = "Votre compte est créé&nbsp;: vos devis sont gratuits et illimités."

  const steps = [
    {
      n: "1",
      title: "Terminez votre inscription",
      desc: "Votre entreprise, votre métier et votre régime de TVA, en une minute&nbsp;: ils figurent sur tous vos devis et vos factures.",
      href: `${APP_URL}/dashboard`,
      cta: "Terminer mon inscription →",
    },
    {
      n: "2",
      title: "Ajoutez votre premier client",
      desc: "Saisissez son numéro SIREN&nbsp;: ses coordonnées se remplissent seules.",
      href: `${APP_URL}/clients`,
      cta: "Ajouter un client →",
    },
    {
      n: "3",
      title: "Faites votre premier devis",
      desc: "Choisissez le client, ajoutez vos prestations, envoyez le devis par email. Une fois accepté, il devient une facture sans rien ressaisir.",
      href: `${APP_URL}/quotes/new`,
      cta: "Créer un devis →",
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
  <title>${escapeHtml(subject)}</title>
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
                Le logiciel de devis et de facturation des artisans du bâtiment
              </p>
            </td>
          </tr>

          <!-- ── CORPS ───────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#FFFFFF;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">

              <!-- Accroche -->
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
                ${title}
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.65;">
                Votre compte est actif. Vos devis sont gratuits et illimités, et vous pouvez préparer vos factures dès maintenant. Vous choisissez une formule seulement au moment d'envoyer votre première facture.
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
                Suivez ces étapes dans l'ordre pour être opérationnel en quelques minutes.
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
                      Gratuit, sans carte bancaire
                    </p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      ${[
                        ...FREE_FEATURES,
                        `Pour envoyer vos factures : formule ${PLANS.starter.name}, ${formatEuros(PLANS.starter.monthlyPrice)} HT par mois, satisfait ou remboursé ${GUARANTEE_DAYS} jours`,
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
                Une question ? Écrivez à
                <a href="mailto:contact@qonforme.fr" style="color:${ACCENT};text-decoration:none;">contact@qonforme.fr</a>.
              </p>

            </td>
          </tr>

          <!-- ── FOOTER ───────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                <strong style="color:#64748B;">Qonforme</strong> — le logiciel de devis et de facturation des artisans du bâtiment.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#CBD5E1;">
                Une formule se résilie à tout moment, depuis Paramètres › Abonnement.
              </p>${unsubscribeUrl ? `
              <p style="margin:10px 0 0;font-size:12px;color:#94A3B8;line-height:1.55;">
                Pendant vos 30 premiers jours, Qonforme vous enverra quelques conseils de démarrage.
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Ne plus recevoir ces conseils</a>
              </p>` : ""}
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
