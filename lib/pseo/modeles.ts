import type { ExempleDevis } from "@/lib/pseo/guides"
import { INDEMNITE_FORFAITAIRE, SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT } from "@/lib/outils/penalites"
import { CERTIFICATION_DEVIS_10, CERTIFICATION_RESUME } from "@/lib/legal/certification-tva"

/** « 12,40 % » : taux BCE + 10 points du semestre en cours (lib/outils/penalites.ts, mis à jour chaque semestre). */
const TAUX_DEFAUT_FR = `${TAUX_PENALITES_DEFAUT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

/** Texte à recopier (mail de relance, lettre). Entre crochets : à remplacer. */
export interface TexteModele {
  id: string
  titre: string
  /** Moment conseillé (« 7 jours après l'échéance »). */
  quand: string
  canal: "Mail" | "Lettre recommandée avec accusé de réception"
  objet: string
  corps: string[]
}

export interface Modele {
  slug: string
  /** Titre affiché (h1). */
  titre: string
  /** Balise <title>, quand elle doit viser une autre formulation que le h1. */
  titreSeo?: string
  description: string
  motsCles: string[]
  type: "facture" | "devis" | "avoir" | "bon-de-commande" | "relance"
  pourQui: string
  contenu: string[]
  conseils: string[]
  mentionsSpecifiques: string[]
  /** Exemple chiffré affiché sous le modèle (totaux calculés par lib/pseo/exemple-devis.ts). */
  exemple?: ExempleDevis
  /** Autres exemples chiffrés, sous le premier, chacun avec son intertitre. */
  autresExemples?: { titre: string; accent: string; exemple: ExempleDevis }[]
  /** Paragraphes sous les exemples (variante auto-entrepreneur…). */
  sections?: { id: string; titre: string; accent: string; paragraphes: string[] }[]
  /** Textes prêts à recopier (relances par mail, lettre de mise en demeure), sous un intertitre. */
  textes?: { titre: string; accent: string; intro: string; liste: TexteModele[] }
  /** Fichier à télécharger (Word, Excel, PDF) : nom sans extension, déclaré dans lib/modeles/fichier.ts. */
  telechargement?: string
}

export const MODELES: Modele[] = [
  {
    slug: "facture-auto-entrepreneur",
    titre: "Modèle de facture auto-entrepreneur gratuit",
    description: "Modèle de facture auto-entrepreneur (micro-entreprise) gratuit, avec les mentions obligatoires et la mention de franchise de TVA. Prêt à utiliser.",
    motsCles: ["modele facture auto entrepreneur", "facture micro entreprise gratuit", "exemple facture auto entrepreneur"],
    type: "facture",
    pourQui: "Auto-entrepreneurs et micro-entrepreneurs qui veulent facturer leurs clients dans le respect de la législation française.",
    contenu: [
      "Coordonnées complètes de l'auto-entrepreneur (nom, adresse, SIRET)",
      "Mention « EI » ou « Entrepreneur individuel »",
      "Coordonnées du client",
      "Numéro de facture chronologique",
      "Date d'émission",
      "Description détaillée des prestations",
      "Prix unitaire et montant total HT",
      "Mention « TVA non applicable, article 293 B du CGI »",
      "Conditions et délai de paiement",
      "Pénalités de retard et indemnité de recouvrement",
    ],
    conseils: [
      "Utilisez une numérotation continue et chronologique (ex : F-2026-001, F-2026-002)",
      "Conservez toutes vos factures pendant 10 ans",
      "Émettez la facture dès la fin de la prestation (une facture récapitulative par mois au plus tard en fin de mois)",
      "Surveillez vos seuils de franchise de TVA (en 2026 : 37 500 € pour les services, 85 000 € pour la vente)",
    ],
    mentionsSpecifiques: [
      "TVA non applicable, article 293 B du CGI",
      "Dispensé d'immatriculation au RCS et au RM (si applicable)",
    ],
  },
  {
    slug: "facture-classique",
    titre: "Modèle de facture classique gratuit",
    description: "Modèle de facture professionnelle gratuit avec toutes les mentions obligatoires. Pour les TPE, PME, artisans et indépendants.",
    motsCles: ["modele facture gratuit", "exemple facture", "modele facture professionnelle"],
    type: "facture",
    pourQui: "Toute entreprise ou tout professionnel indépendant qui veut émettre des factures conformes à la réglementation française.",
    contenu: [
      "Identité complète du vendeur (raison sociale, SIRET, TVA intracommunautaire, RCS)",
      "Identité et adresse du client",
      "Numéro de facture unique et séquentiel",
      "Date d'émission et date de la prestation",
      "Désignation détaillée des produits ou services",
      "Quantités, prix unitaires HT, taux de TVA",
      "Montant total HT, TVA et TTC",
      "Conditions de paiement et échéance",
      "Pénalités de retard et indemnité forfaitaire de 40 €",
    ],
    conseils: [
      "Vérifiez que toutes les mentions obligatoires sont présentes avant l'envoi",
      "Conservez un double de chaque facture pendant 10 ans",
      "En cas d'erreur, ne modifiez jamais une facture émise : émettez un avoir",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "facture-acompte",
    titre: "Modèle de facture d'acompte gratuit",
    description: "Modèle de facture d'acompte gratuit, avec les mentions obligatoires, pour le BTP et les prestations payées en partie avant le début des travaux.",
    motsCles: ["modele facture acompte", "facture acompte gratuit", "exemple facture acompte"],
    type: "facture",
    pourQui: "Artisans, entreprises du BTP et prestataires de services qui demandent un acompte avant le début des travaux.",
    contenu: [
      "Toutes les mentions obligatoires d'une facture classique",
      "Référence du devis accepté",
      "Mention « Facture d'acompte »",
      "Montant total du devis ou de la commande",
      "Pourcentage et montant de l'acompte",
      "TVA calculée sur l'acompte",
      "Solde restant dû",
    ],
    conseils: [
      "L'acompte est généralement de 30 % à la commande dans le BTP",
      "La facture d'acompte fait partie de la numérotation séquentielle normale",
      "Émettez la facture de solde en fin de travaux en y référençant les acomptes versés",
    ],
    mentionsSpecifiques: [
      "Facture d'acompte",
      "Référence devis n° [X] du [date]",
    ],
  },
  {
    slug: "devis-travaux",
    titre: "Modèle de devis travaux gratuit pour artisan",
    titreSeo: "Modèle de devis artisan et exemple de devis travaux (Word, Excel)",
    description: "Modèle de devis artisan gratuit en Word, Excel ou PDF : mentions obligatoires, matériaux et main-d'œuvre détaillés, TVA, et un exemple de devis chiffré.",
    telechargement: "modele-devis-artisan",
    motsCles: ["modele devis travaux", "modele devis artisan", "devis exemple", "exemple devis travaux", "devis matériaux", "devis travaux gratuit"],
    type: "devis",
    pourQui: "Artisans et entreprises du bâtiment qui veulent établir des devis détaillés et conformes pour leurs clients, particuliers ou professionnels.",
    contenu: [
      "Mention « Devis » en titre",
      "Date et durée de validité",
      "Coordonnées de l'entreprise (SIREN ou SIRET, « EI » pour un entrepreneur individuel)",
      "Coordonnées du client et adresse du chantier",
      "Description détaillée des travaux",
      "Détail des fournitures et des matériaux (quantité, unité, prix unitaire)",
      "Détail de la main-d'œuvre (heures ou mètres carrés, taux horaire TTC chez un particulier)",
      "Frais de déplacement, s'il y en a",
      "Évacuation des déchets du chantier : gestion, point de collecte et coût",
      "Taux de TVA de chaque ligne (5,5 %, 10 % ou 20 %)",
      "Montant total HT et TTC",
      "Conditions de paiement (acompte, échéances)",
      "Assurance décennale : assureur, n° de contrat, couverture géographique",
      "Emplacement pour la signature du client, précédée de « Bon pour accord »",
    ],
    conseils: [
      "Détaillez les postes ligne par ligne : fournitures, main-d'œuvre, déplacement, déchets",
      "Indiquez une durée de validité (un à trois mois est courant) : aucune durée n'est fixée par la loi",
      "Prévoyez qu'un travail supplémentaire se fera sur avenant signé",
      "Mentionnez la date ou le délai d'exécution, obligatoire chez un particulier",
      "Écrivez « acompte » pour la somme demandée à la signature : sans précision, celle d'un particulier est considérée comme des arrhes",
    ],
    mentionsSpecifiques: [
      "Bon pour accord, le [date] (mention du client avant sa signature)",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
      CERTIFICATION_DEVIS_10,
    ],
    exemple: {
      titre: "Pose de carrelage dans une salle de bains",
      contexte: "Exemple fictif : devis pour un particulier, dans une maison achevée depuis plus de deux ans, donc TVA à 10 %. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Carrelage sol grès cérame 60 × 60 (référence, ou équivalent), fourni, chutes comprises", quantite: 13, unite: "m²", prixUnitaireHT: 32 },
        { designation: "Mortier-colle, joints et profilés de finition", quantite: 1, unite: "forfait", prixUnitaireHT: 85 },
        { designation: "Dépose de l'ancien carrelage", quantite: 12, unite: "m²", prixUnitaireHT: 15 },
        { designation: "Préparation du support : ragréage", quantite: 12, unite: "m²", prixUnitaireHT: 12 },
        { designation: "Pose du carrelage et des joints", quantite: 12, unite: "m²", prixUnitaireHT: 42 },
        { designation: "Évacuation des gravats et dépôt en déchèterie professionnelle", quantite: 1, unite: "forfait", prixUnitaireHT: 60 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en trois jours, dans les 30 jours qui suivent la signature.",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 50,00 € HT, soit 55,00 € TTC.",
        "Déchets : environ 0,5 m³ de gravats, triés et déposés en déchèterie professionnelle (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        "Acompte de 30 % à la signature, solde à la fin des travaux. Signé au domicile du client, l'acompte ne pourrait être encaissé qu'au bout de sept jours.",
        CERTIFICATION_RESUME,
        "Signature du client précédée de « Bon pour accord ».",
      ],
    },
  },
  {
    slug: "devis-electricien",
    // Mots des chercheurs (MOTS-CLES-COMPACTS-2026-10.md § 9) : « exemple devis remplacement tableau
    // électrique » (390/mois) dans le title et le H1, « maison 100 m² » (210/mois) dans un intertitre.
    titre: "Exemple de devis d'électricien : remplacement du tableau électrique",
    titreSeo: "Exemple de devis électricité : remplacement de tableau",
    description: "Exemples de devis d'électricien chiffrés : remplacement du tableau électrique (Word, Excel, PDF) et rénovation d'une maison de 100 m², TVA à 10 %.",
    motsCles: ["exemple devis remplacement tableau électrique", "exemple devis électricien", "exemple devis électricité maison 100m2", "devis électricité exemple", "modele devis electricien", "devis électricien auto entrepreneur"],
    type: "devis",
    pourQui: "Électriciens, à leur compte ou en sous-traitance, qui veulent un devis de travaux électriques détaillé et conforme : fournitures, main-d'œuvre, déchets, TVA et assurance décennale.",
    contenu: [
      "Mention « Devis », date et durée de validité",
      "Coordonnées de l'entreprise (SIREN ou SIRET, « EI » pour un entrepreneur individuel)",
      "Coordonnées du client et adresse du chantier",
      "Fournitures détaillées : tableau, appareillage, câbles, avec la référence ou « équivalent »",
      "Main-d'œuvre : forfait ou heures, avec le taux horaire TTC chez un particulier",
      "Mise en service et contrôle de l'installation",
      "Évacuation des déchets du chantier : gestion, point de collecte et coût",
      "Taux de TVA de chaque ligne et totaux HT et TTC",
      "Délai d'exécution, acompte et conditions de paiement",
      "Assurance décennale : assureur, n° de contrat, couverture géographique",
      "Emplacement pour la signature du client, précédée de « Bon pour accord »",
    ],
    conseils: [
      "Séparez la fourniture, la main-d'œuvre et la mise en service : le client voit ce qu'il paie et vous évitez les discussions sur le prix.",
      "Indiquez la norme appliquée : la NF C 15-100 est la norme française des installations électriques de basse tension.",
      "Pour une installation neuve ou entièrement rénovée avec coupure du réseau, l'attestation de conformité visée par le Consuel est nécessaire avant la mise en service : ajoutez-la au devis et précisez qui la prend en charge.",
      "Le taux réduit de 10 % chez un particulier suppose que le client certifie sur le devis que le logement est achevé depuis plus de deux ans : prévoyez la mention à côté de sa signature.",
      "Écrivez « acompte » pour la somme demandée à la signature : sans précision, celle d'un particulier est considérée comme des arrhes.",
    ],
    mentionsSpecifiques: [
      "Installation réalisée selon la norme NF C 15-100",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
      CERTIFICATION_DEVIS_10,
    ],
    telechargement: "exemple-devis-electricien",
    exemple: {
      titre: "Remplacement d'un tableau électrique et ajout de prises",
      contexte: "Exemple fictif : devis pour un particulier, dans un appartement achevé depuis plus de deux ans, donc TVA à 10 %. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Dépose de l'ancien tableau et mise en sécurité de l'installation", quantite: 1, unite: "forfait", prixUnitaireHT: 120 },
        { designation: "Tableau électrique 3 rangées équipé (interrupteurs différentiels 30 mA, disjoncteurs divisionnaires), fourni", quantite: 1, unite: "u", prixUnitaireHT: 520 },
        { designation: "Raccordement et repérage des circuits, pose du tableau", quantite: 8, unite: "h", prixUnitaireHT: 48 },
        { designation: "Prise 16 A avec terre encastrée, fournie et posée (percement, câble 2,5 mm² et boîte d'encastrement compris)", quantite: 6, unite: "u", prixUnitaireHT: 78 },
        { designation: "Essais, mise en service et contrôle de l'installation", quantite: 1, unite: "forfait", prixUnitaireHT: 90 },
        { designation: "Évacuation du matériel usagé et dépôt en point de collecte", quantite: 1, unite: "forfait", prixUnitaireHT: 45 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en deux jours, dans les 30 jours qui suivent la signature.",
        "Installation réalisée selon la norme NF C 15-100.",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 48,00 € HT, soit 52,80 € TTC.",
        "Déchets : environ 25 kg de matériel électrique usagé (ancien tableau, câbles), déposés en point de collecte (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        "Acompte de 30 % à la signature, solde à la fin des travaux. Signé au domicile du client, l'acompte ne pourrait être encaissé qu'au bout de sept jours.",
        CERTIFICATION_RESUME,
        "Assurance décennale : assureur, numéro de contrat et zone couverte à indiquer.",
        "Signature du client précédée de « Bon pour accord ».",
      ],
    },
    autresExemples: [
      {
        titre: "Un second exemple :",
        accent: "rénovation électrique d'une maison de 100 m².",
        exemple: {
          titre: "Rénovation électrique complète d'une maison de 100 m²",
          contexte: "Exemple fictif : remise à neuf de toute l'installation d'une maison de 100 m² (séjour, cuisine, trois chambres, salle de bain, WC), achevée depuis plus de deux ans, pour un particulier : TVA à 10 %. Les quantités dépendent de la maison et de la norme NF C 15-100 ; les prix illustrent la méthode, ce ne sont pas des prix de marché.",
          lignes: [
            { designation: "Dépose de l'ancienne installation (tableau, appareillage, câbles apparents)", quantite: 1, unite: "forfait", prixUnitaireHT: 450 },
            { designation: "Tableau électrique 4 rangées équipé (interrupteurs différentiels 30 mA, disjoncteurs divisionnaires) et gaine technique logement, fournis et posés", quantite: 1, unite: "u", prixUnitaireHT: 1250 },
            { designation: "Prise 16 A avec terre, fournie et posée (câble 2,5 mm², gaine et boîte d'encastrement compris)", quantite: 25, unite: "u", prixUnitaireHT: 72 },
            { designation: "Point lumineux avec interrupteur, fourni et posé (câble 1,5 mm², gaine et boîte compris)", quantite: 11, unite: "u", prixUnitaireHT: 85 },
            { designation: "Circuit spécialisé 20 A (four, lave-linge, lave-vaisselle, chauffe-eau), fourni et posé", quantite: 4, unite: "u", prixUnitaireHT: 140 },
            { designation: "Circuit de plaque de cuisson 32 A (câble 6 mm²), fourni et posé", quantite: 1, unite: "u", prixUnitaireHT: 190 },
            { designation: "Saignées et rebouchage des passages de câbles (hors peinture)", quantite: 1, unite: "forfait", prixUnitaireHT: 650 },
            { designation: "Liaison équipotentielle de la salle de bain et contrôle de la prise de terre", quantite: 1, unite: "forfait", prixUnitaireHT: 180 },
            { designation: "Essais, mise en service et contrôle de l'installation", quantite: 1, unite: "forfait", prixUnitaireHT: 150 },
            { designation: "Attestation de conformité visée par le Consuel", quantite: 1, unite: "forfait", prixUnitaireHT: 180 },
            { designation: "Évacuation des déchets du chantier et dépôt en point de collecte", quantite: 1, unite: "forfait", prixUnitaireHT: 90 },
          ],
          tauxTva: 10,
          acomptePourcent: 30,
          conditions: [
            "Devis gratuit, valable deux mois.",
            "Travaux réalisés en huit jours, à une date fixée ensemble dans les 60 jours qui suivent la signature.",
            "Installation réalisée selon la norme NF C 15-100.",
            "Installation entièrement rénovée avec coupure du réseau : l'attestation de conformité visée par le Consuel est nécessaire avant la remise sous tension ; son coût est compris dans le devis.",
            "Taux horaire pour un travail supplémentaire accepté par avenant : 48,00 € HT, soit 52,80 € TTC.",
            "Déchets : environ 150 kg (ancien tableau, câbles, appareillage, gravats des saignées), triés et déposés en point de collecte (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
            "Acompte de 30 % à la signature, solde à la fin des travaux. Signé au domicile du client, l'acompte ne pourrait être encaissé qu'au bout de sept jours.",
            CERTIFICATION_RESUME,
            "Assurance décennale : assureur, numéro de contrat et zone couverte à indiquer.",
            "Signature du client précédée de « Bon pour accord ».",
          ],
        },
      },
    ],
    sections: [
      {
        id: "auto-entrepreneur",
        titre: "Électricien auto-entrepreneur :",
        accent: "le même devis, sans TVA.",
        paragraphes: [
          "Micro-entrepreneur en franchise de TVA, vous ne facturez pas la TVA : le devis n'a ni taux ni total de TVA, et le prix hors taxe est le prix à payer. Ajoutez la mention « TVA non applicable, article 293 B du CGI ».",
          "Le reste ne change pas : vos coordonnées avec la mention « EI », votre assurance décennale, le détail des fournitures et de la main-d'œuvre, le taux horaire, les déchets du chantier, la mention de la norme NF C 15-100 et le « Bon pour accord ». Le client n'a rien à certifier sur la TVA, puisqu'elle n'est pas facturée.",
          "En sous-traitance pour une autre entreprise, pas d'autoliquidation non plus : elle ne concerne que les entreprises qui facturent la TVA. Si vous dépassez les seuils de la franchise, la TVA s'applique et le devis reprend la forme des exemples ci-dessus.",
        ],
      },
    ],
  },
  {
    slug: "devis-prestation-service",
    titre: "Modèle de devis prestation de service gratuit",
    description: "Modèle de devis pour prestation de service gratuit. Idéal pour les consultants, freelances, formateurs et prestataires intellectuels.",
    motsCles: ["modele devis prestation service", "devis freelance", "devis consultant gratuit"],
    type: "devis",
    pourQui: "Freelances, consultants, formateurs et prestataires de services intellectuels qui veulent formaliser leurs propositions commerciales.",
    contenu: [
      "Mention « Devis » ou « Proposition commerciale »",
      "Date et durée de validité",
      "Coordonnées du prestataire",
      "Coordonnées du client",
      "Description détaillée de la mission",
      "Livrables attendus",
      "Planning et jalons",
      "Tarification (forfait, taux journalier, taux horaire)",
      "Conditions de révision de prix",
      "Conditions de paiement",
      "Clause de confidentialité",
      "Conditions d'annulation",
    ],
    conseils: [
      "Définissez clairement le périmètre de la mission pour éviter les dérives",
      "Indiquez le nombre de révisions incluses dans le forfait",
      "Prévoyez une clause pour les demandes supplémentaires (avenant)",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "avoir-annulation",
    titre: "Modèle d'avoir (note de crédit) gratuit",
    description: "Modèle d'avoir gratuit pour annuler ou corriger une facture : mentions obligatoires, référence de la facture d'origine, TVA.",
    motsCles: ["modele avoir", "note de credit modele", "annuler une facture modele"],
    type: "avoir",
    pourQui: "Toute entreprise qui doit annuler ou corriger une facture déjà émise (erreur, retour, remise).",
    contenu: [
      "Mention « Avoir » ou « Note de crédit »",
      "Numéro d'avoir (dans la séquence de facturation)",
      "Date d'émission",
      "Référence de la facture d'origine (numéro et date)",
      "Motif de l'avoir (retour, erreur, remise, annulation)",
      "Détail des montants crédités (HT, TVA, TTC)",
      "Montants en négatif",
      "Mode de remboursement ou report",
    ],
    conseils: [
      "Ne supprimez jamais une facture : émettez toujours un avoir",
      "L'avoir suit la même numérotation séquentielle que les factures",
      "Conservez l'avoir et la facture d'origine ensemble pendant 10 ans",
    ],
    mentionsSpecifiques: [
      "Avoir sur facture n° [X] du [date]",
      "Motif : [retour de marchandise / erreur / remise commerciale / annulation]",
    ],
  },
  {
    slug: "bon-de-commande",
    titre: "Modèle de bon de commande gratuit",
    description: "Modèle de bon de commande gratuit et professionnel, pour formaliser les commandes de fournitures, de matériaux ou de prestations.",
    motsCles: ["modele bon de commande", "bon de commande gratuit", "exemple bon de commande"],
    type: "bon-de-commande",
    pourQui: "Entreprises et artisans qui veulent formaliser leurs commandes auprès de fournisseurs ou confirmer une commande client.",
    contenu: [
      "Mention « Bon de commande »",
      "Numéro de bon de commande",
      "Date et référence",
      "Coordonnées de l'émetteur et du fournisseur",
      "Description des articles ou services commandés",
      "Quantités et prix unitaires",
      "Conditions de livraison (délai, lieu, transport)",
      "Conditions de paiement",
      "Signature de validation",
    ],
    conseils: [
      "Numérotez vos bons de commande pour faciliter le suivi",
      "Reliez chaque bon de commande au devis correspondant",
      "Vérifiez les conditions de livraison et les délais avant validation",
    ],
    mentionsSpecifiques: [],
  },
  {
    slug: "facture-proforma",
    titre: "Modèle de facture proforma gratuit",
    description: "Modèle de facture proforma gratuit : document commercial de préfacturation pour les devis internationaux et les formalités douanières.",
    motsCles: ["facture proforma modele", "proforma gratuit", "facture proforma exemple"],
    type: "facture",
    pourQui: "Entreprises qui réalisent des opérations à l'international ou qui veulent émettre un document de préfacturation sans valeur comptable.",
    contenu: [
      "Mention « Facture proforma » (bien visible)",
      "Mention « Ce document n'est pas une facture »",
      "Coordonnées de l'émetteur et du destinataire",
      "Description des biens ou des services",
      "Quantités, prix unitaires, montant total",
      "Incoterms (pour l'international)",
      "Devise et taux de change",
      "Conditions de paiement",
      "Durée de validité",
    ],
    conseils: [
      "La facture proforma n'a aucune valeur comptable ni fiscale",
      "Elle ne doit pas porter de numéro de facture (elle n'entre pas dans la numérotation)",
      "Émettez une vraie facture une fois la commande confirmée",
    ],
    mentionsSpecifiques: [
      "PROFORMA — Ce document n'est pas une facture et n'a pas de valeur comptable",
    ],
  },
  {
    slug: "facture-situation",
    titre: "Modèle de facture de situation (BTP) gratuit",
    description: "Modèle de facture de situation gratuit pour le BTP : facturation à l'avancement du chantier, cumul des situations précédentes et solde.",
    motsCles: ["facture de situation", "facture avancement travaux", "facture situation BTP gratuit"],
    type: "facture",
    pourQui: "Entreprises du bâtiment qui facturent par tranches selon l'avancement des travaux (gros œuvre, second œuvre, finitions).",
    contenu: [
      "Mention « Facture de situation n° [X] »",
      "Référence du marché ou du devis accepté",
      "Tableau d'avancement par poste (% réalisé)",
      "Montant cumulé des situations précédentes",
      "Montant de la situation en cours",
      "Retenue de garantie (5 % au maximum, art. L. 111-10-1 du CCH)",
      "TVA calculée sur la situation",
      "Solde restant à facturer",
      "Toutes les mentions obligatoires d'une facture classique",
    ],
    conseils: [
      "Faites valider le pourcentage d'avancement par le maître d'ouvrage ou le maître d'œuvre avant d'émettre la facture",
      "Numérotez les situations dans l'ordre (situation 1, 2, 3…)",
      "La retenue de garantie de 5 % est libérée un an après la réception des travaux",
      "Conservez le tableau d'avancement signé avec chaque facture",
    ],
    mentionsSpecifiques: [
      "Situation n° [X] sur [Y] — Avancement global : [Z] %",
      "Retenue de garantie de 5 % conformément à l'article L. 111-10-1 du CCH",
    ],
  },
  {
    slug: "facture-recurrente",
    titre: "Modèle de facture récurrente gratuit",
    description: "Modèle de facture récurrente gratuit pour les abonnements et prestations mensuelles : période couverte, référence du contrat, numérotation continue.",
    motsCles: ["facture recurrente", "facture abonnement", "facture mensuelle modele gratuit"],
    type: "facture",
    pourQui: "Prestataires de services qui facturent de manière périodique : maintenance, abonnements, locations, contrats mensuels.",
    contenu: [
      "Toutes les mentions obligatoires d'une facture classique",
      "Mention de la périodicité (mensuelle, trimestrielle, annuelle)",
      "Référence du contrat ou de l'abonnement",
      "Période couverte (du [date] au [date])",
      "Montant fixe ou variable selon la consommation",
      "Conditions de résiliation",
      "Date de prélèvement ou échéance",
      "Numéro de facture unique et séquentiel (même pour les factures récurrentes)",
    ],
    conseils: [
      "Chaque facture récurrente doit avoir un numéro unique dans votre séquence chronologique",
      "Mentionnez clairement la période couverte pour éviter les contestations",
      "Émettez vos factures à date fixe chaque période : votre client sait quand payer",
      "Prévoyez une clause de révision de prix dans le contrat",
    ],
    mentionsSpecifiques: [
      "Facture périodique — Contrat n° [X]",
      "Période : du [date de début] au [date de fin]",
    ],
  },
  {
    slug: "lettre-relance-impaye",
    // Mots des chercheurs (MOTS-CLES-COMPACTS-2026-10.md § 9) : « relance facture impayée mail » (110/mois).
    titre: "Modèle de relance de facture impayée : mail et lettre",
    description: "Modèles gratuits de relance de facture impayée : 3 mails à copier (1re relance, 2e rappel, avant mise en demeure) et la lettre de mise en demeure.",
    motsCles: ["relance facture impayée mail", "modèle relance facture impayée", "lettre relance facture impayee", "mail relance facture impayée", "relance avant mise en demeure", "modele mise en demeure facture"],
    type: "relance",
    pourQui: "Artisans et entreprises du bâtiment dont un client, professionnel ou particulier, n'a pas réglé une facture à l'échéance, et qui veulent le relancer par mail puis, si besoin, le mettre en demeure par lettre recommandée.",
    contenu: [
      "Référence de la facture impayée (numéro, date, montant TTC)",
      "Date d'échéance dépassée",
      "Moyen de paiement : IBAN et référence à indiquer pour le virement",
      "Délai accordé pour le règlement (huit jours)",
      "Client professionnel : pénalités de retard et indemnité forfaitaire de 40 €",
      "Client particulier : intérêts au taux légal à compter de la mise en demeure",
      "Trois mails progressifs : 1re relance, 2e rappel, dernier rappel avant mise en demeure",
      "Lettre de mise en demeure, à envoyer en recommandé avec accusé de réception",
    ],
    conseils: [
      "Envoyez la première relance par mail 7 jours après l'échéance : un ton courtois et la facture en pièce jointe suffisent souvent.",
      "Le deuxième rappel, 15 jours après l'échéance, demande un règlement sous huit jours ; chez un client professionnel, il rappelle les pénalités de retard et l'indemnité de 40 €.",
      "Gardez la lettre recommandée avec accusé de réception pour la mise en demeure : elle prouve vos démarches avant une injonction de payer et, chez un particulier, fait courir les intérêts au taux légal (Code civil, art. 1231-6).",
      "Conservez une copie de chaque relance envoyée : c'est votre preuve en cas de litige.",
      "Avec la formule Essentiel, Qonforme envoie les relances par mail pour vous, aux dates que vous choisissez.",
    ],
    mentionsSpecifiques: [
      "Client professionnel : pénalités de retard au taux de [X] % l'an (au moins trois fois le taux d'intérêt légal)",
      "Client professionnel : indemnité forfaitaire pour frais de recouvrement de 40 € (article D441-5 du Code de commerce)",
    ],
    textes: {
      titre: "Relance de facture impayée par mail :",
      accent: "les modèles à copier.",
      intro: "Entre crochets : ce que vous remplacez. Les paragraphes marqués « Client professionnel » ou « Client particulier » ne gardent que celui qui correspond à votre client : l'indemnité de 40 € et les pénalités de plein droit ne valent qu'entre professionnels.",
      liste: [
        {
          id: "relance-1",
          titre: "1re relance par mail",
          quand: "7 jours après l'échéance",
          canal: "Mail",
          objet: "Rappel de paiement — facture [numéro] du [date]",
          corps: [
            "Bonjour [Madame, Monsieur],",
            "Sauf erreur de notre part, la facture [numéro] du [date], d'un montant de [montant] € TTC, arrivée à échéance le [date d'échéance], n'a pas encore été réglée.",
            "Il s'agit peut-être d'un simple oubli : vous trouverez la facture en pièce jointe. Vous pouvez la régler par virement sur le compte [IBAN], en indiquant la référence [numéro].",
            "Si le règlement a été fait entre-temps, merci de ne pas tenir compte de ce message.",
            "Bien cordialement,",
            "[Prénom Nom], [entreprise], [téléphone]",
          ],
        },
        {
          id: "relance-2",
          titre: "2e rappel par mail",
          quand: "15 jours après l'échéance",
          canal: "Mail",
          objet: "Deuxième rappel — facture [numéro] en attente de règlement",
          corps: [
            "Bonjour [Madame, Monsieur],",
            "Nous revenons vers vous au sujet de la facture [numéro] du [date], d'un montant de [montant] € TTC, échue le [date d'échéance]. Malgré notre message du [date de la 1re relance], elle reste impayée à ce jour.",
            "Nous vous remercions de la régler sous huit jours, par virement sur le compte [IBAN] avec la référence [numéro]. Si un point vous empêche de la régler (erreur sur la facture, travaux à reprendre), dites-le-nous : nous trouverons une solution.",
            `[Client professionnel] Entre professionnels, tout retard de paiement fait courir de plein droit des pénalités de retard au taux indiqué sur la facture ou, à défaut, au taux de la Banque centrale européenne majoré de 10 points (${TAUX_DEFAUT_FR} l'an au ${SEMESTRE_REFERENCE.libelle}), ainsi qu'une indemnité forfaitaire pour frais de recouvrement de ${INDEMNITE_FORFAITAIRE} € (Code de commerce, articles L441-10 et D441-5).`,
            "Bien cordialement,",
            "[Prénom Nom], [entreprise], [téléphone]",
          ],
        },
        {
          id: "relance-3",
          titre: "Dernier rappel avant mise en demeure",
          quand: "30 jours après l'échéance",
          canal: "Mail",
          objet: "Dernier rappel avant mise en demeure — facture [numéro]",
          corps: [
            "Bonjour [Madame, Monsieur],",
            "La facture [numéro] du [date], d'un montant de [montant] € TTC, échue le [date d'échéance], reste impayée malgré nos messages du [date] et du [date].",
            "Sans règlement de votre part d'ici le [date, huit jours plus tard], nous vous adresserons une mise en demeure par lettre recommandée avec accusé de réception, puis nous pourrons engager une procédure de recouvrement.",
            `[Client professionnel] Les pénalités de retard et l'indemnité forfaitaire de ${INDEMNITE_FORFAITAIRE} € sont dues depuis le [lendemain de l'échéance].`,
            "Bien cordialement,",
            "[Prénom Nom], [entreprise], [téléphone]",
          ],
        },
        {
          id: "mise-en-demeure",
          titre: "Lettre de mise en demeure",
          quand: "Après le dernier rappel resté sans réponse",
          canal: "Lettre recommandée avec accusé de réception",
          objet: "Mise en demeure de payer — facture [numéro] du [date]",
          corps: [
            "[Madame, Monsieur],",
            "Par la présente, nous vous mettons en demeure de nous régler la somme de [montant] € TTC, due au titre de la facture [numéro] du [date], pour les travaux de [désignation] réalisés le [date] au [adresse du chantier]. Cette facture, échue le [date d'échéance], reste impayée malgré nos relances du [date] et du [date].",
            "Ce règlement doit nous parvenir dans un délai de huit jours à compter de la réception de cette lettre, par virement sur le compte [IBAN] (référence [numéro]) ou par chèque à l'ordre de [entreprise].",
            `[Client professionnel] À cette somme s'ajoutent les pénalités de retard au taux de [taux] % l'an, dues depuis le [lendemain de l'échéance], et l'indemnité forfaitaire pour frais de recouvrement de ${INDEMNITE_FORFAITAIRE} € (Code de commerce, articles L441-10 et D441-5).`,
            "[Client particulier] La somme due portera intérêt au taux légal à compter de la présente mise en demeure (Code civil, article 1231-6).",
            "À défaut de règlement dans ce délai, nous saisirons la juridiction compétente pour obtenir le paiement, notamment par une requête en injonction de payer.",
            "Veuillez agréer, [Madame, Monsieur], l'expression de nos salutations distinguées.",
            "[Prénom Nom], [entreprise], [adresse], SIREN [numéro]",
          ],
        },
      ],
    },
  },
]

export function getModeleBySlug(slug: string): Modele | undefined {
  return MODELES.find(m => m.slug === slug)
}
