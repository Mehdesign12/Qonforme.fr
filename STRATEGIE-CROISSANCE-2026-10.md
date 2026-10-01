# Stratégie de croissance Qonforme — octobre 2026 → janvier 2027

> **Objectif :** 3 000 à 4 000 € de revenus mensuels d'ici fin décembre 2026 ou mi-janvier 2027.
>
> **Date :** 1er octobre 2026.
>
> **Base de travail :** lecture complète du code, vérification du site en ligne et étude de marché sourcée (section 10).
>
> **Limite :** les chiffres réels (abonnés, revenu mensuel, trafic) n'étaient pas accessibles depuis cette session. Les objectifs de la section 6 sont donc des hypothèses à recaler avec ces chiffres (section 9).

---

## 0. L'essentiel en une page

1. **Le produit est une vraie base.**
   - Il couvre les factures, devis, avoirs, bons de commande, l'export FEC, la recherche SIREN et la PWA.
   - L'interface est soignée, pour 6 mois de travail.
2. **La promesse centrale (« conforme ») ne tient pas aujourd'hui.**
   - Qonforme n'est raccordé à aucune Plateforme Agréée (PA) : il ne peut donc ni recevoir ni émettre de factures électroniques au sens de la réforme.
   - Le Factur-X produit n'est pas valide : profil `extended` au lieu d'EN 16931, PDF qui n'est pas en PDF/A-3, franchise de TVA codée « Z » au lieu de « E ».
3. **Entre-temps, la conformité est devenue gratuite.**
   - Tiime, Indy, Abby, Shine, Qonto et Pennylane sont des PA immatriculées et ont toutes un plan gratuit.
   - Vendre « la conformité » 9 € par mois est perdu d'avance.
4. **Le site affiche de faux avis, de faux chiffres et une fausse homologation.**
   - « 4,8/5 sur Trustpilot » alors que la page Trustpilot n'existe pas (erreur 404).
   - Le compteur « 47 avis » est écrit en dur dans le code, et ce faux score est aussi déclaré à Google.
   - On trouve aussi « 50+ entreprises », « 100 % taux de conformité » et « Homologué par l'État ? Oui. »
   - C'est un risque juridique (DGCCRF), un risque SEO (pénalité Google) et un frein de confiance.
5. **Le tunnel d'inscription promet « gratuit / sans CB », puis impose le paiement avant toute valeur.**
   - Aucun email ne relance les inscrits qui n'ont pas payé, et ils n'apparaissent même pas dans l'admin.
6. **À 9-19 €, il faut 250 à 300 clients payants pour atteindre 3,5 k€.**
   - En partant de presque zéro, sur un marché saturé d'offres gratuites, ce n'est pas réaliste en 90 jours en libre-service.
7. **La stratégie tient en cinq mouvements.**
   - **Assainir** (semaines 1-2) : retirer tout ce qui est faux, rendre le tunnel honnête et le Factur-X valide.
   - **Devenir « Solution compatible »** (semaines 2-6) : raccordement API à une PA. Super PDP facture 0,01 € par facture en marque grise, et le raccordement ouvre droit au label officiel DGFiP.
   - **Se spécialiser** sur une niche qui paie : les **artisans du BTP qui facturent des professionnels** (sous-traitance, autoliquidation, situations de travaux, retenue de garantie).
   - **Vendre en direct** : prospection email et téléphone, plus prescripteurs (experts-comptables, réseaux). Le SEO, lui, prépare la vague de l'été 2027.
   - **Monter le panier moyen** : plan Artisan à 24 €, annuel mis en avant, mise en route accompagnée payante.
8. **Cible réaliste à J+90 :** environ 110 abonnés à 19 € en moyenne, soit 2,1 k€ de revenu récurrent, plus environ 8 mises en route payées à 149 €, soit 1,2 k€. **Total : environ 3,3 k€ de revenus sur le mois de décembre**, hors encaissements annuels.
   - Le revenu récurrent seul atteindra 3-4 k€ plutôt vers le mois 5 ou 6.
9. **Le goulot n'est pas le code.**
   - L'historique montre 686 commits de construction depuis le 7 mars 2026 (fonctionnalités, SEO, app iOS) et aucune mécanique de vente.
   - Les 90 prochains jours doivent être au moins à 50 % de la vente.

---

## 1. Constat : le produit

### 1.1 Ce qui existe vraiment

| Domaine | État réel | Commentaire |
|---|---|---|
| Factures, devis, avoirs, bons de commande, catalogue | ✅ Fonctionnel | Validé en conditions réelles le 31/08 |
| Recherche SIREN, envoi email + PDF, relances J+30/J+45 | ✅ | Les relances partent aussi pour les comptes **annulés**, voir 1.4 |
| Export FEC, tableau de bord CA | ✅ | Accessibles au plan Starter alors que la page tarifs les réserve au Pro |
| Factur-X | ⚠️ Non conforme | Profil `extended` déclaré (`lib/facturx/xml.ts:190`), pas de PDF/A-3, pas de métadonnées XMP |
| Factur-X : codage de la TVA | ⚠️ Non conforme | TVA à 0 % codée « Z » au lieu de « E » (franchise) ou « AE » (autoliquidation) (`xml.ts:86`). Les avoirs n'ont pas de XML |
| Raccordement PA, réception, annuaire, e-reporting | ❌ Absent | Seulement un guide statique (`app/settings/ppf/page.tsx`) |
| Franchise de TVA (art. 293 B) | ❌ Absent | Le cœur de la cible a la TVA 20 % par défaut sur chaque ligne |
| Mentions B2B obligatoires par défaut | ❌ Absent | Pénalités de retard et indemnité de 40 € non incluses |
| Multi-utilisateur, paiement en ligne des factures, import CSV, BTP | ❌ Absent | BTP = situations, retenue de garantie, acomptes |
| App iOS | ⏸ Non soumise | Le paiement Stripe s'ouvre dans la WebView : rejet probable par Apple (règle 3.1) |

### 1.2 Le tunnel d'achat

Parcours actuel : landing → `/signup` (5 champs) → `/signup/company` → `/signup/plan` → **paiement Stripe** → tableau de bord → créer un client → créer la facture.

Bilan : **environ 12 clics, 7 écrans, 8 à 12 minutes, paiement exigé à l'étape 5**, avant d'avoir vu le produit.

**Fuites identifiées :**
- **Promesses de gratuité fausses.**
  - « Créer mon compte gratuitement » (`app/page.tsx:381`).
  - « Vous pouvez […] tester Qonforme sans carte bancaire » (`app/pricing/page.tsx:29`).
  - « Essai gratuit : Oui, sans CB » sur les 8 pages comparatif.
  - Le middleware renvoie pourtant tout utilisateur sans abonnement vers `/signup/plan` (`lib/supabase/middleware.ts:182`).
- **Le plan choisi sur `/pricing` est perdu.** Le paramètre `?plan=` n'est jamais relu, donc l'utilisateur doit rechoisir, et un choix annuel retombe en mensuel.
- **Création de client impossible depuis le formulaire de facture.**
- **Aucune relance des abandons.**
  - L'email de bienvenue dit « Ton compte est actif » à quelqu'un qui n'a pas payé.
  - La liste admin part de `companies` : un inscrit sans entreprise est invisible.
- **Aucune séquence après paiement :** pas d'onboarding, pas d'email d'échec de paiement, pas de questionnaire d'annulation, pas de reconquête.

### 1.3 L'offre

| Plan | Prix HT | Ce que la page tarifs dit | Ce que le code fait |
|---|---|---|---|
| Starter | 9 €/mois, 90 €/an | 10 factures/mois | Factures **illimitées** via la conversion devis → facture, qui ne vérifie ni abonnement ni quota. Relances et tableau de bord inclus |
| Pro | 19 €/mois, 190 €/an | Illimité + relances + tableau de bord + support prioritaire | Seule vraie différence : la limite de 10 factures directes |

**Autres limites :**
- Pas d'essai, pas de plan gratuit, pas de garantie.
- Pas de code promo (`allow_promotion_codes: false`), donc ni parrainage ni offre partenaire possible.
- Pas de prélèvement SEPA.
- Prix affichés HT sans indication du TTC, alors que la cible en franchise de TVA paie 10,80 € et 22,80 €.

### 1.4 Dettes techniques qui coûtent de l'argent

- **Webhook Stripe :** il répond 200 même en cas d'erreur (`app/api/webhooks/stripe/route.ts:297`), donc Stripe ne réessaie jamais. Un événement perdu signifie soit un client payant bloqué, soit un client annulé qui garde l'accès.
- **`invoice.paid` est inopérant :** il lit `invoice.subscription`, absent de l'API Stripe `clover`.
- **`unpaid` est traduit en `incomplete` :** le client est renvoyé vers le choix de plan, avec un risque de double abonnement car le checkout ne vérifie pas l'existant.
- **Coupure d'accès dès le premier échec de paiement,** sans délai de grâce ni email de l'app.
- **Archives perdues après annulation :** factures et FEC deviennent inaccessibles, ce qui contredit la promesse « archivage légal 10 ans ».
- **Relances envoyées pour les comptes annulés :** le cron envoie des emails aux clients finaux d'utilisateurs qui ne paient plus.
- **Bug de redirection :** `redirect('/signup/company')` est avalé par un `try/catch` (`app/dashboard/page.tsx:45-70`). Un utilisateur peut payer sans fiche entreprise, et ses PDF portent alors « Qonforme » comme émetteur.
- **Redirection ouverte :** `/api/tracking/click?url=` accepte n'importe quelle URL, ce qui permet du phishing avec le domaine des factures.

### 1.5 Ce que révèle l'historique

| Mois | Commits | Contenu |
|---|---|---|
| Mars-avril 2026 (premier commit le 7 mars) | 646 | MVP complet, SEO, pSEO, 12 outils gratuits, blog IA, prospection |
| Juin-juillet 2026 | 4 | — |
| Août 2026 | 36 | App iOS, push, onboarding natif |

Beaucoup de construction, aucune mécanique de vente, aucune boucle de retour client.

---

## 2. Constat : marketing et acquisition

### 2.1 Proposition de valeur : 4/10

- **Le message vit sur une échéance périmée.**
  - Le H1 dit « La facturation électronique devient obligatoire. Sois prêt avant tout le monde. »
  - Le site affiche encore « Septembre 2026 — dans moins de 6 mois » au 1er octobre.
  - Le sous-titre dit « obligatoire […] dès septembre 2026 », alors que l'émission des TPE et micro-entreprises est en **septembre 2027**.
- **« Transmets via Chorus Pro » est faux pour le B2B.** Chorus Pro ne sert qu'aux factures vers le secteur public (B2G). Le guide intégré à l'app le dit lui-même.
- **La cible est éparpillée.** Les 39 métiers mélangent artisans B2B et métiers presque 100 % B2C (coiffeur, taxi, infirmier, boulanger), qui sont peu concernés par l'émission B2B.
- **Le ton change selon les pages :** tutoiement sur la landing, vouvoiement sur `/pricing` et les pages SEO.
- **Aucune différenciation réelle face aux gratuits,** que le comparatif du site reconnaît lui-même.

### 2.2 Preuve sociale et confiance : à refaire entièrement

**À retirer immédiatement :**
- « 4.8/5 sur Trustpilot » (`components/landing/LandingHero.tsx:124`).
- `TOTAL_REVIEWS = 47` (`app/page.tsx:631`).
- 5 témoignages datés du 18/02 au 12/03/2026. Trois sont antérieurs au premier commit du projet (7 mars 2026). Ils décrivent des fonctions qui n'existent pas, comme « je reçois un email quand c'est transmis ».
- `aggregateRating` déclaré à Google sur toutes les pages (`app/layout.tsx:170`).
- « 50+ entreprises », « 1200+ factures », « 100 % taux de conformité », « Le choix de 8 artisans sur 10 ».
- « Homologué par l'État : Oui », et les badges « Factur-X certifié » et « Conforme PPF · DGFiP ».
- Le faux témoignage interpolé dans l'email de prospection J+5, et l'article de blog « Témoignage : Comment un Plombier… ».

**Problèmes de conformité légale :**
- **Meta Pixel chargé sans consentement,** alors que `/confidentialite` affirme « ni Facebook Pixel » : risque CNIL.
- **Mentions légales incomplètes au regard de la LCEN :** pas de capital, RCS/SIREN, siège, directeur de publication ni téléphone.

**Aucune personne visible :** pas de fondateur, pas de page « À propos », pas de photo, support uniquement par email.

### 2.3 SEO

**Contenu en ligne :** 195 URL dans le sitemap. 70 articles de blog, 39 pages métiers, 26 termes de glossaire, 14 guides, 12 outils, 11 modèles, 8 comparatifs.

**Blog IA :**
- À l'arrêt depuis le 15 juin.
- Contient des titres en double (11 articles « électricien » publiés en 10 jours), des titres « 2024 » et un faux cas client.

**Erreurs réglementaires :**
- Glossaire et guide présentent le PPF comme une « alternative gratuite aux PDP ». C'est obsolète depuis octobre 2024 : le PPF ne sert plus qu'à l'annuaire.
- Calendrier « 2026 » donné pour les artisans, alors que leur échéance d'émission est 2027.
- Seuils de franchise de TVA à vérifier.

**Pages métiers :**
- Elles promettent des fonctions absentes : factures récurrentes, acomptes et factures de solde, suivi de chantier.
- Elles partagent les mêmes blocs de texte (contenu « mince »).

**Comparatifs :** non datés, non sourcés, sans accents. Des affirmations comme « Henrri : non conforme » sont risquées : Henrri affiche le label « Solution compatible ».

**Manques :**
- **Aucune page « plateforme agréée »,** alors que c'est la requête n°1 du sujet sur 12 mois (section 3.3).
- Les 780 pages métier × ville sont en noindex : bonne décision, à garder.
- Les compteurs de la landing sont rendus à « 0 » côté serveur, donc Google lit « 0 + entreprises accompagnées ».

### 2.4 Conversion des outils gratuits

- **Bonne base :** 12 outils sans inscription. Les PDF gratuits portent « Facture générée gratuitement sur qonforme.fr », ce qui fait de la diffusion.
- **Aucune capture d'email** sur tout le site : ni newsletter, ni modèle contre email, ni checklist. Chaque visiteur non converti est perdu.
- **Le bouton qui suit un outil « gratuit » mène au paiement.**
- **« Propulsé par Qonforme » sur les emails clients n'est pas cliquable,** donc la boucle de diffusion est perdue.

### 2.5 Mesure

- **PostHog :** pages vues uniquement. Aucun `identify()` ni événement métier, donc aucun entonnoir par utilisateur.
- **UTM jamais enregistrés :** impossible de savoir quel canal amène les payants.
- **Meta `Purchase` côté navigateur uniquement,** et absent du parcours `/pricing/return`. `InitiateCheckout` est gonflé par les visiteurs non inscrits.
- **Conclusion : on ne peut piloter ni la publicité ni la prospection** tant que ce n'est pas corrigé.

### 2.6 Prospection sortante : un moteur complet mais dangereux en l'état

**Ce qui existe :**
- Extraction SIRENE par code NAF, enrichissement des emails (Dropcontact, Hunter, scraping), séquence de 3 emails.
- Montée progressive 20 → 200 emails par jour, suivi des ouvertures et des clics.

**Problèmes bloquants :**
- **Même domaine et même compte d'envoi que les factures des clients :** une plainte pour spam dégrade la délivrabilité des factures payantes.
- **Pas d'en-tête `List-Unsubscribe`.**
- **Pas de filtre sur la diffusion partielle Sirene :** les entrepreneurs qui ont refusé la prospection ne sont pas exclus.
- **Redirection ouverte** (voir 1.4).
- **Bugs :**
  - la campagne plafonne vers 200 prospects ;
  - les étapes sont calculées selon l'âge de la campagne et non du prospect, donc elles peuvent arriver dans le désordre ;
  - les conversions ne sont jamais enregistrées.
- **Messages périmés :** « l'échéance de septembre 2026 approche », et une « offre de lancement » qui est simplement le prix normal.

**État en production inconnu :** les crons tournent-ils ? À confirmer (section 9).

### 2.7 Partenariats et communauté

- Aucun parrainage, aucune affiliation, aucun programme pour experts-comptables, CMA, CAPEB ou BGE.
- Un seul lien vers un réseau social (LinkedIn).

---

## 3. Le marché au 1er octobre 2026

### 3.1 La réforme, telle qu'elle est vraiment

- **Calendrier inchangé (DGFiP) :**
  - **réception obligatoire pour toutes les entreprises depuis le 1/09/2026** ;
  - émission pour les grandes entreprises et ETI depuis le 1/09/2026 ;
  - **émission pour les PME, TPE et micro-entreprises au 1/09/2027**, en même temps que l'e-reporting.
- **Tolérance officielle :** pas de sanction pour les entreprises « engagées dans une trajectoire sérieuse de mise en conformité ». Ce n'est « ni un report ni une suspension ».
  - Conséquence : **marketing de la peur à éviter.** Il est inexact et il abîme la confiance.
- **Sanctions (loi de finances 2026) :**
  - 50 € par facture non conforme, plafonnés à 15 000 € par an ;
  - absence de PA en réception : mise en demeure de 3 mois, puis amendes trimestrielles.
- **149 PA immatriculées** (liste DGFiP du 23/09/2026). Le chiffre « 137 PA » affiché dans `lib/stripe/plans.ts` est périmé.
- **Le PPF ne transporte plus de factures.** Il gère l'annuaire et le concentrateur de données.
- **« Solution compatible » (SC) :** c'est un logiciel non-PA raccordé à au moins une PA.
  - La DGFiP a créé un **label officiel gratuit** « Solution compatible – Facturation électronique ».
  - Freebe, Henrri et Evoliz ont pris ce chemin.
- **Le coût d'un raccordement est faible.** Super PDP (PA immatriculée le 22/12/2025) facture l'API **0,01 € HT par facture** jusqu'à 10 000 factures par mois, avec un KYC à 2 € HT par client et un minimum de 10 € HT par an. La marque grise permet de refacturer. Iopole propose aussi une API et la marque blanche, sur devis.
- **4 nouvelles mentions obligatoires au 1/09/2027 :** SIREN du client, adresse de livraison, catégorie d'opération, option TVA sur les débits.

### 3.2 Concurrence : tous les acteurs micro/TPE sont PA et gratuits à l'entrée

| Acteur | Gratuit | Payant d'entrée | Statut |
|---|---|---|---|
| Abby | Oui, illimité | 9 € | PA, retenue par CMA France (artisans) en juillet 2026 |
| Indy | Oui | 9 € | PA |
| Tiime | Oui, illimité | 9,99 € | PA, environ 3 000 cabinets partenaires |
| Pennylane | Oui (micros, 1 200 factures/an) | 7 € | PA |
| Qonto | Outil gratuit, même sans être client | 9 € avec le compte pro | PA |
| Shine Facture | Oui | 11 € (source secondaire) | PA |
| Solo | Ambigu | 12 € | PA |
| Freebe | Non (essai 30 jours) | 12,50-15 € | SC |
| Henrri | Oui | 17 € | SC (label affiché) |
| **Qonforme** | **Non, et pas d'essai** | **9 € (10 factures)** | **Ni PA ni SC** |

- **Le payant accepté se situe entre 7 et 15 € par mois.**
- **Ce qui fait payer :** relances, paiement en ligne, connexion bancaire, déclarations Urssaf, multi-utilisateur et besoins métier (BTP, avance immédiate). **Jamais la conformité seule.**

### 3.3 Demande

- **Google Trends (France, 12 mois) :** « plateforme agréée » (indice 30,7) devance « facturation électronique » (25,5), loin devant « logiciel facturation » (5,9).
- **Pic la semaine du 30/08/2026, puis baisse d'environ 70 %.** La prochaine vague est attendue au printemps et à l'été 2027, avant l'obligation d'émission.
- **Requêtes en forte hausse :** « plateforme facturation électronique gratuite » (record), « liste plateforme agréée », « facturation électronique gratuite auto-entrepreneur ».
- **Étude OpinionWay pour Tiime (mars 2026) :**
  - **54 % des TPE n'ont pas de logiciel de facturation** ;
  - 50 % comptaient choisir leur PA après septembre 2026 ;
  - **48 % s'informent d'abord auprès de leur expert-comptable,** 23 % auprès de leur banque.
- **Cible :**
  - 2,06 millions d'auto-entrepreneurs ont déclaré un chiffre d'affaires en 2025 ;
  - 60 000 à 80 000 créations par mois ;
  - environ 32 % travaillent surtout avec des entreprises (Insee, cohorte 2018), soit environ 650 000 directement concernés par l'émission B2B en 2027.

---

## 4. La thèse stratégique

> **La conformité est le ticket d'entrée, pas le produit.**
> On ne gagnera ni sur le prix (le gratuit est partout) ni sur la peur (la DGFiP est tolérante).
> On gagne sur **une niche aux besoins mal couverts, qui paie, et qu'on peut aller chercher en direct**, avec **un humain** derrière l'outil.

### 4.1 La niche recommandée : les artisans du BTP qui facturent des professionnels

**Pourquoi le BTP :**
- **Ils facturent beaucoup en B2B** : sous-traitance aux entreprises générales, syndics, promoteurs, autres artisans. Ils sont donc pleinement concernés, par la réception aujourd'hui et par l'émission en 2027.
- **Leurs besoins de facturation sont spécifiques et mal couverts par les généralistes gratuits** : autoliquidation de la TVA en sous-traitance (catégorie Factur-X « AE », que Qonforme code mal aujourd'hui), acomptes et factures de situation, retenue de garantie de 5 %, TVA multi-taux (5,5/10/20 %) avec attestation, devis à faire signer.
- **Les actifs existent déjà** : pages métiers BTP (plombier, électricien, peintre, menuisier…), contenus électricien, ciblage par code NAF dans le moteur de prospection, ton du site orienté artisans.
- **Ils sont joignables** : SIRENE par code NAF (41, 42, 43), CAPEB et FFB locales, négoces de matériaux, experts-comptables spécialisés BTP.
- **Ils paient pour un outil qui leur fait gagner du temps sur les situations et les relances.** Les logiciels spécialisés BTP sont généralement au-dessus de 20 €/mois. Les prix précis restent à vérifier avant de fixer les nôtres.

**Point de vigilance :** Abby a été retenue par CMA France pour les artisans. Notre différence doit donc être **le métier BTP**, pas « artisan » en général.

**Validation avant d'engager tout le positionnement (semaines 3-5) :**
- Faire un test A/B en prospection : BTP sous-traitants contre freelances B2B (développement, design, conseil).
- Mesurer les taux de réponse, de rendez-vous et d'essais.
- Si le BTP ne répond pas mieux, basculer sur le second segment. Le socle produit (raccordement PA, essai, cycle d'emails) reste le même.

### 4.2 Positionnement proposé (à tester)

> **Qonforme — la facturation électronique des artisans du bâtiment.**
> Devis, acomptes, situations, autoliquidation et relances : conforme 2027, branché sur une plateforme agréée, et un vrai humain pour vous mettre en route.

Principes :
- Vouvoiement partout, pour une cible pro BTP.
- Dates exactes.
- Zéro affirmation invérifiable.
- Le fondateur visible.

### 4.3 Ce qu'on arrête (au moins pour 90 jours)

- **App iOS :** pause. À reprendre au-delà de 100 clients, et pas avant d'avoir sorti le paiement de la WebView.
- **Blog IA en publication automatique :** pause, puis nettoyage.
- **Extension du pSEO** (villes, nouveaux métiers B2C) et **Brand Studio**.
- **Toute fonctionnalité hors de ce plan.**

---

## 5. L'offre et les prix (proposition à valider ensemble)

| Offre | Prix HT | Contenu | Quand |
|---|---|---|---|
| **Essai** | 14 jours, sans carte bancaire | Tout le plan Artisan | Semaine 1-2 |
| **Gratuit « Réception »** | 0 € | Adresse de réception PA + inscription annuaire, 3 factures/mois, mention « Propulsé par Qonforme » cliquable | Dès que la PA est branchée (semaine 6 environ) |
| **Essentiel** | 12 €/mois, 120 €/an | Factures illimitées, devis, avoirs, émission Factur-X via la PA, relances automatiques | Semaine 2 |
| **Artisan** (recommandé) | 24 €/mois, 240 €/an | En plus : autoliquidation, acomptes et situations, retenue de garantie, multi-TVA, support prioritaire par téléphone | Semaine 2, les fonctions BTP arrivent progressivement |
| **Mise en route accompagnée** | 149 € une fois, **offerte avec l'annuel Artisan** | 45 minutes en visio : import clients et produits, logo, mentions, inscription à l'annuaire PA, première facture envoyée ensemble | Semaine 2 |

**Règles :**
- **Afficher le TTC pour les franchisés en TVA,** par exemple « soit 28,80 € TTC ».
- **Annuel mis en avant** (« 2 mois offerts »), ce qui fait rentrer la trésorerie tout de suite.
- **Clients actuels : prix garanti à vie.** C'est un argument de fidélité.
- **Activer les codes promo Stripe et le prélèvement SEPA.**
- **Panier moyen visé : environ 19 € par mois** (hypothèse : 40 % Essentiel, 60 % Artisan, 30 % en annuel).

---

## 6. Objectifs chiffrés et entonnoir (hypothèses à recaler en semaine 1)

| | Octobre | Novembre | Décembre |
|---|---|---|---|
| Essais démarrés | 60 | 180 | 300 |
| Taux essai → payant | 15 % | 20 % | 22 % |
| Nouveaux payants | 9 | 36 | 66 |
| **Abonnés payants cumulés** (hors base actuelle) | ~9 | ~45 | **~110** |
| Revenu mensuel récurrent en fin de mois (~19 €/abonné) | ~170 € | ~850 € | **~2 100 €** |
| Mises en route payées | 2 | 5 | 8 |
| **Revenus du mois** (récurrent + mises en route) | ~500 € | ~1 600 € | **~3 300 €** |

Hors encaissements annuels, qui augmentent la trésorerie du mois.

**D'où viennent les 540 essais (hypothèses) :**

| Source | Essais estimés |
|---|---|
| Prospection email | ~200 |
| Téléphone | ~120 |
| Prescripteurs | ~80 |
| Communautés et contenu du fondateur | ~60 |
| SEO et trafic actuel | ~80 (à recaler avec le trafic réel) |

**Indicateurs suivis chaque semaine (lundi, 30 minutes ensemble) :**
- visiteurs, inscriptions ;
- **essais activés**, c'est-à-dire avec une première facture envoyée sous 48 h ;
- passage essai → payant, revenu récurrent, résiliations ;
- appels passés, rendez-vous, partenaires actifs, coût d'acquisition par canal.

**Seuil d'alerte :** si au 15 novembre on a moins de 15 payants cumulés, on revoit la niche ou l'offre plutôt que de pousser plus fort.

---

## 7. Le plan en 3 phases

Répartition des rôles : **(C) = Claude, en code** et **(F) = toi, fondateur, en vente, partenariats et décisions.**

### Phase 1 — Semaines 1-2 : assainir (rien ne sert d'amener du trafic sur un site qui ment)

**Lot 1 — Vérité et légal (C, environ 1 jour)**
- Retirer faux avis, Trustpilot, `aggregateRating`, faux chiffres, « 8 artisans sur 10 », « homologué », « certifié » et « Conforme PPF · DGFiP ».
- Corriger le calendrier partout : réception depuis 09/2026, émission en 09/2027.
- Préciser que Chorus Pro ne concerne que le B2G.
- Corriger le compteur de PA (149).
- Supprimer les compteurs à « 0 » rendus côté serveur.
- Bandeau de consentement pour le Meta Pixel, politique de confidentialité corrigée, mentions légales LCEN (les informations sont à fournir par toi).
- Fermer la redirection ouverte.
- Mettre en pause la prospection automatique.
- Blog : pause de la publication automatique, noindex ou fusion des doublons, retrait du faux témoignage et des titres « 2024 ».
- Glossaire et guides : corriger les erreurs sur le PPF et le calendrier.

**Lot 2 — Tunnel honnête (C, 2-3 jours)**
- Essai de 14 jours sans carte bancaire : statut d'essai accepté par le middleware, bandeau « J-x » dans l'app, paiement en fin d'essai.
- Plan choisi conservé de `/pricing` jusqu'au paiement.
- Création de client depuis le formulaire de facture.
- Checklist d'onboarding persistante en 4 étapes.
- Email de bienvenue honnête.
- Quota appliqué aussi à la conversion devis → facture. Relances limitées aux comptes actifs.

**Lot 3 — Factur-X réellement valide (C, 2-4 jours)**
- Profil EN 16931, ordre des éléments conforme au schéma XSD, `schemeID` correct pour le SIRET.
- Catégories de TVA « E » + motif d'exonération (franchise) et « AE » (autoliquidation).
- PDF/A-3 complet (métadonnées XMP, profil couleur, relation de pièce jointe), et XML pour les avoirs.
- Réglage « franchise de TVA 293 B » dans la fiche entreprise, et mentions B2B obligatoires par défaut.
- **Validation sur un validateur externe** (FNFE / Mustang) avant d'écrire « conforme » où que ce soit.

**Lot 4 — Stripe robuste (C, 1-2 jours)**
- Webhook idempotent qui renvoie une erreur 500 en cas d'échec, pour que Stripe réessaie.
- Correction de `invoice.paid`, `unpaid` renvoyé vers la facturation, garde contre les doubles abonnements.
- Délai de grâce de 7 jours plus email en cas d'échec de paiement.
- Accès en lecture seule aux archives et au FEC après annulation.

**Côté fondateur (F)**
- Récupérer 5 à 10 **vrais** avis auprès des clients actuels ou de bêta-testeurs, en échange de 3 mois offerts. Ouvrir Trustpilot ou une fiche Google seulement quand ils existent.
- Page « Qui sommes-nous » avec ton visage et ton histoire.
- **Commencer dès maintenant 10 appels par jour** à des artisans BTP, pour comprendre avant de vendre.

### Phase 2 — Semaines 2-6 : devenir « Solution compatible » et lancer l'offre BTP

**Lot 5 — Raccordement PA (C, 2-3 semaines)**
- Choisir le partenaire (F + C) : Super PDP a des prix publics et la marque grise ; Iopole propose la marque blanche sur devis. Vérifier dans les deux cas le contrat, le KYC, les délais et la norme XP Z12-013.
- Intégration : inscription à l'annuaire, réception (boîte de factures reçues), émission des Factur-X via la PA, suivi des statuts.
- Garder une couche d'abstraction pour pouvoir changer de PA.
- Demander le **label « Solution compatible »** de la DGFiP.
- Lancer le plan **Gratuit « Réception »**.

**Lot 6 — Fonctions BTP minimum (C, 1-2 semaines, en parallèle)**
- Autoliquidation en sous-traitance (mention + catégorie AE).
- Acomptes et facture de solde, factures de situation (pourcentage d'avancement).
- Retenue de garantie.
- TVA multi-taux avec mention d'attestation.

**Lot 7 — Cycle de vie et mesure (C, 3-4 jours)**
- **Emails :**
  - abandon d'inscription (H+1, J+1, J+3) ;
  - essai (J0, J1, J3, J7, J12, J13) ;
  - échec de paiement, annulation avec motif, reconquête à J+30, alerte admin à chaque nouvel abonné.
- **Suivi :**
  - PostHog `identify` et 8 événements (inscription, entreprise, essai, première facture créée et envoyée, début de paiement, abonnement, résiliation) ;
  - UTM stockés à l'inscription ;
  - `Purchase` envoyé côté serveur depuis le webhook (Meta API Conversions) ;
  - tableau de bord de l'entonnoir dans l'admin.

**Lot 8 — Nouvelle landing BTP et pages commerciales (C, 3-4 jours, textes validés par F)**
- Landing BTP.
- Page pilier « plateforme agréée : comment choisir (et la gratuite pour artisans) ».
- Pages « facture électronique BTP / sous-traitance / autoliquidation 2027 ».
- Guide 2027 refait.
- Comparatifs datés, sourcés et sans dénigrement.

### Phase 3 — Semaines 3-13 : le moteur d'acquisition (démarre dès la semaine 3)

1. **Prospection email SIRENE, remise d'aplomb (C pour la technique, F pour le message)**
   - Domaine d'envoi séparé (compte Resend distinct), chauffe progressive, en-tête `List-Unsubscribe`.
   - Exclusion des diffusions partielles Sirene et correction des bugs de séquence.
   - Cible : codes NAF 41-43, sociétés et EI qui ont un site.
   - Message centré sur « depuis le 1er septembre vous devez pouvoir recevoir » et sur la préparation de 2027. Offre : un diagnostic gratuit de 15 minutes ou l'essai.
   - Volume : 150-200 emails par jour après la chauffe.
   - Règle CNIL B2B : le message doit être en rapport avec la profession, avec opposition simple. Pour les adresses personnelles d'entrepreneurs individuels, préférer le téléphone.
2. **Téléphone (F) :** 20 à 30 appels par jour, 4 jours par semaine. Indy en a fait un canal prévisible. Script court de 4 questions sur la réception, les sous-traitants, l'outil actuel et le temps passé sur les situations.
3. **Prescripteurs (F)**
   - Cibles : 30 petits cabinets comptables indépendants (dont des spécialistes BTP), BGE et couveuses, CAPEB locales, négoces de matériaux.
   - Offre :
     - compte cabinet gratuit ;
     - **25 % de commission récurrente sur 12 mois** ou 30 € par client converti ;
     - code promo dédié ;
     - webinaire commun « facturation électronique 2027 pour vos clients du bâtiment ».
   - Objectif : 5 à 10 partenaires actifs à J+90.
4. **Communautés et contenu du fondateur (F)**
   - Groupes Facebook d'auto-entrepreneurs (environ 61 000 et 54 000 membres) et groupes BTP : réponses utiles, jamais de spam.
   - LinkedIn : 3 posts par semaine.
   - Un webinaire par mois.
5. **Capture d'email (C) :** modèles Word/Excel et checklist « Conformité 2027 BTP » contre email, suivis d'une séquence de 5 emails vers l'essai. Les pages `/modele/*` pointent vers le générateur gratuit.
6. **Boucle de diffusion (C) :** « Propulsé par Qonforme » cliquable (avec UTM) sur les factures et les emails. Parrainage : 1 mois offert de chaque côté, via les coupons Stripe.
7. **Comparateurs (F) :** fiches sur ma-facture-electronique.org, comparateur-efacturation.fr et Appvizer (coût au lead) **une fois le label obtenu.**
8. **Publicité payante, seulement après les phases 1 et 2 :** test de 500 € sur Google Ads (requêtes métier × facture électronique), landing BTP, coût d'acquisition visé sous 100 €.

---

## 8. Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| Faux avis : DGCCRF, Google | Lot 1, en premier, avant toute dépense d'acquisition |
| Comparatifs dénigrants | Comparatifs datés et sourcés, sans verdict « non conforme » invérifiable |
| CNIL : Pixel sans consentement, prospection | Bandeau de consentement, règles B2B, filtre diffusion Sirene, désinscription en un clic |
| Délivrabilité des factures clients | Domaines et comptes d'envoi séparés pour la prospection |
| Dépendance à une seule PA | Couche d'abstraction, contrat lu avant signature |
| Gratuit massif des concurrents | On ne se bat pas sur le prix : niche, humain, fonctions métier |
| Temps disponible du fondateur | La vente directe demande 3 à 4 h par jour. Si ce temps n'existe pas, il faut réduire les objectifs |
| Tolérance DGFiP qui réduit l'urgence | Message « recevoir maintenant, émettre en 2027, préparez-vous calmement », pas de peur |

---

## 9. Ce dont on a besoin pour recaler le plan

1. **Chiffres réels :**
   - nombre d'abonnés payants et revenu récurrent (Stripe) ;
   - inscriptions par mois, trafic par mois et principales sources (Vercel Analytics, PostHog).
2. **Temps disponible par semaine** pour la vente et les partenariats.
3. **Budget mensuel :** domaine d'envoi, Dropcontact, publicité, PA.
4. **Prospection automatique :** les crons tournent-ils en production ? Combien d'emails ont déjà été envoyés ?
5. **PA :** un contact existe-t-il déjà avec IOPOLE (cité dans le code) ?
6. **Validation** de la niche BTP et de la grille de prix.
7. **Informations pour les mentions légales :** raison sociale, capital, RCS, siège, directeur de publication.

---

## 10. Sources (marché)

**Réforme et cadre officiel**
- Calendrier et tolérance : [guide pratique DGFiP](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf) ; [page « Je passe à la facturation électronique »](https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique), modifiée le 01/09/2026.
- [Liste des plateformes agréées](https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees).
- Sanctions : [KPMG Avocats](https://kpmg.com/av/fr/avocats/eclairages/2026/03/facturation-electronique-amenagement-des-obligations-et-renforcement-des-sanctions.html) ; [Indy](https://www.indy.fr/guide/facturation/electronique/augmentation-penalites-non-conformite/).
- [Charte du logo « Solution compatible » (DGFiP)](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fe_charte-utilisation-logotype-solution-compatible.pdf).
- [Tarifs Super PDP](https://www.superpdp.tech/tarifs/), vérifiés le 01/10/2026.
- [Nouvelles mentions obligatoires 2027](https://ma-facture-electronique.org/reforme-2026/nouvelles-mentions-obligatoires/).
- PA gratuites : [ma-facture-electronique.org](https://ma-facture-electronique.org/plateforme-agreee/gratuite-possible/) ; [Tiime](https://blog.tiime.fr/plateforme-agreee-facturation-electronique-gratuite).

**Concurrence**
- Tarifs : [Abby](https://abby.fr/tarifs/), [Indy](https://www.indy.fr/tarifs/), [Tiime](https://www.tiime.fr/tarifs), [Freebe](https://www.freebe.me/tarifs), [Henrri](https://www.henrri.com/tarifs), [Pennylane](https://www.pennylane.com/fr/tarifs), [Qonto](https://qonto.com/fr/invoicing/e-invoicing), [Shine](https://www.shine.fr/facturation-electronique/), [Solo](https://www.solo.fr).
- [Abby retenue par CMA France](https://www.lejournaldesentreprises.com/breve/la-start-up-abby-ete-retenue-par-cma-france-pour-accompagner-les-artisans-face-la-facturation-2146145).
- [Indy et la prospection téléphonique](https://podcasts.audiomeans.fr/saas-connection-978555030bb5/-3-adrien-plat-cofondateur-et-cmo-d-indy-ex-georges-tech-faire-de-la-prospection-telephonique-un-canal-predictif--c0fe0373bcfa).

**Demande et cible**
- [Étude OpinionWay pour Tiime](https://blog.tiime.fr/facturation-electronique-2026-etude-tpe-france).
- Auto-entrepreneurs : [Urssaf, via tpeactu](https://tpeactu.fr/2026/09/27/auto-entrepreneurs-sans-chiffre-affaires-declare-2025-urssaf/) ; [Insee, créations d'entreprises](https://www.insee.fr/fr/statistiques/9052433) ; [Insee, clientèle des micro-entrepreneurs](https://www.insee.fr/fr/statistiques/4799082).

**Points non vérifiés :** volumes de recherche absolus, prix Shine, part B2B récente des micro-entrepreneurs, prix des logiciels BTP spécialisés.
