/**
 * SEO Topics for AI blog generation.
 *
 * Rotation system: picks the next untreated topic by matching the original
 * topic string against the `ai_prompt` field stored in existing blog posts.
 */

export type TopicCategory =
  | "réglementation"
  | "tutoriel"
  | "guide"
  | "actualité"
  | "comparatif"
  | "pratique"
  | "gestion"
  | "comptabilité"
  | "digital"
  | "cas-usage"

export interface Topic {
  topic: string
  keywords: string[]
  category: TopicCategory
}

export const SEO_TOPICS: Topic[] = [
  // ── Réglementation ────────────────────────────────────────────────────────
  {
    topic: "Facturation électronique obligatoire 2026 : ce que les artisans doivent savoir",
    keywords: ["facturation électronique 2026", "obligation facturation", "TPE artisan", "réforme facturation"],
    category: "réglementation",
  },
  {
    topic: "Calendrier de la réforme facturation électronique : dates clés et échéances",
    keywords: ["calendrier facturation électronique", "dates obligation", "réforme 2026", "échéances facturation"],
    category: "réglementation",
  },
  {
    topic: "PPF et PDP : comprendre les plateformes de facturation électronique",
    keywords: ["PPF", "PDP", "plateforme dématérialisation", "Chorus Pro", "portail public facturation"],
    category: "réglementation",
  },
  {
    topic: "Sanctions et pénalités : que risquez-vous sans facturation électronique ?",
    keywords: ["sanctions facturation électronique", "pénalités non-conformité", "amende facture", "risques TPE"],
    category: "réglementation",
  },
  {
    topic: "E-reporting : obligations et fonctionnement pour les TPE",
    keywords: ["e-reporting", "transmission données", "TVA e-reporting", "obligations déclaratives"],
    category: "réglementation",
  },

  // ── Tutoriels ─────────────────────────────────────────────────────────────
  {
    topic: "Comment créer une facture Factur-X conforme en 5 minutes",
    keywords: ["factur-x", "EN 16931", "facture conforme", "créer facture électronique"],
    category: "tutoriel",
  },
  {
    topic: "Guide complet : rédiger une facture conforme aux normes françaises",
    keywords: ["mentions obligatoires facture", "facture conforme", "rédiger facture", "norme facture France"],
    category: "tutoriel",
  },
  {
    topic: "Comment passer de la facturation papier au numérique sans stress",
    keywords: ["transition numérique", "dématérialisation facture", "passage électronique", "TPE numérique"],
    category: "tutoriel",
  },
  {
    topic: "Configurer ses premières factures électroniques : guide pas à pas",
    keywords: ["configurer facturation", "première facture électronique", "démarrer facturation", "setup facturation"],
    category: "tutoriel",
  },
  {
    topic: "Comment numéroter ses factures correctement : règles et bonnes pratiques",
    keywords: ["numérotation facture", "séquence facture", "règles numérotation", "chronologie facture"],
    category: "tutoriel",
  },

  // ── Guides pratiques ──────────────────────────────────────────────────────
  {
    topic: "Les mentions obligatoires sur une facture en 2026",
    keywords: ["mentions obligatoires facture 2026", "informations facture", "conformité facture", "obligation légale"],
    category: "guide",
  },
  {
    topic: "Facture d'acompte, avoir, situation : quand et comment les utiliser",
    keywords: ["facture acompte", "avoir", "facture situation", "types factures"],
    category: "guide",
  },
  {
    topic: "TVA artisan : taux, exonérations et mentions spéciales",
    keywords: ["TVA artisan", "taux TVA", "exonération TVA", "auto-entrepreneur TVA", "franchise TVA"],
    category: "guide",
  },
  {
    topic: "Devis et factures : les différences juridiques à connaître",
    keywords: ["devis facture différence", "valeur juridique devis", "obligation devis", "engagement devis"],
    category: "guide",
  },
  {
    topic: "Délais de paiement : règles légales et pénalités de retard",
    keywords: ["délai paiement facture", "pénalités retard", "relance impayé", "recouvrement facture"],
    category: "guide",
  },
  {
    topic: "Comment gérer les impayés quand on est artisan",
    keywords: ["impayés artisan", "recouvrement", "relance client", "facture impayée solution"],
    category: "guide",
  },
  {
    topic: "Archivage des factures : durée, format et obligations légales",
    keywords: ["archivage facture", "durée conservation", "stockage facture", "obligation archivage"],
    category: "guide",
  },

  // ── Actualités ────────────────────────────────────────────────────────────
  {
    topic: "Facturation électronique 2026 : les dernières actualités de la réforme",
    keywords: ["actualités facturation électronique", "réforme 2026 news", "dernières nouvelles facturation"],
    category: "actualité",
  },
  {
    topic: "Chorus Pro : nouveautés et évolutions du portail public",
    keywords: ["Chorus Pro nouveautés", "portail public facturation", "mise à jour Chorus", "évolutions PPF"],
    category: "actualité",
  },
  {
    topic: "Norme EN 16931 : ce qui change pour les factures en France",
    keywords: ["EN 16931", "norme européenne facture", "standard facturation", "interopérabilité facture"],
    category: "actualité",
  },

  // ── Comparatifs ───────────────────────────────────────────────────────────
  {
    topic: "Factur-X vs UBL vs CII : quel format de facture électronique choisir ?",
    keywords: ["Factur-X UBL CII", "format facture électronique", "comparatif format facture", "standard facture"],
    category: "comparatif",
  },
  {
    topic: "Logiciel de facturation pour artisan : critères de choix en 2026",
    keywords: ["logiciel facturation artisan", "meilleur logiciel facture", "comparatif facturation", "choisir logiciel"],
    category: "comparatif",
  },
  {
    topic: "Facturation gratuite vs payante : que choisir pour sa TPE ?",
    keywords: ["facturation gratuite", "logiciel facture gratuit", "facturation payante avantages", "TPE facturation"],
    category: "comparatif",
  },

  // ── Pratique métier ───────────────────────────────────────────────────────
  {
    topic: "Facturation pour plombier : spécificités et modèle de facture",
    keywords: ["facture plombier", "facturation plomberie", "modèle facture artisan", "devis plombier"],
    category: "pratique",
  },
  {
    topic: "Facturation pour électricien : mentions spécifiques et conformité",
    keywords: ["facture électricien", "facturation électricité", "mentions facture artisan", "devis électricien"],
    category: "pratique",
  },
  {
    topic: "Facturation pour peintre en bâtiment : guide complet",
    keywords: ["facture peintre", "facturation peinture", "devis peintre bâtiment", "tarif peintre facture"],
    category: "pratique",
  },
  {
    topic: "Facturation pour maçon : de la situation de travaux à la facture finale",
    keywords: ["facture maçon", "situation travaux", "facturation maçonnerie", "devis maçon"],
    category: "pratique",
  },
  {
    topic: "Facturation pour menuisier : spécificités bois et sur-mesure",
    keywords: ["facture menuisier", "facturation menuiserie", "devis menuisier", "facture sur-mesure"],
    category: "pratique",
  },
  {
    topic: "Auto-entrepreneur artisan : obligations de facturation simplifiées",
    keywords: ["auto-entrepreneur facture", "micro-entreprise facturation", "obligation auto-entrepreneur", "facture simplifiée"],
    category: "pratique",
  },
  {
    topic: "Comment fixer ses prix quand on est artisan : méthode et facturation",
    keywords: ["fixer prix artisan", "tarification artisan", "calcul prix prestation", "marge artisan"],
    category: "pratique",
  },
  {
    topic: "Gérer sa trésorerie d'artisan grâce à une bonne facturation",
    keywords: ["trésorerie artisan", "gestion trésorerie", "cash flow TPE", "facturation trésorerie"],
    category: "pratique",
  },
  {
    topic: "Bon de commande et facture : liens, obligations et bonnes pratiques",
    keywords: ["bon de commande", "lien commande facture", "obligation bon commande", "gestion commandes"],
    category: "pratique",
  },
  {
    topic: "Comment relancer un client qui ne paie pas : guide étape par étape",
    keywords: ["relance client", "impayé relance", "courrier relance", "recouvrement amiable"],
    category: "pratique",
  },

  // ── Gestion d'entreprise ──────────────────────────────────────────────────
  {
    topic: "Tableau de bord artisan : les indicateurs clés pour piloter son activité",
    keywords: ["tableau de bord artisan", "KPI TPE", "indicateurs activité", "suivi chiffre affaires"],
    category: "gestion",
  },
  {
    topic: "Suivi du chiffre d'affaires : outils et méthodes pour TPE et artisans",
    keywords: ["suivi CA artisan", "chiffre affaires TPE", "reporting activité", "croissance entreprise artisan"],
    category: "gestion",
  },
  {
    topic: "Gestion administrative artisan : simplifier la paperasse au quotidien",
    keywords: ["gestion administrative", "paperasse artisan", "simplifier admin", "organisation TPE"],
    category: "gestion",
  },

  // ── Comptabilité pratique ─────────────────────────────────────────────────
  {
    topic: "Comptabilité simplifiée pour artisan : ce qu'il faut savoir en 2026",
    keywords: ["comptabilité artisan", "comptabilité simplifiée", "obligations comptables TPE", "livre recettes dépenses"],
    category: "comptabilité",
  },
  {
    topic: "Charges déductibles artisan : la liste complète pour optimiser ses impôts",
    keywords: ["charges déductibles", "déductions fiscales artisan", "optimisation fiscale TPE", "frais professionnels"],
    category: "comptabilité",
  },
  {
    topic: "Rapprochement bancaire : pourquoi et comment le faire quand on est artisan",
    keywords: ["rapprochement bancaire", "pointage bancaire", "trésorerie artisan", "gestion compte pro"],
    category: "comptabilité",
  },

  // ── Digital & productivité ────────────────────────────────────────────────
  {
    topic: "Les 10 outils numériques indispensables pour un artisan en 2026",
    keywords: ["outils numériques artisan", "digitalisation TPE", "applications artisan", "productivité artisan"],
    category: "digital",
  },
  {
    topic: "Zéro papier : comment dématérialiser toute sa gestion d'artisan",
    keywords: ["zéro papier", "dématérialisation artisan", "gestion numérique", "bureau sans papier TPE"],
    category: "digital",
  },
  {
    topic: "Automatiser sa facturation : gagner 5 heures par semaine",
    keywords: ["automatisation facturation", "gain de temps", "facturation automatique", "productivité TPE"],
    category: "digital",
  },

  // ── Réglementaire élargi ──────────────────────────────────────────────────
  {
    topic: "RGPD pour artisans et TPE : les obligations à connaître en 2026",
    keywords: ["RGPD artisan", "protection données TPE", "obligations RGPD", "données clients artisan"],
    category: "réglementation",
  },
  {
    topic: "Assurances obligatoires artisan : décennale, RC pro et garanties essentielles",
    keywords: ["assurance artisan", "décennale", "RC pro artisan", "garanties obligatoires"],
    category: "réglementation",
  },
  {
    topic: "URSSAF artisan : cotisations, déclarations et échéances à ne pas manquer",
    keywords: ["URSSAF artisan", "cotisations sociales", "déclaration URSSAF", "échéances sociales TPE"],
    category: "réglementation",
  },

  // ── Cas d'usage / témoignages ─────────────────────────────────────────────
  {
    topic: "Du carnet de commandes au logiciel : parcours d'un artisan qui se digitalise",
    keywords: ["digitalisation artisan", "transition numérique témoignage", "parcours artisan", "moderniser gestion"],
    category: "cas-usage",
  },
  {
    topic: "Comment un plombier a divisé par deux son temps de facturation",
    keywords: ["témoignage artisan facturation", "gain de temps plombier", "avant après facturation", "logiciel facturation retour"],
    category: "cas-usage",
  },
  {
    topic: "Créer son entreprise artisanale : les 10 étapes administratives incontournables",
    keywords: ["créer entreprise artisan", "étapes création entreprise", "immatriculation artisan", "démarches administratives"],
    category: "cas-usage",
  },
]

/**
 * Normalizes a topic string for comparison: lowercase, no accents, no punctuation.
 */
function normalizeTopic(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Selects the next topic that hasn't been covered yet.
 *
 * Compares against the `ai_prompt` fields stored in existing blog posts
 * (which contain the original topic string), rather than slugs.
 * This avoids mismatches when Gemini generates a different title than the topic.
 *
 * @param existingPrompts - Array of `ai_prompt` values from existing blog_posts
 * @returns The next uncovered topic, or null if all topics have been covered
 */
export function getNextTopic(existingPrompts: string[]): Topic | null {
  // Normalize all existing prompts for fuzzy matching
  const normalizedPrompts = existingPrompts.map(normalizeTopic)

  for (const topic of SEO_TOPICS) {
    const normalizedTopic = normalizeTopic(topic.topic)

    // Check if any existing prompt contains this topic string
    const alreadyCovered = normalizedPrompts.some(
      (prompt) => prompt.includes(normalizedTopic)
    )

    if (!alreadyCovered) {
      return topic
    }
  }

  return null
}
