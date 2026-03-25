export interface Metier {
  slug: string
  nom: string
  titre: string
  description: string
  motsCles: string[]
  features: { titre: string; texte: string }[]
  obligations: string[]
  faq: { question: string; reponse: string }[]
}

const BTP_FEATURES = [
  { titre: "Autoliquidation TVA", texte: "Gestion automatique de l'autoliquidation pour la sous-traitance BTP, conforme à l'article 283-2 nonies du CGI." },
  { titre: "Devis détaillés", texte: "Créez des devis professionnels avec lignes de prestations, matériaux, main-d'œuvre et taux de TVA différenciés." },
  { titre: "Suivi de chantier", texte: "Liez vos factures à des devis acceptés et suivez l'avancement financier de chaque chantier." },
]

const SERVICE_FEATURES = [
  { titre: "Factures récurrentes", texte: "Automatisez la facturation de vos prestations mensuelles ou trimestrielles en quelques clics." },
  { titre: "Gestion des acomptes", texte: "Facturez des acomptes et générez automatiquement la facture de solde avec déduction." },
  { titre: "Suivi des paiements", texte: "Visualisez en temps réel les factures payées, en attente et en retard pour gérer votre trésorerie." },
]

const SANTE_FEATURES = [
  { titre: "Notes d'honoraires", texte: "Générez des notes d'honoraires conformes aux obligations de votre profession de santé." },
  { titre: "Franchise de TVA", texte: "Configuration automatique de la franchise en base de TVA (article 293 B du CGI) pour les professions médicales." },
  { titre: "Numérotation séquentielle", texte: "Numérotation chronologique obligatoire avec préfixe personnalisable par année." },
]

const COMMON_FEATURES = [
  { titre: "Factur-X conforme", texte: "Vos factures sont générées au format Factur-X EN 16931, obligatoire pour la facturation électronique 2026." },
  { titre: "Envoi par email", texte: "Envoyez vos factures et devis directement par email depuis l'application, avec suivi de lecture." },
  { titre: "Export comptable FEC", texte: "Exportez votre Fichier des Écritures Comptables (FEC) en un clic pour votre expert-comptable." },
]

function metier(
  slug: string,
  nom: string,
  categorie: "btp" | "service" | "sante" | "artisanat",
  motsCles: string[],
  obligations: string[],
  faq: { question: string; reponse: string }[],
): Metier {
  const catFeatures = categorie === "btp" ? BTP_FEATURES : categorie === "sante" ? SANTE_FEATURES : SERVICE_FEATURES
  return {
    slug,
    nom,
    titre: `Logiciel de facturation pour ${nom}`,
    description: `Créez et envoyez vos factures et devis ${nom.toLowerCase()} en quelques clics. Conforme Factur-X 2026, adapté aux ${nom.toLowerCase()}s.`,
    motsCles: [`facturation ${nom.toLowerCase()}`, `facture ${nom.toLowerCase()}`, `devis ${nom.toLowerCase()}`, `logiciel facturation ${nom.toLowerCase()}`, ...motsCles],
    features: [...catFeatures, ...COMMON_FEATURES],
    obligations,
    faq,
  }
}

export const METIERS: Metier[] = [
  // ── BTP ──
  metier("plombier", "Plombier", "btp",
    ["facture plomberie", "devis plomberie"],
    ["Devis obligatoire avant travaux (> 150 €)", "Mention de l'assurance décennale sur les devis et factures", "Garantie de parfait achèvement d'un an"],
    [
      { question: "Quelles mentions obligatoires sur une facture de plomberie ?", reponse: "Outre les mentions légales classiques (SIRET, date, numéro séquentiel), une facture de plomberie doit mentionner l'assurance décennale (nom, numéro de contrat, couverture géographique) et le détail des prestations (main-d'œuvre, fournitures, déplacement)." },
      { question: "Un plombier doit-il faire un devis ?", reponse: "Oui, un devis est obligatoire pour tout travail dont le montant dépasse 150 € TTC, ou sur demande du client. Le devis doit détailler les prestations, les matériaux, les délais et le prix total." },
      { question: "Comment facturer un dépannage d'urgence en plomberie ?", reponse: "Le dépannage d'urgence peut être facturé sans devis préalable si le montant est inférieur à 150 €. Mentionnez clairement le tarif horaire, les majorations éventuelles (nuit, week-end) et les fournitures utilisées." },
    ],
  ),
  metier("electricien", "Électricien", "btp",
    ["facture electricite", "devis electricite", "norme NF C 15-100"],
    ["Attestation de conformité Consuel après travaux", "Respect de la norme NF C 15-100", "Assurance décennale obligatoire"],
    [
      { question: "Quelles normes mentionner sur une facture d'électricité ?", reponse: "La facture doit faire référence à la norme NF C 15-100 si les travaux concernent une installation neuve ou une rénovation complète. Mentionnez aussi l'attestation Consuel si applicable." },
      { question: "Un électricien doit-il mentionner son assurance décennale ?", reponse: "Oui, l'assurance décennale est obligatoire pour tous les travaux de construction et rénovation. Elle doit figurer sur les devis et factures avec le nom de l'assureur, le numéro de contrat et la zone géographique couverte." },
    ],
  ),
  metier("macon", "Maçon", "btp",
    ["facture maconnerie", "devis maconnerie", "gros oeuvre"],
    ["Assurance décennale obligatoire", "Garantie de parfait achèvement", "Devis détaillé obligatoire pour travaux > 150 €"],
    [
      { question: "Comment facturer des travaux de maçonnerie ?", reponse: "Détaillez chaque poste : terrassement, fondations, élévation des murs, fournitures (parpaings, ciment, ferraillage). Séparez main-d'œuvre et matériaux avec les taux de TVA applicables (10% rénovation, 20% neuf)." },
      { question: "Quel taux de TVA pour des travaux de maçonnerie ?", reponse: "Le taux dépend du type de travaux : 20% pour la construction neuve, 10% pour la rénovation/amélioration de logements de plus de 2 ans, 5,5% pour les travaux d'amélioration énergétique." },
    ],
  ),
  metier("peintre", "Peintre en bâtiment", "btp",
    ["facture peinture", "devis peinture batiment"],
    ["Devis détaillé avec surfaces et nombre de couches", "Assurance responsabilité civile professionnelle", "Respect des normes environnementales (COV)"],
    [
      { question: "Comment établir un devis de peinture ?", reponse: "Un devis de peinture doit détailler : les surfaces à peindre (en m²), le nombre de couches, le type de peinture, la préparation des supports (ponçage, enduit, sous-couche), et séparer main-d'œuvre et fournitures." },
      { question: "Quel taux de TVA pour des travaux de peinture ?", reponse: "10% pour la rénovation de logements achevés depuis plus de 2 ans, 20% pour les constructions neuves ou les locaux professionnels." },
    ],
  ),
  metier("carreleur", "Carreleur", "btp",
    ["facture carrelage", "devis pose carrelage"],
    ["Assurance décennale obligatoire", "Devis avec détail des surfaces et matériaux"],
    [
      { question: "Comment facturer une pose de carrelage ?", reponse: "Détaillez la surface (m²), le type de carrelage (grès cérame, faïence), la pose (droite, diagonale, décalée), les fournitures (colle, joints, croisillons) et les travaux de préparation (ragréage, chape)." },
    ],
  ),
  metier("menuisier", "Menuisier", "btp",
    ["facture menuiserie", "devis menuiserie"],
    ["Assurance décennale pour les ouvrages structurels", "Marquage CE pour les menuiseries extérieures"],
    [
      { question: "Comment facturer des travaux de menuiserie ?", reponse: "Distinguez la fabrication sur mesure (matériaux, heures d'atelier) de la pose (déplacement, installation, finitions). Précisez le type de bois et les traitements appliqués." },
    ],
  ),
  metier("couvreur", "Couvreur", "btp",
    ["facture toiture", "devis couverture"],
    ["Assurance décennale obligatoire", "Respect des DTU couverture"],
    [
      { question: "Quelles mentions sur un devis de couverture ?", reponse: "Le devis doit préciser le type de couverture (tuiles, ardoises, zinc), la surface en m², les travaux d'étanchéité, la pose de gouttières, et l'évacuation des déchets. L'assurance décennale est impérative." },
    ],
  ),
  metier("plaquiste", "Plaquiste", "btp",
    ["facture placo", "devis plaquiste", "cloison seche"],
    ["Assurance décennale", "Respect des DTU plâtrerie"],
    [
      { question: "Comment facturer des travaux de plâtrerie ?", reponse: "Facturez au m² pour les cloisons et plafonds. Détaillez : type de plaques (BA13, hydrofuge, phonique), ossature, isolation, bandes et finitions (enduit, ponçage)." },
    ],
  ),
  metier("chauffagiste", "Chauffagiste", "btp",
    ["facture chauffage", "devis installation chauffage"],
    ["Qualification RGE pour les aides énergétiques", "Attestation de conformité gaz"],
    [
      { question: "Un chauffagiste doit-il être RGE ?", reponse: "La qualification RGE (Reconnu Garant de l'Environnement) n'est pas obligatoire mais elle permet à vos clients de bénéficier des aides (MaPrimeRénov', CEE). Mentionnez-la sur vos devis et factures." },
    ],
  ),
  metier("serrurier", "Serrurier", "btp",
    ["facture serrurerie", "devis serrurier"],
    ["Affichage des tarifs obligatoire", "Devis obligatoire avant intervention (sauf urgence < 150 €)"],
    [
      { question: "Comment facturer une intervention de serrurerie ?", reponse: "Détaillez le déplacement, la main-d'œuvre (avec tarif horaire), les fournitures (cylindre, serrure, poignée) et les majorations éventuelles (nuit, dimanche). Pour les urgences < 150 €, le devis n'est pas obligatoire." },
    ],
  ),

  // ── Services / Freelance ──
  metier("auto-entrepreneur", "Auto-entrepreneur", "service",
    ["facture auto entrepreneur", "modele facture micro entreprise"],
    ["Mention « TVA non applicable, art. 293 B du CGI » si franchise", "Numéro SIRET obligatoire", "Numérotation chronologique des factures"],
    [
      { question: "Comment faire une facture en auto-entrepreneur ?", reponse: "La facture doit comporter : vos coordonnées et SIRET, celles du client, la date, un numéro séquentiel, le détail des prestations, le montant HT, et la mention « TVA non applicable, art. 293 B du CGI » si vous êtes en franchise de TVA." },
      { question: "Un auto-entrepreneur doit-il facturer la TVA ?", reponse: "Non, tant que vous restez sous les seuils de franchise (36 800 € pour les services, 91 900 € pour la vente). Au-delà, vous devez facturer la TVA et la reverser." },
    ],
  ),
  metier("consultant", "Consultant", "service",
    ["facture consultant", "facture prestation conseil"],
    ["Conditions générales de vente recommandées", "Mentions obligatoires classiques"],
    [
      { question: "Comment facturer une prestation de conseil ?", reponse: "Précisez la nature de la mission, la période, le taux journalier ou le forfait, les frais éventuels (déplacement, hébergement) et les conditions de paiement." },
    ],
  ),
  metier("developpeur-freelance", "Développeur freelance", "service",
    ["facture developpeur", "facture freelance informatique"],
    ["Cession de droits d'auteur à préciser", "Conditions de maintenance et support"],
    [
      { question: "Comment facturer une prestation de développement ?", reponse: "Détaillez les livrables (site web, application, API), le volume (jours/homme ou forfait), la cession de droits éventuelle, et les conditions de maintenance. Précisez si le code source est livré." },
    ],
  ),
  metier("graphiste", "Graphiste", "service",
    ["facture graphiste", "devis creation graphique"],
    ["Cession de droits d'exploitation à détailler", "Nombre de révisions à préciser"],
    [
      { question: "Comment facturer une création graphique ?", reponse: "Séparez la création (recherche, conception, déclinaisons) de la cession de droits (exclusifs ou non, durée, supports). Précisez le nombre de propositions et de révisions incluses." },
    ],
  ),
  metier("photographe", "Photographe", "service",
    ["facture photographe", "devis reportage photo"],
    ["Droits d'auteur et cession de droits à préciser", "TVA à 10% sur certaines prestations artistiques"],
    [
      { question: "Comment facturer un reportage photo ?", reponse: "Distinguez la prise de vue (tarif journée/demi-journée), le post-traitement (retouches, sélection), la cession de droits (usage, durée, supports) et les frais (déplacement, matériel spécifique)." },
    ],
  ),
  metier("formateur", "Formateur", "service",
    ["facture formation", "convention de formation"],
    ["Convention de formation obligatoire", "Numéro de déclaration d'activité (NDA)", "Exonération de TVA possible (art. 261-4-4° du CGI)"],
    [
      { question: "Un formateur doit-il facturer la TVA ?", reponse: "Les organismes de formation peuvent être exonérés de TVA (article 261-4-4° du CGI) en obtenant une attestation auprès de la DREETS. Cette exonération doit être mentionnée sur les factures." },
    ],
  ),
  metier("coach", "Coach professionnel", "service",
    ["facture coaching", "devis accompagnement"],
    ["Mentions obligatoires classiques", "CGV recommandées"],
    [
      { question: "Comment facturer une séance de coaching ?", reponse: "Facturez à la séance ou au forfait (pack de séances). Précisez la durée, le lieu (présentiel/visio), et les conditions d'annulation." },
    ],
  ),
  metier("community-manager", "Community manager", "service",
    ["facture community management", "devis gestion reseaux sociaux"],
    ["Mentions obligatoires classiques", "Périmètre de la mission à détailler"],
    [
      { question: "Comment facturer du community management ?", reponse: "Facturez au forfait mensuel en détaillant : nombre de publications par réseau, création de contenu (visuels, vidéos), modération, reporting. Précisez les réseaux concernés." },
    ],
  ),
  metier("traducteur", "Traducteur", "service",
    ["facture traduction", "devis traduction"],
    ["Cession de droits si traduction littéraire", "Tarif au mot ou au feuillet"],
    [
      { question: "Comment facturer une traduction ?", reponse: "Facturez au mot (tarif standard en traduction technique) ou au feuillet (1 500 signes espaces comprises). Précisez les langues, le domaine de spécialité et le délai de livraison." },
    ],
  ),

  // ── Artisanat / Commerce ──
  metier("coiffeur", "Coiffeur", "artisanat",
    ["facture salon coiffure", "logiciel caisse coiffeur"],
    ["Affichage des prix obligatoire", "Note/facture obligatoire au-delà de 25 €"],
    [
      { question: "Un coiffeur doit-il faire des factures ?", reponse: "Une note (ticket) suffit pour les particuliers si le montant est inférieur à 25 €. Au-delà, une note détaillée est obligatoire. Pour les clients professionnels, une facture complète est toujours requise." },
    ],
  ),
  metier("estheticienne", "Esthéticienne", "artisanat",
    ["facture institut beaute", "logiciel facturation esthetique"],
    ["Affichage des prix obligatoire", "Note/facture obligatoire"],
    [
      { question: "Comment facturer des soins esthétiques ?", reponse: "Détaillez chaque prestation (soin visage, épilation, manucure) avec son prix unitaire. Pour les forfaits et cartes prépayées, précisez la validité et les conditions d'utilisation." },
    ],
  ),
  metier("paysagiste", "Paysagiste", "btp",
    ["facture entretien jardin", "devis amenagement paysager"],
    ["Devis obligatoire pour travaux > 150 €", "Assurance RC professionnelle"],
    [
      { question: "Comment facturer un entretien de jardin ?", reponse: "Facturez à l'heure ou au forfait. Détaillez : tonte, taille, désherbage, évacuation des déchets verts. Pour les particuliers, le crédit d'impôt SAP (50%) s'applique à l'entretien courant." },
    ],
  ),
  metier("architecte-interieur", "Architecte d'intérieur", "service",
    ["facture architecte interieur", "devis decoration interieure", "honoraires architecte"],
    ["Barème d'honoraires à communiquer", "Assurance RC professionnelle"],
    [
      { question: "Comment facturer des honoraires d'architecte d'intérieur ?", reponse: "Facturez au pourcentage du montant des travaux (8-15%), au forfait, ou en régie (taux horaire/journalier). Détaillez les phases : étude, conception, plans, suivi de chantier." },
    ],
  ),
  metier("traiteur", "Traiteur", "artisanat",
    ["facture traiteur", "devis reception traiteur"],
    ["Respect des normes HACCP", "Devis détaillé avec menu"],
    [
      { question: "Comment établir un devis de traiteur ?", reponse: "Détaillez : nombre de convives, menu (entrée, plat, dessert, boissons), formule (buffet, assis), matériel (vaisselle, nappes), personnel de service, livraison et installation." },
    ],
  ),
  metier("fleuriste", "Fleuriste", "artisanat",
    ["facture fleuriste", "logiciel caisse fleuriste"],
    ["Affichage des prix obligatoire", "TVA à 10% sur certaines plantes"],
    [
      { question: "Quel taux de TVA pour un fleuriste ?", reponse: "Le taux de TVA est de 10% pour les fleurs coupées, plantes vivantes et compositions florales. Le taux de 20% s'applique aux accessoires et contenants décoratifs." },
    ],
  ),

  // ── Santé ──
  metier("osteopathe", "Ostéopathe", "sante",
    ["facture osteopathe", "note honoraires osteopathie"],
    ["Note d'honoraires obligatoire", "Franchise de TVA (art. 261-4-1° du CGI)", "Numéro ADELI ou RPPS"],
    [
      { question: "Un ostéopathe doit-il facturer la TVA ?", reponse: "Non, les actes d'ostéopathie sont exonérés de TVA en vertu de l'article 261-4-1° du CGI. La mention « TVA non applicable, art. 261-4-1° du CGI » doit figurer sur les notes d'honoraires." },
    ],
  ),
  metier("kinesitherapeute", "Kinésithérapeute", "sante",
    ["facture kine", "note honoraires kinesitherapie"],
    ["Feuille de soins pour les actes remboursés", "Franchise de TVA", "Numéro RPPS obligatoire"],
    [
      { question: "Comment facturer en tant que kinésithérapeute libéral ?", reponse: "Pour les actes conventionnés, utilisez la feuille de soins (tiers payant ou remboursement patient). Pour les dépassements ou actes hors nomenclature, établissez une note d'honoraires séparée." },
    ],
  ),
  metier("infirmier-liberal", "Infirmier libéral", "sante",
    ["facture infirmier liberal", "facturation soins infirmiers"],
    ["Facturation Sesam-Vitale", "Franchise de TVA", "Numéro RPPS"],
    [
      { question: "Comment facturer les soins infirmiers à domicile ?", reponse: "Les soins infirmiers conventionnés sont facturés via le système Sesam-Vitale (tiers payant). Les majorations (nuit, dimanche, urgence, déplacement) sont codifiées. Les soins hors nomenclature sont facturés librement." },
    ],
  ),
  metier("dieteticien", "Diététicien", "sante",
    ["facture dieteticien", "note honoraires nutrition"],
    ["Franchise de TVA pour les actes paramédicaux", "Numéro ADELI"],
    [
      { question: "Les consultations diététiques sont-elles soumises à la TVA ?", reponse: "Non, les consultations diététiques réalisées par un diététicien diplômé sont exonérées de TVA. Utilisez la mention « TVA non applicable, art. 261-4-1° du CGI »." },
    ],
  ),
]

export function getMetierBySlug(slug: string): Metier | undefined {
  return METIERS.find(m => m.slug === slug)
}
