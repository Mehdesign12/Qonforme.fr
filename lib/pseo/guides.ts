export interface Guide {
  slug: string
  titre: string
  description: string
  motsCles: string[]
  sections: { titre: string; contenu: string }[]
  faq: { question: string; reponse: string }[]
}

export const GUIDES: Guide[] = [
  {
    slug: "mentions-obligatoires-facture",
    titre: "Mentions obligatoires sur une facture en 2026",
    description: "Guide complet des mentions obligatoires sur une facture en France : informations vendeur, acheteur, TVA, paiement. Tout ce qu'il faut savoir pour 2026.",
    motsCles: ["mentions obligatoires facture", "que doit contenir une facture", "facture conforme"],
    sections: [
      { titre: "Les mentions d'identification du vendeur", contenu: "Toute facture doit comporter les informations complètes du vendeur : nom ou raison sociale, adresse du siège social, numéro SIREN ou SIRET, forme juridique et montant du capital social (pour les sociétés), numéro de TVA intracommunautaire, et numéro RCS suivi du nom de la ville d'immatriculation." },
      { titre: "Les mentions d'identification de l'acheteur", contenu: "L'acheteur doit être identifié par : son nom ou sa raison sociale, son adresse de facturation, et son numéro de TVA intracommunautaire pour les opérations intracommunautaires." },
      { titre: "Les mentions relatives à la facture", contenu: "La facture doit porter un numéro unique basé sur une séquence chronologique continue (pas de trous), la date d'émission, et la date de la vente ou de la prestation si elle diffère de la date d'émission." },
      { titre: "Le détail des prestations", contenu: "Chaque prestation ou produit doit être décrit avec : sa désignation précise, la quantité, le prix unitaire hors taxe, le taux de TVA applicable, et le montant total HT. Les réductions de prix (remises, rabais) doivent aussi figurer." },
      { titre: "Les mentions de TVA", contenu: "La facture doit indiquer pour chaque taux de TVA : la base HT, le taux appliqué, et le montant de TVA correspondant. Le total HT, le total TVA et le total TTC doivent apparaître clairement. En cas de franchise de TVA, la mention « TVA non applicable, article 293 B du CGI » est obligatoire." },
      { titre: "Les conditions de paiement", contenu: "Doivent figurer : la date d'échéance du paiement, les conditions d'escompte en cas de paiement anticipé (ou la mention « Pas d'escompte pour paiement anticipé »), et le taux des pénalités de retard (minimum : 3 fois le taux d'intérêt légal). L'indemnité forfaitaire de recouvrement de 40 € doit être mentionnée." },
      { titre: "Facture électronique 2026", contenu: "À partir de 2026, toutes les entreprises doivent être capables de recevoir des factures électroniques au format structuré (Factur-X, UBL, CII). L'obligation d'émission sera progressive selon la taille de l'entreprise. Qonforme génère nativement des factures au format Factur-X EN 16931." },
    ],
    faq: [
      { question: "Que risque-t-on si une mention obligatoire manque sur une facture ?", reponse: "L'absence d'une mention obligatoire est passible d'une amende de 15 € par mention manquante et par facture, plafonnée à 25% du montant de la facture. En cas de récidive, l'amende peut atteindre 75 000 € pour une personne physique." },
      { question: "Faut-il un numéro de TVA intracommunautaire sur une facture ?", reponse: "Oui, le numéro de TVA intracommunautaire du vendeur est obligatoire dès que la facture comporte de la TVA. Il est aussi obligatoire pour les opérations intracommunautaires (ventes ou prestations à des clients dans d'autres pays de l'UE)." },
      { question: "Comment numéroter ses factures ?", reponse: "La numérotation doit être chronologique et continue, sans trous. Vous pouvez utiliser un préfixe (ex : F-2026-001) tant que la séquence est respectée. Il est interdit de revenir en arrière ou de supprimer un numéro." },
    ],
  },
  {
    slug: "facture-auto-entrepreneur",
    titre: "Facture auto-entrepreneur : guide complet 2026",
    description: "Comment faire une facture en auto-entrepreneur (micro-entreprise) ? Mentions obligatoires, TVA, modèle et exemples pour 2026.",
    motsCles: ["facture auto entrepreneur", "facture micro entreprise", "modele facture auto entrepreneur"],
    sections: [
      { titre: "Les mentions obligatoires", contenu: "En auto-entrepreneur, votre facture doit comporter : vos nom et prénom (ou nom commercial), votre adresse, votre numéro SIRET, la mention « EI » ou « Entrepreneur individuel », un numéro de facture chronologique, la date d'émission, l'identité du client, le détail des prestations avec prix unitaire, le montant total HT, et les conditions de paiement." },
      { titre: "La mention TVA", contenu: "Si vous êtes en franchise de TVA (seuils : 36 800 € services, 91 900 € vente), vous devez ajouter la mention « TVA non applicable, article 293 B du CGI ». Pas de ligne TVA sur la facture. Si vous avez dépassé les seuils, vous devez facturer la TVA normalement." },
      { titre: "Seuils de franchise de TVA 2026", contenu: "Les seuils pour 2026 sont : 36 800 € de CA annuel pour les prestations de services (seuil majoré : 39 100 €) et 91 900 € pour les activités de vente (seuil majoré : 101 000 €). Au-delà du seuil majoré, la TVA s'applique dès le 1er jour du mois de dépassement." },
      { titre: "L'obligation de facturation électronique", contenu: "À partir de 2026, les auto-entrepreneurs doivent être en mesure de recevoir des factures électroniques. L'obligation d'émettre des factures électroniques arrivera dans un second temps. Anticipez en utilisant un logiciel conforme comme Qonforme." },
    ],
    faq: [
      { question: "Un auto-entrepreneur doit-il faire des factures ?", reponse: "Oui, la facture est obligatoire pour toute vente de produit ou prestation de service à un professionnel. Pour les ventes aux particuliers, un ticket ou une note suffit en dessous de 25 €, mais la facture est obligatoire au-delà ou sur demande du client." },
      { question: "Peut-on facturer sans numéro SIRET ?", reponse: "Non, le numéro SIRET est obligatoire sur toutes les factures. Si vous venez de créer votre auto-entreprise et n'avez pas encore reçu votre SIRET, attendez de le recevoir avant de facturer (délai habituel : 1 à 4 semaines)." },
    ],
  },
  {
    slug: "delai-paiement-facture",
    titre: "Délais de paiement des factures : règles et pénalités 2026",
    description: "Tout savoir sur les délais de paiement légaux entre professionnels : 30 jours, 45 jours fin de mois, pénalités de retard, indemnité de recouvrement.",
    motsCles: ["delai paiement facture", "penalites retard facture", "indemnite recouvrement"],
    sections: [
      { titre: "Le délai légal de paiement", contenu: "Entre professionnels, le délai de paiement est fixé au 30e jour suivant la réception des marchandises ou l'exécution de la prestation. Les parties peuvent convenir d'un délai différent, sans dépasser 60 jours à compter de la date d'émission de la facture, ou 45 jours fin de mois." },
      { titre: "Les pénalités de retard", contenu: "Les pénalités de retard sont dues de plein droit, sans qu'un rappel soit nécessaire. Le taux minimum est de 3 fois le taux d'intérêt légal en vigueur. Les entreprises peuvent fixer un taux supérieur dans leurs CGV. Le taux doit être mentionné sur la facture." },
      { titre: "L'indemnité forfaitaire de recouvrement", contenu: "En plus des pénalités de retard, le créancier peut réclamer une indemnité forfaitaire de 40 € pour frais de recouvrement. Cette indemnité est due pour chaque facture payée en retard. Si les frais réels de recouvrement dépassent 40 €, le créancier peut demander une indemnisation complémentaire." },
      { titre: "Cas particuliers", contenu: "Certains secteurs ont des délais spécifiques : 30 jours pour le transport, 20 jours pour les produits alimentaires périssables, 30 jours fin de décade pour le bétail. Les collectivités publiques ont un délai de 30 jours." },
    ],
    faq: [
      { question: "Peut-on accorder un délai de paiement de 90 jours ?", reponse: "Non, le délai maximum entre professionnels est de 60 jours date de facture ou 45 jours fin de mois. Tout accord dépassant ces limites est nul et expose l'entreprise à une amende administrative pouvant atteindre 2 millions d'euros." },
      { question: "Les pénalités de retard sont-elles automatiques ?", reponse: "Oui, les pénalités de retard sont exigibles de plein droit, le jour suivant la date de paiement figurant sur la facture, sans qu'un rappel soit nécessaire. Cependant, dans la pratique, il est recommandé d'envoyer une relance avant d'appliquer les pénalités." },
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
    ],
  },
  {
    slug: "facture-electronique-2026",
    titre: "Facture électronique obligatoire 2026 : ce qui change",
    description: "Tout comprendre sur la réforme de la facturation électronique 2026 : calendrier, formats acceptés (Factur-X, UBL, CII), PDP, obligations par taille d'entreprise.",
    motsCles: ["facture electronique 2026", "facture electronique obligatoire", "factur-x"],
    sections: [
      { titre: "Le calendrier de la réforme", contenu: "À partir du 1er septembre 2026, toutes les entreprises assujetties à la TVA doivent être capables de recevoir des factures électroniques (obligation de réception). L'obligation d'émettre des factures électroniques sera progressive : grandes entreprises et ETI d'abord, puis PME et micro-entreprises." },
      { titre: "Les formats acceptés", contenu: "Trois formats sont acceptés : Factur-X (PDF hybride avec données XML intégrées, norme EN 16931), UBL (Universal Business Language, format XML pur), et CII (Cross Industry Invoice, format XML). Qonforme génère nativement des factures au format Factur-X, le format le plus accessible." },
      { titre: "Le rôle des PDP", contenu: "Les Plateformes de Dématérialisation Partenaires (PDP) sont des intermédiaires agréés par l'administration fiscale pour transmettre les factures électroniques et les données de facturation (e-reporting). Les entreprises peuvent aussi utiliser le Portail Public de Facturation (PPF)." },
      { titre: "Le e-reporting", contenu: "En plus de la facturation électronique B2B, les entreprises doivent transmettre les données de leurs transactions B2C et internationales (e-reporting). Ces données sont envoyées à l'administration fiscale via une PDP ou le PPF." },
    ],
    faq: [
      { question: "Les auto-entrepreneurs sont-ils concernés ?", reponse: "Oui, tous les assujettis à la TVA sont concernés, y compris les auto-entrepreneurs en franchise de TVA. Ils doivent pouvoir recevoir des factures électroniques dès septembre 2026." },
      { question: "Quel format choisir pour ses factures électroniques ?", reponse: "Le format Factur-X est recommandé pour les TPE et PME : il combine un PDF lisible par l'humain et des données XML exploitables par les logiciels. C'est le format le plus simple à adopter car vos clients peuvent toujours lire le PDF normalement." },
    ],
  },
  {
    slug: "devis-obligatoire",
    titre: "Devis obligatoire : dans quels cas et comment le rédiger",
    description: "Quand le devis est-il obligatoire ? Contenu, mentions légales, durée de validité, différence avec la facture. Guide complet pour artisans et TPE.",
    motsCles: ["devis obligatoire", "modele devis", "mentions obligatoires devis"],
    sections: [
      { titre: "Quand le devis est-il obligatoire ?", contenu: "Le devis est obligatoire pour les travaux et dépannages d'un montant supérieur à 150 € TTC, pour les déménagements, les services à la personne, les prestations de santé dépassant le tarif conventionnel, et dans tous les cas où le client le demande. Pour les travaux de bâtiment, le devis est systématiquement recommandé." },
      { titre: "Les mentions obligatoires du devis", contenu: "Le devis doit comporter : la date, les coordonnées du professionnel (SIRET, assurances), celles du client, le lieu d'exécution, la description détaillée des travaux, les matériaux et fournitures, le prix unitaire et total (HT et TTC), le taux de TVA, la durée de validité, les conditions de paiement et la mention manuscrite « Devis reçu avant l'exécution des travaux »." },
      { titre: "Valeur juridique du devis", contenu: "Un devis signé par le client vaut engagement contractuel. Il a la même valeur qu'un contrat. Le professionnel est tenu de respecter les prix et prestations indiqués. Toute modification doit faire l'objet d'un avenant signé par les deux parties." },
      { titre: "Durée de validité", contenu: "La durée de validité du devis doit être clairement indiquée (généralement 1 à 3 mois). Au-delà, le professionnel n'est plus tenu par les prix indiqués. Si aucune durée n'est mentionnée, le devis est réputé valable pendant un délai raisonnable." },
    ],
    faq: [
      { question: "Un devis peut-il être payant ?", reponse: "Oui, un professionnel peut facturer l'établissement d'un devis, à condition d'en informer le client au préalable. C'est courant pour les devis complexes nécessitant un déplacement ou une étude approfondie. Le montant du devis est souvent déduit de la facture si le client accepte." },
      { question: "Quelle différence entre un devis et une facture ?", reponse: "Le devis est un document commercial émis avant la réalisation des travaux, il constitue une proposition de prix. La facture est un document comptable émis après la réalisation des travaux, elle constate une dette. Un devis signé engage les deux parties, la facture constate l'exécution." },
    ],
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
    ],
  },
]

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find(g => g.slug === slug)
}
