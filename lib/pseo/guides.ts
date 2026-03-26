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
      { question: "Peut-on envoyer une facture par email ?", reponse: "Oui, l'envoi de facture par email est parfaitement légal depuis la loi de finances 2013, à condition que le destinataire l'accepte. La facture envoyée par email doit comporter les mêmes mentions obligatoires qu'une facture papier et garantir l'authenticité de l'origine et l'intégrité du contenu." },
      { question: "Faut-il signer une facture ?", reponse: "Non, la signature n'est pas une mention obligatoire sur une facture en France. Aucun texte légal (article 242 nonies A de l'annexe II du CGI) n'exige de signature. Cependant, un cachet ou une signature électronique peut renforcer l'authenticité du document, notamment dans le cadre de la facturation électronique." },
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
      { question: "Quel logiciel de facturation pour auto-entrepreneur ?", reponse: "Un auto-entrepreneur doit utiliser un logiciel conforme à la loi anti-fraude (article 286 I-3° bis du CGI), garantissant l'inaltérabilité, la sécurisation, la conservation et l'archivage des données. Qonforme est un logiciel certifié qui répond à ces obligations et génère des factures au format Factur-X." },
      { question: "Comment gérer la TVA quand on dépasse les seuils ?", reponse: "Lorsque vous dépassez le seuil majoré (39 100 € pour les services ou 101 000 € pour la vente), la TVA s'applique dès le 1er jour du mois de dépassement. Vous devez alors demander un numéro de TVA intracommunautaire auprès de votre SIE, facturer la TVA à vos clients et déposer des déclarations de TVA (CA12 ou CA3)." },
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
      { titre: "Les pénalités de retard", contenu: "Les pénalités de retard sont dues de plein droit, sans qu'un rappel soit nécessaire. Le taux minimum est de 3 fois le taux d'intérêt légal en vigueur. Les entreprises peuvent fixer un taux supérieur dans leurs CGV. Le taux doit être mentionné sur la facture." },
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
      { question: "Qu'est-ce qu'une PDP (Plateforme de Dématérialisation Partenaire) ?", reponse: "Une PDP est un opérateur privé immatriculé par l'administration fiscale pour transmettre les factures électroniques entre entreprises et effectuer le e-reporting auprès de la DGFiP. Les PDP assurent la conversion des formats, le routage des factures et la transmission des données fiscales. La liste des PDP agréées est publiée par la DGFiP." },
      { question: "Une facture PDF envoyée par email est-elle une facture électronique ?", reponse: "Non, un simple PDF envoyé par email n'est pas considéré comme une facture électronique au sens de la réforme 2026. Une facture électronique doit être émise dans un format structuré (Factur-X, UBL ou CII) et transmise via une PDP ou le PPF. Le PDF classique ne contient pas les données structurées exigées par la norme EN 16931." },
      { question: "Quelles sanctions en cas de non-conformité ?", reponse: "Le non-respect de l'obligation de facturation électronique est sanctionné par une amende de 15 € par facture non conforme, plafonnée à 15 000 € par an (article 1737-II du CGI). Le défaut de e-reporting est sanctionné par une amende de 250 € par transmission manquante, plafonnée à 15 000 € par an." },
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
      { question: "Le client peut-il annuler un devis signé ?", reponse: "Un devis signé a valeur de contrat, donc le client ne peut pas l'annuler unilatéralement sans conséquences. Si le client se rétracte, le professionnel peut réclamer des dommages et intérêts pour le préjudice subi (article 1217 du Code civil). Toutefois, un délai de rétractation de 14 jours s'applique pour les contrats conclus à distance ou hors établissement (article L221-18 du Code de la consommation)." },
      { question: "Faut-il numéroter les devis ?", reponse: "La numérotation des devis n'est pas une obligation légale stricte, contrairement aux factures. Cependant, elle est fortement recommandée pour assurer un suivi commercial efficace et faciliter le lien entre le devis et la facture correspondante. Utilisez une séquence logique (ex : D-2026-001) distincte de la numérotation des factures." },
      { question: "Un devis doit-il mentionner l'assurance décennale ?", reponse: "Oui, pour les travaux de bâtiment soumis à la garantie décennale, le professionnel doit obligatoirement mentionner son assurance décennale sur le devis (article L243-2 du Code des assurances). Doivent figurer : le nom de l'assureur, le numéro de police et la couverture géographique. L'absence de cette mention est passible d'une amende de 75 000 €." },
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
      { question: "Comment archiver ses factures électroniques ?", reponse: "Les factures électroniques doivent être conservées dans leur format d'origine pendant 10 ans, avec des garanties d'authenticité, d'intégrité et de lisibilité (article L102 B du LPF). L'archivage doit permettre une restitution rapide en cas de contrôle fiscal. Un logiciel comme Qonforme assure automatiquement cet archivage conforme." },
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
      { titre: "Choisir le bon format", contenu: "Vous pouvez créer votre facture sur Word, Excel, un logiciel de facturation ou en ligne. Attention : un fichier Word ou Excel n'est pas conforme à la réforme de la facturation électronique 2026 qui impose le format Factur-X, UBL ou CII. Un logiciel comme Qonforme génère automatiquement des factures au format Factur-X EN 16931." },
      { titre: "Les mentions obligatoires", contenu: "Votre facture doit comporter : vos coordonnées complètes (SIRET, adresse, forme juridique), celles du client, un numéro unique et chronologique, la date d'émission, le détail des prestations (désignation, quantité, prix unitaire HT), le taux de TVA, les totaux HT/TVA/TTC, et les conditions de paiement avec pénalités de retard." },
      { titre: "La numérotation", contenu: "La première facture de l'année peut porter le numéro F-2026-001 ou tout autre format, tant que la séquence est chronologique et continue. Il est interdit de supprimer un numéro ou de revenir en arrière. Choisissez un format de numérotation et conservez-le toute l'année." },
      { titre: "L'envoi au client", contenu: "Envoyez votre facture par email (format PDF) ou par courrier. L'envoi par email est recommandé car il constitue une preuve d'envoi. À partir de 2026, les factures B2B devront être transmises via une Plateforme de Dématérialisation Partenaire (PDP) ou le Portail Public de Facturation (PPF)." },
      { titre: "Les erreurs courantes à éviter", contenu: "Les erreurs les plus fréquentes : oublier le numéro de TVA intracommunautaire, ne pas mentionner les pénalités de retard (obligatoire), utiliser une numérotation non chronologique, ne pas conserver les factures 10 ans, et facturer sans SIRET. Chaque mention manquante expose à une amende de 15 € par mention et par facture." },
    ],
    faq: [
      { question: "Peut-on créer une facture sur Word ou Excel ?", reponse: "Techniquement oui, mais ce n'est pas recommandé. Un fichier Word/Excel n'est pas conforme au format Factur-X imposé par la réforme 2026. De plus, il ne garantit pas l'intégrité du document ni la numérotation automatique. Utilisez un logiciel de facturation conforme." },
      { question: "Faut-il un logiciel de facturation ?", reponse: "Avec la réforme de la facturation électronique 2026, un logiciel conforme devient quasi indispensable. Il génère automatiquement les mentions obligatoires, la numérotation chronologique et le format Factur-X requis pour les échanges B2B." },
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
      { titre: "La franchise en base de TVA (art. 293 B du CGI)", contenu: "Les entreprises dont le chiffre d'affaires ne dépasse pas certains seuils bénéficient de la franchise de TVA : 36 800 € pour les prestations de services et 91 900 € pour les activités de vente. Elles ne facturent pas la TVA mais ne peuvent pas non plus la déduire sur leurs achats. La mention « TVA non applicable, article 293 B du CGI » est obligatoire sur chaque facture." },
      { titre: "Les DOM-TOM", contenu: "La Guadeloupe, la Martinique, la Réunion et la Guyane bénéficient d'un régime de TVA spécifique avec des taux réduits. Mayotte n'est pas soumise à la TVA française. Les échanges entre la métropole et les DOM sont traités comme des exportations pour la TVA, ce qui permet la facturation en HT sous conditions." },
      { titre: "Les exportations hors UE", contenu: "Les ventes de biens exportés hors de l'Union européenne sont exonérées de TVA (article 262 du CGI). La facture doit mentionner « Exonération de TVA — article 262 du CGI ». L'exportateur doit conserver la preuve de la sortie du territoire (document douanier, DAU)." },
      { titre: "Auto-entrepreneur et TVA", contenu: "Les auto-entrepreneurs sont en franchise de TVA par défaut, tant qu'ils restent sous les seuils (36 800 € services, 91 900 € vente). En cas de dépassement du seuil majoré (39 100 € ou 101 000 €), la TVA s'applique dès le 1er jour du mois de dépassement. L'auto-entrepreneur doit alors modifier ses factures et reverser la TVA." },
      { titre: "Mentions obligatoires sur une facture sans TVA", contenu: "Une facture sans TVA doit comporter toutes les mentions classiques (SIRET, numéro, date, détail des prestations) plus la mention légale justifiant l'absence de TVA. Le montant est facturé en HT uniquement, sans ligne TVA ni montant TTC. L'absence de la mention légale expose à une amende de 15 € par mention manquante." },
    ],
    faq: [
      { question: "Quelle mention mettre sur une facture sans TVA ?", reponse: "La mention dépend du motif : « TVA non applicable, article 293 B du CGI » pour la franchise de TVA, « Exonération de TVA — article 262 du CGI » pour les exports hors UE, « Autoliquidation » pour la sous-traitance BTP (article 283-2 nonies du CGI)." },
      { question: "Que se passe-t-il si je dépasse les seuils de franchise ?", reponse: "Si vous dépassez le seuil majoré (39 100 € services ou 101 000 € vente), la TVA s'applique dès le 1er jour du mois de dépassement. Vous devez facturer la TVA sur toutes les factures suivantes et la reverser à l'État via vos déclarations de TVA." },
      { question: "Puis-je déduire la TVA si je suis en franchise ?", reponse: "Non, la franchise de TVA est un régime global : vous ne facturez pas la TVA mais vous ne pouvez pas non plus la déduire sur vos achats et charges. La TVA payée sur vos fournitures reste à votre charge." },
      { question: "Facture sans TVA pour activité mixte : comment faire ?", reponse: "Si vous exercez une activité mixte (vente + services), chaque activité a ses propres seuils de franchise. Vous pouvez être en franchise pour l'une et assujetti pour l'autre. Dans ce cas, seules les factures de l'activité en franchise portent la mention d'exonération." },
      { question: "Une facture sans TVA est-elle identique pour les biens et les services ?", reponse: "Oui, les mentions obligatoires sont les mêmes. La seule différence concerne les seuils de franchise : 91 900 € pour la vente de biens et 36 800 € pour les prestations de services. Le format de la facture reste identique." },
    ],
  },
  {
    slug: "facture-impayee",
    titre: "Facture impayée : relance, mise en demeure et recouvrement",
    description: "Que faire en cas de facture impayée ? Relance amiable, mise en demeure, pénalités de retard, injonction de payer. Procédure complète 2026.",
    motsCles: ["facture impayée", "relance facture", "recouvrement facture", "mise en demeure"],
    sections: [
      { titre: "La relance amiable", contenu: "La première étape est la relance amiable par email ou courrier. Envoyez un premier rappel 7 jours après l'échéance, puis un second 15 jours après. Mentionnez le numéro de facture, le montant dû, la date d'échéance dépassée et les pénalités de retard applicables. Un ton professionnel mais ferme est recommandé." },
      { titre: "La mise en demeure", contenu: "Si les relances amiables restent sans effet, envoyez une mise en demeure par lettre recommandée avec accusé de réception. Ce document a une valeur juridique : il constitue le point de départ officiel des pénalités de retard et est un préalable nécessaire à toute action en justice. Mentionnez un délai de 8 à 15 jours pour le règlement." },
      { titre: "Les pénalités de retard", contenu: "Les pénalités de retard sont exigibles de plein droit dès le jour suivant la date d'échéance (article L441-10 du Code de commerce). Le taux minimum est 3 fois le taux d'intérêt légal. L'indemnité forfaitaire de recouvrement de 40 € s'ajoute automatiquement à chaque facture en retard. Ces montants doivent être mentionnés sur vos factures." },
      { titre: "L'injonction de payer", contenu: "Pour les créances inférieures à 5 000 €, vous pouvez recourir à la procédure simplifiée de recouvrement via un commissaire de justice (ex-huissier). Au-delà, l'injonction de payer auprès du tribunal de commerce est la procédure la plus courante : rapide, peu coûteuse (33,47 € de greffe), et sans audience si le débiteur ne conteste pas." },
      { titre: "La provision pour créance douteuse", contenu: "Si le recouvrement est incertain, vous pouvez comptabiliser une provision pour créance douteuse (compte 416/491). Cette provision est déductible fiscalement si elle est justifiée par des démarches de recouvrement documentées. Après épuisement des recours, la créance est passée en perte (compte 654)." },
    ],
    faq: [
      { question: "Quand envoyer la première relance ?", reponse: "Envoyez la première relance 7 jours après la date d'échéance. C'est souvent un simple oubli du client. Un email courtois rappelant le numéro de facture et le montant suffit généralement. Gardez une trace écrite de toutes vos relances." },
      { question: "La mise en demeure est-elle obligatoire avant d'aller en justice ?", reponse: "Oui dans la plupart des cas. La mise en demeure par lettre recommandée AR est un préalable nécessaire à l'action en justice. Elle démontre votre bonne foi et vos tentatives de résolution amiable. Sans elle, le juge peut considérer votre action comme prématurée." },
      { question: "Comment calculer les pénalités de retard ?", reponse: "Le calcul est : montant HT × taux de pénalité × nombre de jours de retard / 365. Le taux minimum est 3 fois le taux d'intérêt légal (soit environ 11,62 % en 2026). Ajoutez l'indemnité forfaitaire de 40 € par facture. Ces pénalités sont exigibles sans formalité préalable." },
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
      { titre: "Vente intracommunautaire (UE)", contenu: "Pour les ventes B2B au sein de l'UE, la TVA est autoliquidée par l'acheteur dans son pays. Vous facturez en HT avec la mention « Autoliquidation — article 283-1 du CGI » et le numéro de TVA intracommunautaire des deux parties. Vérifiez la validité du numéro de TVA de votre client sur le système VIES de la Commission européenne." },
      { titre: "Export hors UE", contenu: "Les ventes de biens exportés hors de l'UE sont exonérées de TVA (article 262 du CGI). La facture porte la mention « Exonération de TVA — article 262-I du CGI ». Conservez la preuve d'exportation (DAU, document de transport). Pour les prestations de services hors UE, les règles dépendent de la nature du service et du statut du client." },
      { titre: "Facturer en devises étrangères", contenu: "Vous pouvez facturer en devises étrangères (dollars, livres, etc.) à condition de mentionner l'équivalent en euros au taux de change du jour de l'opération. Pour la TVA et la comptabilité, le montant en euros fait foi. Le taux de change utilisé doit être documenté (taux BCE du jour ou taux contractuel)." },
      { titre: "Mentions obligatoires spécifiques", contenu: "En plus des mentions classiques, une facture internationale doit comporter : le numéro de TVA intracommunautaire des deux parties (ventes UE), la mention d'exonération ou d'autoliquidation, la devise et le taux de change, et selon les pays, des mentions supplémentaires comme le numéro EORI pour les exportations de biens." },
      { titre: "E-reporting 2026 et opérations internationales", contenu: "La réforme 2026 impose le e-reporting pour les transactions internationales : les entreprises françaises doivent transmettre les données de leurs ventes B2B internationales et de toutes leurs ventes B2C (y compris export) à l'administration fiscale via une PDP ou le PPF. Cette obligation complète la facturation électronique B2B domestique." },
    ],
    faq: [
      { question: "Dois-je facturer en euros obligatoirement ?", reponse: "Non, vous pouvez facturer dans la devise de votre choix. Cependant, vous devez mentionner l'équivalent en euros sur la facture pour la comptabilité et la TVA. Le taux de change retenu est celui du jour de l'opération (taux BCE) ou le taux contractuel convenu avec le client." },
      { question: "Faut-il facturer la TVA à un client dans l'UE ?", reponse: "Pour les ventes B2B à un assujetti dans l'UE, non : la TVA est autoliquidée par l'acheteur. Vérifiez son numéro de TVA intracommunautaire sur VIES. Pour les ventes B2C à des particuliers dans l'UE, la TVA française s'applique sauf si vous dépassez le seuil de 10 000 € de ventes à distance (régime OSS)." },
      { question: "Comment facturer un client hors UE ?", reponse: "Pour les biens, facturez en HT avec la mention d'exonération (article 262-I du CGI) et conservez la preuve d'export. Pour les services, les règles varient selon la nature du service : les services B2B sont généralement taxables dans le pays du preneur (article 259-1° du CGI)." },
      { question: "Faut-il une déclaration en douane pour exporter ?", reponse: "Oui, pour les biens d'une valeur supérieure à 1 000 € ou d'un poids supérieur à 1 000 kg, une déclaration en douane (DAU) est obligatoire. En dessous de ces seuils, une déclaration simplifiée suffit. Le numéro EORI est nécessaire pour toute opération douanière." },
      { question: "Comment fonctionne le e-reporting pour les ventes internationales ?", reponse: "À partir de 2026, les données de vos transactions internationales (montant, TVA, pays du client) doivent être transmises à l'administration fiscale via une PDP. Cela concerne les ventes B2B intracommunautaires et exports, ainsi que toutes les ventes B2C. Le e-reporting complète la facturation électronique domestique." },
    ],
  },
]

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find(g => g.slug === slug)
}
