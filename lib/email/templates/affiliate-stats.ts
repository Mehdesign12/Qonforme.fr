/**
 * Email au partenaire : le lien privé de ses statistiques (visites, inscrits,
 * abonnés, commission). Au nom de Qonforme, jamais d'un humain (règle « aucune
 * promesse de contact humain ») ; aucun nom de client.
 */
import { ctaButton, emailBase } from "@/lib/email/templates/base"
import { escapeHtml } from "@/lib/email/templates/onboarding"

export function buildAffiliateStatsEmail(input: { partnerName: string; url: string; terms: string }): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px;">Bonjour,</p>
    <p style="margin:0 0 16px;">Voici le lien de vos statistiques ${escapeHtml(input.partnerName)} chez Qonforme : les visites amenées par vos liens, les inscrits, les abonnés et votre commission, mis à jour en continu. Aucun nom ni aucune adresse de client n'y figure.</p>
    ${ctaButton("Voir mes statistiques", input.url)}
    <p style="margin:16px 0 0;font-size:14px;color:#5F6F86;">Commission : ${escapeHtml(input.terms)}. Ce lien est personnel : ne le publiez pas. Un nouveau lien remplace celui-ci si vous en demandez un.</p>`
  return {
    subject: "Vos statistiques de partenaire Qonforme",
    html: emailBase({ companyName: "Qonforme", preheader: "Le lien privé de vos statistiques de partenaire", body, headline: "Vos liens,", headlineAccent: "vos résultats.", source: "email-partenaire" }),
  }
}
