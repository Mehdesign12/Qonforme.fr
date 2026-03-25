export interface Modele {
  slug: string
  titre: string
  description: string
  motsCles: string[]
  type: "facture" | "devis" | "avoir" | "bon-de-commande"
  pourQui: string
  contenu: string[]
  conseils: string[]
  mentionsSpecifiques: string[]
}

export const MODELES: Modele[] = [
  {
    slug: "facture-auto-entrepreneur",
    titre: "Modele de facture auto-entrepreneur gratuit",
    description: "Modele de facture auto-entrepreneur (micro-entreprise) gratuit et conforme. Mentions obligatoires incluses, franchise TVA, pret a utiliser.",
    motsCles: ["modele facture auto entrepreneur", "facture micro entreprise gratuit", "exemple facture auto entrepreneur"],
    type: "facture",
    pourQui: "Auto-entrepreneurs et micro-entrepreneurs souhaitant facturer leurs clients en conformite avec la legislation francaise.",
    contenu: [
      "Coordonnees completes de l'auto-entrepreneur (nom, adresse, SIRET)",
      "Mention « EI » ou « Entrepreneur individuel »",
      "Coordonnees du client",
      "Numero de facture chronologique",
      "Date d'emission",
      "Description detaillee des prestations",
      "Prix unitaire et montant total HT",
      "Mention « TVA non applicable, article 293 B du CGI »",
      "Conditions et delai de paiement",
      "Penalites de retard et indemnite de recouvrement",
    ],
    conseils: [
      "Utilisez une numerotation continue et chronologique (ex : F-2026-001, F-2026-002)",
      "Conservez toutes vos factures pendant 10 ans",
      "Envoyez vos factures dans les 15 jours suivant la prestation",
      "Surveillez vos seuils de franchise de TVA (36 800 EUR services, 91 900 EUR vente)",
    ],
    mentionsSpecifiques: [
      "TVA non applicable, article 293 B du CGI",
      "Dispensé d'immatriculation au RCS/RM (si applicable)",
    ],
  },
  {
    slug: "facture-classique",
    titre: "Modele de facture classique gratuit",
    description: "Modele de facture professionnelle gratuit avec toutes les mentions obligatoires. Pour TPE, PME et independants. Conforme 2026.",
    motsCles: ["modele facture gratuit", "exemple facture", "modele facture professionnelle"],
    type: "facture",
    pourQui: "Toute entreprise ou professionnel independant souhaitant emettre des factures conformes a la reglementation francaise.",
    contenu: [
      "Identite complete du vendeur (raison sociale, SIRET, TVA intra, RCS)",
      "Identite et adresse du client",
      "Numero de facture unique et sequentiel",
      "Date d'emission et date de prestation",
      "Designation detaillee des produits/services",
      "Quantites, prix unitaires HT, taux de TVA",
      "Montant total HT, TVA et TTC",
      "Conditions de paiement et echeance",
      "Penalites de retard et indemnite forfaitaire de 40 EUR",
    ],
    conseils: [
      "Verifiez que toutes les mentions obligatoires sont presentes avant l'envoi",
      "Conservez un double de chaque facture pendant 10 ans",
      "En cas d'erreur, ne modifiez jamais une facture emise : emettez un avoir",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "facture-acompte",
    titre: "Modele de facture d'acompte gratuit",
    description: "Modele de facture d'acompte gratuit et conforme. Ideal pour le BTP et les prestations de services necessitant un paiement partiel avant travaux.",
    motsCles: ["modele facture acompte", "facture acompte gratuit", "exemple facture acompte"],
    type: "facture",
    pourQui: "Artisans, entreprises du BTP et prestataires de services qui demandent un acompte avant le debut des travaux.",
    contenu: [
      "Toutes les mentions obligatoires d'une facture classique",
      "Reference du devis accepte",
      "Mention « Facture d'acompte »",
      "Montant total du devis/commande",
      "Pourcentage et montant de l'acompte",
      "TVA calculee sur l'acompte",
      "Solde restant du",
    ],
    conseils: [
      "L'acompte est generalement de 30% a la commande dans le BTP",
      "La facture d'acompte fait partie de la numerotation sequentielle normale",
      "Emettez la facture de solde en fin de travaux en referençant les acomptes verses",
    ],
    mentionsSpecifiques: [
      "Facture d'acompte",
      "Reference devis n° [X] du [date]",
    ],
  },
  {
    slug: "devis-travaux",
    titre: "Modele de devis travaux gratuit",
    description: "Modele de devis travaux gratuit pour artisans du BTP. Mentions obligatoires, detail main-d'oeuvre et materiaux, assurance decennale incluse.",
    motsCles: ["modele devis travaux", "devis travaux gratuit", "exemple devis batiment"],
    type: "devis",
    pourQui: "Artisans et entreprises du batiment souhaitant etablir des devis detailles et conformes pour leurs clients.",
    contenu: [
      "Mention « Devis » en titre",
      "Date et duree de validite",
      "Coordonnees de l'entreprise (SIRET, assurance decennale)",
      "Coordonnees du client et adresse du chantier",
      "Description detaillee des travaux",
      "Detail fournitures et materiaux",
      "Detail main-d'oeuvre (heures, taux horaire)",
      "Prix unitaires et totaux par poste",
      "Taux de TVA (5,5%, 10% ou 20%)",
      "Montant total HT et TTC",
      "Conditions de paiement (acompte, echeances)",
      "Mention assurance decennale (nom assureur, n° contrat)",
      "Emplacement signature client + mention manuscrite",
    ],
    conseils: [
      "Detaillez au maximum les postes pour eviter les litiges",
      "Indiquez une duree de validite (1 a 3 mois)",
      "Prevoyez une clause pour les travaux supplementaires",
      "Mentionnez les delais d'execution",
    ],
    mentionsSpecifiques: [
      "Devis recu avant l'execution des travaux (mention manuscrite client)",
      "Assurance decennale : [Assureur] - Contrat n° [X]",
    ],
  },
  {
    slug: "devis-prestation-service",
    titre: "Modele de devis prestation de service gratuit",
    description: "Modele de devis pour prestation de service gratuit. Ideal pour consultants, freelances, formateurs et prestataires intellectuels.",
    motsCles: ["modele devis prestation service", "devis freelance", "devis consultant gratuit"],
    type: "devis",
    pourQui: "Freelances, consultants, formateurs et prestataires de services intellectuels souhaitant formaliser leurs propositions commerciales.",
    contenu: [
      "Mention « Devis » ou « Proposition commerciale »",
      "Date et duree de validite",
      "Coordonnees du prestataire",
      "Coordonnees du client",
      "Description detaillee de la mission",
      "Livrables attendus",
      "Planning et jalons",
      "Tarification (forfait, taux journalier, taux horaire)",
      "Conditions de revision de prix",
      "Conditions de paiement",
      "Clause de confidentialite",
      "Conditions d'annulation",
    ],
    conseils: [
      "Definissez clairement le perimetre de la mission pour eviter les derives",
      "Incluez le nombre de revisions incluses dans le forfait",
      "Prevoyez une clause pour les demandes supplementaires (avenant)",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "avoir-annulation",
    titre: "Modele d'avoir (note de credit) gratuit",
    description: "Modele d'avoir gratuit pour annuler ou corriger une facture. Mentions obligatoires, reference facture d'origine, TVA. Conforme 2026.",
    motsCles: ["modele avoir", "note de credit modele", "annuler une facture modele"],
    type: "avoir",
    pourQui: "Toute entreprise devant annuler ou corriger une facture deja emise (erreur, retour, remise).",
    contenu: [
      "Mention « Avoir » ou « Note de credit »",
      "Numero d'avoir (dans la sequence de facturation)",
      "Date d'emission",
      "Reference de la facture d'origine (numero et date)",
      "Motif de l'avoir (retour, erreur, remise, annulation)",
      "Detail des montants credites (HT, TVA, TTC)",
      "Montants en negatif",
      "Mode de remboursement ou report",
    ],
    conseils: [
      "Ne supprimez jamais une facture : emettez toujours un avoir",
      "L'avoir suit la meme numerotation sequentielle que les factures",
      "Conservez l'avoir et la facture d'origine ensemble pendant 10 ans",
    ],
    mentionsSpecifiques: [
      "Avoir sur facture n° [X] du [date]",
      "Motif : [retour marchandise / erreur / remise commerciale / annulation]",
    ],
  },
  {
    slug: "bon-de-commande",
    titre: "Modele de bon de commande gratuit",
    description: "Modele de bon de commande gratuit et professionnel. Pour formaliser les commandes de fournitures, materiaux ou prestations.",
    motsCles: ["modele bon de commande", "bon de commande gratuit", "exemple bon de commande"],
    type: "bon-de-commande",
    pourQui: "Entreprises et artisans souhaitant formaliser leurs commandes aupres de fournisseurs ou confirmer une commande client.",
    contenu: [
      "Mention « Bon de commande »",
      "Numero de bon de commande",
      "Date et reference",
      "Coordonnees de l'emetteur et du fournisseur",
      "Description des articles/services commandes",
      "Quantites et prix unitaires",
      "Conditions de livraison (delai, lieu, transport)",
      "Conditions de paiement",
      "Signature de validation",
    ],
    conseils: [
      "Numerotez vos bons de commande pour faciliter le suivi",
      "Reliez chaque bon de commande au devis correspondant",
      "Verifiez les conditions de livraison et les delais avant validation",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "facture-proforma",
    titre: "Modele de facture proforma gratuit",
    description: "Modele de facture proforma gratuit. Document commercial pre-facturation pour les devis internationaux et les formalites douanieres.",
    motsCles: ["facture proforma modele", "proforma gratuit", "facture proforma exemple"],
    type: "facture",
    pourQui: "Entreprises realisant des operations a l'international ou souhaitant emettre un document de pre-facturation sans valeur comptable.",
    contenu: [
      "Mention « Facture proforma » (bien visible)",
      "Mention « Ce document n'est pas une facture »",
      "Coordonnees de l'emetteur et du destinataire",
      "Description des biens ou services",
      "Quantites, prix unitaires, montant total",
      "Incoterms (pour l'international)",
      "Devise et taux de change",
      "Conditions de paiement",
      "Duree de validite",
    ],
    conseils: [
      "La facture proforma n'a aucune valeur comptable ni fiscale",
      "Elle ne doit pas porter de numero de facture (elle n'entre pas dans la numerotation)",
      "Emettez une vraie facture une fois la commande confirmee",
    ],
    mentionsSpecifiques: [
      "PROFORMA — Ce document n'est pas une facture et n'a pas de valeur comptable",
    ],
  },
]

export function getModeleBySlug(slug: string): Modele | undefined {
  return MODELES.find(m => m.slug === slug)
}
