/**
 * « Devenir … à son compte » : une page par métier du bâtiment, pour
 * l'intention « je démarre » (DECISIONS-STRATEGIQUES.md § 3, cible : les
 * artisans du bâtiment qui choisissent leur premier logiciel).
 *
 * Sources vérifiées le 04/10/2026 :
 * - Fiches « conditions d'accès et d'exercice en France » de chaque métier,
 *   entreprendre.service-public.gouv.fr (mises à jour en février et mars 2026) :
 *   qualification (CAP, BP ou titre RNCP, ou 3 ans d'expérience attestés par la
 *   CMA), amende de 7 500 € sans qualification, usurpation de titre (1 an,
 *   15 000 €), immatriculation au guichet des formalités, décennale et RC pro,
 *   défaut de décennale (6 mois, 75 000 €).
 * - Devis : fiche F31144 et arrêté du 24 janvier 2017 (devis dès le premier
 *   euro pour le dépannage, la réparation et l'entretien chez un particulier).
 * - Règles propres : Consuel (décret n° 72-1120), IRVE au-delà de 3,7 kW
 *   (décret n° 2017-26), certificat de conformité gaz (arrêté du 23 février
 *   2018), attestation de capacité pour les fluides frigorigènes, RGE pour les
 *   aides MaPrimeRénov', autoliquidation en sous-traitance (CGI, art. 283-2 nonies).
 * - Chiffres de la micro-entreprise et de la franchise de TVA : repris des
 *   constantes vérifiées des outils (lib/outils/charges.ts,
 *   lib/outils/franchise-tva.ts), jamais recopiés ici.
 * - Diplômes cités : intitulés des CAP sur onisep.fr.
 */
import { ACTIVITES } from "@/lib/outils/charges"
import { SEUILS_FRANCHISE_TVA } from "@/lib/outils/franchise-tva"

export interface Installation {
  /** Même slug que la page « Logiciel de facturation pour … » (lib/pseo/metiers.ts). */
  slug: string
  /** Métier au singulier, en minuscules : « plombier ». */
  metier: string
  /** Balise <title>. */
  titreSeo: string
  /** 120 à 155 caractères. */
  description: string
  motsCles: string[]
  /** Ce que fait le métier et ce qui le distingue (2 à 3 phrases). */
  intro: string
  /** Diplômes, après « un » : « CAP monteur en installations sanitaires ». */
  diplome: string
  /** L'assurance vue depuis ce métier. */
  assurance: string
  /** Les taux de TVA courants du métier. */
  tva: string
  /** Règles et usages propres au métier. */
  specificites: { titre: string; texte: string }[]
  /** Questions propres au métier (aucune n'est reprise d'un autre métier). */
  faq: { question: string; reponse: string }[]
  /** Fiche officielle du métier. */
  fiche: { label: string; href: string }
}

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`
const services = ACTIVITES.find((a) => a.id === "prestations-bic")!
const vente = ACTIVITES.find((a) => a.id === "vente")!
const franchiseServices = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!
const franchiseVente = SEUILS_FRANCHISE_TVA.find((s) => s.id === "vente")!

/** Chiffres partagés par toutes les pages (mêmes valeurs que les outils). */
export const CHIFFRES = {
  plafondServices: eur(services.plafondCA),
  plafondVente: eur(vente.plafondCA),
  cotisationsServices: `${services.tauxCotisations.toLocaleString("fr-FR")} %`,
  cfpArtisan: `${services.tauxCFP.toLocaleString("fr-FR")} %`,
  franchiseServices: eur(franchiseServices.seuilBase),
  franchiseServicesMajore: eur(franchiseServices.seuilMajore),
  franchiseVente: eur(franchiseVente.seuilBase),
}

/** Sources communes à toutes les pages métier. */
export const SOURCES_COMMUNES: { label: string; href?: string }[] = [
  { label: "Service-public.gouv.fr, « Devis obligatoire : activités concernées » (fiche F31144)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31144" },
  { label: "Service-public.gouv.fr, cotisations et plafonds du micro-entrepreneur (fiches F36232 et F32353)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F32353" },
  { label: "Code général des impôts, articles 293 B (franchise de TVA), 279-0 bis et 278-0 bis A (taux réduits des travaux)" },
  { label: "Code des assurances, articles L241-1 (assurance décennale), L243-2 et L243-3" },
  { label: "Loi n° 96-603 du 5 juillet 1996, article 16 (qualification des activités artisanales)" },
]

export const INSTALLATIONS: Installation[] = [
  {
    slug: "plombier",
    metier: "plombier",
    titreSeo: "Devenir plombier à son compte : étapes et obligations",
    description: "Devenir plombier à son compte : diplôme ou expérience, statut, immatriculation, décennale, TVA, devis de dépannage et règles du gaz, étape par étape.",
    motsCles: ["devenir plombier à son compte", "plombier auto entrepreneur", "s'installer plombier", "créer son entreprise de plomberie"],
    intro: "Le plombier installe et répare les réseaux d'eau, les appareils sanitaires et souvent le chauffage. Le dépannage chez des particuliers pèse lourd dans son activité : c'est aussi la part la plus encadrée, avec un devis dû avant chaque intervention.",
    diplome: "CAP monteur en installations sanitaires",
    assurance: "La garantie décennale couvre les installations qui font corps avec le bâtiment, comme les réseaux encastrés et les appareils raccordés.",
    tva: "Dans un logement achevé depuis plus de deux ans, vos travaux sont en général à 10 %. Un chauffe-eau solaire ou thermodynamique peut relever de 5,5 % s'il figure parmi les équipements éligibles. Le neuf est à 20 %.",
    specificites: [
      { titre: "Le dépannage chez un particulier", texte: "Devis détaillé avant toute intervention, même urgente et même pour quelques euros, avec votre taux horaire TTC et vos frais de déplacement. Le seuil de 150 € a disparu le 1er avril 2017." },
      { titre: "Les travaux de gaz", texte: "Pour une installation de gaz neuve, modifiée ou complétée, vous établissez un certificat de conformité, visé par un organisme agréé (arrêté du 23 février 2018)." },
      { titre: "La rénovation énergétique", texte: "Pour que vos clients obtiennent MaPrimeRénov' sur un chauffe-eau solaire ou thermodynamique, votre entreprise doit être qualifiée RGE dans ce domaine de travaux." },
    ],
    faq: [
      { question: "Un plombier doit-il faire un devis pour un petit dépannage ?", reponse: "Oui, chez un particulier : depuis le 1er avril 2017, le devis détaillé est obligatoire avant toute intervention de dépannage, de réparation ou d'entretien, quel qu'en soit le montant (arrêté du 24 janvier 2017)." },
      { question: "Un plombier peut-il installer le gaz ?", reponse: "Oui, si l'installation entre dans sa qualification. Toute installation de gaz neuve, modifiée ou complétée donne lieu à un certificat de conformité établi par l'installateur et visé par un organisme agréé." },
      { question: "Quel diplôme pour devenir plombier à son compte ?", reponse: "Un CAP monteur en installations sanitaires, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Plombier : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39039" },
  },
  {
    slug: "electricien",
    metier: "électricien",
    titreSeo: "Devenir électricien à son compte : étapes et obligations",
    description: "Devenir électricien à son compte : diplôme ou expérience, statut, immatriculation, décennale, Consuel, bornes de recharge et TVA, étape par étape.",
    motsCles: ["devenir électricien à son compte", "électricien auto entrepreneur", "s'installer électricien", "créer son entreprise d'électricité"],
    intro: "L'électricien installe, met aux normes et dépanne les installations électriques des logements et des locaux. Ses mises en service passent par le Consuel, et certaines installations, comme les bornes de recharge, demandent une qualification de plus.",
    diplome: "CAP électricien",
    assurance: "La garantie décennale couvre les installations électriques intégrées au bâtiment, du tableau aux circuits encastrés.",
    tva: "Rénovation dans un logement achevé depuis plus de deux ans : 10 % en général. Construction neuve et locaux professionnels : 20 %.",
    specificites: [
      { titre: "Le Consuel", texte: "Une installation neuve, ou entièrement rénovée avec coupure du réseau, fait l'objet d'une attestation de conformité visée par le Consuel avant sa mise en service (décret n° 72-1120 du 14 décembre 1972)." },
      { titre: "Les bornes de recharge", texte: "Installer une borne de recharge de plus de 3,7 kW demande la qualification IRVE (décret n° 2017-26 du 12 janvier 2017)." },
      { titre: "L'habilitation de vos salariés", texte: "Si vous embauchez, vos salariés qui interviennent sur ou près des installations doivent être habilités par vous, après une formation adaptée." },
    ],
    faq: [
      { question: "Qui s'occupe de l'attestation Consuel ?", reponse: "L'installateur établit l'attestation de conformité et la soumet au visa du Consuel ; elle est ensuite remise au gestionnaire de réseau, qui peut alors mettre l'installation en service." },
      { question: "Faut-il être qualifié IRVE pour poser une borne de recharge ?", reponse: "Oui au-delà de 3,7 kW : la pose doit être faite par un installateur titulaire de la qualification IRVE (décret n° 2017-26 du 12 janvier 2017)." },
      { question: "Quel diplôme pour devenir électricien à son compte ?", reponse: "Un CAP électricien, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Électricien : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F38552" },
  },
  {
    slug: "macon",
    metier: "maçon",
    titreSeo: "Devenir maçon à son compte : étapes et obligations",
    description: "Devenir maçon à son compte : diplôme ou expérience, statut, immatriculation, décennale par activité, TVA des agrandissements et déchets de chantier.",
    motsCles: ["devenir maçon à son compte", "maçon auto entrepreneur", "s'installer maçon", "créer son entreprise de maçonnerie"],
    intro: "Le maçon réalise le gros œuvre : fondations, murs, dalles, ouvertures et reprises de structure. C'est le métier le plus exposé à la garantie décennale, puisqu'il touche à la solidité même de l'ouvrage.",
    diplome: "CAP maçon",
    assurance: "Votre décennale doit couvrir chacune des activités que vous exercez (gros œuvre, ravalement, démolition…) : un chantier hors des activités déclarées à l'assureur n'est pas couvert.",
    tva: "Rénovation d'un logement achevé depuis plus de deux ans : 10 %. Une surélévation, une remise à l'état neuf ou une hausse de plus de 10 % de la surface de plancher restent à 20 %, même chez un particulier.",
    specificites: [
      { titre: "Les déchets de chantier", texte: "Triez gravats et déchets à la source et apportez-les dans des points de reprise adaptés ; votre devis indique comment ils seront gérés et où ils seront collectés." },
      { titre: "La carte BTP", texte: "Si vous embauchez, chaque salarié présent sur vos chantiers doit avoir sa carte d'identification professionnelle du BTP." },
      { titre: "Les agrandissements", texte: "Extension, surélévation, création de surface : ces travaux sortent du taux réduit de TVA et demandent souvent une autorisation d'urbanisme du client. Écrivez clairement le taux sur le devis." },
    ],
    faq: [
      { question: "Quelle assurance pour un maçon qui démarre ?", reponse: "La garantie décennale, obligatoire avant le premier chantier (travailler sans est puni de six mois d'emprisonnement et de 75 000 € d'amende), et une responsabilité civile professionnelle. Faites-y figurer toutes les activités que vous exercez." },
      { question: "Un maçon peut-il facturer à 10 % de TVA ?", reponse: "Oui pour des travaux dans un logement achevé depuis plus de deux ans, si le client le certifie sur le devis ou la facture. Une surélévation, une remise à l'état neuf ou une hausse de plus de 10 % de la surface de plancher restent à 20 %." },
      { question: "Quel diplôme pour devenir maçon à son compte ?", reponse: "Un CAP maçon, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Maçon : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39037" },
  },
  {
    slug: "peintre",
    metier: "peintre en bâtiment",
    titreSeo: "Devenir peintre en bâtiment à son compte : étapes",
    description: "Devenir peintre en bâtiment à son compte : diplôme ou expérience, statut, immatriculation, quand la décennale s'impose, TVA et chiffrage au m².",
    motsCles: ["devenir peintre en bâtiment à son compte", "peintre auto entrepreneur", "s'installer peintre en bâtiment", "créer son entreprise de peinture"],
    intro: "Le peintre en bâtiment prépare et protège les supports, applique peintures et revêtements muraux, et ravale souvent les façades. Ses chantiers sont nombreux et courts : un devis clair, envoyé vite, fait souvent la différence.",
    diplome: "CAP peintre applicateur de revêtements",
    assurance: "La décennale est exigée pour les travaux qui touchent à l'ouvrage lui-même, comme l'étanchéité ou l'imperméabilisation d'une façade ; pour la peinture purement décorative, la fiche officielle recommande une responsabilité civile professionnelle.",
    tva: "Peinture dans un logement achevé depuis plus de deux ans : 10 %. Isolation thermique par l'extérieur éligible : 5,5 %. Locaux professionnels et neuf : 20 %.",
    specificites: [
      { titre: "Produits et déchets", texte: "Solvants, pots entamés et résidus de peinture se trient et se rapportent dans les filières adaptées : la fiche officielle du métier insiste sur ce traitement des déchets." },
      { titre: "Le chiffrage au mètre carré", texte: "Surface, nombre de couches, préparation des supports (lessivage, enduit, ponçage) : détaillez-les ligne par ligne, c'est ce que le client compare d'un devis à l'autre." },
      { titre: "Le ravalement de façade", texte: "Dans un secteur protégé ou dans une commune qui l'a décidé, un ravalement demande une déclaration préalable en mairie (code de l'urbanisme, art. R421-17-1). C'est au propriétaire de la déposer : vérifiez-la avec lui avant de dater le chantier sur le devis." },
    ],
    faq: [
      { question: "Un peintre en bâtiment doit-il avoir une décennale ?", reponse: "Oui dès que ses travaux touchent à l'ouvrage, par exemple l'imperméabilisation d'une façade. Pour la peinture purement décorative, la fiche officielle du métier recommande une responsabilité civile professionnelle." },
      { question: "Quel taux de TVA pour des travaux de peinture ?", reponse: "10 % dans un logement achevé depuis plus de deux ans, si le client le certifie sur le devis ou la facture ; 20 % pour des locaux professionnels ou dans le neuf." },
      { question: "Quel diplôme pour devenir peintre en bâtiment à son compte ?", reponse: "Un CAP peintre applicateur de revêtements, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Peintre en bâtiment : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39038" },
  },
  {
    slug: "carreleur",
    metier: "carreleur",
    titreSeo: "Devenir carreleur à son compte : étapes et obligations",
    description: "Devenir carreleur à son compte : diplôme ou expérience, statut, immatriculation, décennale des terrasses et piscines, TVA et chiffrage au mètre carré.",
    motsCles: ["devenir carreleur à son compte", "carreleur auto entrepreneur", "s'installer carreleur", "créer son entreprise de carrelage"],
    intro: "Le carreleur pose carrelage, faïence, mosaïque et chapes, au sol comme au mur, de la salle de bains à la terrasse. Une pose ratée se voit tout de suite et coûte cher à reprendre : la qualité du support compte autant que celle des carreaux.",
    diplome: "CAP carreleur mosaïste",
    assurance: "La fiche officielle du métier cite la décennale pour les ouvrages comme les façades, les terrasses et les piscines ; l'attestation d'assurance accompagne vos devis et vos factures.",
    tva: "Carrelage dans un logement achevé depuis plus de deux ans : 10 %. Construction neuve et locaux professionnels : 20 %.",
    specificites: [
      { titre: "Terrasses et piscines", texte: "Exposés à l'eau et au gel, ces ouvrages sont ceux où la décennale joue le plus : vérifiez qu'ils figurent bien dans les activités de votre contrat." },
      { titre: "Le prix au mètre carré", texte: "Préparation du support, chape, plinthes, joints, découpes : dites ce qui est compris dans votre prix au mètre carré, c'est la première source de malentendu." },
      { titre: "Gravats et chutes", texte: "Le devis précise comment les gravats, chutes et emballages seront gérés et où ils seront collectés." },
    ],
    faq: [
      { question: "Quelle TVA pour refaire une salle de bains ?", reponse: "10 % dans un logement achevé depuis plus de deux ans, si le client certifie les conditions sur le devis ou la facture ; 20 % dans le neuf." },
      { question: "La décennale est-elle obligatoire pour un carreleur ?", reponse: "Oui pour les ouvrages qu'elle couvre, comme les façades, les terrasses et les piscines, et elle doit être souscrite avant le premier chantier. L'attestation est jointe aux devis et aux factures." },
      { question: "Quel diplôme pour devenir carreleur à son compte ?", reponse: "Un CAP carreleur mosaïste, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Carreleur : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39050" },
  },
  {
    slug: "menuisier",
    metier: "menuisier",
    titreSeo: "Devenir menuisier à son compte : étapes et obligations",
    description: "Devenir menuisier à son compte : diplôme ou expérience, statut, immatriculation, décennale de la pose, TVA des fenêtres et différence avec le charpentier.",
    motsCles: ["devenir menuisier à son compte", "menuisier auto entrepreneur", "s'installer menuisier", "créer son entreprise de menuiserie"],
    intro: "Le menuisier fabrique et pose portes, fenêtres, escaliers, placards et agencements, en bois et souvent en PVC ou en aluminium. Entre l'atelier et le chantier, il vend à la fois des ouvrages fabriqués et de la pose.",
    diplome: "CAP menuisier installateur ou menuisier fabricant",
    assurance: "La décennale est obligatoire avant le premier chantier : la pose de fenêtres, de portes d'entrée et d'escaliers fait partie de l'ouvrage.",
    tva: "Remplacement de fenêtres dans un logement achevé depuis plus de deux ans : 5,5 % si elles respectent les critères de performance énergétique, 10 % sinon. Neuf : 20 %.",
    specificites: [
      { titre: "Fabrication et pose", texte: "Distinguez sur vos devis la fourniture, la fabrication et la pose : le client y voit clair, et vous gardez le détail pour vos marges." },
      { titre: "Votre code d'activité", texte: "La pose de menuiseries relève en général du code APE 43.32A, « travaux de menuiserie bois et PVC », attribué à l'immatriculation." },
      { titre: "Les déchets de bois", texte: "Chutes, anciennes menuiseries et emballages se trient selon les filières du bâtiment, à préciser sur le devis." },
    ],
    faq: [
      { question: "Quel taux de TVA pour changer des fenêtres ?", reponse: "5,5 % dans un logement achevé depuis plus de deux ans si les fenêtres respectent les critères de performance énergétique fixés par l'administration, 10 % sinon ; 20 % dans le neuf." },
      { question: "Menuisier ou charpentier : quelle différence ?", reponse: "Le menuisier travaille les ouvertures et l'agencement (portes, fenêtres, escaliers, placards) ; le charpentier conçoit et pose les structures porteuses, comme les charpentes et les maisons à ossature bois. Les deux métiers demandent une qualification." },
      { question: "Quel diplôme pour devenir menuisier à son compte ?", reponse: "Un CAP menuisier installateur ou menuisier fabricant, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Menuisier : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39043" },
  },
  {
    slug: "couvreur",
    metier: "couvreur",
    titreSeo: "Devenir couvreur à son compte : étapes et obligations",
    description: "Devenir couvreur à son compte : diplôme ou expérience, statut, immatriculation, décennale, sécurité du travail en hauteur, TVA et isolation des combles.",
    motsCles: ["devenir couvreur à son compte", "couvreur auto entrepreneur", "s'installer couvreur", "créer son entreprise de couverture"],
    intro: "Le couvreur pose, entretient et répare les toitures : tuiles, ardoises, zinc, gouttières, fenêtres de toit, et souvent l'isolation des combles. C'est un métier de hauteur, où la sécurité passe avant tout.",
    diplome: "CAP couvreur",
    assurance: "La décennale est obligatoire : une toiture qui fuit rend le bâtiment impropre à son usage. Joignez l'attestation d'assurance à vos devis.",
    tva: "Réfection de toiture dans un logement achevé depuis plus de deux ans : 10 %. Isolation de la toiture ou des combles éligible : 5,5 %. Neuf : 20 %.",
    specificites: [
      { titre: "Le travail en hauteur", texte: "Protections antichute, pas de travail isolé sur un toit, arrêt du chantier par mauvais temps : la fiche officielle du métier rappelle ces règles de sécurité." },
      { titre: "L'isolation des combles", texte: "Pour que vos clients obtiennent MaPrimeRénov' sur l'isolation de la toiture ou des combles, votre entreprise doit être qualifiée RGE pour ces travaux." },
      { titre: "L'échafaudage sur la voie publique", texte: "Un échafaudage ou une benne posés sur le trottoir ou la chaussée demandent une autorisation d'occupation du domaine public (permis de stationnement) délivrée par la mairie : prévoyez son délai et son coût dans le devis." },
    ],
    faq: [
      { question: "Un couvreur peut-il travailler seul sur un toit ?", reponse: "Non : la fiche officielle du métier proscrit le travail isolé en hauteur et impose des protections antichute adaptées." },
      { question: "Quelle TVA pour une réfection de toiture ?", reponse: "10 % dans un logement achevé depuis plus de deux ans, si le client certifie les conditions sur le devis ou la facture ; 5,5 % pour une isolation de toiture éligible ; 20 % dans le neuf." },
      { question: "Quel diplôme pour devenir couvreur à son compte ?", reponse: "Un CAP couvreur, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Couvreur : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39034" },
  },
  {
    slug: "plaquiste",
    metier: "plaquiste",
    titreSeo: "Devenir plaquiste à son compte : étapes et obligations",
    description: "Devenir plaquiste à son compte : diplôme ou expérience, statut, immatriculation, décennale, sous-traitance et autoliquidation, TVA de l'isolation.",
    motsCles: ["devenir plaquiste à son compte", "plaquiste auto entrepreneur", "s'installer plaquiste", "créer son entreprise de plâtrerie"],
    intro: "Le plaquiste monte cloisons, doublages et faux plafonds en plaques de plâtre, souvent avec l'isolation. Très demandé en rénovation, il travaille beaucoup en sous-traitance pour des entreprises générales.",
    diplome: "CAP plâtrier-plaquiste",
    assurance: "La décennale est obligatoire avant le premier chantier, comme pour tous les travaux de construction, avec une responsabilité civile professionnelle.",
    tva: "Cloisons et doublages dans un logement achevé depuis plus de deux ans : 10 %. Doublage isolant éligible : 5,5 %. Neuf : 20 %. En sous-traitance : facture hors taxes, TVA autoliquidée par l'entreprise principale.",
    specificites: [
      { titre: "La sous-traitance", texte: "Quand vous travaillez pour une entreprise du bâtiment, vous facturez hors taxes avec la mention « Autoliquidation » : c'est elle qui déclare la TVA (CGI, art. 283-2 nonies)." },
      { titre: "L'isolation et les aides", texte: "Pour que vos clients obtiennent MaPrimeRénov' sur l'isolation des murs par l'intérieur, votre entreprise doit être qualifiée RGE pour ces travaux." },
      { titre: "Le chiffrage", texte: "Mètres carrés de cloison et de plafond, mètres linéaires de bandes, épaisseur d'isolant : un devis par postes évite les avenants." },
    ],
    faq: [
      { question: "Comment facturer en sous-traitance quand on est plaquiste ?", reponse: "Hors taxes, avec la mention « Autoliquidation » : l'entreprise principale déclare elle-même la TVA due sur vos travaux (CGI, art. 283-2 nonies)." },
      { question: "Quelle TVA pour une isolation intérieure ?", reponse: "5,5 % pour une isolation des murs par l'intérieur éligible dans un logement achevé depuis plus de deux ans, 10 % pour les autres travaux de plâtrerie, 20 % dans le neuf." },
      { question: "Quel diplôme pour devenir plaquiste à son compte ?", reponse: "Un CAP plâtrier-plaquiste, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Entrepreneur en bâtiment : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39041" },
  },
  {
    slug: "chauffagiste",
    metier: "chauffagiste",
    titreSeo: "Devenir chauffagiste à son compte : étapes et obligations",
    description: "Devenir chauffagiste à son compte : diplôme ou expérience, statut, décennale, fluides frigorigènes, gaz, RGE et TVA des pompes à chaleur, étape par étape.",
    motsCles: ["devenir chauffagiste à son compte", "chauffagiste auto entrepreneur", "s'installer chauffagiste", "créer son entreprise de chauffage"],
    intro: "Le chauffagiste installe et entretient chaudières, pompes à chaleur, radiateurs et réseaux de chauffage. La rénovation énergétique en a fait l'un des métiers les plus recherchés du bâtiment, avec des règles propres aux fluides frigorigènes et au gaz.",
    diplome: "CAP monteur en installations thermiques",
    assurance: "La décennale est obligatoire avant le premier chantier, avec une responsabilité civile professionnelle couvrant les dommages corporels, matériels et immatériels.",
    tva: "Équipement de rénovation énergétique éligible, comme une pompe à chaleur, dans un logement achevé depuis plus de deux ans : 5,5 %. Autres travaux de chauffage : 10 %. Neuf : 20 %.",
    specificites: [
      { titre: "Les fluides frigorigènes", texte: "Pompes à chaleur et climatisation : manipuler des fluides frigorigènes demande une attestation de capacité, délivrée par un organisme accrédité et valable cinq ans." },
      { titre: "Le gaz", texte: "Pour une installation de gaz neuve, modifiée ou complétée, vous établissez un certificat de conformité, visé par un organisme agréé (arrêté du 23 février 2018)." },
      { titre: "La qualification RGE", texte: "Elle n'est pas obligatoire pour exercer, mais vos clients n'obtiennent MaPrimeRénov' sur une pompe à chaleur ou un chauffage au bois que si votre entreprise est RGE pour ces travaux." },
    ],
    faq: [
      { question: "Faut-il une attestation de capacité pour poser une pompe à chaleur ?", reponse: "Oui : toute intervention sur des fluides frigorigènes demande une attestation de capacité, délivrée par un organisme accrédité et valable cinq ans." },
      { question: "Faut-il être RGE pour être chauffagiste ?", reponse: "Non pour exercer, mais oui pour que vos clients obtiennent MaPrimeRénov' sur les travaux de rénovation énergétique concernés." },
      { question: "Quel diplôme pour devenir chauffagiste à son compte ?", reponse: "Un CAP monteur en installations thermiques, un brevet professionnel ou un titre de même niveau inscrit au RNCP. À défaut, trois ans d'expérience effective dans le métier, attestés par la chambre de métiers et de l'artisanat." },
    ],
    fiche: { label: "Service-public.gouv.fr, « Chauffagiste : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39033" },
  },
]

export function getInstallationBySlug(slug: string): Installation | undefined {
  return INSTALLATIONS.find((i) => i.slug === slug)
}

/** Étapes communes, avec les éléments propres au métier. */
export function etapes(i: Installation): { titre: string; contenu: string; liste?: string[] }[] {
  return [
    {
      titre: "Justifier de votre qualification",
      contenu: `Le métier de ${i.metier} fait partie des activités artisanales réglementées : la personne qui exerce ou qui contrôle le travail doit être qualifiée. Exercer sans qualification est puni d'une amende de 7 500 €, et se présenter comme professionnel sans l'être relève de l'usurpation de titre (un an d'emprisonnement et 15 000 € d'amende).`,
      liste: [
        `Un diplôme du métier : par exemple un ${i.diplome}, un brevet professionnel ou un titre de même niveau inscrit au RNCP.`,
        "Ou trois ans d'expérience effective dans le métier, comme salarié ou indépendant, en France ou dans l'Union européenne, attestés par la chambre de métiers et de l'artisanat.",
      ],
    },
    {
      titre: "Choisir votre statut",
      contenu: `La micro-entreprise est la façon la plus simple de démarrer : vos cotisations sont calculées sur le chiffre d'affaires encaissé (${CHIFFRES.cotisationsServices} pour des prestations de services artisanales, plus ${CHIFFRES.cfpArtisan} de contribution à la formation), et la comptabilité est allégée. Le régime est réservé aux entreprises dont le chiffre d'affaires annuel ne dépasse pas ${CHIFFRES.plafondServices} pour les prestations de services (${CHIFFRES.plafondVente} pour la vente de marchandises). Une société (EURL, SASU) se choisit plutôt quand l'activité grandit, que vous achetez beaucoup de matériel ou que vous embauchez : faites-vous conseiller.`,
    },
    {
      titre: "Vous immatriculer",
      contenu: "La déclaration se fait en ligne, sur le guichet des formalités des entreprises (formalites.entreprises.gouv.fr), dans le mois qui précède le début de l'activité et au plus tard 15 jours après. Vous y joignez notamment une déclaration sur l'honneur de non-condamnation ; l'Insee vous attribue ensuite vos numéros SIREN et SIRET, à reporter sur vos devis et vos factures.",
    },
    {
      titre: "Vous assurer avant le premier chantier",
      contenu: `${i.assurance} Travailler sans l'assurance décennale obligatoire est puni de six mois d'emprisonnement et de 75 000 € d'amende. L'attestation de décennale est jointe à vos devis et à vos factures (code des assurances, art. L243-2), avec les coordonnées de l'assureur et la couverture géographique du contrat.`,
    },
    {
      titre: "Comprendre votre TVA",
      contenu: `En micro-entreprise, la franchise en base vous dispense de facturer la TVA tant que vos prestations de services restent sous ${CHIFFRES.franchiseServices} par an (${CHIFFRES.franchiseServicesMajore} en seuil majoré ; ${CHIFFRES.franchiseVente} pour la vente de marchandises) : vos factures portent alors « TVA non applicable, art. 293 B du CGI ». Au-delà, vous facturez la TVA au bon taux.`,
      liste: [
        i.tva,
        "Taux réduit chez un particulier : depuis le 1er mars 2025, le client certifie sur le devis ou la facture que le logement est achevé depuis plus de deux ans et que les travaux ne sont pas exclus du taux réduit.",
      ],
    },
    {
      titre: "Faire vos premiers devis et vos premières factures",
      contenu: "Chez un particulier, un devis détaillé est obligatoire avant tout dépannage, toute réparation ou tout entretien, quel qu'en soit le montant. Il porte vos coordonnées et votre SIREN, le détail chiffré des travaux, votre taux horaire, vos frais de déplacement, les totaux HT et TTC, sa durée de validité et votre assurance. Signé, il vaut contrat ; la facture reprend ensuite les mêmes postes. À partir du 1er septembre 2027, vos factures aux entreprises passeront au format électronique, par une plateforme agréée.",
    },
  ]
}
