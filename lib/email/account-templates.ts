/**
 * Modèles des emails envoyés aux comptes (reprise, envoi à la main) et libellés
 * du journal. Module pur, sans dépendance serveur : l'admin l'importe côté navigateur.
 */

/** Emails de reprise envoyés automatiquement (une fois chacun par compte). */
export const REPRISE_TEMPLATES = [
  "reprise_company_1",
  "reprise_company_2",
  "reprise_company_3",
  "reprise_quote_send_1",
  "reprise_quote_send_2",
  "reprise_inactive_14",
] as const
export type RepriseTemplate = (typeof REPRISE_TEMPLATES)[number]

/** Modèles proposés pour un envoi à la main. */
export const MANUAL_TEMPLATES = ["manual_company", "manual_first_quote", "manual_quote_send", "manual_free"] as const
export type ManualTemplate = (typeof MANUAL_TEMPLATES)[number]

export type AccountTemplate = RepriseTemplate | ManualTemplate

export function isManualTemplate(v: unknown): v is ManualTemplate {
  return typeof v === "string" && (MANUAL_TEMPLATES as readonly string[]).includes(v)
}

/** Libellés lisibles (admin), y compris ceux des autres emails du journal. */
export const TEMPLATE_LABELS: Record<string, string> = {
  welcome: "Démarrage · bienvenue",
  first_quote: "Démarrage · premier devis",
  nudge_7d: "Démarrage · relance à 7 jours",
  quote_to_invoice: "Démarrage · du devis à la facture",
  essentiel: "Démarrage · ce que change Essentiel",
  later_reminder: "Rappel « plus tard »",
  reprise_company_1: "Reprise · Bloqué : Entreprise (1/3)",
  reprise_company_2: "Reprise · Bloqué : Entreprise (2/3)",
  reprise_company_3: "Reprise · Bloqué : Entreprise (3/3)",
  reprise_quote_send_1: "Reprise · Devis jamais envoyé (1/2)",
  reprise_quote_send_2: "Reprise · Devis jamais envoyé (2/2)",
  reprise_inactive_14: "Reprise · Inactif depuis 14 jours",
  manual_company: "À la main · trouver son entreprise",
  manual_first_quote: "À la main · premier devis",
  manual_quote_send: "À la main · envoyer son devis",
  manual_free: "À la main · email libre",
}

export const templateLabel = (t: string) => TEMPLATE_LABELS[t] ?? t


/**
 * Raccourci d'Admin › Utilisateurs : modèle conseillé d'après les cinq étapes du
 * parcours (entreprise, devis créé, devis envoyé, facture créée, facture envoyée),
 * et libellé du bouton. Même logique que `suggestedTemplate` de la fiche.
 */
export function templateForSteps(done: readonly boolean[]): ManualTemplate {
  if (!done[0]) return "manual_company"
  if (!done[1] && !done[3]) return "manual_first_quote"
  if (done[1] && !done[2]) return "manual_quote_send"
  return "manual_free"
}

export const SHORTCUT_LABELS: Record<ManualTemplate, string> = {
  manual_company: "Aider : entreprise",
  manual_first_quote: "Aider : premier devis",
  manual_quote_send: "Aider : envoyer le devis",
  manual_free: "Écrire un email",
}

/**
 * Libellé du raccourci. Le même modèle déjà envoyé à ce compte : « Relancer : … »,
 * pour qu'on voie tout de suite que l'aide est déjà partie.
 */
export function shortcutLabel(template: ManualTemplate, lastTemplate?: string | null): string {
  if (lastTemplate !== template || template === "manual_free") return SHORTCUT_LABELS[template]
  return SHORTCUT_LABELS[template].replace(/^Aider : /, "Relancer : ")
}
