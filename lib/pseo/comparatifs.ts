export interface Comparatif {
  slug: string
  nom: string
  description: string
  motsCles: string[]
  prix: string
  prixDetail: string
  facturX: boolean
  factureElectronique: boolean
  exportFec: boolean
  devis: boolean
  avoirs: boolean
  relances: boolean
  multiUtilisateur: boolean
  apiOuverte: boolean
  supportFrancais: boolean
  essaiGratuit: string
  pointsForts: string[]
  pointsFaibles: string[]
  conclusion: string
}

// Qonforme (référence)
export const QONFORME_FEATURES = {
  prix: "9 €/mois",
  prixDetail: "A partir de 9 €/mois sans engagement. Plan Pro a 19 €/mois.",
  facturX: true,
  factureElectronique: true,
  exportFec: true,
  devis: true,
  avoirs: true,
  relances: true,
  multiUtilisateur: false,
  apiOuverte: false,
  supportFrancais: true,
  essaiGratuit: "Oui, sans CB",
}

export const COMPARATIFS: Comparatif[] = [
  {
    slug: "henrri",
    nom: "Henrri",
    description: "Comparatif Qonforme vs Henrri : fonctionnalites, prix, conformite Factur-X, export FEC. Quel logiciel de facturation choisir en 2026 ?",
    motsCles: ["qonforme vs henrri", "alternative henrri", "henrri avis"],
    prix: "Gratuit",
    prixDetail: "Gratuit sans limite de factures. Monetisation par services complementaires.",
    facturX: false,
    factureElectronique: false,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: false,
    multiUtilisateur: false,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "Gratuit",
    pointsForts: [
      "Entierement gratuit sans limitation du nombre de factures",
      "Interface simple et intuitive pour les debutants",
      "Export comptable FEC disponible",
    ],
    pointsFaibles: [
      "Pas de format Factur-X : non conforme a la reforme 2026",
      "Pas de relances automatiques pour les impayes",
      "Fonctionnalites limitees pour les artisans du BTP (pas d'autoliquidation)",
    ],
    conclusion: "Henrri est une bonne option gratuite pour debuter, mais son absence de conformite Factur-X pose probleme pour 2026. Qonforme est plus adapte si vous avez besoin de la facturation electronique obligatoire.",
  },
  {
    slug: "facture-net",
    nom: "Facture.net",
    description: "Comparatif Qonforme vs Facture.net : prix, fonctionnalites, Factur-X, relances. Quel logiciel de facturation gratuit choisir ?",
    motsCles: ["qonforme vs facture.net", "alternative facture.net", "facture.net avis"],
    prix: "Gratuit",
    prixDetail: "Gratuit avec publicites. Version premium a 5,99 €/mois.",
    facturX: false,
    factureElectronique: false,
    exportFec: false,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: false,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "Gratuit avec pubs",
    pointsForts: [
      "Gratuit avec un bon niveau de fonctionnalites",
      "Relances automatiques incluses",
      "Simple d'utilisation pour les auto-entrepreneurs",
    ],
    pointsFaibles: [
      "Publicites dans la version gratuite",
      "Pas de format Factur-X ni de facturation electronique",
      "Pas d'export FEC pour l'expert-comptable",
    ],
    conclusion: "Facture.net convient aux auto-entrepreneurs qui debutent, mais l'absence de Factur-X et d'export FEC le rend insuffisant pour la conformite 2026. Qonforme offre ces fonctionnalites des le plan de base.",
  },
  {
    slug: "tiime",
    nom: "Tiime",
    description: "Comparatif Qonforme vs Tiime : comptabilite, facturation, prix, Factur-X. Quel outil choisir pour les independants en 2026 ?",
    motsCles: ["qonforme vs tiime", "alternative tiime", "tiime avis facturation"],
    prix: "Gratuit a 24 €/mois",
    prixDetail: "Facturation gratuite. Comptabilite a partir de 24 €/mois.",
    facturX: true,
    factureElectronique: true,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: true,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "Oui",
    pointsForts: [
      "Suite complete facturation + comptabilite + banque",
      "Conforme Factur-X et facturation electronique",
      "Application mobile bien concue",
    ],
    pointsFaibles: [
      "La comptabilite est payante et plus chere que Qonforme",
      "Interface plus complexe car orientee comptabilite",
      "Moins adapte aux artisans BTP (pas d'autoliquidation native)",
    ],
    conclusion: "Tiime est un excellent choix si vous cherchez facturation + comptabilite integree. Qonforme est plus abordable et mieux adapte aux artisans et TPE qui ont surtout besoin de facturer simplement.",
  },
  {
    slug: "abby",
    nom: "Abby",
    description: "Comparatif Qonforme vs Abby : facturation auto-entrepreneur, prix, Factur-X. Quel logiciel pour micro-entreprise en 2026 ?",
    motsCles: ["qonforme vs abby", "alternative abby", "abby avis auto entrepreneur"],
    prix: "Gratuit a 11,99 €/mois",
    prixDetail: "Plan gratuit limite. Plans payants a partir de 7,99 €/mois.",
    facturX: true,
    factureElectronique: true,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: false,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "Plan gratuit",
    pointsForts: [
      "Tres bien adapte aux auto-entrepreneurs et micro-entreprises",
      "Declaration URSSAF integree",
      "Interface claire et parcours guide",
    ],
    pointsFaibles: [
      "Plan gratuit tres limite (5 factures/mois)",
      "Moins adapte aux societes (SARL, SAS)",
      "Pas d'autoliquidation TVA pour le BTP",
    ],
    conclusion: "Abby excelle pour les auto-entrepreneurs avec sa declaration URSSAF integree. Qonforme est plus polyvalent pour les artisans et TPE qui ont aussi besoin de devis BTP, autoliquidation et Factur-X natif.",
  },
  {
    slug: "freebe",
    nom: "Freebe",
    description: "Comparatif Qonforme vs Freebe : tableau de bord freelance, facturation, prix. Quel outil pour independants en 2026 ?",
    motsCles: ["qonforme vs freebe", "alternative freebe", "freebe avis freelance"],
    prix: "14,90 €/mois",
    prixDetail: "Plan unique a 14,90 €/mois. Reduction annuelle.",
    facturX: false,
    factureElectronique: false,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: false,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "14 jours",
    pointsForts: [
      "Tableau de bord complet pour freelances (CA, charges, tresorerie)",
      "Simulation fiscale et sociale integree",
      "Bonne gestion des frais professionnels",
    ],
    pointsFaibles: [
      "Plus cher que Qonforme (14,90 € vs 9 €/mois)",
      "Pas de format Factur-X : non conforme 2026",
      "Oriente freelance uniquement, pas adapte aux artisans",
    ],
    conclusion: "Freebe est ideal pour les freelances qui veulent un tableau de bord complet. Qonforme est plus abordable, conforme Factur-X 2026 et mieux adapte aux artisans et TPE.",
  },
  {
    slug: "pennylane",
    nom: "Pennylane",
    description: "Comparatif Qonforme vs Pennylane : comptabilite, facturation, prix, conformite. Quelle solution pour TPE et PME en 2026 ?",
    motsCles: ["qonforme vs pennylane", "alternative pennylane", "pennylane avis"],
    prix: "14 a 49 €/mois",
    prixDetail: "A partir de 14 €/mois (facturation). Comptabilite avec expert-comptable a partir de 49 €/mois.",
    facturX: true,
    factureElectronique: true,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: true,
    apiOuverte: true,
    supportFrancais: true,
    essaiGratuit: "Demo sur demande",
    pointsForts: [
      "Suite complete facturation + comptabilite + connexion bancaire",
      "API ouverte et integrations nombreuses",
      "Collaboration expert-comptable en temps reel",
    ],
    pointsFaibles: [
      "Prix eleve, surtout avec la comptabilite (49 €+/mois)",
      "Courbe d'apprentissage plus longue",
      "Surdimensionne pour un artisan ou auto-entrepreneur",
    ],
    conclusion: "Pennylane est une solution premium pour les PME qui veulent tout centraliser. Qonforme est 5x moins cher et suffisant pour les artisans et TPE qui ont besoin de facturer simplement et conformement.",
  },
  {
    slug: "indy",
    nom: "Indy",
    description: "Comparatif Qonforme vs Indy : comptabilite automatisee, facturation, prix. Quel logiciel pour independants en 2026 ?",
    motsCles: ["qonforme vs indy", "alternative indy", "indy avis independant"],
    prix: "12 a 22 €/mois",
    prixDetail: "A partir de 12 €/mois (facturation + compta). Plan premium a 22 €/mois.",
    facturX: true,
    factureElectronique: true,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: false,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "Oui",
    pointsForts: [
      "Comptabilite automatisee par IA (categorisation des depenses)",
      "Declaration fiscale 2035/2042 integree pour les liberaux",
      "Synchronisation bancaire en temps reel",
    ],
    pointsFaibles: [
      "Oriente professions liberales, moins adapte aux artisans BTP",
      "La facturation seule ne justifie pas le prix (12 €/mois minimum)",
      "Moins de personnalisation des documents que Qonforme",
    ],
    conclusion: "Indy est excellent pour les professions liberales qui veulent automatiser leur comptabilite. Qonforme est plus adapte et moins cher pour les artisans et TPE qui cherchent un logiciel de facturation pur.",
  },
  {
    slug: "mon-expert-en-gestion",
    nom: "Mon Expert en Gestion",
    description: "Comparatif Qonforme vs Mon Expert en Gestion (MEG) : facturation artisans, devis BTP, prix, Factur-X. Quel logiciel choisir ?",
    motsCles: ["qonforme vs meg", "alternative mon expert en gestion", "meg avis artisan"],
    prix: "9,90 a 29,90 €/mois",
    prixDetail: "A partir de 9,90 €/mois. Plan complet a 29,90 €/mois avec suivi de chantier.",
    facturX: false,
    factureElectronique: false,
    exportFec: true,
    devis: true,
    avoirs: true,
    relances: true,
    multiUtilisateur: true,
    apiOuverte: false,
    supportFrancais: true,
    essaiGratuit: "15 jours",
    pointsForts: [
      "Tres bien adapte au BTP avec suivi de chantier integre",
      "Bibliotheque d'ouvrages pour les devis",
      "Multi-utilisateur pour les equipes",
    ],
    pointsFaibles: [
      "Pas de format Factur-X : non conforme a la reforme 2026",
      "Interface plus ancienne et moins moderne",
      "Prix eleve pour le plan complet (29,90 €/mois)",
    ],
    conclusion: "Mon Expert en Gestion est un bon choix BTP pour le suivi de chantier, mais l'absence de Factur-X est un probleme pour 2026. Qonforme offre la conformite Factur-X a un prix inferieur avec les fonctionnalites essentielles.",
  },
]

export function getComparatifBySlug(slug: string): Comparatif | undefined {
  return COMPARATIFS.find(c => c.slug === slug)
}
