/**
 * Pages « exemple de devis » par métier et devis vierge (plan mots-clés du 16/10/2026,
 * MOTS-CLES-COMPACTS-2026-10.md § 0) : une page par requête exacte, chacune avec un
 * exemple chiffré (totaux calculés par lib/pseo/exemple-devis.ts) et ses fichiers
 * Word, Excel et PDF construits à partir du même objet (lib/modeles/fichier.ts).
 *
 * Prix fictifs, annoncés comme tels. Règles vérifiées :
 * - TVA des travaux (CGI 279-0 bis, 278-0 bis A ; BOFiP BOI-TVA-LIQ-30-20-90-20 et -30) :
 *   10 % dans un logement achevé depuis plus de deux ans, 5,5 % pour la rénovation
 *   énergétique sous critères de performance, 20 % pour les espaces verts (exclus du taux
 *   réduit), allée, clôture et terrasse rattachées au logement à 10 % (BOI-ANNX-000208) ;
 * - certification du client sur le devis (BOI-LETTRE-000280, lib/legal/certification-tva.ts) ;
 * - franchise de TVA (CGI 293 B), seuils de lib/outils/franchise-tva.ts ;
 * - déchets de chantier (C. environnement L541-21-2-3), décennale (C. assurances L243-2),
 *   acompte et arrhes, paiement hors établissement (C. conso L221-10).
 */
import type { Modele } from "./modeles"
import { CERTIFICATION_DEVIS_10, CERTIFICATION_RESUME } from "@/lib/legal/certification-tva"
import { MENTION_FRANCHISE } from "@/lib/outils/document"
import { SEUILS_FRANCHISE_TVA } from "@/lib/outils/franchise-tva"

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`
const franchise = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!

/** Conditions communes aux exemples (fin de liste). */
const ACOMPTE_30 = "Acompte de 30 % à la signature, solde à la fin des travaux. Signé au domicile du client, l'acompte ne pourrait être encaissé qu'au bout de sept jours."
const DECENNALE = "Assurance décennale : assureur, numéro de contrat et zone couverte à indiquer."
const BON_POUR_ACCORD = "Signature du client précédée de « Bon pour accord »."

/** Contenu d'un devis de travaux, commun aux pages par métier. */
const contenuTravaux = (fournitures: string): string[] => [
  "Mention « Devis », date et durée de validité",
  "Coordonnées de l'entreprise (SIREN ou SIRET, « EI » pour un entrepreneur individuel)",
  "Coordonnées du client et adresse du chantier",
  fournitures,
  "Main-d'œuvre : forfait, surface ou heures, avec le taux horaire TTC chez un particulier",
  "Évacuation des déchets du chantier : quantité, point de collecte et coût",
  "Taux de TVA de chaque ligne et totaux HT et TTC",
  "Délai d'exécution, acompte et conditions de paiement",
  "Assurance décennale : assureur, n° de contrat, couverture géographique",
  "Emplacement pour la signature du client, précédée de « Bon pour accord »",
]

const ARRHES = "Écrivez « acompte » pour la somme demandée à la signature : sans précision, celle d'un particulier est considérée comme des arrhes."

export const MODELES_DEVIS_METIERS: Modele[] = [
  {
    slug: "devis-auto-entrepreneur",
    // « exemple devis auto entrepreneur » (480/mois) et « modèle devis auto entrepreneur sans tva » (140/mois)
    titre: "Exemple de devis auto-entrepreneur du bâtiment, sans TVA",
    titreSeo: "Exemple de devis auto-entrepreneur sans TVA : Word, Excel",
    description: "Exemple de devis auto-entrepreneur chiffré, sans TVA (art. 293 B du CGI) : mentions obligatoires, détail des travaux, fichiers Word, Excel et PDF gratuits.",
    motsCles: ["exemple devis auto entrepreneur", "modèle devis auto entrepreneur sans tva", "devis auto entrepreneur", "modele devis micro entreprise", "devis sans tva auto entrepreneur"],
    type: "devis",
    pourQui: "Artisans du bâtiment en micro-entreprise (auto-entrepreneurs) en franchise de TVA, qui veulent un devis complet et conforme : prix sans TVA, mention de l'article 293 B, assurance décennale et détail des travaux.",
    contenu: [
      "Mention « Devis », date et durée de validité",
      "Vos nom et prénom suivis de « EI » ou « Entrepreneur individuel », votre adresse et votre SIRET",
      "Coordonnées du client et adresse du chantier",
      "Détail des travaux : fournitures, main-d'œuvre, quantités et prix unitaires",
      "Prix sans TVA et total à payer",
      "Mention « TVA non applicable, art. 293 B du CGI »",
      "Taux horaire chez un particulier, frais de déplacement s'il y en a",
      "Évacuation des déchets du chantier : quantité, point de collecte et coût",
      "Délai d'exécution, acompte et conditions de paiement",
      "Assurance décennale : assureur, n° de contrat, couverture géographique",
      "Emplacement pour la signature du client, précédée de « Bon pour accord »",
    ],
    conseils: [
      "N'écrivez ni « HT » ni « TTC » comme si la TVA s'appliquait : en franchise, le prix indiqué est le prix à payer.",
      `Surveillez votre chiffre d'affaires : pour des travaux (prestations de services), la franchise s'arrête au-delà de ${eur(franchise.seuilBase)} par an (${eur(franchise.seuilMajore)} en seuil majoré). Le devis prend alors la TVA au bon taux.`,
      "Gardez la mention « EI » après votre nom : elle est obligatoire sur les devis et les factures d'un entrepreneur individuel.",
      ARRHES,
      "Les devis sont gratuits et illimités dans Qonforme, mention de franchise comprise : vous n'avez qu'à remplir les lignes.",
    ],
    mentionsSpecifiques: [
      MENTION_FRANCHISE,
      "[Nom Prénom] EI · SIRET [numéro]",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
    ],
    telechargement: "exemple-devis-auto-entrepreneur",
    exemple: {
      titre: "Pose de carrelage dans une salle de bain",
      contexte: "Exemple fictif : devis d'un carreleur auto-entrepreneur en franchise de TVA, pour un particulier. Aucune TVA n'est facturée : le total est le prix à payer. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      franchise: true,
      lignes: [
        { designation: "Dépose de l'ancien carrelage de sol et évacuation des gravats", quantite: 6, unite: "m²", prixUnitaireHT: 18 },
        { designation: "Ragréage du sol avant pose", quantite: 6, unite: "m²", prixUnitaireHT: 12 },
        { designation: "Carrelage grès cérame 60 × 60, fourni (chutes comprises)", quantite: 7, unite: "m²", prixUnitaireHT: 34 },
        { designation: "Pose collée du carrelage et joints", quantite: 6, unite: "m²", prixUnitaireHT: 42 },
        { designation: "Plinthes assorties, fournies et posées", quantite: 10, unite: "ml", prixUnitaireHT: 11 },
        { designation: "Évacuation des déchets et dépôt en déchèterie professionnelle", quantite: 1, unite: "forfait", prixUnitaireHT: 45 },
      ],
      tauxTva: 0,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable un mois.",
        "Travaux réalisés en deux jours, dans les 30 jours qui suivent la signature.",
        `${MENTION_FRANCHISE}.`,
        "Taux horaire pour un travail supplémentaire accepté par avenant : 40,00 € (TVA non applicable).",
        "Déchets : environ 150 kg de carrelage et de gravats, déposés en déchèterie professionnelle (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        ACOMPTE_30,
        DECENNALE,
        BON_POUR_ACCORD,
      ],
    },
    sections: [
      {
        id: "si-tva",
        titre: "Si vous facturez la TVA :",
        accent: "ce qui change.",
        paragraphes: [
          "Au-delà des seuils de la franchise, ou si vous avez choisi de facturer la TVA, chaque ligne prend son taux : 10 % pour des travaux dans un logement achevé depuis plus de deux ans, 5,5 % pour la rénovation énergétique, 20 % sinon. Le devis affiche alors les totaux HT, la TVA par taux et le total TTC, et la mention de l'article 293 B disparaît.",
          "Au taux réduit, le client certifie sur le devis que le logement a plus de deux ans : ajoutez la mention près de sa signature. Les exemples de devis d'électricien, de peinture ou de plomberie montrent cette forme.",
          "En sous-traitance du bâtiment, un auto-entrepreneur en franchise facture sans TVA, comme ici : l'autoliquidation ne concerne que les entreprises qui facturent la TVA.",
        ],
      },
    ],
  },
  {
    slug: "devis-paysagiste",
    // « exemple devis paysagiste » (390/mois)
    titre: "Exemple de devis paysagiste : création de jardin et allée",
    titreSeo: "Exemple de devis paysagiste chiffré (Word, Excel, PDF)",
    description: "Exemple de devis paysagiste chiffré : plantations et gazon à 20 %, allée à 10 %, mentions obligatoires et fichiers Word, Excel et PDF gratuits.",
    motsCles: ["exemple devis paysagiste", "devis paysagiste exemple", "modele devis paysagiste", "devis creation jardin", "devis aménagement extérieur"],
    type: "devis",
    pourQui: "Paysagistes et entreprises du paysage qui chiffrent la création ou l'aménagement d'un jardin pour un particulier : plantations, gazon, allées, clôtures, avec le bon taux de TVA pour chaque ligne.",
    contenu: contenuTravaux("Fournitures détaillées : végétaux (espèce, taille, nombre), terre, gazon, matériaux de l'allée"),
    conseils: [
      "Séparez les espaces verts et les ouvrages : la création de pelouse, de massifs et les plantations sont à 20 %, car exclues des taux réduits ; une allée, une clôture ou une terrasse rattachées à un logement de plus de deux ans peuvent être à 10 %.",
      "Donnez l'espèce, la taille ou la force et le nombre de chaque végétal : c'est ce que le client compare d'un devis à l'autre.",
      "Précisez la garantie de reprise des végétaux et ses conditions (arrosage par le client), ou son absence.",
      "Les petits travaux de jardinage chez un particulier (tonte, taille, désherbage) relèvent des services à la personne s'ils sont rendus au domicile : ce n'est pas le même devis que la création d'un jardin.",
      ARRHES,
    ],
    mentionsSpecifiques: [
      "Plantations et engazonnement : TVA à 20 % (espaces verts exclus des taux réduits)",
      "Assurance décennale (ouvrages : allée, clôture, terrasse) : [Assureur], contrat n° [X], couverture : [zone]",
      CERTIFICATION_DEVIS_10,
    ],
    telechargement: "exemple-devis-paysagiste",
    exemple: {
      titre: "Création d'un jardin de 120 m² avec allée en pavés",
      contexte: "Exemple fictif : devis pour un particulier, autour d'une maison achevée depuis plus de deux ans. Les espaces verts sont à 20 %, l'allée rattachée à la maison à 10 % : le devis porte deux taux. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Débroussaillage, nettoyage et nivellement du terrain", quantite: 120, unite: "m²", prixUnitaireHT: 4.5, tauxTva: 20 },
        { designation: "Apport de terre végétale, régalage", quantite: 6, unite: "m³", prixUnitaireHT: 55, tauxTva: 20 },
        { designation: "Engazonnement par semis (préparation, semences, roulage)", quantite: 80, unite: "m²", prixUnitaireHT: 6, tauxTva: 20 },
        { designation: "Arbustes en conteneur 40/60 cm, fournis et plantés", quantite: 18, unite: "u", prixUnitaireHT: 32, tauxTva: 20 },
        { designation: "Paillage des massifs (copeaux de bois)", quantite: 25, unite: "m²", prixUnitaireHT: 9, tauxTva: 20 },
        { designation: "Allée en pavés sur lit de sable stabilisé, bordures comprises", quantite: 15, unite: "m²", prixUnitaireHT: 85, tauxTva: 10 },
        { designation: "Évacuation des déchets verts et des terres, dépôt en déchèterie", quantite: 1, unite: "forfait", prixUnitaireHT: 120, tauxTva: 20 },
      ],
      tauxTva: 20,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en quatre jours, à une date fixée ensemble selon la saison de plantation.",
        "Garantie de reprise des végétaux pendant un an, sous réserve d'un arrosage régulier par le client.",
        "Déchets : environ 2 m³ de déchets verts et de terres, déposés en déchèterie (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        `Allée à 10 % : ${CERTIFICATION_RESUME}`,
        ACOMPTE_30,
        DECENNALE,
        BON_POUR_ACCORD,
      ],
    },
  },
  {
    slug: "devis-peinture",
    // « exemple devis peinture » (320/mois) et « devis peinture façade extérieure » (320/mois)
    titre: "Exemple de devis peinture : intérieur et façade extérieure",
    titreSeo: "Exemple de devis peinture : intérieur et façade",
    description: "Exemples de devis de peinture chiffrés : pièces intérieures et façade extérieure, TVA à 10 %, mentions obligatoires, fichiers Word, Excel et PDF gratuits.",
    motsCles: ["exemple devis peinture", "devis peinture façade extérieure", "modele devis peinture", "devis peinture intérieure", "devis peintre exemple"],
    type: "devis",
    pourQui: "Peintres en bâtiment qui chiffrent des travaux de peinture intérieure ou un ravalement de façade : préparation des supports, nombre de couches, produits et surfaces au mètre carré.",
    contenu: contenuTravaux("Préparation des supports et produits : type de peinture, finition, nombre de couches"),
    conseils: [
      "Chiffrez au mètre carré, pièce par pièce, et distinguez murs, plafonds et boiseries : le client voit où va son argent.",
      "Écrivez la préparation (lessivage, rebouchage, ponçage, sous-couche) sur une ligne à part : c'est elle qui fait la tenue de la peinture, et c'est ce qui manque dans les devis les moins chers.",
      "Nommez le produit, la finition (mat, satiné, velours) et le nombre de couches.",
      "Pour une façade : changer la couleur ou l'aspect demande en principe une déclaration préalable en mairie, et certaines communes y soumettent tout ravalement. Un échafaudage sur le trottoir demande aussi une autorisation de la commune.",
      "Dans un logement achevé depuis plus de deux ans, peinture intérieure et ravalement sont à 10 % : prévoyez la mention que le client signe.",
    ],
    mentionsSpecifiques: [
      "Peinture : [marque ou équivalent], finition [ ], [nombre] couches",
      "Assurance décennale ou responsabilité civile professionnelle : [Assureur], contrat n° [X]",
      CERTIFICATION_DEVIS_10,
    ],
    telechargement: "exemple-devis-peinture",
    exemple: {
      titre: "Peinture d'un séjour et d'une chambre",
      contexte: "Exemple fictif : devis pour un particulier, dans un appartement achevé depuis plus de deux ans, donc TVA à 10 %. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Protection des sols et des meubles, dépose et repose des prises et interrupteurs", quantite: 1, unite: "forfait", prixUnitaireHT: 120 },
        { designation: "Préparation des murs : lessivage, rebouchage, ponçage", quantite: 85, unite: "m²", prixUnitaireHT: 6 },
        { designation: "Sous-couche et deux couches de peinture acrylique velours, murs", quantite: 85, unite: "m²", prixUnitaireHT: 16 },
        { designation: "Préparation et deux couches de peinture blanche mate, plafonds", quantite: 32, unite: "m²", prixUnitaireHT: 19 },
        { designation: "Peinture des boiseries (portes et encadrements), laque satinée", quantite: 3, unite: "u", prixUnitaireHT: 85 },
        { designation: "Nettoyage du chantier et évacuation des déchets", quantite: 1, unite: "forfait", prixUnitaireHT: 60 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en quatre jours, dans les 30 jours qui suivent la signature.",
        "Peinture acrylique velours pour les murs, mate pour les plafonds, laque satinée pour les boiseries (marque ou équivalent à préciser).",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 42,00 € HT, soit 46,20 € TTC.",
        "Déchets : pots vides, bâches et papiers de protection, déposés en déchèterie (nom et adresse à indiquer), coût compris dans la ligne de nettoyage.",
        ACOMPTE_30,
        CERTIFICATION_RESUME,
        "Assurance : assureur, numéro de contrat et zone couverte à indiquer.",
        BON_POUR_ACCORD,
      ],
    },
    autresExemples: [
      {
        titre: "Un second exemple :",
        accent: "peinture d'une façade extérieure.",
        exemple: {
          titre: "Ravalement et peinture de la façade d'une maison",
          contexte: "Exemple fictif : façade enduite de 120 m² d'une maison achevée depuis plus de deux ans, pour un particulier : TVA à 10 %. La couleur ne change pas ; si elle changeait, une déclaration préalable en mairie serait à prévoir avant les travaux. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
          lignes: [
            { designation: "Installation, location et repli de l'échafaudage", quantite: 1, unite: "forfait", prixUnitaireHT: 1400 },
            { designation: "Protection des menuiseries, des sols et des végétaux", quantite: 1, unite: "forfait", prixUnitaireHT: 250 },
            { designation: "Nettoyage haute pression et traitement anti-mousse de la façade", quantite: 120, unite: "m²", prixUnitaireHT: 7 },
            { designation: "Reprise des fissures et des épaufrures à l'enduit", quantite: 1, unite: "forfait", prixUnitaireHT: 380 },
            { designation: "Fixateur de fond et deux couches de peinture façade pliolite", quantite: 120, unite: "m²", prixUnitaireHT: 21 },
            { designation: "Peinture des appuis de fenêtre et des sous-faces de toit", quantite: 1, unite: "forfait", prixUnitaireHT: 450 },
            { designation: "Nettoyage du chantier et évacuation des déchets", quantite: 1, unite: "forfait", prixUnitaireHT: 120 },
          ],
          tauxTva: 10,
          acomptePourcent: 30,
          conditions: [
            "Devis gratuit, valable deux mois.",
            "Travaux réalisés en sept jours, hors intempéries, à une date fixée ensemble dans les 60 jours qui suivent la signature.",
            "Échafaudage sur la voie publique : autorisation de la commune demandée par l'entreprise (permis de stationnement), son éventuelle redevance en plus.",
            "Couleur inchangée. Changer la couleur ou l'aspect de la façade demande en principe une déclaration préalable en mairie.",
            "Déchets : eaux de lavage filtrées, pots vides et protections, déposés en déchèterie (nom et adresse à indiquer), coût compris dans la ligne de nettoyage.",
            ACOMPTE_30,
            CERTIFICATION_RESUME,
            DECENNALE,
            BON_POUR_ACCORD,
          ],
        },
      },
    ],
  },
  {
    slug: "devis-vierge",
    // « devis vierge à imprimer » (260/mois) et « devis vierge pdf » (170/mois)
    titre: "Devis vierge à imprimer ou à remplir : PDF, Word, Excel",
    titreSeo: "Devis vierge à imprimer : PDF, Word et Excel gratuits",
    description: "Devis vierge gratuit à imprimer en PDF ou à remplir en Word et Excel : lignes de travaux, TVA par taux, mentions obligatoires et « Bon pour accord ».",
    motsCles: ["devis vierge à imprimer", "devis vierge pdf", "devis vierge gratuit", "modele devis vierge", "devis vierge word", "devis vierge excel"],
    type: "devis",
    pourQui: "Artisans et entreprises du bâtiment qui veulent un devis vierge, à imprimer et remplir à la main sur le chantier, ou à compléter sur ordinateur, avec toutes les mentions déjà prévues.",
    contenu: [
      "En-tête : vos coordonnées (SIREN ou SIRET, « EI » pour un entrepreneur individuel) et celles du client",
      "N° du devis, date d'émission, durée de validité et délai d'exécution",
      "Objet des travaux et adresse du chantier",
      "Tableau des lignes : désignation, quantité, unité, prix unitaire HT, taux de TVA, total",
      "Totaux : HT, TVA par taux (20 %, 10 %, 5,5 %), TTC, acompte et reste à payer",
      "Conditions de paiement et mention de l'acompte",
      "Mentions à garder selon votre cas : décennale, déchets, certification du taux réduit, franchise de TVA, autoliquidation",
      "Cadre « Bon pour accord » pour la date et la signature du client",
    ],
    conseils: [
      "PDF à imprimer : remplissez-le au stylo chez le client, et gardez-en une copie signée. Word : modifiez-le librement. Excel : les totaux, la TVA par taux et l'acompte se calculent tout seuls.",
      "Numérotez vos devis dans un ordre continu (D-2026-001, D-2026-002…) : vous retrouverez chaque devis au moment de faire la facture.",
      "Barrez les mentions qui ne vous concernent pas : par exemple la franchise de TVA si vous facturez la TVA.",
      "Le devis rempli à la main reste valable : ce qui compte, ce sont les mentions et la signature du client.",
      "Pour ne plus rien recopier, faites vos devis dans Qonforme : gratuits et illimités, mentions et TVA calculées pour vous.",
    ],
    mentionsSpecifiques: [],
    telechargement: "modele-devis-artisan",
    sections: [
      {
        id: "imprimer",
        titre: "Imprimer le devis vierge :",
        accent: "les bons réglages.",
        paragraphes: [
          "Imprimez le PDF en A4, à taille réelle (100 %), sans « ajuster à la page » : les lignes du tableau gardent la place qu'il faut pour écrire. Prévoyez deux exemplaires : un pour le client, un pour vous, signé.",
          "Sur le chantier, remplissez d'abord l'objet des travaux et l'adresse, puis une ligne par prestation, avec la quantité et l'unité (m², ml, heure, forfait). Calculez les totaux au calme : une erreur de TVA se corrige mal devant le client.",
          "Un devis vierge rempli à la main a la même valeur qu'un devis tapé, s'il porte toutes les mentions et la signature du client précédée de « Bon pour accord ».",
        ],
      },
    ],
  },
  {
    slug: "devis-maconnerie",
    // « exemple devis maçonnerie » (170/mois)
    titre: "Exemple de devis maçonnerie : ouverture dans un mur porteur",
    titreSeo: "Exemple de devis maçonnerie chiffré (Word, Excel, PDF)",
    description: "Exemple de devis de maçonnerie chiffré : ouverture dans un mur porteur, étaiement, poutre, TVA à 10 %, mentions obligatoires, fichiers Word, Excel, PDF.",
    motsCles: ["exemple devis maçonnerie", "devis maçonnerie exemple", "modele devis maçonnerie", "devis maçon", "devis ouverture mur porteur"],
    type: "devis",
    pourQui: "Maçons et entreprises de gros œuvre qui chiffrent des travaux de maçonnerie chez un particulier : ouverture, démolition, reprise en sous-œuvre, dalle ou murs, avec l'assurance décennale et les déchets du chantier.",
    contenu: contenuTravaux("Matériaux détaillés : linteau, béton, parpaings, enduits, avec la référence ou « équivalent »"),
    conseils: [
      "Pour un mur porteur, faites dimensionner le linteau ou la poutre par un bureau d'études ou un calcul justifié, et dites-le sur le devis : c'est votre responsabilité décennale qui est en jeu.",
      "Séparez la démolition, l'étaiement, la pose du linteau et les finitions : le client comprend le prix, et un avenant se chiffre plus facilement.",
      "Annoncez la quantité de gravats et la façon de les évacuer : c'est une mention obligatoire des devis de construction, de rénovation et de démolition.",
      "En copropriété, l'ouverture d'un mur porteur demande en principe l'accord du syndicat des copropriétaires : rappelez-le au client avant de signer.",
      ARRHES,
    ],
    mentionsSpecifiques: [
      "Linteau dimensionné par [bureau d'études ou note de calcul n° X]",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
      CERTIFICATION_DEVIS_10,
    ],
    telechargement: "exemple-devis-maconnerie",
    exemple: {
      titre: "Ouverture de 2,40 m dans un mur porteur entre cuisine et séjour",
      contexte: "Exemple fictif : devis pour un particulier, dans une maison achevée depuis plus de deux ans, donc TVA à 10 %. Le linteau est dimensionné par un bureau d'études. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Protection des sols et des pièces voisines, confinement de la poussière", quantite: 1, unite: "forfait", prixUnitaireHT: 180 },
        { designation: "Étaiement provisoire du plancher", quantite: 1, unite: "forfait", prixUnitaireHT: 420 },
        { designation: "Note de calcul du linteau par un bureau d'études", quantite: 1, unite: "forfait", prixUnitaireHT: 450 },
        { designation: "Démolition du mur porteur (ouverture 2,40 m × 2,10 m)", quantite: 5, unite: "m²", prixUnitaireHT: 160 },
        { designation: "Poutre acier HEA, fournie et posée sur appuis maçonnés", quantite: 1, unite: "forfait", prixUnitaireHT: 1250 },
        { designation: "Reprise des tableaux et du linteau à l'enduit plâtre", quantite: 1, unite: "forfait", prixUnitaireHT: 380 },
        { designation: "Évacuation des gravats et dépôt en déchèterie professionnelle", quantite: 1, unite: "forfait", prixUnitaireHT: 220 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en cinq jours, dans les 45 jours qui suivent la signature.",
        "Poutre dimensionnée par un bureau d'études (note de calcul remise au client).",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 45,00 € HT, soit 49,50 € TTC.",
        "Déchets : environ 1,5 tonne de gravats, triés et déposés en déchèterie professionnelle (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        ACOMPTE_30,
        CERTIFICATION_RESUME,
        DECENNALE,
        BON_POUR_ACCORD,
      ],
    },
  },
  {
    slug: "devis-plomberie",
    // « exemple devis plomberie » (140/mois)
    titre: "Exemple de devis plomberie : chauffe-eau et sanitaires",
    titreSeo: "Exemple de devis plomberie chiffré (Word, Excel, PDF)",
    description: "Exemple de devis de plomberie chiffré : remplacement d'un chauffe-eau et d'un WC, TVA à 10 %, mentions obligatoires et fichiers Word, Excel, PDF.",
    motsCles: ["exemple devis plomberie", "devis plomberie exemple", "modele devis plombier", "devis remplacement chauffe-eau", "devis plombier"],
    type: "devis",
    pourQui: "Plombiers et chauffagistes qui chiffrent un remplacement d'équipement ou des travaux de sanitaires chez un particulier : fournitures, main-d'œuvre, déplacement et reprise de l'ancien appareil.",
    contenu: contenuTravaux("Fournitures détaillées : appareil (marque ou équivalent, capacité), raccords, groupe de sécurité"),
    conseils: [
      "Indiquez les frais de déplacement sur une ligne à part : chez un particulier, ils doivent être annoncés avant les travaux.",
      "Pour un chauffe-eau, écrivez la capacité, le type (électrique, thermodynamique) et la position : c'est ce qui change le prix.",
      "Un chauffe-eau électrique classique est à 10 % dans un logement de plus de deux ans. Un chauffe-eau thermodynamique qui remplit les critères de performance peut passer à 5,5 % : la mention certifiée par le client change alors.",
      "Le remplacement d'une chaudière au gaz ou au fioul est à 20 % depuis le 1er mars 2025 : ne la mettez pas au taux réduit.",
      ARRHES,
    ],
    mentionsSpecifiques: [
      "Ancien appareil repris et déposé en point de collecte (déchet d'équipement électrique)",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
      CERTIFICATION_DEVIS_10,
    ],
    telechargement: "exemple-devis-plomberie",
    exemple: {
      titre: "Remplacement d'un chauffe-eau électrique de 200 L et d'un WC",
      contexte: "Exemple fictif : devis pour un particulier, dans une maison achevée depuis plus de deux ans, donc TVA à 10 %. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Déplacement", quantite: 1, unite: "forfait", prixUnitaireHT: 35 },
        { designation: "Vidange et dépose de l'ancien chauffe-eau", quantite: 1, unite: "forfait", prixUnitaireHT: 90 },
        { designation: "Chauffe-eau électrique vertical 200 L (marque ou équivalent), fourni", quantite: 1, unite: "u", prixUnitaireHT: 520 },
        { designation: "Groupe de sécurité, siphon et raccords, fournis", quantite: 1, unite: "lot", prixUnitaireHT: 65 },
        { designation: "Pose, raccordement eau et électricité, mise en service", quantite: 3, unite: "h", prixUnitaireHT: 55 },
        { designation: "Dépose de l'ancien WC, WC suspendu avec bâti-support fourni et posé", quantite: 1, unite: "u", prixUnitaireHT: 690 },
        { designation: "Reprise et dépôt en point de collecte de l'ancien chauffe-eau et de la cuvette", quantite: 1, unite: "forfait", prixUnitaireHT: 40 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable un mois.",
        "Travaux réalisés en une journée, dans les 15 jours qui suivent la signature.",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 55,00 € HT, soit 60,50 € TTC.",
        "Déchets : ancien chauffe-eau (déchet d'équipement électrique) et cuvette, déposés en point de collecte (nom et adresse à indiquer), coût compris dans la ligne de reprise.",
        ACOMPTE_30,
        CERTIFICATION_RESUME,
        DECENNALE,
        BON_POUR_ACCORD,
      ],
    },
  },
  {
    slug: "devis-placo",
    // « exemple devis placo » (110/mois)
    titre: "Exemple de devis placo : cloison et doublage isolant",
    titreSeo: "Exemple de devis placo chiffré (Word, Excel, PDF)",
    description: "Exemple de devis placo chiffré : cloison en plaques de plâtre à 10 %, doublage isolant à 5,5 %, mentions obligatoires, fichiers Word, Excel, PDF.",
    motsCles: ["exemple devis placo", "devis placo exemple", "modele devis plaquiste", "devis cloison placo", "devis doublage isolant"],
    type: "devis",
    pourQui: "Plaquistes et entreprises de plâtrerie qui chiffrent des cloisons, des doublages et des faux plafonds : surfaces au mètre carré, ossature, isolant, bandes et finitions.",
    contenu: contenuTravaux("Fournitures détaillées : plaques (type, épaisseur), ossature métallique, isolant avec sa résistance thermique"),
    conseils: [
      "Chiffrez au mètre carré et précisez le type de plaque (standard, hydrofuge en pièce humide), l'ossature et le niveau de finition (bandes et enduit prêts à peindre).",
      "Un doublage isolant de mur peut être à 5,5 % s'il fait partie d'une rénovation énergétique et si l'isolant atteint la performance exigée (résistance thermique d'au moins 3,7 m².K/W pour un mur en façade ou en pignon). Écrivez la résistance thermique sur la ligne.",
      "Avec deux taux sur le même devis, la mention que le client certifie couvre les deux : au taux de 5,5 %, elle ajoute « et qu'ils ont la nature de travaux de rénovation énergétique ».",
      "Une cloison ou un doublage sans performance thermique reste à 10 % dans un logement de plus de deux ans.",
      ARRHES,
    ],
    mentionsSpecifiques: [
      "Isolant : [marque ou équivalent], épaisseur [ ] mm, résistance thermique R = [ ] m².K/W",
      "Assurance décennale : [Assureur], contrat n° [X], couverture : France métropolitaine",
      `${CERTIFICATION_DEVIS_10} Au taux de 5,5 % : « et qu'ils ont la nature de travaux de rénovation énergétique ».`,
    ],
    telechargement: "exemple-devis-placo",
    exemple: {
      titre: "Cloison de séparation et doublage isolant d'un mur extérieur",
      contexte: "Exemple fictif : devis pour un particulier, dans une maison achevée depuis plus de deux ans. La cloison est à 10 % ; le doublage isolant du mur en façade (R = 3,75 m².K/W) entre dans une rénovation énergétique et passe à 5,5 % : le devis porte deux taux. Les prix illustrent la méthode ; ce ne sont pas des prix de marché.",
      lignes: [
        { designation: "Cloison de distribution 72/48, plaques BA13 standard sur ossature métallique, isolant acoustique 45 mm", quantite: 14, unite: "m²", prixUnitaireHT: 48, tauxTva: 10 },
        { designation: "Bandes, enduit et finition prêts à peindre, cloison", quantite: 14, unite: "m²", prixUnitaireHT: 12, tauxTva: 10 },
        { designation: "Bloc-porte intégré à la cloison, fourni et posé", quantite: 1, unite: "u", prixUnitaireHT: 260, tauxTva: 10 },
        { designation: "Doublage du mur en façade : isolant laine de verre 120 mm (R = 3,75 m².K/W) et plaques BA13 sur ossature", quantite: 22, unite: "m²", prixUnitaireHT: 58, tauxTva: 5.5 },
        { designation: "Bandes, enduit et finition prêts à peindre, doublage", quantite: 22, unite: "m²", prixUnitaireHT: 12, tauxTva: 5.5 },
        { designation: "Évacuation des chutes et des emballages, dépôt en déchèterie", quantite: 1, unite: "forfait", prixUnitaireHT: 70, tauxTva: 10 },
      ],
      tauxTva: 10,
      acomptePourcent: 30,
      conditions: [
        "Devis gratuit, valable deux mois.",
        "Travaux réalisés en quatre jours, dans les 30 jours qui suivent la signature.",
        "Isolant de résistance thermique R = 3,75 m².K/W (fiche technique remise au client).",
        "Taux horaire pour un travail supplémentaire accepté par avenant : 42,00 € HT, soit 46,20 € TTC.",
        "Déchets : environ 80 kg de chutes de plaques et d'emballages, déposés en déchèterie (nom et adresse à indiquer), coût compris dans la ligne d'évacuation.",
        ACOMPTE_30,
        `${CERTIFICATION_RESUME} Pour le doublage à 5,5 %, le client certifie aussi qu'il s'agit de travaux de rénovation énergétique.`,
        DECENNALE,
        BON_POUR_ACCORD,
      ],
    },
  },
]

/** Page « exemple de devis » de chaque métier qui en a une (liens des pages métier et « s'installer »). */
export const EXEMPLE_DEVIS_PAR_METIER: Record<string, { href: string; label: string }> = {
  electricien: { href: "/modele/devis-electricien", label: "Exemple de devis d'électricien" },
  plombier: { href: "/modele/devis-plomberie", label: "Exemple de devis de plomberie" },
  chauffagiste: { href: "/modele/devis-plomberie", label: "Exemple de devis de plomberie" },
  macon: { href: "/modele/devis-maconnerie", label: "Exemple de devis de maçonnerie" },
  peintre: { href: "/modele/devis-peinture", label: "Exemple de devis de peinture" },
  plaquiste: { href: "/modele/devis-placo", label: "Exemple de devis placo" },
  paysagiste: { href: "/modele/devis-paysagiste", label: "Exemple de devis paysagiste" },
}
