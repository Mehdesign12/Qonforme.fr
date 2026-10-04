export interface GuideSection {
  titre: string
  contenu: string
  /** Liste à puces affichée sous le paragraphe. */
  liste?: string[]
}

export interface Guide {
  slug: string
  /** Titre affiché (h1). */
  titre: string
  /** Balise <title>, quand elle doit viser une autre formulation que le h1. */
  titreSeo?: string
  description: string
  motsCles: string[]
  /** « L'essentiel » : la réponse directe, en tête de page. */
  essentiel?: string[]
  sections: GuideSection[]
  faq: { question: string; reponse: string }[]
  /** Liens internes affichés en premier dans « Aller plus loin ». */
  liens?: { href: string; label: string }[]
  /** Textes officiels sur lesquels repose le guide. */
  sources?: { label: string; href?: string }[]
  /** Date de la dernière vérification du contenu sur les sources (AAAA-MM-JJ). */
  verifieLe?: string
}

export const GUIDES: Guide[] = [
  {
    slug: "mentions-obligatoires-facture",
    titre: "Mentions obligatoires d'une facture : la liste complète",
    titreSeo: "Mentions obligatoires d'une facture : liste complète 2026",
    description: "Les mentions obligatoires d'une facture en 2026 : vendeur, client, numéro, TVA, paiement, nouvelles mentions de la réforme et mentions du bâtiment.",
    motsCles: ["mentions obligatoires facture", "factures mentions obligatoires", "mentions obligatoires facture artisan", "que doit contenir une facture", "facture conforme"],
    essentiel: [
      "Un numéro unique, pris dans une suite chronologique et continue, et la date d'émission.",
      "Votre identité : nom ou dénomination, adresse, SIREN, forme juridique, et votre numéro de TVA intracommunautaire si vous en avez un.",
      "L'identité du client : nom ou dénomination et adresse de facturation.",
      "La date de la vente ou de la prestation, si elle diffère de la date d'émission.",
      "Pour chaque ligne : désignation précise, quantité, prix unitaire hors taxe et taux de TVA.",
      "Les totaux HT, la TVA par taux et le total TTC, ou la mention qui justifie l'absence de TVA.",
      "La date d'échéance, les conditions d'escompte et le taux des pénalités de retard.",
      "Pour un client professionnel : l'indemnité forfaitaire de 40 € pour frais de recouvrement.",
      "Pour un artisan : son assurance professionnelle (assureur, contrat, couverture géographique).",
      "Au passage à la facture électronique (1er septembre 2027 pour une TPE ou une PME) : le SIREN du client, l'adresse de livraison, la nature des opérations et, le cas échéant, l'option pour la TVA sur les débits.",
    ],
    sections: [
      {
        titre: "Ce qui identifie le vendeur",
        contenu: "La facture doit permettre d'identifier sans ambiguïté l'entreprise qui l'émet. Les mentions dépendent de votre forme juridique.",
        liste: [
          "Votre nom ou votre dénomination sociale, et l'adresse de votre siège ou de votre établissement.",
          "Votre numéro SIREN (ou SIRET).",
          "Entrepreneur individuel, micro-entreprise comprise : votre nom précédé ou suivi de « entrepreneur individuel » ou « EI » (code de commerce, art. R526-27).",
          "Société : la forme juridique et le montant du capital social, et « RCS » suivi de la ville du greffe si elle est immatriculée au registre du commerce.",
          "Votre numéro de TVA intracommunautaire, si vous êtes identifié à la TVA.",
        ],
      },
      {
        titre: "Ce qui identifie le client",
        contenu: "Indiquez le nom ou la dénomination du client et son adresse de facturation. Pour un client professionnel, ajoutez son numéro de TVA intracommunautaire, sauf sur une facture de 150 € HT ou moins. Si l'adresse du chantier ou de livraison diffère, notez-la : elle deviendra obligatoire avec la facture électronique.",
      },
      {
        titre: "Le numéro et les dates",
        contenu: "Chaque facture porte un numéro unique, attribué dans une suite chronologique et continue, sans trou ni doublon. Plusieurs séries sont possibles (une par année, par exemple) si chacune reste continue. Une facture émise ne se modifie pas et ne se supprime pas : une erreur se corrige par un avoir.",
        liste: [
          "La date d'émission de la facture.",
          "La date de la vente ou de la fin de la prestation, si elle diffère de la date d'émission.",
          "Pour une facture d'acompte : la date du versement, si elle diffère de la date d'émission.",
        ],
      },
      {
        titre: "Le détail des travaux et des prix",
        contenu: "Chaque ligne décrit précisément ce qui est facturé : votre client doit pouvoir comprendre la facture sans avoir le devis sous les yeux.",
        liste: [
          "La désignation précise : fournitures, main-d'œuvre, déplacement…",
          "La quantité et son unité : heure, m², mètre linéaire, forfait…",
          "Le prix unitaire hors taxe.",
          "Le taux de TVA de la ligne : 20 %, 10 % ou 5,5 % selon la nature des travaux.",
          "Les rabais, remises ou ristournes acquis à la date de la facture.",
        ],
      },
      {
        titre: "La TVA et les totaux",
        contenu: "Pour chaque taux, la facture indique la base hors taxe et le montant de la TVA, puis les totaux HT, TVA et TTC. Quand la TVA n'est pas facturée, une mention en donne la raison.",
        liste: [
          "Franchise en base : « TVA non applicable, art. 293 B du CGI ».",
          "Sous-traitance dans le bâtiment : « Autoliquidation ». L'entreprise principale déclare elle-même la TVA.",
          "Taux réduit de 10 % ou 5,5 % pour des travaux chez un particulier : depuis le 1er mars 2025, le client certifie sur le devis ou la facture que les conditions sont remplies (logement achevé depuis plus de deux ans, travaux non exclus). L'attestation séparée n'existe plus.",
        ],
      },
      {
        titre: "Les conditions de paiement",
        contenu: "Ces mentions fixent les règles du paiement. Pour un client particulier, l'indemnité de 40 € ne s'applique pas ; pour la vente de certains biens à un particulier, la facture rappelle en revanche l'existence et la durée de la garantie légale de conformité.",
        liste: [
          "La date d'échéance du paiement.",
          "Les conditions d'escompte en cas de paiement anticipé, ou « Pas d'escompte pour paiement anticipé ».",
          "Le taux des pénalités de retard. Sans taux prévu, c'est le taux de la BCE majoré de 10 points ; un taux prévu ne peut pas être inférieur à trois fois le taux d'intérêt légal.",
          "Pour un client professionnel : l'indemnité forfaitaire de 40 € pour frais de recouvrement.",
        ],
      },
      {
        titre: "Les mentions propres aux artisans du bâtiment",
        contenu: "Un artisan dont l'activité exige une assurance professionnelle l'indique sur ses devis et ses factures (code de l'artisanat, art. L132-1).",
        liste: [
          "L'assurance souscrite : garantie décennale, responsabilité civile professionnelle…",
          "Les coordonnées de l'assureur ou du garant.",
          "Les références du contrat.",
          "La couverture géographique du contrat.",
          "Pour la garantie décennale, le code des assurances (art. L243-2) demande aussi de joindre l'attestation d'assurance aux devis et aux factures.",
        ],
      },
      {
        titre: "Les nouvelles mentions de la facture électronique",
        contenu: "Quatre mentions s'ajoutent quand votre entreprise passe à l'émission de factures électroniques : le 1er septembre 2026 pour les grandes entreprises et les ETI, le 1er septembre 2027 pour les PME, les TPE et les micro-entreprises. La facture circule alors au format structuré, par une plateforme agréée.",
        liste: [
          "Le numéro SIREN du client, quand c'est une entreprise.",
          "L'adresse de livraison des biens, si elle diffère de l'adresse du client.",
          "La nature des opérations : livraison de biens, prestation de services, ou les deux.",
          "La mention « Option pour le paiement de la taxe d'après les débits », si vous avez choisi cette option.",
        ],
      },
      {
        titre: "Ce que coûte une mention manquante",
        contenu: "Une facture incomplète expose à deux sanctions distinctes, qui peuvent s'ajouter.",
        liste: [
          "Une amende fiscale de 15 € par mention manquante ou inexacte, plafonnée au quart du montant de la facture (CGI, art. 1737).",
          "Une amende administrative pouvant atteindre 75 000 € pour une personne physique et 375 000 € pour une société, montants doublés en cas de récidive dans les deux ans (code de commerce, art. L441-16).",
        ],
      },
    ],
    faq: [
      { question: "Quelles sont les mentions obligatoires d'une facture ?", reponse: "Le numéro et la date de la facture, votre identité et votre SIREN, le nom et l'adresse du client, la date de la prestation, le détail des lignes (quantité, prix unitaire HT, taux de TVA), les totaux HT, TVA et TTC, la date d'échéance, l'escompte et le taux des pénalités de retard, et, pour un client professionnel, l'indemnité de 40 €. S'y ajoutent les mentions propres à votre situation : franchise de TVA, autoliquidation, assurance d'artisan, mention « EI »." },
      { question: "Que risque-t-on si une mention manque sur une facture ?", reponse: "Une amende fiscale de 15 € par mention manquante ou inexacte, plafonnée au quart du montant de la facture (CGI, art. 1737). Le code de commerce prévoit en plus une amende administrative jusqu'à 75 000 € pour une personne physique et 375 000 € pour une société (art. L441-16)." },
      { question: "Un micro-entrepreneur doit-il indiquer un numéro de TVA ?", reponse: "Pas s'il est en franchise de TVA et n'a pas de numéro : il indique alors « TVA non applicable, art. 293 B du CGI ». Il doit en revanche indiquer son SIREN et la mention « EI » ou « entrepreneur individuel » à côté de son nom." },
      { question: "Une facture d'acompte porte-t-elle les mêmes mentions ?", reponse: "Oui. C'est une facture à part entière, numérotée dans la même suite que les autres, avec la date du versement. Pour une prestation de services, la TVA est due sur l'acompte encaissé. La facture finale déduit ensuite les acomptes déjà facturés." },
      { question: "Peut-on encore envoyer une facture en PDF par email ?", reponse: "Oui, tant que votre entreprise n'est pas passée à l'émission électronique (le 1er septembre 2027 pour une TPE ou une PME) et si le client l'accepte. Ensuite, une facture adressée à une entreprise établie en France passe par une plateforme agréée, au format structuré. Pour un client particulier, le PDF reste possible : ce sont les données de la vente qui sont transmises à l'administration." },
      { question: "Faut-il signer une facture ?", reponse: "Non. Aucune signature n'est exigée : l'article 242 nonies A de l'annexe II du code général des impôts, qui liste les mentions obligatoires, n'en prévoit pas." },
    ],
    liens: [
      { href: "/outils/verificateur-mentions-facture", label: "Vérifier les mentions de ma facture" },
      { href: "/modele/facture-classique", label: "Modèle de facture gratuit" },
      { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
      { href: "/guide/plateforme-agreee", label: "Plateforme agréée" },
      { href: "/guide/delai-paiement-facture", label: "Délais de paiement" },
    ],
    sources: [
      { label: "Service-public.gouv.fr, « Mentions obligatoires sur une facture » (fiche F31808, mise à jour le 11 août 2026)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31808" },
      { label: "Code général des impôts, annexe II, article 242 nonies A (mentions des factures) et article 1737 (amende de 15 € par mention)" },
      { label: "Code de commerce, articles L441-9 (règles de facturation), L441-16 (amende administrative) et R526-27 (mention de l'entrepreneur individuel)" },
      { label: "Code de l'artisanat, article L132-1 (assurance de l'artisan)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294" },
      { label: "Code des assurances, article L243-2 (attestation de garantie décennale)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272" },
      { label: "Code général des impôts, article 279-0 bis (taux réduit des travaux, certification par le client)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051215062" },
    ],
    verifieLe: "2026-10-04",
  },
  {
    slug: "facture-auto-entrepreneur",
    titre: "Facture auto-entrepreneur : guide complet 2026",
    description: "Comment faire une facture en auto-entrepreneur (micro-entreprise) ? Mentions obligatoires, TVA, modèle et exemples pour 2026.",
    motsCles: ["facture auto entrepreneur", "facture micro entreprise", "modele facture auto entrepreneur"],
    sections: [
      { titre: "Les mentions obligatoires", contenu: "En auto-entrepreneur, votre facture doit comporter : vos nom et prénom (ou nom commercial), votre adresse, votre numéro SIRET, la mention « EI » ou « Entrepreneur individuel », un numéro de facture chronologique, la date d'émission, l'identité du client, le détail des prestations avec prix unitaire, le montant total HT, et les conditions de paiement." },
      { titre: "La mention TVA", contenu: "Si vous êtes en franchise de TVA (seuils 2026 : 37 500 € pour les services, 85 000 € pour la vente), vous devez ajouter la mention « TVA non applicable, article 293 B du CGI ». Pas de ligne TVA sur la facture. Si vous avez dépassé les seuils, vous devez facturer la TVA normalement." },
      { titre: "Seuils de franchise de TVA 2026", contenu: "Les seuils pour 2026 sont : 37 500 € de chiffre d'affaires l'année précédente pour les prestations de services (seuil majoré pour l'année en cours : 41 250 €) et 85 000 € pour les activités de vente (seuil majoré : 93 500 €). Si vous dépassez le seuil de base sans dépasser le seuil majoré, la franchise continue jusqu'au 31 décembre. Au-delà du seuil majoré, la TVA s'applique aux opérations réalisées à partir de la date du dépassement (article 293 B du CGI)." },
      { titre: "L'obligation de facturation électronique", contenu: "Depuis le 1er septembre 2026, les auto-entrepreneurs doivent pouvoir recevoir des factures électroniques. L'obligation d'en émettre arrive le 1er septembre 2027. Pour anticiper, choisissez un logiciel qui produit déjà des factures structurées : Qonforme joint un fichier XML Factur-X au PDF de vos factures, et l'envoi par une plateforme agréée y est en préparation." },
    ],
    faq: [
      { question: "Un auto-entrepreneur doit-il faire des factures ?", reponse: "Oui, la facture est obligatoire pour toute vente de produit ou prestation de service à un professionnel. Pour les ventes aux particuliers, un ticket ou une note suffit en dessous de 25 €, mais la facture est obligatoire au-delà ou sur demande du client." },
      { question: "Peut-on facturer sans numéro SIRET ?", reponse: "Non, le numéro SIRET est obligatoire sur toutes les factures. Si vous venez de créer votre auto-entreprise et n'avez pas encore reçu votre SIRET, attendez de le recevoir avant de facturer (délai habituel : 1 à 4 semaines)." },
      { question: "Quel logiciel de facturation pour auto-entrepreneur ?", reponse: "Aucun logiciel précis n'est imposé. L'obligation d'utiliser un logiciel certifié (article 286 I-3° bis du CGI) vise les logiciels de caisse, pas les logiciels de facturation. Choisissez un outil qui numérote vos factures sans trou et reprend vos mentions obligatoires, dont « TVA non applicable, article 293 B du CGI ». Avec Qonforme, vous enregistrez cette mention une fois et elle figure ensuite sur chaque facture." },
      { question: "Comment gérer la TVA quand on dépasse les seuils ?", reponse: "Lorsque vous dépassez le seuil majoré (41 250 € pour les services ou 93 500 € pour la vente), la TVA s'applique aux opérations réalisées à partir de la date du dépassement. Si vous dépassez seulement le seuil de base (37 500 € ou 85 000 €), elle s'applique au 1er janvier suivant. Vous devez alors demander un numéro de TVA intracommunautaire auprès de votre SIE, facturer la TVA à vos clients et déposer des déclarations de TVA (CA12 ou CA3)." },
      { question: "Faut-il un compte bancaire dédié pour facturer ?", reponse: "Depuis la loi PACTE de 2019, un compte bancaire dédié est obligatoire uniquement si votre chiffre d'affaires dépasse 10 000 € pendant deux années consécutives. En dessous de ce seuil, vous pouvez utiliser votre compte personnel, mais un compte dédié reste recommandé pour simplifier votre comptabilité." },
    ],
  },
  {
    slug: "delai-paiement-facture",
    titre: "Délais de paiement des factures : règles et pénalités 2026",
    description: "Tout savoir sur les délais de paiement légaux entre professionnels : 30 jours, 45 jours fin de mois, pénalités de retard, indemnité de recouvrement.",
    motsCles: ["delai paiement facture", "penalites retard facture", "indemnite recouvrement"],
    sections: [
      { titre: "Le délai légal de paiement", contenu: "Entre professionnels, le délai de paiement est fixé au 30e jour suivant la réception des marchandises ou l'exécution de la prestation. Les parties peuvent convenir d'un délai différent, sans dépasser 60 jours à compter de la date d'émission de la facture, ou 45 jours fin de mois." },
      { titre: "Les pénalités de retard", contenu: "Les pénalités de retard sont dues de plein droit, sans qu'un rappel soit nécessaire. Le taux prévu dans vos conditions ne peut pas être inférieur à 3 fois le taux d'intérêt légal en vigueur ; à défaut de taux prévu, c'est le taux de refinancement de la BCE majoré de 10 points (article L441-10 du Code de commerce). Le taux doit être mentionné sur la facture." },
      { titre: "L'indemnité forfaitaire de recouvrement", contenu: "En plus des pénalités de retard, le créancier peut réclamer une indemnité forfaitaire de 40 € pour frais de recouvrement. Cette indemnité est due pour chaque facture payée en retard. Si les frais réels de recouvrement dépassent 40 €, le créancier peut demander une indemnisation complémentaire." },
      { titre: "Cas particuliers", contenu: "Certains secteurs ont des délais spécifiques : 30 jours pour le transport, 20 jours pour les produits alimentaires périssables, 30 jours fin de décade pour le bétail. Les collectivités publiques ont un délai de 30 jours." },
    ],
    faq: [
      { question: "Peut-on accorder un délai de paiement de 90 jours ?", reponse: "Non, le délai maximum entre professionnels est de 60 jours date de facture ou 45 jours fin de mois. Tout accord dépassant ces limites est nul et expose l'entreprise à une amende administrative pouvant atteindre 2 millions d'euros." },
      { question: "Les pénalités de retard sont-elles automatiques ?", reponse: "Oui, les pénalités de retard sont exigibles de plein droit, le jour suivant la date de paiement figurant sur la facture, sans qu'un rappel soit nécessaire. Cependant, dans la pratique, il est recommandé d'envoyer une relance avant d'appliquer les pénalités." },
      { question: "Comment calculer les pénalités de retard ?", reponse: "Les pénalités se calculent avec la formule : montant TTC × (taux annuel / 365) × nombre de jours de retard. Le taux minimum légal est de 3 fois le taux d'intérêt légal (article L441-10 du Code de commerce). Par exemple, avec un taux de 12 % et 30 jours de retard sur 1 000 €, les pénalités s'élèvent à 9,86 €." },
      { question: "Que faire si un client ne paie pas ?", reponse: "Commencez par envoyer une relance amiable, puis une mise en demeure par lettre recommandée avec accusé de réception. Si le client ne répond pas, vous pouvez engager une procédure d'injonction de payer auprès du tribunal compétent (article 1405 du CPC). L'indemnité forfaitaire de 40 € et les pénalités de retard sont dues en plus du principal." },
      { question: "Les pénalités de retard sont-elles soumises à la TVA ?", reponse: "Non, les pénalités de retard ne sont pas soumises à la TVA car elles constituent des dommages et intérêts, et non la contrepartie d'une prestation. Elles doivent cependant être déclarées en tant que produits financiers dans votre comptabilité et figurer sur une note de débit distincte de la facture initiale." },
    ],
  },
  {
    slug: "tva-autoliquidation-sous-traitance",
    titre: "TVA autoliquidation sous-traitance BTP : guide pratique",
    description: "Comment fonctionne l'autoliquidation de la TVA en sous-traitance BTP ? Obligations, mentions sur la facture, déclaration. Guide complet 2026.",
    motsCles: ["autoliquidation tva", "sous traitance btp tva", "facture autoliquidation"],
    sections: [
      { titre: "Le principe de l'autoliquidation", contenu: "Depuis le 1er janvier 2014, le sous-traitant BTP ne facture plus la TVA à l'entrepreneur principal. C'est l'entrepreneur principal qui auto-liquide la TVA, c'est-à-dire qu'il la déclare et la déduit simultanément. Le sous-traitant facture uniquement le montant HT." },
      { titre: "Qui est concerné ?", contenu: "L'autoliquidation s'applique à tous les travaux immobiliers réalisés en sous-traitance : gros œuvre, second œuvre, installations électriques, plomberie, peinture, etc. Elle concerne uniquement les relations entre l'entrepreneur principal et le sous-traitant, pas les relations avec le client final." },
      { titre: "Les mentions obligatoires sur la facture", contenu: "La facture du sous-traitant doit porter la mention « Autoliquidation » et ne comporter aucun montant de TVA. Le montant facturé est exclusivement HT. Le numéro de TVA intracommunautaire des deux parties doit figurer sur la facture." },
      { titre: "Déclaration de TVA", contenu: "L'entrepreneur principal déclare la TVA autoliquidée sur la ligne « Autres opérations imposables » de sa déclaration CA3 (ligne 02 ou 2B). Il déduit simultanément cette TVA sur la ligne « TVA déductible sur autres biens et services ». L'opération est donc neutre pour lui." },
    ],
    faq: [
      { question: "Le sous-traitant peut-il quand même déduire sa TVA ?", reponse: "Oui, le sous-traitant conserve son droit à déduction de la TVA sur ses achats et charges, même s'il ne facture plus la TVA à l'entrepreneur principal. Il continue de déposer des déclarations de TVA normalement." },
      { question: "L'autoliquidation s'applique-t-elle aux auto-entrepreneurs ?", reponse: "Les auto-entrepreneurs en franchise de TVA ne sont pas concernés par l'autoliquidation puisqu'ils ne facturent déjà pas la TVA. Si un auto-entrepreneur dépasse les seuils de franchise, il devient assujetti et doit alors appliquer l'autoliquidation en sous-traitance BTP." },
      { question: "Que se passe-t-il si le sous-traitant facture par erreur la TVA ?", reponse: "Si le sous-traitant facture la TVA par erreur, il reste redevable de cette TVA auprès du Trésor Public (article 283-3 du CGI). L'entrepreneur principal ne pourra pas la déduire, car l'autoliquidation aurait dû s'appliquer. Il faut alors émettre un avoir et refacturer sans TVA avec la mention « Autoliquidation »." },
      { question: "L'autoliquidation concerne-t-elle la fourniture de matériaux ?", reponse: "L'autoliquidation s'applique uniquement aux travaux immobiliers, c'est-à-dire aux prestations de services. La fourniture de matériaux seule, sans pose, n'est pas concernée par le mécanisme d'autoliquidation. En revanche, si la fourniture est accessoire à la prestation de pose, l'ensemble est soumis à l'autoliquidation." },
      { question: "Comment mentionner l'autoliquidation dans sa comptabilité ?", reponse: "Le sous-traitant enregistre sa facture HT en chiffre d'affaires sans TVA collectée. L'entrepreneur principal comptabilise la TVA autoliquidée au débit du compte 4456 (TVA déductible) et au crédit du compte 4457 (TVA collectée), rendant l'opération neutre sur sa trésorerie. La déclaration CA3 doit refléter ces écritures." },
    ],
  },
  {
    slug: "facture-electronique-2026",
    // Les artisans (TPE, micro) émettent en 2027 : le titre vise aussi cette échéance
    titre: "Facture électronique obligatoire : ce qui change en 2026 et 2027",
    titreSeo: "Facture électronique obligatoire : calendrier 2026-2027",
    description: "Réforme de la facturation électronique : calendrier, formats acceptés (Factur-X, UBL, CII), plateformes agréées et obligations selon votre entreprise.",
    motsCles: ["facture electronique 2026", "facture electronique obligatoire", "factur-x"],
    sections: [
      { titre: "Le calendrier de la réforme", contenu: "Depuis le 1er septembre 2026, toutes les entreprises assujetties à la TVA doivent pouvoir recevoir des factures électroniques (obligation de réception). L'obligation d'émettre est progressive : depuis le 1er septembre 2026 pour les grandes entreprises et les ETI, à partir du 1er septembre 2027 pour les PME et les micro-entreprises." },
      { titre: "Les formats acceptés", contenu: "Trois formats sont acceptés : Factur-X (PDF hybride avec données XML intégrées, norme EN 16931), UBL (Universal Business Language, format XML pur) et CII (Cross Industry Invoice, format XML). Factur-X est le plus accessible, car la facture reste un PDF lisible. Qonforme joint un fichier XML Factur-X au PDF de vos factures." },
      { titre: "Le rôle des plateformes agréées", contenu: "Les plateformes agréées (anciennement appelées PDP, plateformes de dématérialisation partenaires) sont des intermédiaires agréés par l'administration fiscale pour transmettre les factures électroniques et les données de facturation (e-reporting). Chaque entreprise doit en choisir une : le Portail public de facturation (PPF) ne transmet pas les factures entre entreprises, il tient l'annuaire et centralise les données destinées à l'administration." },
      { titre: "Le e-reporting", contenu: "En plus de la facturation électronique B2B, les entreprises doivent transmettre les données de leurs transactions B2C et internationales (e-reporting). Ces données sont transmises à l'administration fiscale par la plateforme agréée de l'entreprise, selon le même calendrier que la facturation électronique." },
    ],
    faq: [
      { question: "Les auto-entrepreneurs sont-ils concernés ?", reponse: "Oui, tous les assujettis à la TVA sont concernés, y compris les auto-entrepreneurs en franchise de TVA. Ils doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026 et devront en émettre à partir du 1er septembre 2027." },
      { question: "Quel format choisir pour ses factures électroniques ?", reponse: "Le format Factur-X est recommandé pour les TPE et PME : il combine un PDF lisible par l'humain et des données XML exploitables par les logiciels. C'est le format le plus simple à adopter car vos clients peuvent toujours lire le PDF normalement." },
      { question: "Qu'est-ce qu'une PDP (Plateforme de Dématérialisation Partenaire) ?", reponse: "PDP est l'ancien nom des plateformes agréées : des opérateurs privés agréés par l'administration fiscale pour transmettre les factures électroniques entre entreprises et effectuer le e-reporting auprès de la DGFiP. Elles assurent la conversion des formats, le routage des factures et la transmission des données fiscales. La liste des plateformes agréées est publiée par l'administration fiscale." },
      { question: "Une facture PDF envoyée par email est-elle une facture électronique ?", reponse: "Non, un simple PDF envoyé par email n'est pas considéré comme une facture électronique au sens de la réforme 2026. Une facture électronique doit être émise dans un format structuré (Factur-X, UBL ou CII) et transmise par une plateforme agréée. Le PDF classique ne contient pas les données structurées exigées par la norme EN 16931." },
      { question: "Quelles sanctions en cas de non-conformité ?", reponse: "Le non-respect de l'obligation de facturation électronique est sanctionné par une amende de 15 € par facture non conforme, plafonnée à 15 000 € par an (article 1737-II du CGI). Le défaut de e-reporting est sanctionné par une amende de 250 € par transmission manquante, plafonnée à 15 000 € par an." },
    ],
    liens: [
      { href: "/guide/plateforme-agreee", label: "Choisir sa plateforme agréée" },
      { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
      { href: "/glossaire/e-reporting", label: "E-reporting" },
      { href: "/glossaire/factur-x", label: "Factur-X" },
    ],
  },
  {
    slug: "plateforme-agreee",
    titre: "Plateforme agréée : à quoi elle sert et comment la choisir",
    titreSeo: "Plateforme agréée de facturation électronique : le guide",
    description: "Plateforme agréée (ex-PDP) : son rôle dans la facture électronique, le calendrier 2026-2027, comment la choisir et ce qu'elle change pour un artisan.",
    motsCles: ["plateforme agréée", "plateforme agréée facturation électronique", "pdp facture électronique", "liste des plateformes agréées", "choisir sa plateforme agréée", "plateforme agréée gratuite"],
    essentiel: [
      "Une plateforme agréée est un prestataire immatriculé par la DGFiP pour échanger les factures électroniques entre entreprises et transmettre les données de facturation à l'administration.",
      "C'est le nouveau nom des « PDP » (plateformes de dématérialisation partenaires).",
      "Depuis le 1er septembre 2026, toute entreprise assujettie à la TVA doit pouvoir recevoir ses factures électroniques.",
      "Les PME, les TPE et les micro-entreprises émettent les leurs à partir du 1er septembre 2027.",
      "Votre logiciel de facturation peut rester le même : s'il est « solution compatible », il se raccorde à une plateforme agréée, qui fait la transmission.",
      "La liste officielle des plateformes agréées est publiée par la DGFiP sur impots.gouv.fr.",
    ],
    sections: [
      {
        titre: "Ce qu'est une plateforme agréée",
        contenu: "Une plateforme agréée est une solution informatique immatriculée par la Direction générale des Finances publiques (DGFiP). Elle répond à un cahier des charges réglementaire, fiscal et technique, et a passé des tests d'interopérabilité avec les autres plateformes. C'est l'intermédiaire indispensable entre les entreprises pour l'échange des factures électroniques. Elle reçoit aussi les données de transaction et de paiement de ses clients, et les transmet périodiquement à l'administration. On parlait auparavant de « plateforme de dématérialisation partenaire » (PDP).",
      },
      {
        titre: "Plateforme agréée, solution compatible, PPF : qui fait quoi",
        contenu: "Trois acteurs se partagent le dispositif. Seule la plateforme agréée transmet les factures et les données.",
        liste: [
          "La plateforme agréée échange les factures entre entreprises et envoie les données à l'administration. Elle porte le logo « Plateforme agréée – Facturation électronique ».",
          "La solution compatible (logiciel de facturation, de comptabilité, de caisse, application bancaire…) produit des factures conformes, mais n'est pas immatriculée : elle ne transmet rien seule et doit être raccordée à une plateforme agréée. Elle porte le label « Solution compatible – Facturation électronique ».",
          "Le portail public de facturation (PPF), géré par l'État, tient l'annuaire des entreprises et centralise les données destinées à l'administration. Il ne transmet pas les factures entre entreprises.",
        ],
      },
      {
        titre: "Le calendrier",
        contenu: "Les dates sont fixées par la loi de finances pour 2024 (article 91). Les micro-entrepreneurs en franchise de TVA sont concernés : ils restent assujettis à la TVA, même s'ils ne la facturent pas.",
        liste: [
          "1er septembre 2026 : toutes les entreprises assujetties à la TVA doivent pouvoir recevoir des factures électroniques. Les grandes entreprises et les ETI doivent aussi les émettre.",
          "1er septembre 2027 : les PME, les TPE et les micro-entreprises émettent à leur tour leurs factures électroniques et transmettent les données de leurs ventes aux particuliers (e-reporting).",
        ],
      },
      {
        titre: "Ce que la plateforme change pour un artisan",
        contenu: "Entre entreprises établies en France, une facture ne partira plus en simple PDF par email : elle sera émise dans un format structuré (Factur-X, UBL ou CII) et transmise par votre plateforme agréée à celle de votre client. C'est le cas d'un sous-traitant qui facture l'entreprise principale. Pour vos clients particuliers, vous remettez la facture comme aujourd'hui ; votre plateforme transmet seulement les données de la vente à l'administration. Vos devis ne sont pas concernés : un devis, même signé, n'est pas une facture.",
      },
      {
        titre: "Comment choisir sa plateforme",
        contenu: "Vérifiez d'abord qu'elle figure dans la liste officielle publiée par la DGFiP sur impots.gouv.fr. Si vous utilisez déjà un logiciel, demandez à son éditeur à quelle plateforme il est raccordé : c'est le premier conseil de l'administration. Comparez ensuite les offres sur ces points :",
        liste: [
          "Ce qui est inclus : réception, émission, e-reporting, suivi des statuts des factures, archivage.",
          "Le raccordement à votre logiciel de facturation : vos factures doivent y arriver sans ressaisie.",
          "Le prix : les tarifs sont libres, au nombre de factures ou au forfait.",
          "Les formats acceptés (Factur-X, UBL, CII) et la récupération de vos factures si vous changez de plateforme.",
          "L'assistance proposée et le lieu d'hébergement de vos données.",
        ],
      },
      {
        titre: "Et avec Qonforme ?",
        contenu: "Qonforme produit déjà vos factures au format Factur-X : un PDF lisible qui contient les données structurées de la facture. Le raccordement de Qonforme à une plateforme agréée est en préparation, et Qonforme n'est pas encore « solution compatible ». D'ici là, choisissez votre plateforme agréée pour recevoir vos factures fournisseurs : cette obligation s'applique depuis le 1er septembre 2026.",
      },
    ],
    faq: [
      { question: "Quelle différence entre une plateforme agréée et une PDP ?", reponse: "Aucune : « plateforme agréée » est le nouveau nom des plateformes de dématérialisation partenaires (PDP). C'est désormais le terme officiel." },
      { question: "Une plateforme agréée est-elle obligatoire ?", reponse: "Oui. Pour recevoir puis émettre des factures électroniques, chaque entreprise passe par une plateforme agréée, directement ou par un logiciel « solution compatible » raccordé à l'une d'elles. Le portail public de facturation ne transmet pas les factures entre entreprises." },
      { question: "Existe-t-il une plateforme agréée gratuite ?", reponse: "Les prix sont libres et varient d'une plateforme à l'autre ; des offres gratuites existent, souvent limitées en volume ou en services. Comparez ce qui est inclus (réception, émission, e-reporting, archivage) plutôt que le seul prix." },
      { question: "Un micro-entrepreneur doit-il choisir une plateforme agréée ?", reponse: "Oui. Depuis le 1er septembre 2026, il doit pouvoir recevoir des factures électroniques, et il émettra les siennes à partir du 1er septembre 2027, même en franchise de TVA." },
      { question: "Où trouver la liste des plateformes agréées ?", reponse: "Sur impots.gouv.fr, dans l'espace professionnel : « Gérer mon entreprise/association », puis « Je passe à la facturation électronique » et « Je consulte la liste des plateformes agréées ». La DGFiP la met à jour au fil des immatriculations." },
      { question: "Mes devis doivent-ils passer par une plateforme agréée ?", reponse: "Non. La réforme vise les factures. Un devis, même signé, n'est pas une facture : vous continuez à l'envoyer comme aujourd'hui." },
    ],
    liens: [
      { href: "/guide/facture-electronique-2026", label: "Calendrier de la facture électronique" },
      { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
      { href: "/glossaire/ppf", label: "Portail public de facturation (PPF)" },
      { href: "/glossaire/e-reporting", label: "E-reporting" },
      { href: "/glossaire/factur-x", label: "Factur-X" },
    ],
    sources: [
      { label: "DGFiP, « Présentation de la marque Plateforme agréée et du label Solution compatible » (septembre 2025)", href: "https://www.impots.gouv.fr/presentation-des-logos-plateforme-agreee-et-solution-compatible" },
      { label: "impots.gouv.fr, « Facturation électronique : publication de la liste des plateformes agréées » (16 janvier 2026)", href: "https://www.impots.gouv.fr/actualite/facturation-electronique-publication-de-la-liste-des-plateformes-agreees" },
      { label: "Service-public.gouv.fr, « Mentions obligatoires sur une facture » (fiche F31808), calendrier de la facturation électronique", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31808" },
      { label: "Loi n° 2023-1322 du 29 décembre 2023 de finances pour 2024, article 91" },
    ],
    verifieLe: "2026-10-04",
  },
  {
    slug: "devis-obligatoire",
    titre: "Devis obligatoire : dans quels cas et ce qu'il engage",
    titreSeo: "Devis obligatoire : dans quels cas pour un artisan ?",
    description: "Quand le devis est-il obligatoire pour un artisan ? Dépannage et travaux chez un particulier, autres secteurs, valeur du devis signé et sanctions.",
    motsCles: ["devis obligatoire", "devis obligatoire artisan", "devis obligatoire montant", "devis travaux obligatoire"],
    sections: [
      { titre: "Dans le bâtiment, chez un particulier : toujours", contenu: "Pour les travaux de dépannage, de réparation ou d'entretien dans le bâtiment et l'équipement de la maison (maçonnerie, plomberie, électricité, menuiserie, couverture, peinture, remplacement ou ajout de pièces ou d'appareils…), un devis détaillé est obligatoire avant l'intervention, quel qu'en soit le montant. L'arrêté du 24 janvier 2017, en vigueur depuis le 1er avril 2017, a supprimé l'ancien seuil de 150 € TTC." },
      { titre: "Les autres cas", contenu: "Le devis est aussi obligatoire dans d'autres secteurs : déménagement, services à la personne, optique et audioprothèse, prestations funéraires, entre autres. Entre professionnels, aucun texte général ne l'impose, mais c'est la pièce qui fixe le prix et les travaux : établissez-le systématiquement." },
      { titre: "Ce que doit contenir le devis", contenu: "Date, identité de l'entreprise et du client, lieu des travaux, nature exacte des travaux, décompte détaillé en quantité et en prix, taux horaire de la main-d'œuvre, frais de déplacement, totaux HT et TTC avec le taux de TVA, durée de validité et caractère gratuit ou payant du devis. La liste complète, avec les mentions propres au bâtiment, est dans notre guide des mentions obligatoires d'un devis." },
      { titre: "La valeur du devis signé", contenu: "Signé par le client, précédé de « Bon pour accord » ou « Bon pour travaux », le devis vaut contrat : il vous engage sur le prix et les travaux décrits, et engage le client à les payer. Une modification en cours de chantier se règle par un avenant ou un nouveau devis signé." },
      { titre: "Ce que coûte un devis manquant", contenu: "Ne pas remettre de devis là où il est obligatoire expose à une amende administrative pouvant atteindre 3 000 € pour une personne physique et 15 000 € pour une société." },
    ],
    faq: [
      { question: "Un devis est-il obligatoire pour moins de 150 € ?", reponse: "Pour un dépannage, une réparation ou un entretien chez un particulier dans le bâtiment, oui : depuis le 1er avril 2017, le devis détaillé est dû quel que soit le montant (arrêté du 24 janvier 2017)." },
      { question: "Un devis peut-il être payant ?", reponse: "Oui, à condition d'en informer le client avant de l'établir ; le devis indique alors qu'il est payant et son prix. Beaucoup d'artisans en déduisent le montant de la facture si les travaux sont commandés." },
      { question: "Quelle différence entre un devis et une facture ?", reponse: "Le devis est une proposition de prix établie avant les travaux ; signé, il vaut contrat. La facture constate la vente une fois les travaux faits : elle est numérotée, obligatoire entre professionnels et soumise à ses propres mentions." },
      { question: "Le client peut-il annuler un devis signé ?", reponse: "Un devis signé vaut contrat : le client ne peut pas l'annuler seul sans conséquences. Toutefois, un particulier dispose de 14 jours pour se rétracter quand le devis a été signé chez lui (hors établissement) ou à distance (code de la consommation, art. L221-18)." },
      { question: "Faut-il numéroter les devis ?", reponse: "Ce n'est pas exigé par la loi, contrairement aux factures. Un numéro permet toutefois de relier le devis à sa facture et de suivre vos relances (par exemple D-2026-001)." },
      { question: "Que risque un artisan sans assurance décennale ?", reponse: "Travailler sans l'assurance décennale obligatoire est puni de six mois d'emprisonnement et de 75 000 € d'amende. L'attestation d'assurance doit en outre être jointe aux devis et aux factures (code des assurances, art. L243-2)." },
    ],
    liens: [
      { href: "/guide/mentions-obligatoires-devis", label: "Mentions obligatoires d'un devis" },
      { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
      { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
      { href: "/guide/difference-devis-facture", label: "Devis ou facture ?" },
    ],
    sources: [
      { label: "Service-public.gouv.fr, « Devis obligatoire : activités concernées » (fiche F31144)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31144" },
      { label: "Arrêté du 24 janvier 2017 relatif à la publicité des prix des prestations de dépannage, de réparation et d'entretien dans le secteur du bâtiment et de l'équipement de la maison" },
      { label: "Code de la consommation, article L221-18 (délai de rétractation)" },
      { label: "Code des assurances, articles L243-2 (attestation jointe aux devis) et L243-3 (défaut d'assurance décennale)" },
    ],
    verifieLe: "2026-10-04",
  },
  {
    slug: "mentions-obligatoires-devis",
    titre: "Mentions obligatoires d'un devis : la liste pour les artisans",
    titreSeo: "Mentions obligatoires d'un devis : la liste complète 2026",
    description: "Les mentions obligatoires d'un devis de travaux en 2026 : identité, détail des prix, TVA, validité, assurance décennale, signature et sanctions.",
    motsCles: ["mentions obligatoires devis", "mentions obligatoires devis artisan", "que doit contenir un devis", "devis conforme", "devis travaux mentions"],
    essentiel: [
      "La date du devis et sa durée de validité.",
      "Votre identité : nom ou dénomination, adresse, SIREN, et la mention « EI » si vous êtes entrepreneur individuel.",
      "Le nom et l'adresse du client, et le lieu des travaux.",
      "La nature exacte des travaux, avec le décompte en quantité et en prix de chaque prestation et de chaque fourniture.",
      "Le taux horaire de la main-d'œuvre TTC et les frais de déplacement, s'il y en a.",
      "La somme globale HT et TTC, avec le taux de TVA.",
      "Le caractère gratuit ou payant du devis.",
      "Votre assurance professionnelle (assureur, contrat, couverture géographique), avec l'attestation pour la décennale.",
      "Chez un particulier : la date ou le délai d'exécution des travaux.",
      "Construction, rénovation ou démolition : la gestion des déchets du chantier, les points de collecte et leur coût estimé.",
      "La signature du client, précédée de « Bon pour accord » ou « Bon pour travaux ».",
    ],
    sections: [
      {
        titre: "Quand le devis est obligatoire",
        contenu: "Pour les travaux de dépannage, de réparation ou d'entretien dans le bâtiment et l'équipement de la maison chez un particulier, un devis détaillé est obligatoire avant l'intervention, quel qu'en soit le montant : l'arrêté du 24 janvier 2017, en vigueur depuis le 1er avril 2017, a supprimé l'ancien seuil de 150 €. Pour tous vos autres chantiers, le devis reste la pièce qui fixe le prix et les travaux, et que la facture reprendra.",
      },
      {
        titre: "L'identité des parties",
        contenu: "Le devis doit permettre d'identifier sans ambiguïté qui s'engage envers qui.",
        liste: [
          "La date du devis.",
          "Votre nom ou votre dénomination, votre adresse et votre numéro SIREN.",
          "Entrepreneur individuel : la mention « entrepreneur individuel » ou « EI » à côté de votre nom ; société : forme juridique, capital, et « RCS » suivi de la ville du greffe s'il y a lieu.",
          "Le nom et l'adresse du client.",
          "Le lieu d'exécution des travaux.",
        ],
      },
      {
        titre: "La nature des travaux et le détail des prix",
        contenu: "Le devis décrit la nature exacte des travaux et les chiffre ligne par ligne : le client compare, et la facture reprendra les mêmes postes.",
        liste: [
          "La désignation de chaque prestation et de chaque fourniture.",
          "La quantité, l'unité (heure, m², mètre linéaire, forfait) et le prix unitaire.",
          "Le taux horaire de la main-d'œuvre TTC et la façon de décompter le temps.",
          "Les frais de déplacement, s'il y en a.",
          "La somme globale à payer, hors taxes et toutes taxes comprises, avec le taux de TVA de chaque ligne (20 %, 10 % ou 5,5 %).",
        ],
      },
      {
        titre: "Validité, prix du devis et délai des travaux",
        contenu: "Ces mentions évitent la plupart des litiges sur le prix et le calendrier.",
        liste: [
          "La durée de validité de l'offre. Aucune durée légale n'existe : c'est à vous de l'écrire (un à trois mois est courant).",
          "Le caractère gratuit ou payant du devis, et son prix s'il est payant. Prévenez le client avant de l'établir.",
          "Pour un particulier : la date ou le délai dans lequel vous vous engagez à réaliser les travaux (code de la consommation, art. L111-1).",
          "Les conditions de paiement prévues : acompte à la commande, échéances, solde.",
        ],
      },
      {
        titre: "Les mentions propres au bâtiment",
        contenu: "Un artisan dont l'activité exige une assurance l'indique sur ses devis comme sur ses factures (code de l'artisanat, art. L132-1).",
        liste: [
          "L'assurance souscrite, les coordonnées de l'assureur ou du garant, les références du contrat et sa couverture géographique.",
          "Pour la garantie décennale : l'attestation d'assurance jointe au devis (code des assurances, art. L243-2).",
          "Taux réduit de 10 % ou 5,5 % chez un particulier : depuis le 1er mars 2025, le client certifie sur le devis ou la facture que le logement est achevé depuis plus de deux ans et que les travaux ne sont pas exclus du taux réduit.",
          "Sous-traitance : un prix hors taxes, la TVA étant autoliquidée par l'entreprise principale ; la facture portera la mention « Autoliquidation ».",
          "Travaux de construction, de rénovation ou de démolition (depuis le 1er juillet 2021) : la quantité de déchets estimée, leur tri et leur enlèvement, le ou les points de collecte prévus (nom, adresse, type d'installation) et le coût estimé de cette gestion (code de l'environnement, art. L541-21-2-3 et D541-45-1).",
        ],
      },
      {
        titre: "La signature et ce qu'elle engage",
        contenu: "Le client signe le devis en le faisant précéder de « Bon pour accord » ou « Bon pour travaux ». Le devis vaut alors contrat : vous êtes tenu par le prix et les travaux décrits, le client par le paiement. Une modification en cours de chantier se règle par un avenant ou un nouveau devis signé. Signé chez le client ou à distance, le devis d'un particulier lui ouvre un délai de rétractation de 14 jours (code de la consommation, art. L221-18) : remettez-lui le formulaire de rétractation, et ne commencez avant la fin du délai qu'à sa demande expresse.",
      },
      {
        titre: "Ce que coûte un devis manquant",
        contenu: "Ne pas remettre de devis là où il est obligatoire expose à une amende administrative pouvant atteindre 3 000 € pour une personne physique et 15 000 € pour une société. Un devis incomplet affaiblit aussi votre position en cas de litige sur le prix ou les travaux.",
      },
    ],
    faq: [
      { question: "Quelles sont les mentions obligatoires d'un devis ?", reponse: "La date, l'identité de l'entreprise et du client, le lieu des travaux, la nature exacte des travaux, le décompte en quantité et en prix de chaque prestation, le taux horaire de main-d'œuvre, les frais de déplacement, les totaux HT et TTC avec le taux de TVA, la durée de validité et le caractère gratuit ou payant du devis. Un artisan y ajoute son assurance professionnelle et, pour un chantier de construction, de rénovation ou de démolition, la gestion des déchets." },
      { question: "Un devis est-il obligatoire en dessous de 150 € ?", reponse: "Pour un dépannage, une réparation ou un entretien chez un particulier dans le bâtiment, oui : depuis le 1er avril 2017, le devis détaillé est dû quel que soit le montant (arrêté du 24 janvier 2017)." },
      { question: "Combien de temps un devis est-il valable ?", reponse: "La durée que vous y indiquez : la loi n'en fixe aucune. Sans durée écrite, le devis reste valable un délai raisonnable, ce qui ouvre la porte aux litiges. Écrivez-la toujours." },
      { question: "Faut-il mettre son numéro SIRET sur un devis ?", reponse: "Indiquez votre numéro SIREN ou SIRET et, pour un entrepreneur individuel, la mention « EI » à côté du nom. Ce sont les mêmes informations d'identification que sur vos factures." },
      { question: "Un devis signé par email ou en ligne est-il valable ?", reponse: "Oui : une signature électronique a la même valeur qu'une signature manuscrite si elle permet d'identifier le signataire et de garantir le lien avec le document (code civil, art. 1366 et 1367)." },
      { question: "Faut-il numéroter ses devis ?", reponse: "Ce n'est pas exigé par la loi, contrairement aux factures. Un numéro relie toutefois le devis à sa facture et facilite le suivi de vos relances." },
    ],
    liens: [
      { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
      { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
      { href: "/guide/devis-obligatoire", label: "Quand le devis est obligatoire" },
      { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
      { href: "/devenir-a-son-compte", label: "S'installer à son compte" },
    ],
    sources: [
      { label: "Service-public.gouv.fr, « Devis obligatoire : activités concernées » (fiche F31144)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31144" },
      { label: "Arrêté du 24 janvier 2017 relatif à la publicité des prix des prestations de dépannage, de réparation et d'entretien dans le secteur du bâtiment et de l'équipement de la maison" },
      { label: "Code de la consommation, articles L111-1 (information du client) et L221-18 (délai de rétractation)" },
      { label: "Code de l'artisanat, article L132-1 (assurance de l'artisan)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294" },
      { label: "Code des assurances, article L243-2 (attestation de garantie décennale)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272" },
      { label: "Code général des impôts, article 279-0 bis (taux réduit des travaux, certification par le client)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051215062" },
      { label: "Code de l'environnement, article L541-21-2-3 (déchets mentionnés sur les devis de travaux)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041570415" },
      { label: "Décret n° 2020-1817 du 29 décembre 2020 (informations des devis sur l'enlèvement et la gestion des déchets)", href: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000042841880" },
    ],
    verifieLe: "2026-10-04",
  },
  {
    slug: "facture-acompte",
    titre: "Facture d'acompte : règles, modèle et bonnes pratiques",
    description: "Comment faire une facture d'acompte conforme ? Montant, TVA, numérotation, facture de solde. Guide complet pour artisans et TPE.",
    motsCles: ["facture acompte", "acompte facture", "facture de solde"],
    sections: [
      { titre: "Qu'est-ce qu'une facture d'acompte ?", contenu: "Une facture d'acompte est un document comptable émis lors du versement d'un paiement partiel avant la livraison complète d'un bien ou d'une prestation. Elle est obligatoire dès qu'un acompte est encaissé et doit respecter les mêmes mentions que toute facture." },
      { titre: "Montant et calcul de l'acompte", contenu: "L'acompte est généralement un pourcentage du devis (30% à la commande est courant dans le BTP). La TVA doit être calculée et mentionnée sur la facture d'acompte. L'acompte fait partie de la séquence chronologique de numérotation des factures." },
      { titre: "La facture de solde", contenu: "À la fin des travaux, une facture de solde est émise pour le montant restant. Elle doit mentionner le montant total de la prestation, les acomptes déjà versés (avec références des factures d'acompte), et le solde restant dû." },
    ],
    faq: [
      { question: "Faut-il facturer la TVA sur un acompte ?", reponse: "Oui, la TVA est exigible sur l'acompte pour les prestations de services (au moment de l'encaissement). Pour les livraisons de biens, la TVA devient exigible à la livraison, mais elle doit quand même figurer sur la facture d'acompte." },
      { question: "Comment numéroter une facture d'acompte ?", reponse: "La facture d'acompte suit la même séquence chronologique que les autres factures. Elle porte un numéro unique dans la continuité de votre numérotation (ex : F-2026-042). Ne créez pas de séquence séparée pour les acomptes." },
      { question: "Quel pourcentage d'acompte demander ?", reponse: "Il n'existe pas de règle légale imposant un pourcentage précis. Dans la pratique, 30 % à la commande est courant dans le BTP et les services. Pour les commandes importantes, vous pouvez échelonner : 30 % à la commande, 40 % en cours de réalisation et 30 % à la livraison. Le montant doit être défini dans le devis signé." },
      { question: "Peut-on facturer un acompte sans devis signé ?", reponse: "Juridiquement, rien n'interdit de facturer un acompte sans devis signé, mais c'est fortement déconseillé. Le devis signé constitue la preuve de l'accord du client sur le prix et les prestations. Sans devis, en cas de litige, il sera difficile de prouver l'étendue des engagements réciproques." },
      { question: "Comment gérer un acompte non encaissé ?", reponse: "Si le client ne verse pas l'acompte prévu, vous pouvez suspendre le démarrage des travaux conformément aux conditions du devis signé. La facture d'acompte émise reste valide et constitue une créance. Envoyez une relance écrite, puis une mise en demeure si nécessaire, avant d'envisager l'annulation du contrat." },
    ],
  },
  {
    slug: "avoir-facture",
    titre: "Avoir (note de crédit) : quand et comment l'émettre",
    description: "Guide complet sur l'avoir : annulation de facture, remboursement, erreur de facturation. Mentions obligatoires, TVA, comptabilisation.",
    motsCles: ["avoir facture", "note de credit", "annuler une facture"],
    sections: [
      { titre: "Qu'est-ce qu'un avoir ?", contenu: "Un avoir (ou note de crédit) est un document comptable qui annule ou corrige partiellement une facture émise. Il est utilisé en cas de retour de marchandise, d'erreur de facturation, de remise commerciale accordée après facturation, ou d'annulation de prestation." },
      { titre: "Quand émettre un avoir ?", contenu: "L'avoir est obligatoire dans les cas suivants : annulation totale ou partielle d'une facture, retour de marchandise, erreur de prix ou de quantité, remise ou rabais accordé après facturation. Il est interdit de modifier ou supprimer une facture émise : seul un avoir peut la corriger." },
      { titre: "Mentions obligatoires de l'avoir", contenu: "L'avoir doit comporter les mêmes mentions qu'une facture, plus : la référence de la facture d'origine, la mention « Avoir » ou « Note de crédit », le motif (retour, erreur, remise), les montants négatifs (HT, TVA, TTC)." },
    ],
    faq: [
      { question: "Peut-on supprimer une facture au lieu de faire un avoir ?", reponse: "Non, il est strictement interdit de supprimer une facture émise. La numérotation doit rester continue et chronologique. Pour annuler une facture, vous devez émettre un avoir pour son montant total." },
      { question: "Comment comptabiliser un avoir ?", reponse: "L'avoir est comptabilisé en sens inverse de la facture d'origine : il vient diminuer le chiffre d'affaires et la TVA collectée. Il doit être enregistré dans le journal des ventes avec un montant négatif." },
      { question: "Un avoir doit-il être numéroté ?", reponse: "Oui, un avoir doit obligatoirement porter un numéro unique et chronologique, au même titre qu'une facture (article 242 nonies A de l'annexe II du CGI). Vous pouvez utiliser la même séquence que vos factures ou une séquence dédiée avec un préfixe distinct (ex : AV-2026-001), tant que la continuité est respectée." },
      { question: "Peut-on faire un avoir partiel ?", reponse: "Oui, un avoir partiel est tout à fait possible et courant. Il permet de corriger une partie seulement de la facture d'origine, par exemple en cas de retour partiel de marchandise ou de remise accordée sur certaines lignes. L'avoir partiel doit détailler précisément les lignes concernées et les montants corrigés (HT, TVA, TTC)." },
      { question: "Quel est le délai pour émettre un avoir ?", reponse: "Il n'existe pas de délai légal spécifique pour émettre un avoir. Cependant, il est recommandé de l'émettre le plus rapidement possible après la constatation de l'erreur ou du retour, idéalement dans le même exercice comptable. Pour la TVA, la régularisation doit intervenir sur la déclaration du mois de l'événement justifiant l'avoir." },
    ],
  },
  {
    slug: "conservation-factures",
    titre: "Durée de conservation des factures : obligations légales",
    description: "Combien de temps conserver ses factures ? Durées légales, format papier vs électronique, sanctions. Guide complet pour entreprises.",
    motsCles: ["conservation factures", "duree conservation facture", "archivage facture"],
    sections: [
      { titre: "Les durées légales", contenu: "Les factures doivent être conservées pendant 10 ans à compter de la clôture de l'exercice (obligation fiscale, article L102 B du LPF). L'obligation commerciale est de 10 ans également (article L123-22 du Code de commerce). En cas de contrôle fiscal, l'administration peut remonter sur les 3 derniers exercices (droit de reprise)." },
      { titre: "Format de conservation", contenu: "Les factures peuvent être conservées sous format papier ou électronique. Si vous choisissez le format électronique, vous devez garantir l'authenticité, l'intégrité et la lisibilité des documents pendant toute la durée de conservation. Les factures reçues sous format électronique doivent être conservées dans leur format d'origine." },
      { titre: "Sanctions en cas de non-conservation", contenu: "Le défaut de conservation des factures est passible d'une amende de 10 000 € par exercice concerné. En cas de contrôle fiscal, l'absence de factures peut entraîner un rejet de la comptabilité et une taxation d'office." },
    ],
    faq: [
      { question: "Peut-on numériser ses factures papier et jeter les originaux ?", reponse: "Oui, depuis 2017 (article A 102 B-2 du LPF), la numérisation fidèle est acceptée comme mode de conservation. La copie numérique doit être identique à l'original et horodatée. Les originaux papier peuvent alors être détruits." },
      { question: "Faut-il conserver les devis ?", reponse: "Oui, les devis signés doivent être conservés pendant 10 ans en tant que documents commerciaux (article L123-22 du Code de commerce). Ils constituent la preuve de l'accord contractuel avec le client. Pour les travaux soumis à la garantie décennale, il est même recommandé de les conserver au moins 10 ans après la réception des travaux." },
      { question: "Comment archiver ses factures électroniques ?", reponse: "Les factures électroniques doivent être conservées dans leur format d'origine pendant 10 ans, avec des garanties d'authenticité, d'intégrité et de lisibilité (article L102 B du LPF). L'archivage doit permettre une restitution rapide en cas de contrôle fiscal. Qonforme garde dans votre compte les factures que vous y émettez : vous pouvez les consulter et les télécharger à tout moment, y compris après la fin d'une formule." },
      { question: "Le cloud est-il un mode de conservation valide ?", reponse: "Oui, le stockage cloud est un mode de conservation valide à condition que le prestataire garantisse l'intégrité, la sécurité et la disponibilité des documents pendant toute la durée légale de 10 ans. Le serveur doit être situé dans l'Union européenne ou dans un pays ayant signé une convention d'assistance administrative avec la France (article 96 F de l'annexe III du CGI)." },
      { question: "Que faire en cas de perte de factures ?", reponse: "En cas de perte de factures, vous pouvez demander des duplicatas à vos fournisseurs ou clients. Informez votre expert-comptable et documentez la perte par écrit. En cas de contrôle fiscal, l'absence de factures peut entraîner un rejet de la comptabilité et une taxation d'office (article L192 du LPF), avec une amende de 10 000 € par exercice." },
    ],
  },
  {
    slug: "premiere-facture",
    titre: "Comment créer sa première facture : guide pas à pas",
    description: "Créez votre première facture conforme en 5 étapes : format, mentions obligatoires, numérotation, envoi. Guide pratique pour débutants 2026.",
    motsCles: ["première facture", "créer une facture", "comment facturer", "faire une facture"],
    sections: [
      { titre: "Choisir le bon format", contenu: "Vous pouvez créer votre facture sur Word, Excel, un logiciel de facturation ou en ligne. Attention : à partir du 1er septembre 2027, les TPE et PME devront émettre leurs factures entre entreprises dans un format structuré (Factur-X, UBL ou CII), ce qu'un fichier Word ou Excel ne permet pas. Qonforme joint un fichier XML Factur-X au PDF de vos factures ; l'envoi par une plateforme agréée y est en préparation." },
      { titre: "Les mentions obligatoires", contenu: "Votre facture doit comporter : vos coordonnées complètes (SIRET, adresse, forme juridique), celles du client, un numéro unique et chronologique, la date d'émission, le détail des prestations (désignation, quantité, prix unitaire HT), le taux de TVA, les totaux HT/TVA/TTC, et les conditions de paiement avec pénalités de retard." },
      { titre: "La numérotation", contenu: "La première facture de l'année peut porter le numéro F-2026-001 ou tout autre format, tant que la séquence est chronologique et continue. Il est interdit de supprimer un numéro ou de revenir en arrière. Choisissez un format de numérotation et conservez-le toute l'année." },
      { titre: "L'envoi au client", contenu: "Envoyez votre facture par email (format PDF) ou par courrier. L'envoi par email est recommandé car il constitue une preuve d'envoi. À partir du 1er septembre 2027, les TPE et PME devront transmettre leurs factures entre entreprises par une plateforme agréée." },
      { titre: "Les erreurs courantes à éviter", contenu: "Les erreurs les plus fréquentes : oublier le numéro de TVA intracommunautaire, ne pas mentionner les pénalités de retard (obligatoire), utiliser une numérotation non chronologique, ne pas conserver les factures 10 ans, et facturer sans SIRET. Chaque mention manquante expose à une amende de 15 € par mention et par facture." },
    ],
    faq: [
      { question: "Peut-on créer une facture sur Word ou Excel ?", reponse: "Techniquement oui, mais ce n'est pas recommandé. Un fichier Word ou Excel ne permettra pas d'émettre les factures électroniques exigées des TPE et PME à partir du 1er septembre 2027. De plus, il ne garantit ni l'intégrité du document ni la numérotation automatique. Utilisez un logiciel de facturation." },
      { question: "Faut-il un logiciel de facturation ?", reponse: "Avec la réforme de la facturation électronique, un logiciel devient quasi indispensable. Il reprend les mentions obligatoires, numérote les factures dans l'ordre et prépare le format structuré exigé des TPE et PME pour leurs échanges entre entreprises à partir du 1er septembre 2027." },
      { question: "Quel numéro donner à ma première facture ?", reponse: "Vous êtes libre du format : F-2026-001, FA001, 2026-0001, etc. L'important est que la séquence soit chronologique et continue, sans trous. Vous ne pouvez pas commencer à F-100 pour paraître plus expérimenté." },
      { question: "Quand envoyer une facture ?", reponse: "La facture doit être émise dès la réalisation de la prestation ou la livraison du bien. Pour les prestations de services, la TVA est exigible à l'encaissement (sauf option pour les débits). Un délai de facturation supérieur à 15 jours peut être sanctionné." },
      { question: "Que faire si j'ai fait une erreur sur ma facture ?", reponse: "Il est interdit de modifier ou supprimer une facture émise. Vous devez émettre un avoir (note de crédit) qui annule la facture erronée, puis créer une nouvelle facture corrigée avec un nouveau numéro." },
    ],
  },
  {
    slug: "facture-sans-tva",
    titre: "Facture sans TVA : quand et comment facturer en HT",
    description: "Quand peut-on facturer sans TVA ? Franchise de TVA, export, DOM-TOM, auto-entrepreneur. Mentions obligatoires et cas pratiques 2026.",
    motsCles: ["facture sans tva", "franchise tva", "facture ht", "tva non applicable"],
    sections: [
      { titre: "La franchise en base de TVA (art. 293 B du CGI)", contenu: "Les entreprises dont le chiffre d'affaires ne dépasse pas certains seuils bénéficient de la franchise de TVA : en 2026, 37 500 € pour les prestations de services et 85 000 € pour les activités de vente, appréciés sur l'année précédente (seuils majorés pour l'année en cours : 41 250 € et 93 500 €). Elles ne facturent pas la TVA mais ne peuvent pas non plus la déduire sur leurs achats. La mention « TVA non applicable, article 293 B du CGI » est obligatoire sur chaque facture." },
      { titre: "Les DOM-TOM", contenu: "La Guadeloupe, la Martinique, la Réunion et la Guyane bénéficient d'un régime de TVA spécifique avec des taux réduits. Mayotte n'est pas soumise à la TVA française. Les échanges entre la métropole et les DOM sont traités comme des exportations pour la TVA, ce qui permet la facturation en HT sous conditions." },
      { titre: "Les exportations hors UE", contenu: "Les ventes de biens exportés hors de l'Union européenne sont exonérées de TVA (article 262 du CGI). La facture doit mentionner « Exonération de TVA — article 262 du CGI ». L'exportateur doit conserver la preuve de la sortie du territoire (document douanier, DAU)." },
      { titre: "Auto-entrepreneur et TVA", contenu: "Les auto-entrepreneurs sont en franchise de TVA par défaut, tant qu'ils restent sous les seuils (37 500 € pour les services, 85 000 € pour la vente). En cas de dépassement du seuil majoré (41 250 € ou 93 500 €), la TVA s'applique aux opérations réalisées à partir de la date du dépassement. L'auto-entrepreneur doit alors modifier ses factures et reverser la TVA." },
      { titre: "Mentions obligatoires sur une facture sans TVA", contenu: "Une facture sans TVA doit comporter toutes les mentions classiques (SIRET, numéro, date, détail des prestations) plus la mention légale justifiant l'absence de TVA. Le montant est facturé en HT uniquement, sans ligne TVA ni montant TTC. L'absence de la mention légale expose à une amende de 15 € par mention manquante." },
    ],
    faq: [
      { question: "Quelle mention mettre sur une facture sans TVA ?", reponse: "La mention dépend du motif : « TVA non applicable, article 293 B du CGI » pour la franchise de TVA, « Exonération de TVA — article 262 du CGI » pour les exports hors UE, « Autoliquidation » pour la sous-traitance BTP (article 283-2 nonies du CGI)." },
      { question: "Que se passe-t-il si je dépasse les seuils de franchise ?", reponse: "Si vous dépassez le seuil majoré (41 250 € pour les services ou 93 500 € pour la vente), la TVA s'applique aux opérations réalisées à partir de la date du dépassement. Si vous dépassez seulement le seuil de base, elle s'applique au 1er janvier suivant. Vous devez ensuite facturer la TVA sur toutes vos factures et la reverser à l'État via vos déclarations de TVA." },
      { question: "Puis-je déduire la TVA si je suis en franchise ?", reponse: "Non, la franchise de TVA est un régime global : vous ne facturez pas la TVA mais vous ne pouvez pas non plus la déduire sur vos achats et charges. La TVA payée sur vos fournitures reste à votre charge." },
      { question: "Facture sans TVA pour activité mixte : comment faire ?", reponse: "Si vous exercez une activité mixte (vente + services), votre chiffre d'affaires total ne doit pas dépasser 85 000 €, dont 37 500 € au plus pour les services (seuils 2026). Dépasser l'un de ces deux seuils fait sortir l'ensemble de votre activité de la franchise : vous facturez alors la TVA sur toutes vos ventes." },
      { question: "Une facture sans TVA est-elle identique pour les biens et les services ?", reponse: "Oui, les mentions obligatoires sont les mêmes. La seule différence concerne les seuils de franchise : 85 000 € pour la vente de biens et 37 500 € pour les prestations de services en 2026. Le format de la facture reste identique." },
    ],
  },
  {
    slug: "facture-impayee",
    titre: "Facture impayée : relance, mise en demeure et recouvrement",
    description: "Que faire en cas de facture impayée ? Relance amiable, mise en demeure, pénalités de retard, injonction de payer. Procédure complète 2026.",
    motsCles: ["facture impayée", "relance facture", "recouvrement facture", "mise en demeure"],
    sections: [
      { titre: "La relance amiable", contenu: "La première étape est la relance amiable par email ou courrier. Envoyez un premier rappel 7 jours après l'échéance, puis un second 15 jours après. Mentionnez le numéro de facture, le montant dû, la date d'échéance dépassée et les pénalités de retard applicables. Un ton professionnel mais ferme est recommandé." },
      { titre: "La mise en demeure", contenu: "Si les relances amiables restent sans effet, envoyez une mise en demeure par lettre recommandée avec accusé de réception. Ce document a une valeur juridique : il prouve votre démarche amiable et constitue un préalable à toute action en justice. Mentionnez un délai de 8 à 15 jours pour le règlement." },
      { titre: "Les pénalités de retard", contenu: "Les pénalités de retard sont exigibles de plein droit dès le jour suivant la date d'échéance (article L441-10 du Code de commerce). Le taux minimum est 3 fois le taux d'intérêt légal. L'indemnité forfaitaire de recouvrement de 40 € s'ajoute automatiquement à chaque facture en retard. Ces montants doivent être mentionnés sur vos factures." },
      { titre: "L'injonction de payer", contenu: "Pour les créances inférieures à 5 000 €, vous pouvez recourir à la procédure simplifiée de recouvrement via un commissaire de justice (ex-huissier). Au-delà, l'injonction de payer auprès du tribunal de commerce est la procédure la plus courante : rapide, peu coûteuse (33,47 € de greffe), et sans audience si le débiteur ne conteste pas." },
      { titre: "La provision pour créance douteuse", contenu: "Si le recouvrement est incertain, vous pouvez comptabiliser une provision pour créance douteuse (compte 416/491). Cette provision est déductible fiscalement si elle est justifiée par des démarches de recouvrement documentées. Après épuisement des recours, la créance est passée en perte (compte 654)." },
    ],
    faq: [
      { question: "Quand envoyer la première relance ?", reponse: "Envoyez la première relance 7 jours après la date d'échéance. C'est souvent un simple oubli du client. Un email courtois rappelant le numéro de facture et le montant suffit généralement. Gardez une trace écrite de toutes vos relances." },
      { question: "La mise en demeure est-elle obligatoire avant d'aller en justice ?", reponse: "Oui dans la plupart des cas. La mise en demeure par lettre recommandée AR est un préalable nécessaire à l'action en justice. Elle démontre votre bonne foi et vos tentatives de résolution amiable. Sans elle, le juge peut considérer votre action comme prématurée." },
      { question: "Comment calculer les pénalités de retard ?", reponse: "Le calcul est : montant TTC dû × taux de pénalité × nombre de jours de retard / 365. Le taux ne peut pas être inférieur à 3 fois le taux d'intérêt légal, publié chaque semestre ; à défaut de taux prévu, c'est le taux directeur de la BCE majoré de 10 points. Ajoutez l'indemnité forfaitaire de 40 € par facture. Ces pénalités sont exigibles sans formalité préalable." },
      { question: "Peut-on faire appel à une société de recouvrement ?", reponse: "Oui, les sociétés de recouvrement peuvent intervenir à l'amiable ou en judiciaire. Elles prélèvent généralement une commission de 10 à 25 % du montant recouvré. Vérifiez que le prestataire est déclaré auprès de la CNIL et respecte les règles déontologiques." },
      { question: "Quand passer une créance en perte ?", reponse: "Une créance est passée en perte (compte 654) lorsque le recouvrement est définitivement impossible : liquidation judiciaire du débiteur, prescription de la créance (5 ans en droit commercial), ou échec de toutes les procédures. La TVA correspondante peut être récupérée via un avoir." },
    ],
  },
  {
    slug: "difference-devis-facture",
    titre: "Différence entre devis et facture : rôles et obligations",
    description: "Devis ou facture ? Comprendre les différences juridiques, quand utiliser l'un ou l'autre, et comment transformer un devis en facture.",
    motsCles: ["différence devis facture", "devis ou facture", "devis vs facture", "transformer devis en facture"],
    sections: [
      { titre: "Définition juridique du devis", contenu: "Le devis est un document commercial pré-contractuel qui décrit les prestations à réaliser et leur prix. Il constitue une offre de prix et n'a pas de valeur comptable. Une fois signé par le client, il vaut engagement contractuel et lie les deux parties. Le devis n'est pas enregistré en comptabilité tant qu'il n'est pas transformé en facture." },
      { titre: "Définition juridique de la facture", contenu: "La facture est un document comptable obligatoire qui constate la réalisation d'une vente ou d'une prestation. Elle crée une obligation de paiement pour le client et doit être enregistrée en comptabilité. Elle est régie par les articles 289 et suivants du CGI et doit comporter des mentions obligatoires strictes sous peine d'amende." },
      { titre: "Quand utiliser l'un ou l'autre", contenu: "Le devis est émis avant les travaux pour informer le client du prix et obtenir son accord. La facture est émise après la réalisation de la prestation ou la livraison du bien. Dans certains cas, le devis est obligatoire (travaux > 150 €, déménagements, services à la personne). La facture est toujours obligatoire pour les transactions B2B." },
      { titre: "Le devis vaut-il contrat ?", contenu: "Un devis signé par le client vaut contrat au sens de l'article 1113 du Code civil. Le professionnel est tenu de respecter les prix et prestations indiqués. Toute modification doit faire l'objet d'un avenant signé par les deux parties. Un devis non signé n'engage personne et peut être librement modifié." },
      { titre: "Transformer un devis en facture", contenu: "La transformation d'un devis en facture consiste à créer une facture reprenant les éléments du devis accepté. La facture doit porter son propre numéro chronologique et peut différer du devis si des travaux supplémentaires ont été réalisés (avec accord du client). Le devis signé doit être conservé comme pièce justificative." },
    ],
    faq: [
      { question: "Un devis peut-il remplacer une facture ?", reponse: "Non, jamais. Le devis est un document commercial sans valeur comptable, tandis que la facture est un document comptable obligatoire. Même si le devis est signé et payé, une facture doit être émise pour constater la vente et permettre la comptabilisation." },
      { question: "Un devis doit-il être signé ?", reponse: "La signature n'est pas obligatoire pour la validité du devis, mais elle est fortement recommandée. Un devis signé vaut contrat et protège les deux parties. La mention manuscrite « Devis reçu avant l'exécution des travaux » suivie de la date et de la signature est la pratique standard." },
      { question: "Peut-on facturer sans avoir fait de devis ?", reponse: "Oui, dans de nombreux cas le devis n'est pas obligatoire (ventes en magasin, prestations < 150 €, accords verbaux entre professionnels). Cependant, pour les travaux du bâtiment > 150 €, les déménagements et les services à la personne, le devis préalable est obligatoire." },
      { question: "Que faire si le montant final diffère du devis ?", reponse: "Si des travaux supplémentaires sont nécessaires, vous devez obtenir l'accord écrit du client (avenant au devis) avant de les réaliser. La facture finale peut alors mentionner les travaux supplémentaires acceptés. Sans accord, le client n'est redevable que du montant du devis initial." },
      { question: "Une facture pro forma est-elle un devis ?", reponse: "Non, la facture pro forma est un document informatif qui ressemble à une facture mais n'a pas de valeur comptable. Elle est utilisée dans le commerce international pour les formalités douanières ou bancaires. Contrairement au devis, elle ne constitue pas une offre de prix engageante." },
    ],
  },
  {
    slug: "facturer-etranger",
    titre: "Facturer à l'étranger : TVA, devises et obligations",
    description: "Comment facturer un client étranger ? TVA intracommunautaire, export hors UE, devises, e-reporting. Guide complet pour entreprises françaises.",
    motsCles: ["facturer étranger", "facture export", "facture intracommunautaire", "tva export"],
    sections: [
      { titre: "Vente intracommunautaire (UE)", contenu: "Entre professionnels au sein de l'UE, vous facturez en HT avec le numéro de TVA intracommunautaire des deux parties, et c'est votre client qui déclare la TVA dans son pays. Pour une livraison de biens, exonérée en France, la facture porte la mention « Exonération de TVA, article 262 ter I du CGI ». Pour une prestation de services, imposable dans le pays du client (article 259-1° du CGI), elle porte la mention « Autoliquidation ». Vérifiez la validité du numéro de TVA de votre client sur le système VIES de la Commission européenne." },
      { titre: "Export hors UE", contenu: "Les ventes de biens exportés hors de l'UE sont exonérées de TVA (article 262 du CGI). La facture porte la mention « Exonération de TVA — article 262-I du CGI ». Conservez la preuve d'exportation (DAU, document de transport). Pour les prestations de services hors UE, les règles dépendent de la nature du service et du statut du client." },
      { titre: "Facturer en devises étrangères", contenu: "Vous pouvez facturer en devises étrangères (dollars, livres, etc.) à condition de mentionner l'équivalent en euros au taux de change du jour de l'opération. Pour la TVA et la comptabilité, le montant en euros fait foi. Le taux de change utilisé doit être documenté (taux BCE du jour ou taux contractuel)." },
      { titre: "Mentions obligatoires spécifiques", contenu: "En plus des mentions classiques, une facture internationale doit comporter : le numéro de TVA intracommunautaire des deux parties (ventes UE), la mention d'exonération ou d'autoliquidation, la devise et le taux de change, et selon les pays, des mentions supplémentaires comme le numéro EORI pour les exportations de biens." },
      { titre: "E-reporting 2026 et opérations internationales", contenu: "La réforme impose le e-reporting des transactions internationales : les entreprises françaises doivent transmettre les données de leurs ventes B2B internationales et de toutes leurs ventes B2C (y compris à l'export) à l'administration fiscale, par leur plateforme agréée. Pour les PME et les micro-entreprises, l'obligation démarre le 1er septembre 2027. Elle complète la facturation électronique B2B domestique." },
    ],
    faq: [
      { question: "Dois-je facturer en euros obligatoirement ?", reponse: "Non, vous pouvez facturer dans la devise de votre choix. Cependant, vous devez mentionner l'équivalent en euros sur la facture pour la comptabilité et la TVA. Le taux de change retenu est celui du jour de l'opération (taux BCE) ou le taux contractuel convenu avec le client." },
      { question: "Faut-il facturer la TVA à un client dans l'UE ?", reponse: "Pour les ventes B2B à un assujetti dans l'UE, non : c'est votre client qui déclare la TVA dans son pays. La facture porte la mention « Exonération de TVA, article 262 ter I du CGI » pour des biens, ou « Autoliquidation » pour des services. Vérifiez son numéro de TVA intracommunautaire sur VIES. Pour les ventes B2C à des particuliers dans l'UE, la TVA française s'applique sauf si vous dépassez le seuil de 10 000 € de ventes à distance (régime OSS)." },
      { question: "Comment facturer un client hors UE ?", reponse: "Pour les biens, facturez en HT avec la mention d'exonération (article 262-I du CGI) et conservez la preuve d'export. Pour les services, les règles varient selon la nature du service : les services B2B sont généralement taxables dans le pays du preneur (article 259-1° du CGI)." },
      { question: "Faut-il une déclaration en douane pour exporter ?", reponse: "Oui, pour les biens d'une valeur supérieure à 1 000 € ou d'un poids supérieur à 1 000 kg, une déclaration en douane (DAU) est obligatoire. En dessous de ces seuils, une déclaration simplifiée suffit. Le numéro EORI est nécessaire pour toute opération douanière." },
      { question: "Comment fonctionne le e-reporting pour les ventes internationales ?", reponse: "Pour les PME et les micro-entreprises, à partir du 1er septembre 2027, les données de vos transactions internationales (montant, TVA, pays du client) doivent être transmises à l'administration fiscale par votre plateforme agréée. Cela concerne les ventes B2B intracommunautaires et exports, ainsi que toutes les ventes B2C. Le e-reporting complète la facturation électronique domestique." },
    ],
  },
]

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find(g => g.slug === slug)
}
