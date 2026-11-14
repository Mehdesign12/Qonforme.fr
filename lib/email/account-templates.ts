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
  quote_followup: "Suivi · devis accepté ?",
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
 * Sujets prêts à l'emploi de l'« email libre » : objet et texte préremplis,
 * modifiables avant l'envoi. Le modèle ajoute lui-même « Bonjour {prénom}, » et
 * le bouton « Ouvrir Qonforme » : les textes n'en parlent pas. Vouvoiement,
 * fonctions réellement livrées, ni appel, ni rendez-vous, ni délai de réponse.
 */
export interface FreeEmailPreset {
  id: string
  label: string
  subject: string
  body: string
}

export const FREE_EMAIL_PRESETS: readonly FreeEmailPreset[] = [
  {
    id: "aide",
    label: "Besoin d'aide ?",
    subject: "Besoin d'un coup de main pour démarrer ?",
    body: [
      "Vous avez créé votre compte Qonforme il y a peu, et je voulais savoir si tout se passe bien.",
      "Si quelque chose vous bloque (votre entreprise, votre premier devis, l'envoi à un client), écrivez-nous depuis la page Contact de qonforme.fr ou la bulle en bas de l'écran : nous vous répondons par email.",
      "Vos devis sont gratuits et sans limite : vous pouvez en faire autant que vous voulez.",
    ].join("\n\n"),
  },
  {
    id: "reforme",
    label: "Facture électronique 2027",
    subject: "Facture électronique : vous êtes prêt pour le 1er septembre 2027",
    body: [
      "Depuis le 1er septembre 2026, toutes les entreprises doivent pouvoir recevoir leurs factures par une plateforme agréée. Au 1er septembre 2027, les TPE et les micro-entreprises devront aussi les envoyer par ce moyen.",
      "Avec la formule Essentiel, Qonforme reçoit vos factures fournisseurs et envoie vos factures à vos clients professionnels par une plateforme agréée, au format Factur-X, avec les mentions obligatoires ajoutées pour vous.",
      "Vous n'avez rien à installer : tout se règle depuis la page Facturation électronique de votre compte.",
    ].join("\n\n"),
  },
  {
    id: "relances",
    label: "Relances automatiques",
    subject: "Vos factures impayées relancées toutes seules",
    body: [
      "Relancer un client qui tarde à payer prend du temps, et c'est rarement agréable.",
      "Avec la formule Essentiel, Qonforme envoie un rappel avant l'échéance puis des relances après (à 7, 15, 30 et 45 jours, selon vos réglages), avec le PDF de la facture et vos coordonnées de virement.",
      "Vous choisissez les dates dans Paramètres › Relances, et vous voyez toutes les relances à venir sur la page Relances.",
    ].join("\n\n"),
  },
  {
    id: "signature",
    label: "Signature en ligne",
    subject: "Faites signer vos devis en ligne",
    body: [
      "Plus besoin d'imprimer, de scanner ou d'attendre un courrier : votre client peut signer son devis depuis son téléphone ou son ordinateur.",
      "Avec la formule Essentiel, envoyez le lien de signature depuis la fiche du devis : vous êtes prévenu dès qu'il est signé, et le PDF signé est gardé dans votre compte.",
      "Une fois le devis accepté, il se transforme en facture en un clic.",
    ].join("\n\n"),
  },
  {
    id: "logo",
    label: "Logo et modèles",
    subject: "Des devis à vos couleurs",
    body: [
      "Saviez-vous que vous pouvez ajouter votre logo et choisir l'habillage de vos documents ?",
      "Dans Paramètres › Entreprise, importez votre logo ; dans Paramètres › Modèles de documents, choisissez parmi cinq modèles (Classique, Chantier, Moderne, Épuré, Prestige) et votre couleur.",
      "Vos devis, factures et bons de commande prennent aussitôt cette présentation.",
    ].join("\n\n"),
  },
  {
    id: "terrain",
    label: "Planning et scan",
    subject: "Votre planning et vos papiers de chantier au même endroit",
    body: [
      "Qonforme ne sert pas qu'aux devis et aux factures : le Planning garde vos visites, chantiers et livraisons, avec un rappel par email.",
      "Depuis votre téléphone, la page Documents scanne vos bons de livraison, tickets et factures papier, et les range par client ou par chantier.",
      "Ces deux outils sont inclus dans votre compte, même gratuit.",
    ].join("\n\n"),
  },
]

/**
 * Libellé du raccourci. Le même modèle déjà envoyé à ce compte : « Relancer : … »,
 * pour qu'on voie tout de suite que l'aide est déjà partie.
 */
export function shortcutLabel(template: ManualTemplate, lastTemplate?: string | null): string {
  if (lastTemplate !== template || template === "manual_free") return SHORTCUT_LABELS[template]
  return SHORTCUT_LABELS[template].replace(/^Aider : /, "Relancer : ")
}
