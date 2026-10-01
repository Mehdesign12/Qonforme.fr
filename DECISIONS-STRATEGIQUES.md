# Décisions stratégiques — Qonforme

> **Document vivant.** Il consigne ce qui a été décidé avec le fondateur et ce qui reste ouvert.
>
> **Dernière mise à jour :** 1er octobre 2026.
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
| **2. L'installé sans logiciel** | 2 à 15 ans d'activité, factures sur Word, Excel ou carnet. L'échéance 2027 l'oblige à s'équiper | La simplicité, l'import de ses clients, une aide humaine pour démarrer | Essentiel, plus la mise en route accompagnée |
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
- **Canevas de référence :** https://claude.ai/artifact/QEPJmN9m1MdvkriB3RpAkG (13 écrans).
  - Le héros « Clair sobre » de l'accueil est **validé**.
  - Les autres écrans sont à relire.
  - Le bloc d'appel à l'action en bas de l'accueil a encore l'ancien fond bleu : il faut l'aligner.

## 7. Questions ouvertes

1. **Modèle d'accès** (mur de paiement ou gratuité partielle) : voir la section 8, recommandation en attente de décision.
2. **Grille de prix.** Proposition actuelle : Essentiel 12 € HT, Artisan 24 € HT, mise en route accompagnée 149 € HT (offerte avec l'abonnement annuel Artisan). L'offre gratuite « Réception » est remise en question (section 8).
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

### Recommandation, à valider : « Devis gratuits, factures payantes »

**Gratuit, sans carte bancaire :**
- création du compte, entreprise remplie depuis le SIRET, logo ;
- clients et catalogue de prestations pré-rempli selon le métier ;
- **devis illimités** ;
- la démo reste disponible.

**Le paiement se déclenche** au moment de créer ou d'envoyer la **première facture** (ou de transformer un devis en facture). C'est le moment où l'argent rentre.

**Écran de paiement :**
- garantie « satisfait ou remboursé » de 30 jours ;
- mise en route offerte avec l'abonnement annuel.

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
- Ajouter la garantie de 30 jours et la mise en route offerte avec l'abonnement annuel.

## 9. Ce que ce document remplace dans `STRATEGIE-CROISSANCE-2026-10.md`

| Section de la stratégie | Ce qui change |
|---|---|
| § 4.1 Niche limitée aux sous-traitants du second œuvre | Élargie : cœur et trois profils (§ 4 ci-dessus) |
| § 7, phase 3, points 1 et 2 : prospection par email et par téléphone | **Abandonnés** (§ 3) |
| Message « remplacez votre outil » et rachat de clients déjà équipés | **Abandonnés** (§ 3) |
| § 7 lot 8 et phase 3 : comparatifs « datés et sourcés » | Remplacés : retirer ou neutraliser, sans nommer de concurrent (§ 2) |
| § 5 : offre gratuite « Réception » et essai de 14 jours | En attente de décision sur le modèle d'accès (§ 8) |
| § 6 : objectif de 3 300 €/mois en décembre | À recaler : sans démarchage, plutôt vers le 6e à 9e mois, sauf budget publicitaire ou partenaire (§ 5) |

**Reste valable dans la stratégie :**
- lot 1 (vérité et conformité légale du site) ;
- lot 3 (Factur-X réellement valide) ;
- lot 4 (fiabilité Stripe) ;
- raccordement à une plateforme agréée ;
- fonctions chantier ;
- cycle d'emails et mesure de l'audience.
