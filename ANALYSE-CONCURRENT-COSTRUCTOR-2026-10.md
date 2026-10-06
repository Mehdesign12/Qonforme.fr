# Analyse concurrentielle : Costructor

> **Document interne.** Ce concurrent ne doit jamais être nommé dans un contenu public : site, emails, publicités, réseaux sociaux (`DECISIONS-STRATEGIQUES.md` § 2). Les données de concurrence servent à décider, pas à se comparer en public.
>
> Relevé le **05/10/2026** sur costructor.co (accueil, tarifs avec le tableau détaillé, 9 pages fonctions, outils, mentions légales, pages partenaires, plan du site), la page partenaire de la CAPEB, la presse spécialisée et le registre des entreprises. Côté Qonforme : le code de la branche principale au 05/10/2026. Sources en fin de document.

---

## 0. En bref

**C'est bien un concurrent direct.** Même cible (artisans du bâtiment, premier logiciel, du travailleur seul à la petite équipe), même porte d'entrée (gratuit sans carte bancaire), prix très proches (15 € HT contre 12 € HT).

**Ses trois avantages décisifs aujourd'hui :**

1. **La facturation électronique fonctionne déjà de bout en bout** : raccordement à deux plateformes agréées (Pennylane et Super PDP), émission et réception, y compris dans l'offre gratuite. Qonforme produit un Factur-X valide mais **n'est raccordé à aucune plateforme**, alors que la réception est obligatoire depuis le 1er septembre 2026.
2. **Le partenariat officiel avec la CAPEB** (signé le 27/08/2026) : la première organisation des artisans du bâtiment (plus de 60 000 adhérents) recommande ce logiciel à ses membres. C'est exactement notre cible, au moment exact où elle s'équipe.
3. **L'ampleur** : devis par IA (à la voix), bibliothèque Batiprix et catalogues fournisseurs, planning, interventions, stock, feuilles d'heures, banque, plusieurs utilisateurs, support humain par téléphone le soir et le week-end.

**Les avantages réels de Qonforme :**

1. **Moins cher sur ce dont un artisan seul a besoin.** Relances automatiques et export FEC : 12 € HT chez Qonforme, 30 € HT chez lui (formule Business+). Signature en ligne illimitée et paiement par virement sans frais à l'acte.
2. **Un gratuit plus utile pour décrocher le premier chantier** : chez Qonforme, le devis gratuit part par email avec le PDF et le logo. Son offre gratuite n'inclut ni l'envoi par email, ni la personnalisation, ni les avoirs (d'après son propre tableau des tarifs).
3. **La rigueur juridique**, vérifiable : mentions du bâtiment générées et figées à l'émission, Factur-X EN 16931 validé par les schématrons officiels, documents émis immuables côté serveur, signature qui gère la rétractation et la certification du taux réduit.

**Ce qui doit se passer maintenant :** raccorder une plateforme agréée (son partenaire Super PDP est celui que nous avions déjà repéré, l'adaptateur `lib/pa` est prêt), appliquer les migrations en attente pour que les fonctions construites soient visibles, et occuper les canaux de prescription qui restent libres (courtiers en décennale, centres de formation, comptables des créateurs).

---

## 1. Qui est Costructor

| | |
|---|---|
| Éditeur | JMJi Groupe, SAS au capital de 1 000 €, Nantes, RCS 918 895 277 |
| Création | 1er septembre 2022 ; marque déposée en 2023 |
| Dirigeants visibles | Mathieu Affejee (président), Romain Soudry (directeur des opérations) ; un responsable éditorial, journaliste de formation |
| Comptes | Non publiés (chiffre d'affaires et effectif inconnus) |
| Hébergement | Clever Cloud (Nantes) pour l'application, o2switch pour le site ; site vitrine sous WordPress |
| Pays | France, et Belgique (Bancontact, « adapté à la législation belge » dans un témoignage) |
| Slogan | « Le logiciel BTP boosté à l'IA pour vos devis et factures » |
| Cible affichée | Artisans, TPE et PME du bâtiment, « des indés à la boîte de 100 salariés » ; 14 métiers, dont architectes, paysagistes, jardiniers, décorateurs |
| Preuve sociale affichée | 4,9/5 sur plus de 650 avis Google ; « 140 000 clients satisfaits » ; « 2 millions de devis » ; « 500 000 chantiers » |

Le nombre d'utilisateurs annoncé varie selon la source : 80 000 (comparateur plus ancien), 135 000 (page CAPEB), 140 000 (site), 150 000 (communiqué du 27/08/2026). Il s'agit probablement de comptes créés, gratuits compris. Rien ne permet de le vérifier.

---

## 2. Son offre et ses prix

### Grille (prix HT, relevés le 05/10/2026)

| Formule | Mensuel | Annuel (équivalent mensuel) | Utilisateurs |
|---|---|---|---|
| Starter | Gratuit | Gratuit | 1 |
| Pro | 15 € | 150 € (12,50 €) | 1 |
| Business+ | 30 € | 300 € (25 €) | 1, + 10 € par utilisateur (8,33 € à l'année) |
| Premium | 60 € | 600 € (50 €) | 1, + 10 € par utilisateur (8,33 € à l'année) |

**Options payantes en plus :** synchronisation avec un logiciel comptable et accès API avec serveur MCP (10 € HT par mois chacun, inclus en Premium) ; bibliothèque Batiprix (abonnement annuel par lot de métier, prix non affiché) ; signature et paiement en ligne à 0,90 € HT l'unité en Pro (illimités dès Business+).

**Conditions :** essai de 14 jours des formules payantes sans carte bancaire, sans engagement, « satisfait ou remboursé », offre « Jeune entreprise » pour les entreprises de moins d'un an, abonnement payable par carte, prélèvement SEPA, Apple Pay ou Google Pay.

### Ce que contient chaque formule (d'après son tableau détaillé)

- **Starter (gratuit)** : devis et factures illimités, facturation électronique en émission et en réception via la plateforme agréée partenaire, répertoire clients, site internet d'une page. **Pas** d'envoi des documents par email, pas de personnalisation, pas d'avoir, pas d'acompte, pas de support.
- **Pro (12,50 à 15 €)** : envoi par email et suivi d'ouverture, personnalisation, avoirs, acomptes, portail client, signature sur place, signature électronique des devis, 2 devis par IA par mois, bibliothèque d'articles, chantiers en tableau Kanban, livre des recettes, aide à la déclaration Urssaf, 1 connexion bancaire, accès du comptable, support par chat et téléphone.
- **Business+ (25 à 30 €)** : situations de travaux, retenue de garantie, bons de commande et de livraison, primes CEE et révisions de prix, photos et pièces jointes dans les documents, relances automatiques, signature et paiement en ligne illimités, 10 devis par IA par mois, import de DPGF, DQE et BPU par IA, achats avec lecture des justificatifs (OCR), fournisseurs, stock, planning de chantier, PV de réception, interventions, équipes et rôles, export FEC, 2 connexions bancaires, support prioritaire.
- **Premium (50 à 60 €)** : agent IA, IA illimitée, feuilles d'heures, portail client des chantiers, trésorerie et prévisionnel, tableau de pilotage, tags analytiques, paiement par carte via Stripe, SMTP personnalisé, synchronisation comptable et API incluses.

### Facturation électronique

- Raccordement à **deux plateformes agréées : Pennylane et Super PDP**. Le site parle aussi de « solution agréée » et de « solution officiellement compatible », mais l'éditeur n'est pas lui-même plateforme agréée.
- Émission, réception et e-reporting annoncés, **gratuits dans toutes les formules**. Activation de la réception en 3 jours ouvrés après l'inscription (SIREN, Kbis, RIB demandés).
- Factur-X en émission et en réception ; profil et validation non précisés.

### Intelligence artificielle

- Devis rédigé à partir d'une phrase ou d'une **dictée vocale** (« rénovation de salle de bain 12 m² avec pose de baignoire »), lignes, quantités et prix calculés par l'IA, puis modification en langage naturel (« ajoute une ligne de peinture à 35 €/m² »).
- Import de DPGF, DQE et BPU (documents d'appel d'offres) par IA, assistant de rédaction, agent IA qui pilote le compte, serveur MCP, OCR des factures d'achat, suggestions de rapprochement bancaire et de catégories.
- Quotas : 2 par mois en Pro, 10 en Business+, illimités en Premium.

### Chiffrage

- **Batiprix** (partenaire officiel) : 28 000 ouvrages avec décomposition et temps de pose, mis à jour chaque mois, 9 lots vendus séparément.
- **Extension de navigateur** qui ajoute un produit depuis le site de plus de 100 négoces (Point P, Cedeo, Leroy Merlin, Brico Dépôt, Chausson…) ; « bibliothèque de plus de 100 millions d'articles ».
- Déboursé sec, frais généraux, marge par ligne, indicateur de marge en direct.

### Support et accompagnement

- Support humain basé en France, par chat (Crisp), email et téléphone (numéro affiché), y compris le soir et le week-end, selon les avis.
- Formation de découverte gratuite, webinaires hebdomadaires, migration des données gratuite (clients, bibliothèque, historique).

---

## 3. Fonction par fonction

Légende Qonforme : **Gratuit**, **Essentiel** (12 € HT, 10 € à l'année), **Artisan** (24 € HT, 20 € à l'année, en vente dès que ses prix Stripe sont configurés). « Migration » : construit dans le code, masqué tant que la migration correspondante n'est pas appliquée en production.

| Fonction | Costructor | Qonforme |
|---|---|---|
| Devis illimités | Gratuit | Gratuit |
| Envoi du devis par email avec logo | Pro | **Gratuit** |
| Factures illimitées | Gratuit, mais sans envoi par email | Essentiel |
| Avoirs | Pro | Essentiel |
| Bons de commande | Business+ | **Gratuit** |
| Factures d'acompte | Pro | Artisan (migration) |
| Situations de travaux | Business+ | Artisan (migration) |
| Retenue de garantie | Business+ | Artisan (migration), avec lettre de demande de libération |
| Autoliquidation en sous-traitance | Annoncée, formule non précisée | Artisan (migration), catégorie AE dans le Factur-X |
| Mentions légales du bâtiment | « Automatiques » | Profil légal détaillé (décennale, EI, RCS, franchise de TVA), mentions **figées à l'émission** (migration) |
| Signature en ligne des devis | Pro (0,90 € l'unité selon le tableau), illimitée en Business+ | Essentiel, illimitée, devis **et** bons de commande ; code par email au-delà de 5 000 € TTC, rétractation et démarrage anticipé pour un particulier, certification du taux réduit (migration) |
| Signature sur place | Pro | Essentiel (migration) |
| Paiement en ligne par le client | 0,90 € HT par paiement en Pro, illimité en Business+, carte bancaire via Stripe en Premium ; « e-paiement » et « e-virement » annoncés | Page de règlement par **virement**, QR code SEPA, « J'ai effectué le virement », sans frais (migration). Pas de carte, par décision (§ 12) |
| Relances automatiques | Business+ | **Essentiel**, réglables avant et après échéance, relance des devis sans réponse (migration ; J+30 et J+45 d'ici là) |
| Suivi d'ouverture des documents | Pro | Non |
| Portail client | Pro (documents), Premium (chantier) | Non (pages de signature et de règlement seulement) |
| Photos et pièces jointes dans les documents | Business+ | Non |
| Primes CEE, révision de prix, compte prorata | Pro et Business+ | Non |
| Bibliothèque de prix | Batiprix (payant), catalogues de 100 négoces | Catalogue personnel, import des prestations courantes de 11 métiers **sans prix** |
| Devis par IA, dictée vocale | Pro (2 par mois) à Premium | Non |
| Import DPGF / DQE / BPU | Business+ | Non |
| Factur-X | Annoncé, sans précision | **EN 16931 validé** (veraPDF, schématrons CEN et AFNOR BR-FR), PDF/A-3 |
| Émission via plateforme agréée | **Oui, gratuit** | **Non** : aucune plateforme raccordée (`PA_PROVIDER` « none ») |
| Réception des factures fournisseurs | **Oui, via la plateforme, gratuit** | Boîte « Factures reçues » par import manuel (PDF Factur-X, CII, UBL), cycle de vie aux codes DGFiP, local (migration). Pas d'annuaire |
| E-reporting | Annoncé | Non |
| Achats (OCR, fournisseurs, paiements partiels) | Business+ | Non |
| Suivi par chantier | Pro (Kanban), Business+ (rentabilité, planning, PV de réception) | Artisan : signé, facturé, encaissé, reste à facturer, retenues (migration) |
| Planning, Gantt, interventions, stock, feuilles d'heures | Business+ et Premium | Non (hors cible : `DECISIONS-STRATEGIQUES.md` § 4) |
| Connexion bancaire, rapprochement | Pro (1 compte) à Premium | Non |
| Livre des recettes, aide Urssaf | Pro | Non |
| Export FEC | **Business+ (25 à 30 €)** | **Essentiel (10 à 12 €)** |
| Accès du comptable | Gratuit dès Pro | Gratuit pour tous : lecture, FEC, CSV, PDF en ZIP, journal des consultations (migration) |
| Synchronisation logiciel comptable | Option à 10 € par mois | Non |
| Trésorerie prévisionnelle | Premium | Non |
| Plusieurs utilisateurs | Business+ et Premium, 10 € par utilisateur | Non |
| API, serveur MCP | Option à 10 € par mois | Non |
| Site vitrine | Gratuit, une page | Non |
| Démonstration | Sur rendez-vous avec l'équipe | **Démo publique complète, sans inscription** (`/demo`) |
| Démarrage guidé | Formation et webinaires | Écran « Par quoi commencer ? », devis d'essai envoyé à soi-même, rappel « plus tard », 5 emails déclenchés par les actions (migration) |
| Mobile | Site responsive ; « appli iOS et Android » annoncée, aucune fiche trouvée sur les stores ; pas de hors-ligne | Site responsive installable (PWA) ; pas de hors-ligne |
| Support | Humain : chat, téléphone, soir et week-end (formules payantes) | Aucun contact humain, par décision (§ 2) : aide dans le produit |
| Essai et garantie | 14 jours des formules payantes, satisfait ou remboursé | Gratuit sans limite de durée, remboursé sous 30 jours |

**Attention :** la colonne Qonforme décrit le code. Une grande partie de ce qui a été construit les 02 et 03/10/2026 reste **invisible en production** tant que les migrations correspondantes ne sont pas appliquées. L'état réel de la base de production n'a pas pu être vérifié pendant cette analyse. Si ces migrations ne sont pas appliquées, un artisan qui compare aujourd'hui voit un Qonforme sans signature en ligne, sans lien de paiement, sans relances réglables, sans offre Artisan ni réception.

---

## 4. Ce que paie un artisan, profil par profil

Prix HT, à l'année.

| Besoin | Costructor | Qonforme | Écart |
|---|---|---|---|
| **Le nouvel installé** : devis et factures envoyés par email, signature en ligne | Pro : 150 € (+ 0,90 € par signature selon le tableau) | Devis gratuits, Essentiel : 120 €, signatures illimitées | **30 € de moins** chez Qonforme, sans frais à l'acte |
| **L'installé sans logiciel** : relances automatiques et export FEC pour le comptable | Business+ : 300 € | Essentiel : 120 € | **180 € de moins** chez Qonforme |
| **L'artisan qui grandit** : situations, retenue, suivi par chantier, un collaborateur | Business+ : 300 € + 100 € (utilisateur) = 400 € | Artisan : 240 €, **sans** collaborateur possible | Moins cher, mais incomplet |
| **Celui qui veut tout gratuitement** : factures illimitées, facturation électronique | Starter : 0 € (sans envoi par email) | Pas de facture émise sans formule | **Avantage Costructor** |

Lecture : l'écart de prix sur l'entrée de gamme (30 € par an) est trop faible pour faire choisir à lui seul. Il devient net dès que l'artisan veut des relances automatiques ou l'export comptable. Le vrai point de friction est le dernier profil : face à « factures électroniques gratuites pour toujours », notre « factures payantes » doit se justifier par autre chose que le prix.

---

## 5. Distribution et marketing

### Prescripteurs : sa force principale

- **CAPEB, partenaire officiel depuis le 27/08/2026** : page dédiée sur le site de la CAPEB, 10 % de remise la première année, webinaires communs sur la réforme (juin à août 2026), citation du président de la CAPEB dans le communiqué. Relayé par la presse du bâtiment (Batijournal, 01/09/2026).
- **MAPEI** (fabricant de mortiers et colles) : tarifs réservés dans le programme de fidélité des artisans « MAESTRO ».
- **Une quarantaine de pages partenaires** (39 dans le plan du site, `/a/<partenaire>`) : cabinets et conseils en gestion de TPE, secrétariats indépendants, agences. Chaque partenaire a sa page « Recommandé par … ». C'est un programme de prescription par les professionnels qui accompagnent les artisans.
- Partenaire Batiprix ; logos de presse affichés (BFM Business, Maison & Travaux, France Num, Batiweb).

### Référencement

- 14 pages métiers, 9 pages fonctions, environ 76 articles de blog (salaires, devenir artisan, exemples de devis par métier, DPGF, DQE, BPU, réforme, autoliquidation…).
- **35 calculatrices techniques** gratuites (béton, peinture, placo, carrelage, toiture, VMC, chauffage…), « conçues avec l'aide de l'IA », plus une estimation de travaux et une vérification de SIRET.
- Pages « alternative à » qui **nomment des concurrents** (trois éditeurs du marché), avec tableau comparatif et offre de migration.
- Site vitrine gratuit comme produit d'appel (« Le 1er site internet 100 % gratuit pour les artisans du BTP »).

### Comparaison avec Qonforme

Qonforme a **plus de pages utiles à l'intention « je démarre »** : 12 outils réglementaires (TVA, pénalités, seuils, SIRET, générateurs de facture et de devis), guides vérifiés sur les textes, 9 pages « devenir … à son compte », glossaire, modèles. Ses calculatrices techniques visent une autre intention (chiffrer un chantier, souvent par des particuliers).

La différence est ailleurs : **lui est recommandé par les organisations où l'artisan s'informe ; Qonforme n'a encore aucun prescripteur.**

---

## 6. Ses points faibles (constats internes, à ne jamais publier)

- **Gratuit moins généreux que son discours.** « Facturation électronique gratuite et illimitée, pour toujours » ; mais en gratuit, d'après son propre tableau : pas d'envoi par email, pas de personnalisation, pas d'avoir pour corriger une erreur, pas de support.
- **Coûts qui s'empilent.** Signature et paiement à 0,90 € l'unité en Pro, utilisateurs à 10 €, synchronisation comptable et API à 10 € chacune, Batiprix par lot. L'export FEC, que tout comptable demande, n'arrive qu'à 25 €.
- **Affirmations difficiles à vérifier.** « Logiciel certifié loi anti-fraude à la TVA » sans certificat cité ; « plateforme certifiée ISO » sans norme ; « partenariat avec Peppol » (Peppol est un réseau, pas une entreprise) ; nombre d'utilisateurs qui change selon la page ; statistiques non sourcées (« 45 % de devis acceptés en plus », « 32 % d'impayés en moins »).
- **Prix générés par l'IA.** « Lignes, quantités et prix calculés automatiquement », « prix actualisés par l'IA » : un prix inventé sur un devis signé engage l'artisan.
- **Largeur.** Une cible qui va de l'auto-entrepreneur à l'entreprise de 100 salariés, plus les architectes, les paysagistes et la Belgique. Plus de 100 fonctions : le risque est une interface chargée pour l'artisan seul. Les avis publics disent pourtant le contraire (simplicité très citée) : ce n'est pas un angle d'attaque fiable.
- **Pas de mode hors ligne**, pas d'application trouvée sur les stores.

Ces points servent à **positionner Qonforme sans le citer** : dire ce que fait Qonforme (« vos devis partent par email avec votre logo, gratuitement », « relances et export comptable dès 12 € », « aucun frais à la signature ni au paiement »), jamais ce que l'autre ne fait pas.

---

## 7. Bilan

| | Costructor | Qonforme |
|---|---|---|
| Conformité 2026 réelle (plateforme agréée) | **Fait** | À faire, urgent |
| Prescripteurs | **CAPEB, MAPEI, ~40 partenaires** | Aucun |
| Ampleur fonctionnelle | **Très large** | Centrée sur devis, facture, paiement, BTP de base |
| IA | **Devis vocal, imports, agent** | Aucune dans l'application |
| Accompagnement humain | **Oui** | Non, par décision |
| Preuve sociale | 650+ avis Google affichés | Aucune (et aucune fausse, par décision) |
| Prix pour l'artisan seul | 12,50 à 25 € selon les besoins | **10 à 12 €**, relances et FEC compris |
| Gratuit pour décrocher un premier chantier | Devis sans envoi par email | **Devis envoyé par email avec logo** |
| Frais à l'acte | 0,90 € par signature ou paiement en Pro | **Aucun** |
| Rigueur juridique démontrable | Affirmée | **Démontrable** (Factur-X validé, mentions figées, immutabilité, rétractation) |
| Démo sans inscription | Non (sur rendez-vous) | **Oui** |

---

## 8. Recommandations, par ordre d'urgence

### 1. Raccorder une plateforme agréée — maintenant

C'est le seul écart qui peut faire perdre un artisan **à coup sûr** : depuis le 1er septembre 2026, il doit pouvoir recevoir ses factures fournisseurs par une plateforme agréée. Un logiciel gratuit qui le fait déjà gagnera contre un logiciel payant qui ne le fait pas.

- **Super PDP**, déjà repéré (`STRATEGIE-CROISSANCE-2026-10.md` § 3.1, `DECISIONS-STRATEGIQUES.md` § 7.3), est l'un des deux partenaires de Costructor : la voie est prouvée pour un logiciel du bâtiment. Repères publics : 0,01 € HT par facture par API, 2 € HT de vérification d'identité par entreprise.
- Côté code, **corrigé le 06/10/2026** : il ne suffit pas d'un fichier. Super PDP raccorde chaque artisan par OAuth (un jeton par entreprise) et n'a pas encore de webhook, alors que l'interface `lib/pa` supposait des clés globales et un webhook. Il faut compter environ 50 à 70 h pour la réception, puis 55 à 75 h pour l'émission. Plan détaillé : `PLAN-PLATEFORME-AGREEE-2026-10.md`.
- Puis : émission par la plateforme (obligatoire pour les TPE au 1er septembre 2027), e-reporting. L'inscription à l'annuaire se fait pendant le parcours de raccordement de l'artisan, chez Super PDP.
- Décision liée (§ 7.6 de `DECISIONS-STRATEGIQUES.md`) : **garder la réception gratuite pour tous**. Le concurrent la donne gratuitement ; la faire payer serait un argument contre nous.

### 2. Mettre en production ce qui est construit

Appliquer les migrations du 03/10/2026 (mentions du bâtiment, numéro à l'émission et relances, lien de paiement, signature, accès comptable, réception, formule Artisan, démarrage), créer les prix Stripe Artisan et le cron `/api/cron/onboarding`. Sans cela, la comparaison de la section 3 est fausse en notre défaveur.

Corriger aussi `lib/stripe/plans.ts` : la signature en ligne et la réception y sont encore « à venir » alors qu'elles sont construites (à basculer en « inclus » au moment où leurs migrations passent).

### 3. Occuper les prescripteurs qui restent libres

La CAPEB est prise, la CMA travaille déjà avec un autre éditeur (stratégie § 3.2). Restent, dans la liste validée (§ 3 des décisions), ceux qui voient l'artisan **au moment où il choisit son premier logiciel** :

- **courtiers et assureurs en décennale** : assurance obligatoire pour tout créateur du bâtiment, et Qonforme imprime déjà les mentions d'assurance ;
- **centres de formation du bâtiment** (CFA, AFPA, organismes de titres professionnels) : les futurs installés, avant qu'ils aient un logiciel ;
- **experts-comptables des créateurs** : l'accès comptable gratuit et le FEC dès 12 € sont de vrais arguments pour eux ;
- **négoces indépendants**, à l'ouverture d'un compte professionnel ;
- **fabricants** : le programme MAPEI montre que ce canal existe.

Outil à construire : une page par partenaire (`/partenaire/<nom>`) avec provenance suivie jusqu'à l'abonnement, et le lien « Propulsé par Qonforme » rendu cliquable (aujourd'hui texte seul, § 10 des décisions). Aucun démarchage : ce sont des partenariats.

### 4. Dicter un devis, sans prix inventé

Le devis dicté au téléphone, chez le client, correspond exactement à la promesse du profil « nouvel installé » (« un devis en 5 minutes, depuis le chantier »). Version Qonforme, compatible avec nos règles :

- la voix ou une phrase produisent des **lignes et des quantités** ;
- les prix viennent **uniquement** du catalogue de l'artisan ; une prestation sans prix reste « Prix à compléter », comme pour l'import par métier ;
- TVA et mentions appliquées par les règles existantes, jamais par le modèle.

La brique Gemini existe déjà (`lib/ai/gemini.ts`, utilisée pour le blog). C'est l'écart fonctionnel le plus visible pour un artisan, et le seul de la liste « IA » qui sert notre cible.

### 5. Mériter des avis

Il affiche 650 avis Google. Qonforme n'affichera jamais d'avis inventé, mais peut en **demander de vrais** : une fiche d'établissement Google, et une invitation dans l'application après un moment de réussite (première facture payée, premier devis signé). Rien à publier avant d'avoir de vrais avis.

### 6. Un collaborateur dans la formule Artisan

« Plusieurs utilisateurs » figure dans le besoin du profil 3 (§ 4 des décisions) et le concurrent le vend 10 € par utilisateur. Un premier pas suffit : un collaborateur en saisie (devis, clients), sans accès aux réglages ni à la facturation.

### 7. Écrire ce que nous faisons de mieux, sans le citer

Arguments vérifiables à porter sur l'accueil, la page Tarifs et les pages métiers :

- « Vos devis partent par email, avec votre logo, gratuitement » ;
- « Relances automatiques et export comptable dès 12 € HT » ;
- « Signature en ligne illimitée, aucun frais à la signature ni au paiement » ;
- « Votre comptable consulte et exporte, gratuitement » ;
- « Essayez la démo complète sans créer de compte ».

### Ce qu'il ne faut pas copier

- **Planning, Gantt, interventions, stock, feuilles d'heures, GMAO** : hors de notre cible (dépanneurs et entreprises de plus de 10 salariés, § 4 des décisions). Les construire diluerait la simplicité pour l'artisan seul.
- **Connexion bancaire, trésorerie, livre des recettes** : utiles, mais pas avant la plateforme agréée et les prescripteurs.
- **Site vitrine gratuit** : produit d'appel efficace mais éloigné de la facturation.
- **Paiement par carte** : écarté par décision (§ 12), et nos « zéro frais » sont un argument.
- **Pages « alternative à »**, chiffres d'utilisateurs, « certifié », notes affichées : interdits par nos règles, et ce sont aussi ses fragilités.

---

## 9. Décisions à prendre par le fondateur

1. **Quelle plateforme agréée, et quand ?** Super PDP (prix publics, déjà éprouvé par un logiciel du bâtiment) ou Iopole (marque blanche sur devis). Recommandation : Super PDP, signé cette semaine.
2. **Le modèle « factures payantes » face à « factures électroniques gratuites pour toujours ».** Garder le modèle (recommandé : notre gratuit est plus utile pour le devis, et l'écart de valeur est réel dès les relances), ou tester un geste d'entrée, par exemple les **3 premières factures émises offertes**, pour que l'artisan touche la valeur avant de payer.
3. **L'accompagnement humain.** C'est l'asymétrie la plus forte : téléphone, soirs, week-ends, migration de données. La décision actuelle (aucun contact humain) reste cohérente tant qu'il n'y a personne pour répondre. À défaut : import de clients par fichier (absent aujourd'hui, demandé par le profil 2), tutoriels vidéo courts (canal 4 des décisions).
4. **Hébergement.** Le concurrent met en avant « données hébergées en France ». La politique de confidentialité de Qonforme annonce Supabase « eu-west-3, Paris ». À vérifier : le seul projet Supabase actif créé à la date du lancement de Qonforme est en région eu-west-1 (Irlande). Si c'est bien celui de Qonforme, la phrase est à corriger (règle « aucune affirmation invérifiable »).

---

## Sources (consultées le 05/10/2026)

**Costructor**
- [Accueil](https://costructor.co/), [Tarifs et tableau comparatif](https://costructor.co/tarifs/), [Facturation électronique](https://costructor.co/facturation-electronique/), [Logiciel de devis](https://costructor.co/logiciel-devis/), [Logiciel de facturation](https://costructor.co/logiciel-facturation/), [Chiffrage](https://costructor.co/logiciel-de-chiffrage-batiment/), [Suivi de chantier](https://costructor.co/suivi-de-chantier/), [Interventions](https://costructor.co/logiciel-interventions/), [Appli](https://costructor.co/appli-suivi-chantier/), [Rentabilité](https://costructor.co/rentabilite-chantier/), [Site internet](https://costructor.co/site-internet/), [Outils](https://costructor.co/outil/), [Devis par IA](https://costructor.co/devis-ia/), [Mentions légales](https://costructor.co/mentions-legales/), [Contact](https://costructor.co/contact/).
- Prescripteurs : [page CAPEB](https://costructor.co/a/capeb/), [page MAPEI](https://costructor.co/a/mapei/), [plan du site](https://costructor.co/page-sitemap.xml) (pages `/a/…`).
- [Annonce du partenariat CAPEB](https://costructor.co/blog/partenariat-capeb-costructor/), [réception des factures électroniques](https://costructor.co/blog/plateforme-reception-facture-electronique/).

**Tiers**
- [CAPEB, fiche partenaire](https://www.capeb.fr/partenaires-commerciaux/costructornat) ; [Batijournal, 01/09/2026](https://batijournal.com/index.php/facturation-electronique-la-capeb-et-costructor-partenaires/113788/).
- [Pappers, JMJi Groupe](https://www.pappers.fr/entreprise/jmji-groupe-918895277).
- Tests publiés : [Batemark](https://www.batemark.com/blog/costructor-avis-logiciel-btp-2026), [Tool Advisor](https://tool-advisor.fr/logiciel-facturation/comparatif/costructor/) (note Google 4,9/5 sur 711 avis, Trustpilot 4,1/5 sur 5 avis, pas de mode hors ligne).

**Qonforme**
- `lib/stripe/plans.ts`, `lib/pa/`, `lib/reception/`, `lib/artisan/`, `lib/payment-link/`, `lib/signature/`, `lib/accountant/rules.ts`, routes `app/api/**` (mur de paiement), `app/confidentialite/page.tsx`, `DECISIONS-STRATEGIQUES.md`, `STRATEGIE-CROISSANCE-2026-10.md`.
