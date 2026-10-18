# Plan marketing de Qonforme — octobre 2026 → avril 2027

> Document interne, rédigé le 18/10/2026. **Il applique `DECISIONS-STRATEGIQUES.md`, qui fait foi** : aucun concurrent nommé, aucun démarchage, aucune promesse de contact humain, aucune affirmation invérifiable, vouvoiement. En cas de contradiction avec `STRATEGIE-CROISSANCE-2026-10.md`, c'est `DECISIONS-STRATEGIQUES.md` qui gagne.
>
> Les chiffres marqués *(hypothèse)* sont à recaler dès que les vrais chiffres (inscriptions, abonnés, revenu) sont connus : c'est la question ouverte n° 4 des décisions, et cette session n'y a pas accès (voir § 1).

---

## 0. L'essentiel

1. **Le trafic gratuit ne peut pas, seul, porter l'objectif.** Search Console, 28 derniers jours : environ 450 affichages et 3 à 4 clics pour tout le site. Le référencement est un moteur de 6 à 12 mois, pas de 90 jours.
2. **L'objectif de 3 500 €/mois est à recaler.** `DECISIONS-STRATEGIQUES.md` § 5 le calcule avec un panier de 19 € (185 abonnés). La grille du 02/10 l'a ramené à environ 11 € HT : il faut **environ 320 abonnés, soit environ 4 000 inscriptions** *(hypothèse de 8 % d'inscrits qui paient)*. À la montée prévue ici, on y arrive **à l'été 2027**, juste avant l'échéance du 1er septembre 2027 qui rend l'émission obligatoire pour les TPE.
3. **La publicité sur « logiciel devis … » perd de l'argent.** À 8-36 € le clic, un inscrit coûte 80 à 360 €, alors qu'un canal payant ne peut pas dépasser **environ 5 € par inscrit** pour que l'abonné se rembourse en 6 mois. L'ancien « test de 500 € sur Google Ads » est abandonné.
4. **Les canaux qui tiennent dans ce plafond** : les prescripteurs rémunérés au résultat, la boucle « Propulsé par Qonforme », les vidéos courtes, les réponses utiles dans les communautés, puis le référencement qui s'accumule.
5. **Avant tout : mesurer.** Aujourd'hui, seul le pixel Meta voit quelque chose ; l'inscription n'enregistre pas la provenance (`?source=` est perdu) ; GA4 n'est pas relié. Sans cela, on ne saura pas quel canal marche. C'est la semaine 1.

---

## 1. Où on en est (relevé du 18/10/2026)

### Ce que cette session a pu lire

| Source | Résultat |
|---|---|
| **Search Console** (via OpenSEO, 17/09-15/10) | Environ 450 affichages, 3 à 4 clics. Position moyenne 40 à 60. Accueil : 3 clics. `/modele` : 153 affichages, position 17,5. `/modele/devis-travaux` : 221 affichages, position 49,5. « devis modele » : 47 affichages, position 6,6, aucun clic. Ce qui reste d'affichages sur `/facturation/fleuriste`, `boulanger`, `avocat` vient des pages supprimées le 15/10 (404) : il va disparaître. |
| **GA4** | Non relié à OpenSEO (`ga4_not_connected`) |
| **Vercel Analytics** | Non lu : le projet Vercel n'est pas identifiable depuis la session, et on ne devine pas un identifiant |
| **Supabase de production** | Hors de portée : les trois projets visibles depuis la session ne sont pas celui de Qonforme (même constat que le 15/10) |
| **Stripe** | Non relié |

→ **Aucun chiffre d'inscriptions, d'abonnés ni de revenu.** Tout ce qui suit en dépend pour le recalage.

### Ce que le code mesure aujourd'hui

- **Pixel Meta seulement** : `Lead` (compte créé), `CompleteRegistration` (entreprise renseignée), `InitiateCheckout` (mur de paiement ou tarifs), `Purchase`, `Schedule` (générateur gratuit). Pas de « premier devis envoyé », pas de « première facture ».
- **Provenance** : l'inscription ne garde que `?ab=` (`landing_variant`). Le `?source=email-facture`, `pdf-devis`… des liens « Propulsé par Qonforme » (`lib/utils/powered-by.ts`) n'est **pas enregistré sur le compte**. La boucle de bouche-à-oreille construite le 10/10 n'est donc pas mesurable au niveau du compte.
- **Aucun programme de prescripteurs ni de parrainage** dans le code : ni lien dédié, ni suivi, ni versement.

### Ce qui est prêt et utilisable tout de suite

Modèles de devis Word, Excel et PDF ; exemples chiffrés (électricien) ; 14 outils gratuits ; 11 pages métier ; guides vérifiés (mentions d'un devis, d'une facture, TVA des travaux) ; lettre de relance ; démo ; accueil refait ; offre simple (devis gratuits, factures à partir de 12 € HT/mois, remboursé 30 jours).

---

## 2. L'arithmétique, corrigée

| Hypothèse | Valeur |
|---|---|
| Panier moyen Essentiel (moitié à 12 € par mois, moitié à 10 € par mois à l'année) | environ 11 € HT par mois |
| Objectif de revenu | 3 500 € par mois |
| **Abonnés nécessaires** | **environ 320** |
| Part des inscrits qui paient *(hypothèse, décisions § 5)* | 8 % |
| **Inscriptions nécessaires** | **environ 4 000** |
| Si un quart des abonnés prend Artisan (24 € HT, vendu dès que ses prix Stripe existent) | environ 255 abonnés, 3 200 inscriptions |
| Durée de vie d'un abonné *(hypothèse)* | 18 mois, soit environ 200 € HT |
| **Coût d'acquisition plafond** (remboursé en 6 mois) | **environ 60 € par abonné, soit 5 € par inscrit** |

### Montée prévue *(hypothèse)*

| | Nov. | Déc. | Janv. | Fév. | Mars | Avril | Mai | Juin | Juil. | Août |
|---|---|---|---|---|---|---|---|---|---|---|
| Inscriptions du mois | 60 | 120 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 800 |
| Inscriptions cumulées | 60 | 180 | 380 | 680 | 1 080 | 1 580 | 2 180 | 2 880 | 3 680 | 4 480 |
| Abonnés cumulés (8 %, sans résiliation) | 5 | 14 | 30 | 54 | 86 | 126 | 174 | 230 | 294 | **358** |

→ Le seuil de 320 abonnés est franchi en **août 2027**. Les résiliations le repousseraient de quelques semaines. La pente peut être plus forte : l'échéance de septembre 2027 fait monter la demande au printemps et à l'été, et c'est pour cela que les actifs durables (partenaires, pages, vidéos) se construisent maintenant.

### Ce que coûte une inscription, par canal

| Canal | Coût | Par inscrit | Dans le plafond de 5 € ? |
|---|---|---|---|
| Google Ads « logiciel devis [métier] » | 8 à 36 € le clic (OpenSEO, 16/10), 10 % des clics s'inscrivent *(hypothèse)* | 80 à 360 € | **Non (×16 à ×72)** |
| Prescripteur payé 30 € par abonné | 30 € × 8 % | 2,40 € | Oui |
| Boucle « Propulsé par Qonforme », vidéos, communautés, référencement | du temps | 0 € | Oui |
| Meta Ads (facebook, instagram) | clic inconnu, à mesurer | à mesurer | Seulement avec un clic sous 0,50 € : peu probable, test borné plus tard (§ 4.5) |

---

## 3. Message et preuves

### Le message, par profil (décisions § 4)

| Profil | Accroche | Preuve à montrer |
|---|---|---|
| **Le nouvel installé** | « Votre premier devis, prêt avant d'avoir quitté le chantier. Gratuit. » | Le générateur gratuit, l'exemple chiffré du métier, la démo |
| **L'installé sans logiciel** | « Fini Word et Excel : devis, factures et relances au même endroit. » | La démo, le passage d'un devis à une facture en un clic |
| **L'artisan qui grandit** | « Quand votre activité grandit, Qonforme suit. » (Artisan : toujours dire « bientôt » tant qu'il n'est pas en vente) | La page Tarifs, le détail de la formule |

**Phrase pivot, vraie et différenciante :** « Vos devis sont gratuits. Vous ne payez qu'à partir de votre première facture, quand l'argent rentre. » (décisions § 8)

**Angle d'actualité, vrai et daté :** la réception des factures est obligatoire depuis le 1er septembre 2026 ; l'émission le sera pour les TPE au 1er septembre 2027. Pas de marketing de la peur : on explique, on ne menace pas.

### Dire / ne pas dire

| On peut dire | On ne dit jamais |
|---|---|
| « Devis gratuits et illimités » | « Facturation gratuite » (les factures sont payantes) |
| « Sans carte bancaire pour commencer », « sans engagement », « remboursé 30 jours » | « Essai gratuit 14 jours » (n'existe pas) |
| « Solution compatible – Facturation électronique » avec le logotype officiel, une fois la preuve consignée (décisions § 13) | « Conforme », « certifié », « homologué », « plateforme agréée », « PDP » |
| « Réception des factures depuis le 1er septembre 2026, émission des TPE au 1er septembre 2027 » | Un concurrent, même en creux (« changez de logiciel », comparatifs) |
| Les chiffres de l'offre lus dans le code (12 € HT, 11 métiers, 30 jours) | Chiffres d'utilisateurs, avis, notes, témoignages, « des milliers d'artisans » |
| « Vos mentions d'assurance et de TVA sont dans le devis » | « Un conseiller vous répond », « appel », « visio », « notre équipe vous accompagne » |

**Fonctions à confirmer en ligne avant de les citer** : mentions du bâtiment et catalogue par métier, lien de règlement, relances réglables (leurs migrations du 03/10 étaient « à appliquer »), signature en ligne et réception des factures (« à venir » sur `/pricing` au 16/10). **Règle de sécurité : ne citer dans un contenu que ce que la page `/pricing` affirme déjà.**

---

## 4. Les canaux, par priorité

### 4.1 Prescripteurs (le canal le plus fort, à construire en premier)

**Pourquoi.** Environ 7 100 entreprises du bâtiment se créent chaque mois (INSEE). Chacune doit souscrire une décennale, ouvrir un compte, faire ses formalités, souvent voir un comptable. **Ceux qui les croisent à ce moment-là sont la seule voie vers le gros volume sans démarchage.**

**Cibles** (décisions § 3), par ordre de simplicité : courtiers en assurance décennale, plateformes de formalités, BGE / Initiative France / couveuses, chambres de métiers, centres de formation du bâtiment, négoces indépendants, experts-comptables spécialisés.

**Offre au prescripteur** : un lien dédié, un compte gratuit pour sa structure, une page à lui remettre ; rémunération au résultat, **30 € par abonné** (25 % du premier an d'Essentiel). Aucune exclusivité, aucun engagement. Le coût (2,40 € par inscrit) tient dans le plafond.

**À construire (aucun code n'existe)** : page `/partenaires`, lien `?ref=<code>` enregistré sur le compte à l'inscription, tableau du prescripteur (inscrits, abonnés, gain), liste des versements pour l'admin. Environ 3 à 5 jours.

**Volume attendu** *(hypothèse)* : 10 partenaires actifs qui font chacun connaître Qonforme à 40 créateurs par mois, 30 % s'inscrivent → **environ 120 inscriptions par mois**. Un seul partenaire de taille (courtier ou plateforme de formalités) vaut plus que dix petits.

**Point de vigilance.** « Aucun démarchage » vise les artisans. Un premier message à une institution qui prescrit est un cas à trancher (§ 7, question 1). Pour les experts-comptables, faire vérifier avant toute rémunération : leur déontologie peut limiter les commissions, auquel cas on offre un compte cabinet et on ne paie rien.

### 4.2 La boucle produit : chaque devis envoyé est une annonce

Environ 55 % du chiffre d'affaires des entreprises de 10 salariés ou moins vient de particuliers, 25 % d'entreprises privées, 12 % de sous-traitance et 7 % du secteur public (SDES, juin 2026) : **plus d'un tiers du chiffre d'affaires (37 %) vient d'autres entreprises, privées ou en sous-traitance** : des clients qui reçoivent un devis ou une facture de Qonforme et qui peuvent eux-mêmes être artisans.

À faire :
1. **Enregistrer la provenance à l'inscription** (`source`, `ref`, `ab`) dans `user_metadata`. Sans cela, la boucle ne se mesure pas. Environ 1 jour.
2. **Une ligne d'appel honnête** sur le PDF et la page de consultation du devis : « Devis réalisé avec Qonforme. Faites les vôtres gratuitement. » (vrai : les devis sont gratuits.) Tester deux formulations via `?source=`.
3. **Parrainage artisan à artisan** si le fondateur le valide (§ 7, question 3) : un mois offert de chaque côté, via un coupon Stripe.

**Volume attendu** *(hypothèse)* : nul au départ (il faut des artisans actifs qui envoient des devis), **environ 80 inscriptions par mois à partir d'avril**. C'est le canal qui grandit avec le produit.

### 4.3 Vidéo courte et communautés (gratuit, demande de la régularité)

- **Vidéos de 30 à 45 secondes** : captures de la démo avec voix off, une idée par vidéo (scripts en annexe C). Diffusion : YouTube Shorts, TikTok, Instagram Reels, Facebook. Une vidéo par semaine, quatre en stock avant de commencer.
- **Communautés** : groupes d'artisans et d'auto-entrepreneurs, forums du bâtiment. **Répondre aux vraies questions** (TVA des travaux, mentions d'un devis, relance d'un impayé), en disant d'où l'on parle, sans lien dans chaque message, en respectant le règlement du groupe. Annexe D.
- **Créateurs de contenu pour artisans** : leur offrir un compte, jamais d'avis écrit à leur place ni de faux témoignage (règle « aucun faux avis »).

**Volume attendu** *(hypothèse)* : environ 100 inscriptions par mois à partir de mars, très variable : une vidéo qui prend peut en apporter des centaines.

### 4.4 Référencement (déjà lancé, il paie plus tard)

- **Continuer le plan de `MOTS-CLES-COMPACTS-2026-10.md` § 0** : 7 pages d'exemple de devis restent à créer (`devis-vierge`, `devis-auto-entrepreneur`, `devis-paysagiste`, `devis-peinture`, `devis-maconnerie`, `devis-plomberie`, `devis-placo`), puis demander l'indexation de chacune dans la Search Console.
- **Deux réglages sans coût à regarder** : « devis modele » est en position 6,6 avec 47 affichages et aucun clic (titre et description de `/modele` à retravailler pour donner envie de cliquer) ; `/modele/devis-travaux` a 221 affichages en position 49 (la page existe, Google ne la classe pas encore : liens internes et exemple chiffré à renforcer).
- **Ne pas attendre de résultat avant 8 à 12 semaines** après chaque mise en ligne.

**Volume attendu** *(hypothèse)* : environ 100 inscriptions par mois à partir d'avril.

### 4.5 Publicité payante : seulement quand le suivi existe

- **Google Ads « logiciel devis … » : non** (§ 2).
- **Meta Ads (facebook, instagram) : un test borné à 300 €**, une fois les événements de la semaine 1 en place et au moins 100 inscrits pour calibrer le taux de passage. Cible : métiers du bâtiment, créateurs d'entreprise. Message : la phrase pivot. Critère d'arrêt : plus de 5 € par inscrit après 300 €.
- **Reciblage** des visiteurs des outils gratuits et du générateur de devis (le pixel est déjà là) : le seul usage payant qui a une chance de rester sous le plafond.

### Répartition visée en avril 2027 *(hypothèse)*

| Canal | Inscriptions par mois |
|---|---|
| Prescripteurs | 150 |
| Référencement | 100 |
| Vidéo et communautés | 100 |
| Boucle produit et parrainage | 80 |
| Direct, bouche-à-oreille, autres | 70 |
| **Total** | **500** |

---

## 5. Calendrier des 13 semaines

| Semaine | Objectif | À faire |
|---|---|---|
| **1** (19-25/10) | **Mesurer** | Enregistrer `source`, `ref`, `ab` à l'inscription ; relier GA4 ; ajouter les événements « premier devis envoyé » et « première facture émise » ; tableau d'acquisition de l'admin lu dans la base (inscrits, entreprise complétée, devis envoyé, facture, abonné, par provenance) ; consigner la preuve du label (décisions § 13) |
| **2** (26/10-01/11) | Préparer les prescripteurs | Page `/partenaires` ; lien `?ref=` ; tableau du prescripteur ; texte d'accompagnement (annexe B) ; liste de 30 prescripteurs classés par volume |
| **3** (02-08/11) | Premiers partenaires | Premiers contacts selon la règle décidée (§ 7, q. 1) ; 4 vidéos tournées ; ligne « Devis réalisé avec Qonforme » en test sur les PDF |
| **4** (09-15/11) | Régularité | 1 vidéo par semaine ; réponses utiles dans 3 communautés ; page `devis-vierge` en ligne |
| **5-6** (16-29/11) | Pages d'exemple | `devis-auto-entrepreneur` et `devis-peinture` en ligne, indexation demandée ; relance des partenaires qui n'ont pas répondu : un seul rappel |
| **7-8** (30/11-13/12) | Premier point chiffré | Lire le tableau d'acquisition ; recaler les hypothèses de ce plan avec les vrais chiffres ; décider du test Meta |
| **9-10** (14-27/12) | Pages d'exemple | `devis-paysagiste`, `devis-maconnerie` |
| **11-13** (28/12-17/01) | Bilan du trimestre | `devis-plomberie`, `devis-placo` ; bilan sur les seuils ci-dessous ; décision sur la suite |

### Seuils de décision *(hypothèses)*

Au 31/12/2026 (la montée du § 2 donne 180 inscriptions et 14 abonnés) : **au moins 150 inscriptions cumulées**, dont **40 % ont envoyé un premier devis (réel ou d'essai) dans les 7 jours**, et **au moins 10 abonnés**. En dessous, on ne pousse pas plus fort : on regarde où l'entonnoir fuit (inscription, entreprise, premier devis, première facture) avant d'ajouter un canal.

---

## 6. Mesure

### L'entonnoir à suivre, chaque lundi

1. Visiteurs (par provenance) → 2. Compte créé → 3. Entreprise renseignée → 4. **Premier devis envoyé** (réel ou d'essai) → 5. Mur de paiement affiché → 6. Abonnement → 7. Abonné encore actif à J+30.

Les étapes 3 à 7 se lisent dans la base (`companies`, `quotes`, `invoices`, `subscriptions`) : **aucun traceur ni cookie de plus**. Seules les étapes 1 et 2 demandent la provenance enregistrée en semaine 1.

### Tableau de la semaine

| Indicateur | Source |
|---|---|
| Inscriptions par provenance | base (`user_metadata`) |
| Part qui envoie un premier devis sous 7 jours | base |
| Délai du premier devis au mur de paiement | base |
| Abonnés, revenu, résiliations | Stripe |
| Clics et affichages, pages qui montent | Search Console |
| Partenaires actifs, inscrits et abonnés par partenaire | tableau du prescripteur |

---

## 7. Décisions à prendre par le fondateur

1. **Premier message à un prescripteur.** « Aucun démarchage » vise les artisans. Autorisez-vous **un seul message de présentation** à une institution ou une entreprise qui prescrit (BGE, chambre de métiers, courtier, plateforme de formalités), sans relance au-delà d'un rappel ? Sinon, seule la voie entrante reste : formulaires de partenariat des prescripteurs, salons, publications. Elle est plus lente.
2. **Rémunération des prescripteurs.** 30 € par abonné (recommandé), ou compte gratuit seulement. À faire relire par un juriste, en particulier pour les experts-comptables.
3. **Parrainage artisan à artisan.** Un mois offert de chaque côté, oui ou non.
4. **Qui est à l'image dans les vidéos ?** Vous, une voix off sur des captures de la démo (recommandé pour démarrer, aucune contrainte), ou un créateur.
5. **Budget et temps par semaine.** Zéro euro est tenable pour les canaux 1 à 4. Un test Meta de 300 € est la seule dépense proposée. Combien d'heures par semaine pour les partenaires et les vidéos ?
6. **Les vrais chiffres.** Donner à la session un accès en lecture au tableau de bord Stripe, aux comptes Supabase de production ou à GA4, ou coller ici : inscriptions par mois, abonnés, revenu mensuel, principales sources de trafic. C'est ce qui permet de remplacer les hypothèses de ce plan.
7. **La preuve du label** « Solution compatible » (plateforme raccordée, date, fonctions couvertes), à noter au § 13 de `DECISIONS-STRATEGIQUES.md`. Le logotype est un argument fort, mais il peut être contrôlé et retiré.

---

## Annexe A. Accroches prêtes à l'emploi

- Nouvel installé : « Votre premier devis, prêt avant d'avoir quitté le chantier. Gratuit. »
- Nouvel installé : « Vos devis sont gratuits. Vous ne payez qu'à partir de votre première facture. »
- Sans logiciel : « Fini Word et Excel. Devis, factures et relances au même endroit. »
- Sans logiciel : « Septembre 2027 : vos factures partiront sous un nouveau format. Autant commencer simplement. »
- Qui grandit : « Quand votre activité grandit, votre logiciel suit. »
- Boucle produit : « Devis réalisé avec Qonforme. Faites les vôtres gratuitement. »
- Référencement (titres de page) : « Exemple de devis de maçonnerie : modèle chiffré à télécharger », « Remplacement de tableau électrique : exemple de devis ».

## Annexe B. Texte pour les prescripteurs (page `/partenaires` et message d'accompagnement)

> **Un logiciel de devis gratuit pour vos créateurs du bâtiment.**
> Les artisans qui se mettent à leur compte ont d'abord besoin d'un devis correct, avant leur premier chantier. Avec Qonforme, leurs devis sont gratuits et illimités ; ils ne passent à la formule payante (12 € HT par mois, sans engagement, remboursée 30 jours) qu'au moment de leur première facture.
> **Pour vous :** un lien à votre nom, un compte gratuit pour votre structure, une rémunération de 30 € par abonné issu de votre lien [à confirmer, § 7 q. 2]. Aucune exclusivité, aucun engagement.
> Qonforme est fait pour les métiers du bâtiment : 11 métiers, TVA par ligne, mentions d'assurance. [Ne garder que ce que `/pricing` affirme déjà.]

*Adaptation courte :* courtier décennale (« au moment où votre client signe sa décennale, il a besoin de ses premiers devis »), BGE ou couveuse (« un outil que le créateur garde après l'accompagnement »), expert-comptable (« les devis et factures arrivent propres, avec le FEC prêt »).

## Annexe C. Scripts vidéo (30-45 secondes, captures de la démo, voix off)

1. **« Un devis de peinture en 2 minutes ».** Accroche : « Voilà comment faire un devis propre sans quitter le chantier. » Trois temps : catalogue du métier, TVA par ligne, envoi. Fin : « Gratuit, sans carte bancaire. »
2. **« Les 3 mentions qu'on oublie sur un devis ».** Assurance (décennale), déchets du chantier, certification du taux réduit de TVA. Source : le guide « Mentions obligatoires d'un devis ».
3. **« L'attestation de TVA à 10 % n'existe plus ».** Accroche : « On vous la réclame encore. Depuis mars 2025, une simple mention suffit. » Source : BOFiP, guide « TVA des travaux ». (140 recherches par mois sur « attestation tva 10 travaux ».)
4. **« Remplacement de tableau électrique : l'exemple de devis ».** On déroule l'exemple chiffré de la page (390 recherches par mois).
5. **« Relancer un impayé sans se fâcher ».** Trois mails, la lettre de mise en demeure, les pénalités (BCE + 10 points, 40 € entre professionnels). Source : la page lettre de relance.
6. **« Septembre 2027 : ce que ça change pour une TPE ».** Réception depuis le 1er septembre 2026, émission le 1er septembre 2027. Pas de peur : trois gestes simples.

Chaque vidéo : un seul appel à l'action, l'adresse de la page correspondante, jamais d'avis ni de chiffre d'utilisateurs.

## Annexe D. Réponses types pour les communautés

- Se présenter d'abord : « Je travaille sur Qonforme, un logiciel de devis et factures pour artisans. »
- Répondre à la question posée, avec la source officielle (service-public, BOFiP, Légifrance), **avant** de parler de Qonforme.
- Ne mettre un lien que s'il répond à la question (le modèle de devis, l'exemple chiffré, le guide) ; jamais de lien d'inscription seul.
- Suivre le règlement du groupe ; un message de promotion pure n'est pas posté.
- Exemple : « Pour la TVA à 10 %, l'attestation papier n'est plus obligatoire depuis la loi de finances pour 2025 : une mention sur le devis ou la facture suffit (sauf pour les travaux déjà en cours au 16 février 2025). Les modèles officiels sont au BOFiP (BOI-LETTRE-000280). J'ai mis le modèle de mention dans un guide si ça aide : [lien]. » (Source : `lib/legal/certification-tva.ts` et le guide « TVA des travaux » ; à relire contre le BOFiP avant de publier.)

---

## Garde-fous

- Pas un mot sur un concurrent, y compris dans les groupes et les commentaires.
- Pas d'appel ni de message à froid vers des artisans ; le moteur de prospection reste à l'arrêt.
- Pas de promesse de contact humain, de rendez-vous ni de message signé du fondateur.
- Pas de chiffre d'utilisateurs, d'avis, de note ou de témoignage tant qu'il n'est pas réel et vérifiable.
- Pas de dégradé, de halo ni d'élément flottant dans les visuels publics (règles de design du fondateur).
- Les pages destinées aux clients de l'artisan (règlement, signature) n'affichent pas de décor de marque ; la ligne « Devis réalisé avec Qonforme » reste discrète sur le document.
