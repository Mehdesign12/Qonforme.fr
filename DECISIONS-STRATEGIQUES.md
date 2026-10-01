# Décisions stratégiques — Qonforme

> **Document vivant.** Il consigne ce qui a été décidé avec le fondateur et ce qui reste ouvert.
>
> **Dernière mise à jour :** 1er octobre 2026 (accès libre au tableau de bord, aucun contact humain promis, écrans épurés, inventaire de la refonte en section 10).
>
> **Il complète `STRATEGIE-CROISSANCE-2026-10.md` (l'analyse de départ).** En cas de contradiction, **ce document fait foi**. La section 9 liste ce qu'il remplace.

---

## 1. Positionnement — validé

- **Cible :** les artisans du bâtiment, tous métiers, du travailleur seul jusqu'à une dizaine de salariés.
- **Promesse :** être **le premier et le dernier logiciel de facturation** de l'artisan. On démarre simplement, on grandit sans jamais changer d'outil.
- **Message principal du site :** « La facturation des pros du bâtiment, conforme de bout en bout. » C'est le héros validé sur le canevas de design.
- **Rôle des fonctions chantier :** situations de travaux, retenue de garantie, autoliquidation et accès comptable ne sont pas la promesse d'entrée. Ce sont **les raisons de rester** quand l'entreprise grandit.

## 2. Règles de communication — validées

- **Ne jamais mentionner un concurrent** en public : site, publicités, emails, contenus, réseaux sociaux. Qonforme a sa place, on ne se compare pas.
  - Conséquence : les 8 pages `/comparatif/*` (« Qonforme contre X ») doivent être retirées, ou transformées en guides neutres sans aucun nom, du type « Comment choisir son premier logiciel de facturation quand on est artisan ».
  - Les données de concurrence restent un outil interne, par exemple pour fixer les prix.
- **Aucune affirmation invérifiable :** pas de faux avis, pas de faux chiffres, pas de fausse homologation ou certification. Les éléments actuels du site sont listés dans le lot 1 de la stratégie.
- **Aucune promesse de contact humain :** pas d'appel, de visio, de rendez-vous, de « un humain vous répond » ni de message signé du fondateur. Ce service n'existe pas : le promettre serait une affirmation invérifiable de plus. Les emails partent au nom de Qonforme, sans inviter à répondre. L'aide passe par le produit : écrans clairs, devis d'essai, tableau de bord explorable.
- **Ton :** vouvoiement. Dates exactes de la réforme : réception obligatoire depuis le 1er septembre 2026, émission obligatoire pour les TPE au 1er septembre 2027. Pas de marketing de la peur.

## 3. Acquisition — validée

- **Pas de démarchage :** ni appels à froid, ni emails à froid.
  - Le moteur de prospection existant (`lib/scraping`, `lib/outreach`, crons `scraping-sirene`, `enrich-prospects`, `outreach-sequence`) reste à l'arrêt et doit être désactivé.
- **Pas de logique de remplacement :** on vise les entreprises qui **n'ont pas encore** de logiciel de facturation (nouvelles créations et entreprises encore sur papier, Word ou Excel), pas celles qui en ont déjà un.
- **Canaux retenus, là où se prend la décision du premier logiciel :**
  1. **Partenaires de la création d'entreprise**, sous forme de partenariats et non de démarchage des clients :
     - chambres de métiers, BGE, Initiative France, couveuses ;
     - plateformes de formalités juridiques ;
     - **courtiers en assurance décennale** (assurance obligatoire pour tout créateur du BTP) ;
     - experts-comptables qui accompagnent les créateurs ;
     - centres de formation du bâtiment et organismes de titres professionnels ;
     - négoces indépendants, au moment de l'ouverture d'un compte professionnel.
  2. **Référencement naturel sur l'intention « je démarre »**, en s'appuyant sur l'existant (pages métiers, 12 outils gratuits, modèles). Exemples : « devenir plaquiste à son compte », « ma première facture d'artisan », « mentions obligatoires sur un devis de peintre ». Chaque page mène vers l'inscription gratuite.
  3. **Bouche-à-oreille intégré au produit :** un lien « Propulsé par Qonforme » cliquable, avec suivi de provenance, sur les devis, les factures, les emails et la page de paiement. Les clients d'un artisan sont souvent d'autres artisans.
  4. **Contenu vidéo court** (tutoriels) et partenariats avec des créateurs de contenu qui parlent aux artisans.
  5. **Publicité payante éventuelle** sur les recherches de création d'entreprise. C'est de l'acquisition entrante, à arbitrer selon le budget.

## 4. Client idéal : un cœur, trois profils — validé

**Le cœur :** l'artisan du bâtiment, tous métiers, du travailleur seul jusqu'à environ 10 salariés, qui choisit son **premier** logiciel.

| Profil | Qui | Ce qu'il lui faut | Offre visée |
|---|---|---|---|
| **1. Le nouvel installé** | Ancien ouvrier ou chef d'équipe qui se met à son compte, en micro-entreprise ou en société | Un devis et une facture professionnels en 5 minutes, depuis le chantier, avec les bonnes mentions (décennale, franchise de TVA) et la conformité sans y penser | Gratuit (devis), puis Essentiel |
| **2. L'installé sans logiciel** | 2 à 15 ans d'activité, factures sur Word, Excel ou carnet. L'échéance 2027 l'oblige à s'équiper | La simplicité, l'import de ses clients, un démarrage guidé dans l'application | Essentiel |
| **3. L'artisan qui grandit** | Passe en société, embauche, travaille avec des entreprises ou en sous-traitance | Situations, retenue de garantie, autoliquidation, accès comptable, plusieurs utilisateurs | Artisan |

**Hors cible pour l'instant :**
- les entreprises déjà équipées d'un logiciel ;
- les plombiers dépanneurs, qui ont besoin de planning et de gestion d'interventions ;
- les entreprises générales de plus de 10 salariés (paiement direct des sous-traitants, compte prorata).

## 5. Chiffres de référence du marché

| Indicateur | Valeur | Source |
|---|---|---|
| Entreprises actives de la construction | 650 207 (2024), dont 619 159 de moins de 10 salariés et 218 746 micro-entrepreneurs | INSEE SIDE |
| Créations d'entreprises dans la construction | 85 629 en 2025 (environ 7 100 par mois), dont 50 052 micro-entrepreneurs | INSEE |
| Entreprises du BTP sans logiciel de facturation | 19 à 22 %, soit **environ 125 000 à 145 000**. Sans doute davantage, car les micro-entrepreneurs sont sous-représentés dans l'enquête | France Num 2026 ; Qonto/OpinionWay 2026 |
| **Marché « premier logiciel » sur 12 mois** | **Environ 210 000 à 230 000 entreprises** : les créations plus les entreprises non équipées. Le stock doit se résorber avant septembre 2027 | calcul |
| Marché total en valeur | Environ 130 M€ par an (650 000 entreprises × environ 200 €/an, soit le prix moyen réellement encaissé par un logiciel BTP établi) | calcul |
| Répartition du chiffre d'affaires des entreprises de 10 salariés ou moins | 55,5 % particuliers, 24,9 % entreprises privées, 12,3 % sous-traitance, 7,3 % secteur public | SDES, juin 2026 |
| Part des artisans travaillant en sous-traitance | 15 à 17 % | CAPEB, 2025 |
| Auto-entrepreneurs du BTP réellement actifs | 60 % des inscrits (169 102 sur 281 760 fin 2025) | Urssaf |

**Conséquences pour la stratégie :**
- Les nouveaux installés paient moins et disparaissent plus souvent. L'offre d'entrée doit les garder jusqu'au moment où ils peuvent payer.
- Sans démarchage, le démarrage est plus lent. Ordre de grandeur : 3 500 €/mois demandent environ 185 abonnés à 19 €, donc environ 2 300 inscriptions si environ 8 % des inscrits passent payants (hypothèse).
  - Dans les 90 jours, ce n'est atteignable qu'avec un trafic existant, un budget publicitaire ou un partenaire qui apporte du volume.
  - Sinon, l'objectif arrive plutôt vers le 6e à 9e mois.

**Sources :**
- https://www.insee.fr/fr/statistiques/2021271
- https://www.insee.fr/fr/statistiques/8721354
- https://www.francenum.gouv.fr/files/2026-09/Barom%C3%A8tre%20France%20Num%202026%20-%20Rapport.pdf
- https://www.statistiques.developpement-durable.gouv.fr/le-marche-de-la-construction-en-france-en-2023
- https://www.capeb.fr/www/capeb/media/2025-noteconj-1t25-v4.pdf
- https://open.urssaf.fr/explore/dataset/auto-entrepreneurs-par-departement-secteur/

## 6. Design — validé en partie

- **Identité conservée :** bleu Qonforme `#2563EB`, marine, Bricolage Grotesque, DM Sans et DM Mono. Elle est resserrée vers un rendu fintech sobre.
- **Refusé par le fondateur :** les fonds bleus avec dégradés ou halos (« ça fait IA »).
- **Retenu :**
  - héros sur fond blanc, textes et boutons centrés ;
  - boutons en pilule avec micro-interactions : survol, pression, focus ;
  - visuel produit intégré sans cartes collées ni rognées.
- **Verre liquide :** seulement sur les surfaces flottantes, sur ordinateur. Jamais sur mobile (règle iOS de `CLAUDE.md`).
- **Écrans épurés (demande du fondateur) :** une action principale par écran, des sous-titres d'une ligne, pas de surtitres, de badges décoratifs ni d'encarts d'aide empilés.
- **Icônes :** celles de la barre latérale de l'application (style Lucide), en trait fin (1,25), **sans fond, sans pastille ni carré arrondi**.
- **Canevas de référence :** https://claude.ai/artifact/QEPJmN9m1MdvkriB3RpAkG (environ 190 planches au 01/10/2026).
  - Le héros « Clair sobre » de l'accueil est **validé**.
  - Les autres écrans sont à relire.
  - Le bloc d'appel à l'action en bas de l'accueil a encore l'ancien fond bleu : il faut l'aligner.

## 7. Questions ouvertes

1. ~~Modèle d'accès~~ : **tranché le 01/10/2026**, « devis gratuits, factures payantes » (section 8).
2. **Grille de prix.** Proposition actuelle : Essentiel 12 € HT, Artisan 24 € HT (10 € et 20 € par mois à l'année). Plus de mise en route accompagnée : aucun contact humain n'est proposé (§ 2). L'offre gratuite « Réception » est remise en question (section 8).
3. **Plateforme agréée partenaire** pour devenir « Solution compatible » : Super PDP, Iopole ou autre.
   - Coût réel pour un éditeur à confirmer.
   - Repère public chez Super PDP : vérification d'identité de l'entreprise à 2 € HT par entreprise, plus un coût par facture.
4. **Vrais chiffres** (abonnés, revenu mensuel, trafic, inscriptions) pour recaler l'objectif de 3 000 à 4 000 €/mois.
5. **Livrables suivants demandés par le fondateur :**
   - un copywriting de haut niveau pour le site, les tarifs, l'onboarding, l'écran de paiement et les emails ;
   - un vrai parcours d'onboarding client.

## 8. Onboarding et mur de paiement

### État actuel

1. Démo gratuite avec données fictives.
2. Inscription.
3. **Paiement obligatoire avant tout usage**, sans essai ni gratuité. Le middleware renvoie tout compte sans abonnement vers `/signup/plan`.

**Intention du fondateur :** ne garder que les clients sérieux.

**Problèmes constatés :**
- Le site promet « gratuitement » et « sans carte bancaire » à plusieurs endroits. C'est faux aujourd'hui : il faut corriger quel que soit le modèle retenu.
- Le paiement arrive avant que l'artisan ait vu **son** document, avec **son** logo et **son** client. La démo montre l'entreprise de quelqu'un d'autre.
- Sans démarchage, chaque visiteur compte. Pour la cible « premier logiciel », payer avant d'essayer est le frein le plus fort.

### Décision validée le 01/10/2026 : « Devis gratuits, factures payantes »

**Maquettes du parcours :** rangée « Onboarding » du canevas de design (inscription, entreprise, prestations, premier devis, devis envoyé, première facture, bienvenue), la rangée « Étape 4 » avec le tableau de bord d'un compte neuf, plus la séquence de 5 emails et deux écrans mobiles. L'accueil et les tarifs ont été réécrits pour ce modèle.

**Gratuit, sans carte bancaire :**
- création du compte, entreprise remplie depuis le SIRET, logo ;
- clients et catalogue de prestations pré-rempli selon le métier ;
- **devis illimités** ;
- la démo reste disponible.

**Le paiement se déclenche** au moment de créer ou d'envoyer la **première facture** (ou de transformer un devis en facture). C'est le moment où l'argent rentre.

**Écran de paiement :**
- garantie « satisfait ou remboursé » de 30 jours ;
- sans engagement.

**Après l'inscription : pas de passage obligé par le devis (validé le 01/10/2026).** L'étape 4 est un écran « Par quoi voulez-vous commencer ? » avec quatre choix. Chacun donne un premier résultat concret, même sans client sous la main :

1. **Faire un vrai devis.**
2. **M'envoyer un devis d'essai** : un devis d'exemple à son nom, envoyé sur sa propre adresse email. Il porte la mention « Exemple », n'a pas de numéro et reste hors des devis et des chiffres.
3. **Facturer un chantier terminé** : la préparation est gratuite, le choix de la formule arrive à l'envoi. Le numéro de facture n'est attribué qu'à l'envoi, pour garder une numérotation continue.
4. **Je le ferai plus tard** : un rappel par email au moment choisi (ce soir 19 h, demain 7 h 30, samedi 9 h, autre moment).

**Accès libre au tableau de bord (validé le 01/10/2026).** L'artisan qui veut seulement regarder n'est jamais bloqué :
- « Explorer le tableau de bord » sous les quatre choix ;
- « Passer au tableau de bord » dans l'en-tête de chaque étape, dès l'étape 2 ;
- le même accès depuis le devis d'essai, le rappel, le devis envoyé, la bienvenue et l'email de relance à 7 jours.

Le tableau de bord d'un compte neuf montre trois premiers pas (faire un devis, recevoir les factures fournisseurs, importer ses clients), des compteurs à zéro et des listes vides qui expliquent ce qui s'y affichera. Rien n'est envoyé sans action de l'artisan.

**Indicateurs à suivre :**
- premier document envoyé, réel ou d'essai, le premier jour ;
- premier vrai devis sous 7 jours.

**Pourquoi ce modèle :**
- Dans le BTP, le devis précède la facture. Le premier besoin d'un nouvel installé est de décrocher des chantiers.
- L'artisan vit le moment de satisfaction avec ses propres données.
- Les devis portent « Propulsé par Qonforme » et sont vus par ses prospects.
- Il a déjà investi du temps (entreprise, clients, catalogue) quand il arrive au paiement.
- Les devis ne sont pas des factures électroniques : ils ne coûtent rien en frais de plateforme agréée.
- Le tri des clients sérieux se fait quand même, au moment où le sérieux est réel : la première facture.

**Formulation possible :** « Vos devis sont gratuits. Vous ne payez qu'à partir de votre première facture, quand l'argent rentre. »

**À surveiller :**
- part des inscrits qui créent un devis ;
- passage du premier devis au paiement ;
- délai jusqu'à la première facture.

Si certains n'utilisent que les devis sans jamais payer, on pourra plafonner (par exemple 10 devis par mois).

**Effort technique : environ 2 à 4 jours.**
- Ouvrir l'application aux comptes sans abonnement.
- Placer le mur de paiement sur la création ou l'envoi de facture, la conversion devis vers facture et l'inscription à la plateforme agréée. La conversion devis vers facture est aujourd'hui sans contrôle : c'est le trou relevé dans l'audit.

### Option B : garder le mur de paiement actuel en le rendant moins frustrant

- Retirer toutes les promesses de gratuité.
- Proposer une démo personnalisée : l'artisan saisit son SIRET et voit la démo à son nom, avec son entreprise.
- Ajouter la garantie de 30 jours.

## 9. Ce que ce document remplace dans `STRATEGIE-CROISSANCE-2026-10.md`

| Section de la stratégie | Ce qui change |
|---|---|
| § 4.1 Niche limitée aux sous-traitants du second œuvre | Élargie : cœur et trois profils (§ 4 ci-dessus) |
| § 7, phase 3, points 1 et 2 : prospection par email et par téléphone | **Abandonnés** (§ 3) |
| Message « remplacez votre outil » et rachat de clients déjà équipés | **Abandonnés** (§ 3) |
| § 7 lot 8 et phase 3 : comparatifs « datés et sourcés » | Remplacés : retirer ou neutraliser, sans nommer de concurrent (§ 2) |
| § 5 : offre gratuite « Réception » et essai de 14 jours | **Remplacés** par « devis gratuits, factures payantes » (§ 8). Plus d'essai de 14 jours ni d'offre gratuite « Réception » |
| § 0, § 4, § 4.2, § 5 et § 8 : « un humain derrière l'outil », fondateur visible, mise en route accompagnée en visio, support prioritaire par téléphone | **Abandonnés** : aucun contact humain n'est proposé (§ 2). L'aide passe par le produit |
| § 6 : objectif de 3 300 €/mois en décembre | À recaler : sans démarchage, plutôt vers le 6e à 9e mois, sauf budget publicitaire ou partenaire (§ 5) |

**Reste valable dans la stratégie :**
- lot 1 (vérité et conformité légale du site) ;
- lot 3 (Factur-X réellement valide) ;
- lot 4 (fiabilité Stripe) ;
- raccordement à une plateforme agréée ;
- fonctions chantier ;
- cycle d'emails et mesure de l'audience.

## 10. Ce que la refonte apporte à la plateforme (inventaire du 01/10/2026)

Chaque apport des maquettes est comparé au code en ligne.
- **Existe** : déjà en production.
- **Partiel** : une base existe, à compléter.
- **À construire** : absent du code.

Canevas : https://claude.ai/artifact/QEPJmN9m1MdvkriB3RpAkG

### Conformité 2026-2027 (la plus urgente)

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Réception des factures fournisseurs, raccordement à une plateforme agréée, inscription à l'annuaire | **À construire** : `/settings/ppf` est un guide manuel | Obligation légale depuis le 1er septembre 2026. C'est le premier argument de « conforme » |
| Cycle de la facture sur la plateforme (déposée, reçue, acceptée, refusée, payée) | **Partiel** : statuts saisis à la main, `ppf_status` jamais écrit | Visibilité réelle, moins de relances inutiles |
| Factur-X valide (profil EN 16931, PDF/A-3, motif d'exonération) | **À corriger** (stratégie, lot 1) | Condition pour devenir « Solution compatible » |

### Accès, offre et conversion

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| « Devis gratuits, factures payantes » : application ouverte sans abonnement, paiement à la première facture | **À construire** : paiement obligatoire avant tout usage, seule limite `canCreateInvoice` | Lève le principal frein pour un premier logiciel |
| Grille Essentiel 12 € / Artisan 24 € HT (10 € et 20 € à l'année), satisfait ou remboursé 30 jours | **À décider** : aujourd'hui Starter 9 € (10 factures/mois) et Pro 19 € | Panier moyen plus haut, garantie qui rassure |
| Lien « Propulsé par Qonforme » cliquable, avec provenance | **Partiel** : texte seul dans les emails et les PDF | Bouche-à-oreille mesurable, sans démarchage |
| Accueil et tarifs réécrits, sans faux avis ni promesse non tenue | **À construire** | Confiance. À noter : la FAQ tarifs affirme gérer l'autoliquidation, ce que le code ne fait pas |

### Premiers pas

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Entreprise remplie depuis le SIRET | **Existe** (`/api/sirene`) | — |
| Mentions BTP automatiques : franchise de TVA (art. 293 B), décennale avec champs dédiés | **Partiel** : modèle de texte libre à remplir | Documents conformes sans y penser |
| Catalogue de prestations pré-rempli selon le métier | **Partiel** : le catalogue démarre vide | Premier devis en 2 minutes |
| Écran « Par quoi commencer ? » et accès libre au tableau de bord | **Partiel** : fenêtre de bienvenue à 3 actions | Personne n'est bloqué ni forcé |
| Devis d'essai envoyé à soi-même | **À construire** | Premier résultat même sans client |
| Rappel « plus tard » au moment choisi | **À construire** | Récupère les inscrits pressés |
| Tableau de bord d'un compte neuf (premiers pas, états vides expliqués) | **Partiel** : états vides seulement | Activation |
| Séquence de 5 emails déclenchés par les actions | **Partiel** : email de bienvenue seulement | Activation et passage au payant |
| Logo personnalisé, avec aperçu sur un devis | **Existe** dans Paramètres › Préférences factures (import, photo depuis l'app, couleur). La maquette le place dans Paramètres › Entreprise avec un aperçu en direct | Documents à l'image de l'artisan |

### Devis, facture, paiement (le cœur)

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Acceptation du devis en ligne par le client | **À construire** : l'artisan change le statut à la main | Chantiers signés plus vite |
| Lien de paiement par carte ou virement dans la facture, page de paiement du client | **À construire** : IBAN seulement | Payé plus vite, argument de vente fort |
| Relances réglables (avant échéance, J+7, J+15) et relance des devis non signés | **Partiel** : J+30 et J+45 fixes, factures seulement | Trésorerie |
| Suivi d'ouverture des devis et factures | **À construire** | L'artisan sait quand relancer |
| Devis transformé en facture en un clic | **Existe** (ne vérifie pas la limite du plan) | — |
| Aperçu du document en direct pendant la saisie | **Partiel** : bouton « Aperçu PDF » | Moins d'erreurs |
| Numéro de facture attribué à l'envoi (brouillons sans numéro) | **À construire** : numéro dès la création | Numérotation continue, conforme |

### Fonctions du bâtiment (les raisons de rester)

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Situations de travaux, acomptes, retenue de garantie, autoliquidation | **À construire** | Justifie l'offre Artisan, garde les clients qui grandissent |
| Suivi par chantier | **À construire** | Vision claire par chantier |
| TVA par ligne (5,5 / 10 / 20 %) | **Existe** | — |
| Bons de commande, avoirs | **Existent** | — |

### Pilotage et équipe

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Tableau de bord : encaissé, à encaisser, en retard, prévision à 30 jours | **Partiel** : pas de prévision. Bug : une facture relancée passe au statut `overdue` et sort des montants « en attente » et « en retard » | Pilotage fiable |
| Trésorerie | **À construire** | Anticiper les mois creux |
| Liste des factures : recherche, vues enregistrées, actions groupées | **Partiel** : filtres par statut | Gain de temps au-delà de 50 factures |
| Recherche globale ⌘K | **À construire** (composant présent, non branché) | Rapidité |
| Exports comptables | **Partiel** : FEC seulement | Le comptable reçoit ce qu'il attend |
| Accès pour le comptable et l'équipe | **À construire** : un seul utilisateur | Prescription par les comptables |
| Plusieurs entreprises par compte | **À construire** | Artisans qui ont plusieurs structures |

### Mobile

| Apport | Aujourd'hui | Valeur |
|---|---|---|
| Application iOS (push, photo, partage) | **Existe** | — |
| Parcours mobiles : devis sur le chantier, paiement de la première facture | **Partiel** : l'app charge le site | Le devis se fait là où se décide le chantier |

### Ordre suggéré, à valider

1. **Réception des factures fournisseurs et plateforme agréée.** C'est une obligation légale.
2. **« Devis gratuits, factures payantes ».** Il faut aussi retirer de la page tarifs ce qui n'existe pas (autoliquidation, support prioritaire).
3. **Acceptation du devis en ligne et lien de paiement.** C'est la plus grosse valeur perçue.
4. **Mentions BTP automatiques et catalogue par métier.** C'est ce qui permet le premier devis en 2 minutes.
5. **Relances réglables et correction du bug `overdue`.**
6. **Situations, acomptes, retenue de garantie, autoliquidation.** C'est l'offre Artisan.
