export interface Metier {
  slug: string
  nom: string
  titre: string
  description: string
  motsCles: string[]
  features: { titre: string; texte: string }[]
  obligations: string[]
  faq: { question: string; reponse: string }[]
  metiersProches: string[]
}

/*
 * Fonctions affichées sur les pages métier : uniquement celles que le produit
 * livre aujourd'hui (DECISIONS-STRATEGIQUES.md § 10). Une fonction en
 * préparation (autoliquidation, acomptes, situations, suivi de chantier,
 * factures récurrentes, suivi d'ouverture…) n'entre ici qu'une fois livrée.
 */
const BTP_FEATURES = [
  { titre: "Devis détaillés", texte: "Créez des devis avec vos lignes de main-d'œuvre, de matériaux et de déplacement, et un taux de TVA par ligne (5,5 %, 10 % ou 20 %)." },
  { titre: "Du devis à la facture", texte: "Une fois le devis accepté, transformez-le en facture en un clic, sans rien ressaisir." },
  { titre: "Décennale sur vos documents", texte: "Enregistrez une fois vos mentions légales, assurance décennale comprise : elles figurent ensuite en bas de chaque devis et de chaque facture." },
]

const COMMON_FEATURES = [
  { titre: "Envoi par email", texte: "Envoyez vos factures et devis par email depuis l'application, le PDF en pièce jointe." },
  { titre: "Avoirs", texte: "Une facture émise ne se modifie pas : corrigez-la par un avoir, numéroté à la suite des précédents." },
  { titre: "Export comptable FEC", texte: "Exportez vos factures et vos avoirs au format FEC (Fichier des écritures comptables) pour votre expert-comptable." },
]

const DESCRIPTIONS: Record<string, string> = {
  plombier: "Logiciel de facturation pour plombier : devis détaillés, TVA par ligne (5,5, 10 ou 20 %), assurance décennale sur vos documents. Devis gratuits.",
  electricien: "Facturez vos travaux d'électricité avec les mentions NF C 15-100, l'attestation Consuel et l'assurance décennale. Devis gratuits et illimités.",
  macon: "Logiciel de facturation maçonnerie : devis gros œuvre, TVA 10 % rénovation / 20 % neuf, export FEC comptable. Devis gratuits et illimités.",
  peintre: "Créez vos devis peinture au m² avec le détail des couches, de la sous-couche et des fournitures. TVA 10 % rénovation. Devis gratuits et illimités.",
  carreleur: "Devis et factures de pose de carrelage : surfaces, matériaux, ragréage. TVA adaptée au type de travaux. Devis gratuits et illimités.",
  menuisier: "Facturez vos travaux de menuiserie sur mesure : fabrication, pose, finitions. Marquage CE et décennale. Devis gratuits et illimités.",
  couvreur: "Logiciel de facturation couverture et toiture : devis tuiles, ardoises, zinc, étanchéité, mention décennale. Devis gratuits et illimités.",
  plaquiste: "Facturez vos chantiers placo au m² : cloisons, plafonds, isolation, bandes et enduit. Export comptable FEC. Devis gratuits et illimités.",
  chauffagiste: "Facturez installations et dépannages de chauffage : TVA à 5,5 % ou 10 %, mention RGE, attestation gaz, entretien annuel. Devis gratuits et illimités.",
  serrurier: "Factures et devis de serrurerie : interventions d'urgence, pose de serrures, tarifs transparents. Devis gratuits et illimités.",
  paysagiste: "Devis et factures d'entretien de jardin et d'aménagement paysager : crédit d'impôt SAP, RC pro, TVA. Devis gratuits et illimités.",
}

function metier(
  slug: string,
  nom: string,
  categorie: "btp",
  motsCles: string[],
  obligations: string[],
  faq: { question: string; reponse: string }[],
  metiersProches: string[] = [],
): Metier {
  const catFeatures = categorie === "btp" ? BTP_FEATURES : []
  return {
    slug,
    nom,
    titre: `Logiciel de facturation pour ${nom}`,
    description: DESCRIPTIONS[slug] ?? `Créez et envoyez vos devis et factures de ${nom.toLowerCase()} en quelques clics, avec les mentions obligatoires. Devis gratuits et illimités.`,
    motsCles: [`facturation ${nom.toLowerCase()}`, `facture ${nom.toLowerCase()}`, `devis ${nom.toLowerCase()}`, `logiciel facturation ${nom.toLowerCase()}`, ...motsCles],
    features: [...catFeatures, ...COMMON_FEATURES],
    obligations,
    faq,
    metiersProches,
  }
}

export const METIERS: Metier[] = [
  // ── BTP ──
  metier("plombier", "Plombier", "btp",
    ["facture plomberie", "devis plomberie"],
    ["Devis détaillé obligatoire avant tout dépannage chez un particulier, quel qu'en soit le montant", "Mention de l'assurance décennale sur les devis et factures", "Garantie de parfait achèvement d'un an"],
    [
      { question: "Quelles mentions obligatoires sur une facture de plomberie ?", reponse: "Outre les mentions légales classiques (SIRET, date, numéro séquentiel), une facture de plomberie doit mentionner l'assurance décennale (nom, numéro de contrat, couverture géographique) et le détail des prestations (main-d'œuvre, fournitures, déplacement)." },
      { question: "Un plombier doit-il faire un devis ?", reponse: "Oui : chez un particulier, un devis détaillé est obligatoire avant tout dépannage, toute réparation ou tout entretien, quel qu'en soit le montant (arrêté du 24 janvier 2017). Il détaille les prestations, les fournitures, le taux horaire TTC, les frais de déplacement, le délai et le prix total." },
      { question: "Comment facturer un dépannage d'urgence en plomberie ?", reponse: "Même en urgence, remettez un devis détaillé avant d'intervenir chez un particulier, quel qu'en soit le montant ; seul le délai de rétractation ne s'applique pas à une réparation urgente qu'il vous a demandée. Mentionnez clairement le tarif horaire, les majorations éventuelles (nuit, week-end) et les fournitures utilisées." },
      { question: "Quel taux de TVA appliquer en plomberie ?", reponse: "Le taux de TVA dépend du type de travaux : 20 % pour les constructions neuves, 10 % pour les travaux de rénovation dans un logement de plus de 2 ans (article 279-0 bis du CGI), et 5,5 % pour les travaux d'amélioration de la performance énergétique." },
      { question: "La facturation électronique Factur-X est-elle obligatoire pour un plombier en 2026 ?", reponse: "Depuis le 1er septembre 2026, toute entreprise, artisans du BTP compris, doit pouvoir recevoir des factures électroniques. L'émission devient obligatoire pour les TPE et PME au 1er septembre 2027 : vos factures aux clients professionnels devront alors partir dans un format structuré (Factur-X, UBL ou CII), par une plateforme agréée. Qonforme joint déjà un fichier XML Factur-X au PDF de vos factures ; l'envoi par une plateforme agréée est en préparation." },
    ],
    ["electricien", "chauffagiste", "macon", "carreleur"],
  ),
  metier("electricien", "Électricien", "btp",
    ["facture electricite", "devis electricite", "norme NF C 15-100"],
    ["Attestation de conformité Consuel après travaux", "Respect de la norme NF C 15-100", "Assurance décennale obligatoire"],
    [
      { question: "Quelles normes mentionner sur une facture d'électricité ?", reponse: "La facture doit faire référence à la norme NF C 15-100 si les travaux concernent une installation neuve ou une rénovation complète. Mentionnez aussi l'attestation Consuel si applicable." },
      { question: "Un électricien doit-il mentionner son assurance décennale ?", reponse: "Oui, l'assurance décennale est obligatoire pour tous les travaux de construction et rénovation. Elle doit figurer sur les devis et factures avec le nom de l'assureur, le numéro de contrat et la zone géographique couverte." },
      { question: "Quel taux de TVA pour des travaux d'électricité ?", reponse: "Le taux est de 20 % pour les constructions neuves, 10 % pour la rénovation de logements de plus de 2 ans (article 279-0 bis du CGI), et 5,5 % pour les travaux d'amélioration énergétique (isolation, chauffage performant)." },
      { question: "Comment facturer au forfait ou au mètre linéaire en électricité ?", reponse: "Les deux modes sont courants : le forfait convient aux installations complètes (tableau, circuit), tandis que le mètre linéaire est utilisé pour le câblage et les chemins de câbles. Détaillez toujours la méthode de calcul sur le devis." },
      { question: "Quelles sont les obligations Factur-X 2026 pour un électricien ?", reponse: "Depuis le 1er septembre 2026, tout électricien doit pouvoir recevoir des factures électroniques. L'émission suit la taille de l'entreprise : depuis le 1er septembre 2026 pour les grandes entreprises et les ETI, à partir du 1er septembre 2027 pour les TPE et PME. Les factures aux clients professionnels passeront alors par une plateforme agréée, dans un format structuré comme Factur-X." },
    ],
    ["plombier", "chauffagiste", "plaquiste", "couvreur"],
  ),
  metier("macon", "Maçon", "btp",
    ["facture maconnerie", "devis maconnerie", "gros oeuvre"],
    ["Assurance décennale obligatoire", "Garantie de parfait achèvement", "Devis détaillé obligatoire avant tout dépannage ou réparation chez un particulier"],
    [
      { question: "Comment facturer des travaux de maçonnerie ?", reponse: "Détaillez chaque poste : terrassement, fondations, élévation des murs, fournitures (parpaings, ciment, ferraillage). Séparez main-d'œuvre et matériaux avec les taux de TVA applicables (10% rénovation, 20% neuf)." },
      { question: "Quel taux de TVA pour des travaux de maçonnerie ?", reponse: "Le taux dépend du type de travaux : 20% pour la construction neuve, 10% pour la rénovation/amélioration de logements de plus de 2 ans, 5,5% pour les travaux d'amélioration énergétique." },
      { question: "L'assurance décennale est-elle obligatoire pour un maçon ?", reponse: "Oui, la garantie décennale est obligatoire pour tout constructeur au sens de l'article 1792 du Code civil. Elle couvre les dommages compromettant la solidité de l'ouvrage pendant 10 ans. Ses références doivent figurer sur tous les devis et factures." },
      { question: "Comment facturer la sous-traitance en maçonnerie (autoliquidation) ?", reponse: "En cas de sous-traitance BTP, c'est le donneur d'ordre qui reverse la TVA (article 283-2 nonies du CGI). Le sous-traitant maçon émet une facture HT avec la mention « Autoliquidation de la TVA » sans collecter de TVA." },
      { question: "La facturation électronique Factur-X concerne-t-elle les maçons ?", reponse: "Oui, la réforme de la facturation électronique s'applique à tous les professionnels du BTP, maçons compris. Ils doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026, et les TPE et PME devront émettre leurs factures B2B dans un format structuré (Factur-X, UBL ou CII), par une plateforme agréée, à partir du 1er septembre 2027." },
    ],
    ["plombier", "carreleur", "couvreur", "peintre"],
  ),
  metier("peintre", "Peintre en bâtiment", "btp",
    ["facture peinture", "devis peinture batiment"],
    ["Devis détaillé avec surfaces et nombre de couches", "Assurance responsabilité civile professionnelle", "Respect des normes environnementales (COV)"],
    [
      { question: "Comment établir un devis de peinture ?", reponse: "Un devis de peinture doit détailler : les surfaces à peindre (en m²), le nombre de couches, le type de peinture, la préparation des supports (ponçage, enduit, sous-couche), et séparer main-d'œuvre et fournitures." },
      { question: "Quel taux de TVA pour des travaux de peinture ?", reponse: "10% pour la rénovation de logements achevés depuis plus de 2 ans, 20% pour les constructions neuves ou les locaux professionnels." },
      { question: "Un peintre en bâtiment doit-il souscrire une assurance décennale ?", reponse: "Oui, la décennale est obligatoire dès lors que les travaux de peinture affectent l'étanchéité ou la protection de l'ouvrage (peinture extérieure, imperméabilisation). Pour la peinture intérieure décorative, la RC professionnelle suffit généralement." },
      { question: "Comment facturer des travaux de peinture au m² ?", reponse: "Indiquez la surface totale en m², le prix unitaire au m² (qui inclut main-d'œuvre et fournitures ou les sépare), le nombre de couches et le type de finition. Ce mode de facturation est le plus transparent pour le client." },
      { question: "Quelles sont les obligations Factur-X 2026 pour un peintre ?", reponse: "Comme tous les artisans du BTP, les peintres en bâtiment doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront aussi émettre leurs factures aux clients professionnels dans un format structuré, par une plateforme agréée. Qonforme joint déjà un fichier XML Factur-X au PDF de vos factures ; l'envoi par une plateforme agréée est en préparation." },
    ],
    ["plaquiste", "carreleur", "macon", "menuisier"],
  ),
  metier("carreleur", "Carreleur", "btp",
    ["facture carrelage", "devis pose carrelage"],
    ["Assurance décennale obligatoire", "Devis avec détail des surfaces et matériaux"],
    [
      { question: "Comment facturer une pose de carrelage ?", reponse: "Détaillez la surface (m²), le type de carrelage (grès cérame, faïence), la pose (droite, diagonale, décalée), les fournitures (colle, joints, croisillons) et les travaux de préparation (ragréage, chape)." },
      { question: "Quel taux de TVA pour la pose de carrelage ?", reponse: "Le taux réduit de 10 % s'applique pour la pose de carrelage dans un logement de plus de 2 ans (article 279-0 bis du CGI). Le taux normal de 20 % s'applique pour les constructions neuves et les locaux professionnels." },
      { question: "L'assurance décennale est-elle obligatoire pour un carreleur ?", reponse: "Oui, le carreleur réalise des travaux d'ouvrage et doit souscrire une assurance décennale (article 1792 du Code civil). Cette garantie couvre les défauts de pose (infiltrations, décollements) pendant 10 ans après la réception des travaux." },
      { question: "Comment établir un devis de carrelage au m² ?", reponse: "Indiquez la surface totale en m², le prix au m² pour la fourniture et la pose séparément, les découpes spéciales (angles, plinthes), et les travaux préparatoires. Précisez le type de pose car une pose diagonale coûte plus cher qu'une pose droite." },
      { question: "Quelles sont les obligations Factur-X 2026 pour un carreleur ?", reponse: "Les carreleurs doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront émettre dans un format structuré (Factur-X, UBL ou CII) toutes leurs factures B2B, y compris les factures de sous-traitance en autoliquidation de TVA." },
    ],
    ["macon", "peintre", "plombier", "menuisier"],
  ),
  metier("menuisier", "Menuisier", "btp",
    ["facture menuiserie", "devis menuiserie"],
    ["Assurance décennale pour les ouvrages structurels", "Marquage CE pour les menuiseries extérieures"],
    [
      { question: "Comment facturer des travaux de menuiserie ?", reponse: "Distinguez la fabrication sur mesure (matériaux, heures d'atelier) de la pose (déplacement, installation, finitions). Précisez le type de bois et les traitements appliqués." },
      { question: "Quel taux de TVA pour des travaux de menuiserie ?", reponse: "Le taux de 10 % s'applique à la pose de menuiseries dans un logement de plus de 2 ans. Le taux de 5,5 % s'applique aux menuiseries améliorant la performance énergétique (fenêtres isolantes, portes d'entrée). Le taux de 20 % s'applique au neuf." },
      { question: "L'assurance décennale est-elle obligatoire pour un menuisier ?", reponse: "Oui, pour les ouvrages structurels (charpente, escalier, menuiseries extérieures). La décennale couvre les dommages compromettant la solidité ou rendant l'ouvrage impropre à sa destination pendant 10 ans (article 1792 du Code civil)." },
      { question: "Comment facturer la fabrication sur mesure et la pose séparément ?", reponse: "Créez deux sections distinctes sur votre facture : la fabrication (matériaux bois, quincaillerie, heures d'atelier) et la pose (déplacement, installation, ajustements). Ce détail facilite l'application des bons taux de TVA." },
      { question: "Quelles sont les obligations Factur-X 2026 pour un menuisier ?", reponse: "Les menuisiers doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront émettre leurs factures aux clients professionnels au format électronique : elles transiteront par une plateforme agréée." },
    ],
    ["couvreur", "peintre", "plaquiste", "carreleur"],
  ),
  metier("couvreur", "Couvreur", "btp",
    ["facture toiture", "devis couverture"],
    ["Assurance décennale obligatoire", "Respect des DTU couverture"],
    [
      { question: "Quelles mentions sur un devis de couverture ?", reponse: "Le devis doit préciser le type de couverture (tuiles, ardoises, zinc), la surface en m², les travaux d'étanchéité, la pose de gouttières, et l'évacuation des déchets. L'assurance décennale est impérative." },
      { question: "Quel taux de TVA pour des travaux de toiture ?", reponse: "Le taux de 10 % s'applique à la réfection de toiture d'un logement de plus de 2 ans. Le taux de 5,5 % concerne les travaux d'isolation de toiture améliorant la performance énergétique. Le taux normal de 20 % s'applique aux constructions neuves." },
      { question: "L'assurance décennale est-elle obligatoire pour un couvreur ?", reponse: "Oui, absolument. La toiture étant un élément de clos et de couvert, elle relève de la garantie décennale (article 1792 du Code civil). Tout couvreur doit mentionner son assurance décennale sur ses devis et factures." },
      { question: "Comment facturer des travaux de couverture au m² ?", reponse: "Indiquez la surface totale en m², le prix au m² pour la dépose de l'ancienne couverture, la fourniture des matériaux neufs et la pose. Séparez les postes accessoires : zinguerie, gouttières, ventilation, échafaudage." },
      { question: "Un couvreur est-il concerné par la facturation Factur-X 2026 ?", reponse: "Oui. Les couvreurs doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026, et les TPE et PME devront émettre leurs factures B2B au format électronique à partir du 1er septembre 2027, factures de sous-traitance comprises." },
    ],
    ["macon", "menuisier", "plaquiste", "chauffagiste"],
  ),
  metier("plaquiste", "Plaquiste", "btp",
    ["facture placo", "devis plaquiste", "cloison seche"],
    ["Assurance décennale", "Respect des DTU plâtrerie"],
    [
      { question: "Comment facturer des travaux de plâtrerie ?", reponse: "Facturez au m² pour les cloisons et plafonds. Détaillez : type de plaques (BA13, hydrofuge, phonique), ossature, isolation, bandes et finitions (enduit, ponçage)." },
      { question: "Quel taux de TVA pour des travaux de plaquiste ?", reponse: "Le taux réduit de 10 % s'applique aux travaux de cloisons et faux plafonds dans un logement de plus de 2 ans. Le taux de 5,5 % concerne les travaux d'isolation thermique (doublage avec isolant). Le neuf est à 20 %." },
      { question: "Un plaquiste doit-il souscrire une assurance décennale ?", reponse: "Oui, les travaux de plâtrerie sèche (cloisons, doublages, faux plafonds) constituent des ouvrages couverts par la garantie décennale dès lors qu'ils participent à la solidité ou à l'habitabilité du bâtiment (article 1792 du Code civil)." },
      { question: "Comment facturer la sous-traitance en plâtrerie avec autoliquidation ?", reponse: "Si vous intervenez comme sous-traitant, facturez HT avec la mention « Autoliquidation — article 283-2 nonies du CGI ». C'est le donneur d'ordre qui déclare et reverse la TVA. Aucune TVA ne doit apparaître sur votre facture." },
      { question: "Quelles sont les obligations Factur-X 2026 pour un plaquiste ?", reponse: "Les plaquistes doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront émettre leurs factures aux clients professionnels dans un format structuré (Factur-X, UBL ou CII). Le e-reporting s'appliquera aussi aux ventes aux particuliers." },
    ],
    ["peintre", "electricien", "menuisier", "macon"],
  ),
  metier("chauffagiste", "Chauffagiste", "btp",
    ["facture chauffage", "devis installation chauffage"],
    ["Qualification RGE pour les aides énergétiques", "Attestation de conformité gaz"],
    [
      { question: "Un chauffagiste doit-il être RGE ?", reponse: "La qualification RGE (Reconnu Garant de l'Environnement) n'est pas obligatoire mais elle permet à vos clients de bénéficier des aides (MaPrimeRénov', CEE). Mentionnez-la sur vos devis et factures." },
      { question: "Quel taux de TVA pour l'installation d'un chauffage ?", reponse: "Le taux de 5,5 % s'applique aux équipements de chauffage performants (pompe à chaleur, chaudière à condensation) dans un logement de plus de 2 ans. Le taux de 10 % s'applique aux autres travaux de rénovation. Le neuf est à 20 %." },
      { question: "L'assurance décennale est-elle obligatoire pour un chauffagiste ?", reponse: "Oui, les installations de chauffage sont des éléments d'équipement indissociables du bâtiment couverts par la garantie décennale (article 1792 du Code civil). Le chauffagiste doit mentionner son assureur et son numéro de contrat sur chaque devis." },
      { question: "Comment facturer l'entretien annuel d'une chaudière ?", reponse: "L'entretien annuel obligatoire (décret n° 2009-649) se facture généralement au forfait. Détaillez les opérations effectuées (nettoyage, vérifications, mesure de combustion) et remettez l'attestation d'entretien au client." },
      { question: "Un chauffagiste est-il concerné par Factur-X 2026 ?", reponse: "Oui, comme tous les professionnels du BTP : réception des factures électroniques depuis le 1er septembre 2026 et, pour les TPE et PME, émission des factures B2B dans un format structuré à partir du 1er septembre 2027. Les factures aux particuliers relèveront du e-reporting." },
    ],
    ["plombier", "electricien", "couvreur", "macon"],
  ),
  metier("serrurier", "Serrurier", "btp",
    ["facture serrurerie", "devis serrurier"],
    ["Affichage des tarifs obligatoire", "Devis obligatoire avant toute intervention chez un particulier, même en urgence"],
    [
      { question: "Comment facturer une intervention de serrurerie ?", reponse: "Détaillez le déplacement, la main-d'œuvre (avec tarif horaire), les fournitures (cylindre, serrure, poignée) et les majorations éventuelles (nuit, dimanche). Même en urgence, chez un particulier, le devis détaillé est remis avant l'intervention, quel qu'en soit le montant." },
      { question: "Quel taux de TVA pour des travaux de serrurerie ?", reponse: "Le taux de 10 % s'applique aux travaux de remplacement de serrures et blindage de portes dans un logement de plus de 2 ans. Le taux de 20 % s'applique aux constructions neuves et aux locaux professionnels." },
      { question: "Un serrurier doit-il afficher ses tarifs ?", reponse: "Oui, l'arrêté du 24 janvier 2017 impose l'affichage des tarifs pour les prestations de dépannage, réparation et entretien. Le serrurier doit afficher ses tarifs TTC (déplacement, main-d'œuvre horaire, majorations) dans son véhicule et sur son site." },
      { question: "Quelle assurance est obligatoire pour un serrurier ?", reponse: "La RC professionnelle est obligatoire pour couvrir les dommages causés lors des interventions. L'assurance décennale est requise uniquement pour les travaux affectant la structure du bâtiment (blindage de porte d'entrée, par exemple)." },
      { question: "La facturation Factur-X 2026 concerne-t-elle les serruriers ?", reponse: "Oui. Les serruriers doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront émettre leurs factures aux clients professionnels au format électronique ; pour les particuliers, certaines données de vente seront transmises à l'administration (e-reporting)." },
    ],
    ["menuisier", "electricien", "plombier", "peintre"],
  ),

  metier("paysagiste", "Paysagiste", "btp",
    ["facture entretien jardin", "devis amenagement paysager"],
    ["Devis de travaux de jardinage : gestion des déchets verts, point de collecte et coût estimé", "Assurance RC professionnelle"],
    [
      { question: "Comment facturer un entretien de jardin ?", reponse: "Facturez à l'heure ou au forfait. Détaillez : tonte, taille, désherbage, évacuation des déchets verts. Pour les particuliers, le crédit d'impôt SAP (50%) s'applique à l'entretien courant." },
      { question: "Quel taux de TVA pour des travaux de paysagisme ?", reponse: "Le taux de 20 % s'applique aux travaux de création (aménagement, plantation, terrassement). Le taux de 10 % peut s'appliquer à l'entretien de jardins attenants à un logement de plus de 2 ans. Les prestations SAP d'entretien courant sont à 20 %." },
      { question: "Un paysagiste doit-il souscrire une assurance décennale ?", reponse: "L'assurance décennale est obligatoire pour les ouvrages paysagers structurels (murs de soutènement, terrasses, allées carrossables). Pour l'entretien et les plantations, la RC professionnelle suffit généralement." },
      { question: "Comment facturer un contrat d'entretien annuel de jardin ?", reponse: "Proposez un forfait annuel avec un calendrier d'interventions (mensuel ou trimestriel). Détaillez les prestations incluses (tonte, taille, traitement) et émettez une facture par passage ou une facture mensuelle selon l'accord." },
      { question: "Un paysagiste est-il concerné par Factur-X 2026 ?", reponse: "Oui. Les paysagistes doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, ils devront émettre au format électronique leurs factures aux entreprises ; le e-reporting s'appliquera aux prestations pour les particuliers." },
    ],
    ["macon", "menuisier", "carreleur", "peintre"],
  ),
]

export function getMetierBySlug(slug: string): Metier | undefined {
  return METIERS.find(m => m.slug === slug)
}
