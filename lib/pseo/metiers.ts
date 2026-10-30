export interface Metier {
  slug: string
  nom: string
  /** <title> de la page : la requête « logiciel devis {métier} » (MOTS-CLES-COMPACTS-2026-10.md § 0). */
  titre: string
  description: string
  /** Introduction sous le H1 : l'ouvrage (le mot que tapent les gens), puis le détail du métier. */
  intro: string
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

/*
 * Title, description et introduction suivent les mots des chercheurs
 * (MOTS-CLES-COMPACTS-2026-10.md § 0 et § 9, 16/10/2026) : « logiciel devis
 * {métier} » dans le title, l'ouvrage (« devis de maçonnerie ») dans la
 * première phrase. « Gratuit » ne vise que les devis : les factures et les
 * relances demandent la formule Essentiel (lib/stripe/plans.ts).
 */
const DESCRIPTIONS: Record<string, string> = {
  plombier: "Logiciel de devis gratuit pour plombier : devis de plomberie illimités, dépannage et fournitures détaillés, TVA par ligne. Factures avec Essentiel.",
  electricien: "Logiciel de devis gratuit pour électricien : devis d'électricité illimités, TVA par ligne, décennale sur vos documents. Factures avec Essentiel.",
  macon: "Logiciel de devis gratuit pour maçon : devis de maçonnerie illimités, gros œuvre ligne par ligne, TVA à 10 % ou 20 %. Factures et relances avec Essentiel.",
  peintre: "Logiciel de devis gratuit pour peintre : devis de peinture illimités au m², couches et fournitures détaillées, TVA par ligne. Factures avec Essentiel.",
  carreleur: "Logiciel de devis gratuit pour carreleur : devis de carrelage illimités, surfaces, colle et ragréage, TVA selon le chantier. Factures avec Essentiel.",
  menuisier: "Logiciel de devis gratuit pour menuisier : devis de menuiserie illimités, fabrication, pose et finitions détaillées. Factures et relances avec Essentiel.",
  couvreur: "Logiciel de devis gratuit pour couvreur : devis de toiture illimités, tuiles, ardoises, zinc, décennale sur vos documents. Factures avec Essentiel.",
  plaquiste: "Logiciel de devis gratuit pour plaquiste : devis de placo illimités au m², cloisons, plafonds et isolation. Factures et relances avec Essentiel.",
  chauffagiste: "Logiciel de devis gratuit pour chauffagiste : devis de chauffage illimités, installation, dépannage et entretien, TVA par ligne. Factures avec Essentiel.",
  serrurier: "Logiciel de devis gratuit pour serrurier : devis de serrurerie illimités, urgences, serrures et déplacement détaillés. Factures avec Essentiel.",
  paysagiste: "Logiciel de devis gratuit pour paysagiste : devis de jardin illimités, création, plantation, entretien et déchets verts. Factures avec Essentiel.",
}

/** L'ouvrage tel que le tapent les chercheurs (« devis de maçonnerie »), puis le détail du métier. */
const OUVRAGES: Record<string, { devisDe: string; detail: string }> = {
  plombier: { devisDe: "de plomberie", detail: "Main-d'œuvre, fournitures et déplacement ligne par ligne, un taux de TVA par ligne (5,5 %, 10 % ou 20 %) et votre assurance décennale en bas de chaque document." },
  electricien: { devisDe: "d'électricité", detail: "Tableau, prises et circuits chiffrés ligne par ligne, avec la bonne TVA et votre assurance décennale en bas de chaque document." },
  macon: { devisDe: "de maçonnerie", detail: "Terrassement, fondations, murs et fournitures ligne par ligne, avec la TVA à 10 % ou 20 % selon le chantier et votre assurance décennale en bas de chaque document." },
  peintre: { devisDe: "de peinture", detail: "Surfaces au mètre carré, nombre de couches, sous-couche et fournitures détaillés, avec la TVA à 10 % en rénovation d'un logement de plus de deux ans." },
  carreleur: { devisDe: "de carrelage", detail: "Surfaces, carrelage, colle, joints et ragréage ligne par ligne, avec le taux de TVA qui correspond au chantier." },
  menuisier: { devisDe: "de menuiserie", detail: "Fabrication, pose et finitions séparées, avec la bonne TVA et votre assurance décennale en bas de chaque document." },
  couvreur: { devisDe: "de toiture", detail: "Dépose, tuiles, ardoises, zinc et échafaudage ligne par ligne, avec la bonne TVA et votre assurance décennale en bas de chaque document." },
  plaquiste: { devisDe: "de plâtrerie et de placo", detail: "Cloisons, plafonds, isolation, bandes et enduit chiffrés au mètre carré, avec la bonne TVA sur chaque ligne." },
  chauffagiste: { devisDe: "de chauffage", detail: "Installation, dépannage et entretien annuel détaillés, avec le taux de TVA qui correspond à l'équipement posé." },
  serrurier: { devisDe: "de serrurerie", detail: "Déplacement, main-d'œuvre, fournitures et majorations de nuit ou de week-end bien visibles, sur un devis remis avant d'intervenir." },
  paysagiste: { devisDe: "de paysagisme et d'entretien de jardin", detail: "Création, plantation, tonte et taille ligne par ligne, avec l'évacuation des déchets verts et le taux de TVA qui correspond aux travaux." },
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
  const nomMin = nom.toLowerCase()
  const ouvrage = OUVRAGES[slug] ?? { devisDe: `de ${nomMin}`, detail: "" }
  return {
    slug,
    nom,
    titre: `Logiciel de devis gratuit pour ${nomMin}`,
    description: DESCRIPTIONS[slug] ?? `Logiciel de devis gratuit pour ${nomMin} : devis illimités avec les mentions obligatoires et la TVA par ligne. Factures avec Essentiel.`,
    intro: `Faites vos devis ${ouvrage.devisDe} gratuitement et sans limite, puis vos factures avec Essentiel. ${ouvrage.detail}`.trim(),
    motsCles: [`logiciel devis ${nomMin}`, `devis ${nomMin}`, `facture ${nomMin}`, `logiciel facturation ${nomMin}`, ...motsCles],
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
      { question: "La facturation électronique Factur-X est-elle obligatoire pour un plombier en 2026 ?", reponse: "Depuis le 1er septembre 2026, toute entreprise, artisans du BTP compris, doit pouvoir recevoir des factures électroniques. L'émission devient obligatoire pour les TPE et PME au 1er septembre 2027 : vos factures aux clients professionnels devront alors partir dans un format structuré (Factur-X, UBL ou CII), par une plateforme agréée. Qonforme joint déjà un fichier XML Factur-X au PDF de vos factures ; avec Essentiel, vos factures fournisseurs arrivent déjà par la plateforme agréée Super PDP, et l'envoi par la plateforme est prévu pour 2027." },
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
      { question: "Quelles sont les obligations Factur-X 2026 pour un peintre ?", reponse: "Comme tous les artisans du BTP, les peintres en bâtiment doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. À partir du 1er septembre 2027, les TPE et PME devront aussi émettre leurs factures aux clients professionnels dans un format structuré, par une plateforme agréée. Qonforme joint déjà un fichier XML Factur-X au PDF de vos factures ; avec Essentiel, vos factures fournisseurs arrivent déjà par la plateforme agréée Super PDP, et l'envoi par la plateforme est prévu pour 2027." },
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
      { question: "Quel taux de TVA pour l'installation d'un chauffage ?", reponse: "Le taux de 5,5 % s'applique à la pose d'équipements qui atteignent les critères de performance fixés (pompe à chaleur, chaudière au bois ou aux granulés, régulation du chauffage) dans un logement achevé depuis plus de deux ans. Depuis le 1er mars 2025, une chaudière qui peut fonctionner au gaz ou au fioul n'a plus droit aux taux réduits, même à condensation : sa fourniture et sa pose sont à 20 %. Les autres travaux de rénovation d'un logement de plus de deux ans sont à 10 %, le neuf à 20 %. Le client certifie sur le devis ou la facture que les conditions du taux réduit sont remplies." },
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
      { question: "Comment facturer un entretien de jardin ?", reponse: "Facturez à l'heure ou au forfait. Détaillez : tonte, taille, désherbage, évacuation des déchets verts. Chez un particulier, les petits travaux de jardinage peuvent ouvrir droit au crédit d'impôt de 50 %, dans la limite de 5 000 € de dépenses par an, si votre entreprise est déclarée comme organisme de services à la personne et en remplit les conditions." },
      { question: "Quel taux de TVA pour des travaux de paysagisme ?", reponse: "L'aménagement et l'entretien des espaces verts (plantation, engazonnement, tonte, taille) sont au taux normal de 20 %, même chez un particulier dont la maison a plus de deux ans : ils sont exclus des taux réduits. Les petits travaux de jardinage facturés en services à la personne sont aussi à 20 %. Dans une maison achevée depuis plus de deux ans, restent à 10 % l'allée principale et l'accès au garage, les clôtures et le portail (sauf les haies vives) et la réfection d'une terrasse maçonnée attenante." },
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
