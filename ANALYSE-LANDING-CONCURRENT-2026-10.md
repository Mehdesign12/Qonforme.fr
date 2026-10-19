# Accueil d'un concurrent : analyse pour la variante B de l'accueil (octobre 2026)

> **Note interne.** Le concurrent étudié est Costructor (https://costructor.co/). Son nom ne doit jamais apparaître dans un contenu public : site, emails, publicités, contenus, réseaux sociaux (`DECISIONS-STRATEGIQUES.md` § 2).
>
> Relevé du 17/10/2026, synthèse de quatre analyses de la même page (structure, conversion, design, SEO et technique). L'offre, les prix et la comparaison fonction par fonction restent dans `ANALYSE-CONCURRENT-COSTRUCTOR-2026-10.md` (05/10/2026).
>
> Objet : reprendre la structure et le rythme de cette page dans une variante B de l'accueil de Qonforme, pour un test A/B, avec un contenu vrai.

---

## 1. Résumé

1. La page est longue : environ 12 écrans à 1 440 px de large, environ 1 740 mots visibles, dont près de la moitié dans la FAQ.
2. Elle repose sur un module répété six fois : un titre à l'impératif, 4 ou 5 puces cochées, un bouton, et une capture qui alterne de côté.
3. Le moteur de conversion est la gratuité : environ 16 occurrences de « gratuit… », et un bouton d'inscription par écran (10 sur ordinateur), tous vers la même adresse.
4. La preuve sociale est placée au point de décision : « Avis 4.9/5 » sous le bouton du héros, puis « 140 000 clients satisfaits », « + 2 millions devis créés » et 7 témoignages nominatifs.
5. La facturation électronique arrive dès le premier écran : logotype « Solution compatible » dans le héros, puis bandeau « 2026 » avec les logos Peppol, Factur-X et Finances Publiques.
6. La page n'a qu'un seul moment de spectacle : la signature d'un devis au clic (trait dessiné, confettis, fond qui vire au vert). Tout le reste est statique.
7. L'accroche « boosté à l'IA » n'est démontrée nulle part : trois mentions, aucune capture, aucun exemple.
8. Faiblesse principale : presque toute la réassurance est invérifiable depuis la page (chiffres d'utilisateurs, « Certifié conforme », « 100 % conforme eIDAS », « 32 % d'impayés en moins », « 45 % de devis acceptés en plus »), et plusieurs affirmations se contredisent.
9. Ce qui manque : aucun prix, aucun « sans carte bancaire », aucune identité de l'éditeur, le partenariat CAPEB absent de l'accueil. Certains contenus sont périmés (« attestations de TVA », « 2026 » au futur).
10. La technique est moyenne : WordPress, 246 Ko de JavaScript écrit dans le `<head>`, jQuery bloquant, chat, GTM, aucune règle « Réduire les animations ». La force SEO vient du maillage des menus (11 pages de fonctions, 14 pages métier), pas de la page elle-même.

**Pour Qonforme :** la structure et le rythme se reprennent. Environ la moitié des contenus doit être remplacée par des faits vrais : l'offre, le label, les engagements et des démonstrations. Quatre blocs disparaissent : interventions, suivi des temps, rentabilité et planning.

---

## 2. Inventaire des sections, dans l'ordre

Page relevée à 1 440 px. Elle mesure environ 10 000 à 10 700 px de haut selon le relevé.

| N° | Section | Rôle | Contenu clé | Mise en page | Animation |
|---|---|---|---|---|---|
| 0 | En-tête fixe | Navigation, accès à l'inscription | Menu « Fonctionnalités » chapeauté par « Plus de 100 fonctionnalités dont : » (11 entrées, dont « Devis par IA » et « Assistant IA »). Menu « Métiers » (14 métiers, dont architecte, décorateur, jardinier, climaticien). Liens Tarifs, Outils gratuits, Blog. « Connexion » et bouton « Essayer maintenant » | Fond blanc, filet bas, 64 px de haut sur téléphone et 86 px sur ordinateur. Bouton peu arrondi, seul bouton qui n'est pas en pilule. Sur mobile, menu plein écran à accordéons | Ombre ajoutée au-delà de 100 px de défilement. Méga-menus ouverts au survol (200 ms) |
| 1 | Héros | Accroche et preuve | Pastille « NOUVEAU · Pilotez tout votre compte […] avec l'assistant IA ». H1 « Le logiciel BTP **boosté à l'IA** pour vos devis et factures. » Quatre puces cochées : devis et factures, chantiers et interventions, rentabilité, « Intuitif et 100 % compatible mobile ». Bouton pilule « Essayez, c'est gratuit → ». Sous le bouton : logo Google, « Avis 4.9/5 », 5 étoiles. Photo d'une artisane en atelier de menuiserie. Deux cartes ombrées posées sur la photo : le logotype « Solution compatible », et un avis signé (Ophelie L., ADCONCEPT 92) | Texte à gauche (environ 60 %), photo en goutte de 384 px à droite (trois coins ronds, coin haut droit carré). Sur mobile : texte centré, photo en dessous, rectangulaire | Aucune |
| 2 | Bandeau facturation électronique | Réassurance réglementaire | Emoji fusée, H3 « Soyez prêts pour la facturation électronique 2026 », « Faites la transition en toute sérénité ». Logos Peppol, Factur-X, Finances Publiques | Encart gris arrondi pleine largeur | Aucune |
| 3 | Logos presse et partenaires | Autorité | 7 logos, sans titre ni lien : Batiprix, BFM Business, Maison & Travaux, France Num, Batiweb, Batinews, Batinfo | Une rangée à 70 % d'opacité | Aucune |
| 4 | Bande pleine violette | Simplicité, accessibilité | H2 « Gérer votre entreprise n'a jamais été aussi simple ». Trois coches : « Accessible 100% en ligne », « Disponible sur PC, Mac, Android et iOs », « Support client gratuit » | Violet `#6665DD` plein, titre blanc centré, coches en ligne | Aucune |
| 5 | Chiffres | Preuve par le volume | « 140 000 clients satisfaits », « + 2 millions devis créés », « + 500 000 chantiers pilotés », « 4,9 / 5 sur + 650 avis Google » | Fond gris, 4 cartes blanches ombrées, icône sur un carré teinté | Aucune (pas de compteur) |
| 6 | « Créez vos devis en 1 clic » | Fonction cœur | Édition depuis PC, tablette ou mobile. « Logiciel devis factures boosté à l'IA ». « Générez vos attestations de TVA ». « Ouvrages Batiprix ». Bouton « Démarrer maintenant » | Texte sur 2/5, capture sur 3/5 à droite, téléphone sombre qui déborde en bas à gauche. Grille décorative en pointillés derrière | Aucune |
| 7 | « Optimisez votre facturation » | Fonction cœur | Facture électronique (emoji fusée). Acomptes, situations, avoirs. « Logiciel de facturation Certifié conforme ». « Faites vous payer en 1 clic ». Bouton « Essayer gratuitement » | Image à gauche, facture de situation superposée | Aucune |
| 8 | « Gagnez du temps et de l'argent » | Gains chiffrés | « 4h par semaine », « 32% d'impayés en moins », « 1 min 30 par facture ». Bouton « S'inscrire gratuitement » | Fond gris, H2 centré, 3 cartes | Aucune |
| 9 | « Gérez et planifiez vos chantiers & interventions » | Fonctions pour grandir | Planning (Gantt), suivi en temps réel, marge, documents et photos. Bouton « Démarrer maintenant » | Image à droite, avec une carte de chantier et un planning dans un cadre en verre dépoli | Aucune |
| 10 | « Suivez vos interventions » | Fonctions pour grandir | Planifier, facturer, rapport d'intervention, bon signé | Image à gauche, deux captures superposées | Aucune |
| 11 | « Pilotez votre rentabilité et vos achats » | Fonctions pour grandir | Rentabilité des devis, marge des chantiers, dépenses, fournisseurs. Bouton « Essayer gratuitement » | Image à droite, cadre en verre dépoli | Aucune |
| 12 | « Ne perdez plus de temps à suivre le temps » | Fonctions pour grandir | 5 puces : obligation de contrôle des temps, saisie, validation, prévisionnel contre réalisé, heures supplémentaires. Bouton « Essayer gratuitement » | Image à gauche | Aucune |
| 13 | Signature électronique | Démonstration, émotion | H2 avec un emoji. « Envoyé en 1 clic, signé en 2 min ». « 45 % de devis acceptés en plus ». « Réduisez votre impact sur l'environement ». « 100 % conforme eIDAS et RGPD ». Aucun bouton d'inscription | Dégradé violet foncé vers violet. Devis à gauche, texte à droite, flèche spirale décorative. Sur mobile, le texte passe avant | Au clic : trait de signature, confettis, fond qui vire au vert, coche (2,3 s, une seule fois) |
| 14 | Métiers | « C'est pour mon métier » | H2 « Un logiciel adapté à tous les artisans du BTP ». 7 cartes : photo, métier, deux lignes concrètes, « En savoir plus → » | Carrousel : 4,3 cartes visibles sur ordinateur, 1,3 sur mobile, pagination en barres | Glisser (300 ms), ombre au survol, pas de lecture automatique |
| 15 | Trois badges | Réassurance | « Développé en France », « Co-construit avec nos clients ». « Compatible loi anti-fraude à la TVA + Facturation électronique 2026 ». « Assistance illimitée, Chat / Email / Téléphone » | 3 colonnes avec illustrations SVG | Aucune |
| 16 | Avis | Preuve sociale | H3 « Ils gèrent leur entreprise avec Costructor ». 6 avis : citation, 5 étoiles, nom, métier ou statut. Lien « Découvrir tous les avis clients sur Google » | Fond gris, 3 colonnes décalées, guillemet géant en fond | Aucune |
| 17 | Vidéo | Démonstration | H2 « Vidéo : créez votre premier devis en 1 minute avec Costructor » | Iframe YouTube 16:9, coins arrondis | Lecture au clic |
| 18 | Appel final | Conversion | H3 « Prêt ? Rejoignez + 140 000 utilisateurs ». Bouton « Essayer Costructor gratuitement », vers `signup?plan=business_plus`. Bouton « Demander une démo » masqué tant que le chat n'est pas chargé | Violet foncé plein | Aucune |
| 19 | FAQ | Objections et référencement | 12 questions, toutes dépliées. Les questions sont des `<strong>`, avec un balisage FAQPage | Fond blanc, H2 centré | Aucune (pas d'accordéon) |
| 20 | Pied de page | Maillage | Réseaux sociaux. Colonnes « À propos », « Ressources » (4 articles sur des mots-clés forts), « Métiers » (14). « © 2026 costructor », sans logo ni adresse | Gris très foncé | Aucune |
| — | Bulle de chat | Support, démonstration | Chat Crisp chargé sans condition | Bulle flottante tierce | — |

**Grammaire commune des blocs 6 à 12 :**
- Un H2 formé d'un verbe à l'impératif et d'un objet.
- 4 ou 5 puces de 4 à 14 mots.
- Un bouton pilule.
- La capture alterne de côté. Sur mobile, l'image passe avant le texte.
- Environ 190 px d'écart entre deux blocs.

En dehors de la FAQ et des avis, la page n'a aucun paragraphe. Une bande de couleur ou de chiffres coupe la lecture toutes les 2 à 4 sections.

**Ordre des arguments :**
1. Catégorie, nouveauté et gratuité.
2. Conformité 2026.
3. Autorité.
4. Simplicité.
5. Volume.
6. Devis puis facture.
7. Gains chiffrés.
8. Fonctions pour grandir.
9. Démonstration.
10. Métier.
11. Badges.
12. Avis.
13. Vidéo.
14. Appel final.
15. Objections.
16. Maillage.

---

## 3. Conversion

### 3.1 Appels à l'action

| # | Emplacement | Libellé | Style | Cible |
|---|---|---|---|---|
| 0 | En-tête fixe (ordinateur seulement) | Essayer maintenant | Petit bouton plein, coins à peine arrondis | `app.costructor.co/signup` |
| 1 | Héros | Essayez, c'est gratuit → | Grande pilule pleine avec flèche | signup |
| 2 | Devis | Démarrer maintenant | Petite pilule pleine | signup |
| 3 | Facturation | Essayer gratuitement | idem | signup |
| 4 | Gains chiffrés | S'inscrire gratuitement | Pilule centrée | signup |
| 5 | Chantiers | Démarrer maintenant | idem | signup |
| 6 | Interventions | Démarrer maintenant | idem | signup |
| 7 | Rentabilité | Essayer gratuitement | idem | signup |
| 8 | Suivi des temps | Essayer gratuitement | idem | signup |
| 9 | Appel final | Essayer Costructor gratuitement | Grande pilule | `signup?plan=business_plus` |
| 9b | À côté du 9 | Demander une démo | Pilule blanche, masquée par défaut | Ouvre le chat et un scénario de robot |
| M | Menu mobile | Inscription / Connexion | Pilule pleine / pilule contour | signup / application |

**Ce qu'il faut retenir :**
- **Volume :** 10 boutons d'inscription visibles sur ordinateur, avec 6 libellés différents pour une seule adresse.
- **Aucune hiérarchie :** tous les boutons sont des boutons principaux de la même couleur, sans option secondaire visible.
- **Espacement :**
  - dans les écrans 1 à 6, un bouton tous les 400 à 900 px ;
  - de la signature à la vidéo, environ 2 500 px sans bouton d'inscription ;
  - après l'appel final, la FAQ et le pied de page n'ont aucun bouton.
- **Moments manqués :** aucun bouton juste après la signature animée (l'effet le plus fort de la page), ni juste après les avis.
- **Mobile :** le bouton de l'en-tête est masqué et il n'y a pas de barre collante en bas. Les longues zones sans bouton sont donc bien réelles sur téléphone.
- **Montée en gamme cachée :** celui qui lit toute la page et clique en bas démarre l'essai de la formule chère (Business+).
- **Fuites hors du parcours :**
  - la pastille « NOUVEAU » mène à l'écran de connexion de l'application, une impasse pour un prospect ;
  - deux méga-menus d'environ 25 liens ;
  - 7 liens « En savoir plus » ;
  - 4 liens dans le texte ;
  - YouTube et le lien vers Google.
- **Mesure :** GTM, et sourcebuster, qui garde la source d'acquisition en cookie jusqu'à l'inscription.

### 3.2 Réassurance

« Vérifiable » veut dire : contrôlable depuis la page elle-même.

| Élément | Où | Vérifiable ? | Effet | Chez Qonforme |
|---|---|---|---|---|
| « Avis 4.9/5 » avec logo Google et 5 étoiles pleines | Sous le bouton du héros | Non. Le lien mène à la section avis de la page, sans nombre d'avis | Très fort | Interdit sans vrais avis (§ 2) |
| « 140 000 clients satisfaits », « + 2 millions devis », « + 500 000 chantiers » | Bande de chiffres | Non. L'appel final dit « 140 000 utilisateurs ». Selon la note du 05/10, le chiffre varie entre 80 000 et 150 000 selon les sources | Fort (effet de foule) | Interdit |
| « 4,9 / 5 sur + 650 avis Google » | Bande de chiffres | Hors de la page seulement | Fort | Interdit tant qu'il n'y a pas d'avis réels |
| 7 témoignages (nom, entreprise, citation) | Carte posée sur la photo du héros, section avis | Non : ni date, ni lien par avis. Un seul lien global vers Google. Un avis cite un logiciel concurrent | Fort : lève les objections (simplicité, mobile, support, prix, essai) | Interdit sans vrais avis. Élément flottant refusé par le fondateur |
| Logos presse et partenaires | Sous le héros | Non : aucun lien, aucun article. Mélange de presse, de partenaire commercial et de programme public | Moyen | Rien à afficher, rien à inventer |
| Logotype « Solution compatible » | Héros, dans une carte avec ombre | Hors de la page seulement. La plateforme raccordée n'est pas nommée | Fort en 2026 | Autorisé par le seul composant `SolutionCompatible`, sans ombre, au moins 192 px de large (§ 13) |
| Logos Peppol, Factur-X, Finances Publiques | Bandeau 2026 | Ce sont un réseau, un format et l'administration, pas des partenaires | Fort, mais trompeur | Logo de l'administration interdit (il laisse croire à un agrément). « Factur-X » possible en texte |
| « Logiciel de facturation Certifié conforme » | Bloc facturation | Non : ni certificat ni organisme | Moyen | Interdit (« certifié », « conforme ») |
| « Compatible loi anti-fraude à la TVA » | Badges | Non : aucune attestation | Moyen | À éviter sans attestation |
| « 100 % conforme eIDAS et RGPD » | Signature | Non : ni niveau de signature ni prestataire | Moyen | Interdit tel quel |
| « 45 % », « 32 % », « 4h par semaine », « 1 min 30 » | Gains, signature | Non : ni source ni méthode | Fort | Interdit (faux chiffres) |
| « Support client gratuit », « Assistance illimitée Chat / Email / Téléphone », formation et import par l'équipe | Bande violette, badges, FAQ | Seul le chat est visible. La FAQ réserve le tchat et le téléphone à l'abonnement payant | Très fort pour un artisan qui a peur de rester bloqué | Interdit (aucune promesse de contact humain) |
| « Version gratuite illimitée » | FAQ seulement | Non. D'après leur grille, l'offre gratuite n'envoie pas d'email et n'a ni avoir ni support | Très fort, mais enterré | Vrai chez Qonforme : devis gratuits et illimités, envoyés par email avec le PDF |
| Essai de 14 jours, annulation, données conservées | FAQ seulement | Non | Fort, mais enterré | Vrai chez Qonforme : garantie 30 jours en libre-service, sans engagement, documents gardés après résiliation |
| Vidéo « premier devis en 1 minute » | Avant l'appel final | Oui : on voit le produit | Fort | Équivalent : les scènes « Trois étapes » (`StepsShowcase`) et la démo `/demo` sans compte |
| Signature interactive | Bande violette | Oui, mais simulée | Fort : le visiteur fait le geste lui-même | À reprendre seulement quand la signature sera vendue (voir § 6) |
| Identité de l'éditeur | Absente (lien vers les mentions légales) | — | Manque | À ajouter. Les mentions légales de Qonforme doivent aussi être complétées (§ 12 « Reste ouvert ») |

Le partenariat officiel avec la CAPEB, leur meilleur prescripteur selon la note du 05/10, n'apparaît pas sur l'accueil.

### 3.3 FAQ

Les 12 questions et l'objection que chacune lève :

1. Essayer gratuitement : risque et coût. C'est le meilleur argument de la page, mais il n'apparaît qu'ici.
2. Support client : peur de rester bloqué. Promesse humaine.
3. Mobile : usage sur le terrain.
4. Plusieurs postes : équipe, appareils.
5. Import depuis un autre logiciel : coût de changement. Vise les entreprises déjà équipées.
6. Formations : prise en main. Promesse humaine.
7. Facture électronique 2026 : conformité. La réponse dit « 100% compatible », parle d'un « partenariat avec Peppol » (un réseau, pas une entreprise) et d'obligations « qui entreront en vigueur en 2026 », au futur.
8. Prix : la réponse ne donne aucun chiffre et renvoie vers la page Tarifs.
9. Annulation : vaut pour l'abonnement mensuel seulement.
10. Données après l'essai : bien traité.
11. Nombre d'utilisateurs : équipe.
12. Support compris : doublon de la question 2.

**Objections non traitées :**
- le prix en chiffres ;
- l'engagement annuel et le remboursement ;
- la valeur d'une signature en ligne ;
- les mentions obligatoires du bâtiment (décennale, TVA réduite) ;
- l'hébergement et la sécurité des données ;
- le départ et l'export des données ;
- le mode hors ligne ;
- l'accès du comptable.

### 3.4 Friction

- **Parcours :** un clic vers un autre sous-domaine (`app.`). Aucun formulaire sur l'accueil, et les champs de l'inscription ne se voient pas avant le clic.
- **Ambiguïté :** on ne sait pas si « Essayez, c'est gratuit » désigne un essai limité ou une formule gratuite. Seule la FAQ tranche.
- **Ni prix ni « sans carte bancaire »** près d'un bouton.
- **Démonstration :** le bouton n'existe que si le chat se charge, puis passe par un robot. Il n'y a pas de démo en libre-service.
- **Charge :** 7 blocs de fonctions, dont 4 hors du cœur pour un artisan seul (planning, interventions, temps, achats).
- **Contenus faux ou périmés :**
  - « Générez vos attestations de TVA » : l'attestation a été remplacée par une mention en 2025 ;
  - « Faites vous payer en 1 clic ».
- **Ce qui manque :**
  - un prix d'ancrage ;
  - « sans carte bancaire » sous chaque bouton ;
  - une phrase « ce qui se passe après le clic » ;
  - une démo sans compte ;
  - un bouton après la signature et après les avis ;
  - une barre collante sur mobile ;
  - des avis vérifiables ;
  - l'identité de l'éditeur ;
  - un bloc sur la sécurité et la propriété des données.

### 3.5 Incohérences relevées

- « 140 000 clients satisfaits » dans les chiffres, « 140 000 utilisateurs » dans l'appel final.
- « Support client gratuit » dans la bande violette, alors que la FAQ réserve « tchat et téléphone » à l'abonnement payant.
- « Version gratuite illimitée » dans la FAQ, alors que leur grille ne permet pas l'envoi par email dans l'offre gratuite. Le bouton final ouvre l'essai d'une formule payante.
- Note de 4,9 affichée avec 5 étoiles pleines.
- Logotype « Solution compatible » posé dans une carte avec ombre, alors que la charte interdit tout effet.
- Coquilles : « environement », « en temps et en heures », « Electricien », « iOs ».
- Le texte alternatif de l'image du suivi des temps est faux (« Calcul de la rentabilité d'un chantier »).
- 7 métiers dans le carrousel, 14 dans le menu.

---

## 4. Design et animations

### 4.1 Système visuel

**Gabarit.** Le thème est très probablement un portage WordPress du modèle Tailwind UI « Salient ». Les indices :
- Lexend avec Inter ;
- la balise `html` « h-full scroll-smooth bg-white antialiased » avec le jeu `ss01` ;
- le guillemet SVG de 105 × 78 des avis ;
- les classes des onglets.

**Polices.**
- **Titres :** Lexend en 500, `tracking-tight`, slate-800/900. La police est chargée de 100 à 900 alors que seul le 500 sert.
  - H1 : 30, puis 36, puis 42,4 px (hauteur de ligne 48 px).
  - H2 des blocs : 24, 30, puis 36 px.
  - « boosté à l'IA » est simplement coloré, sans trait dessous.
- **Texte :** Inter variable (hébergée sur rsms.me), slate-600, 16 px (18 px dans le héros), interligne serré.
- **Chiffres des cartes :** 30 px en gras.

**Couleurs.**
- Violet pervenche : 50 `#f0f3fd`, 100 `#e4e8fb`, 500 `#6665dd` (boutons, bande pleine), 600 `#6459d2`, 700 `#5549b9`, 800 `#463e95` (appel final, départ du dégradé).
- Gris slate de Tailwind : 100 `#f1f5f9` (bandes), 200 `#e2e8f0` (bordures), 600 `#475569`, 900 `#0f172a` (pied de page).
- Accents : vert 500 `#22c55e` (bouton « Signer le devis »), jaune 400 (étoiles).

**Rayons.**
- 6 px : captures et bouton de l'en-tête.
- 8 px : cartes de chiffres, cadres en verre, entrées de menu.
- 12 px : cartes métier, bandeau facture électronique, cadre du téléphone, vidéo, méga-menus.
- 16 px : avis.
- Pilule : tous les autres boutons et la pastille « NOUVEAU ».
- Photo du héros en goutte : trois coins ronds, coin haut droit carré.

**Ombres.**
- Une seule signature visuelle : `shadow-xl` diffuse et froide, `rgba(203,213,225,.3)`.
- Avis : même ombre en slate-900 à 10 %.
- En-tête après défilement : `shadow-lg` slate-400 à 20 %.
- Une faute de frappe (`shadow-geen-900/50`) laisse la capture de la signature sans couleur d'ombre.

**Grille en pointillés.**
- Un calque de 4 colonnes est posé derrière les blocs de fonctions : bords pleins, trois lignes intérieures en tirets.
- Il est remonté de 48 à 80 px pour démarrer au-dessus du padding et ne bouge jamais.

**Superposition des captures.** Chaque bloc empile deux ou trois captures décalées :
- un téléphone qui déborde d'une capture d'ordinateur ;
- une seconde capture à 50 % de large ;
- une petite carte collée au milieu d'une capture ;
- des cadres en « verre » (`bg-white/20 backdrop-blur-[2px]`).

**Bandes pleine largeur.**
- Violet plein : simplicité.
- Gris clair : chiffres, gains, avis.
- Dégradé diagonal violet foncé vers violet : signature.
- Violet foncé : appel final.
- Gris très foncé : pied de page.

**Cartes.**
- Chiffres : blanches, bordure, ombre, icône sur une tuile teintée de 48 px.
- Métier : photo de 160 px, titre de 20 px, texte limité à 3 lignes.
- Avis : 3 colonnes décalées.

Les puces sont des coches pleines violettes, sans fond.

### 4.2 Animations et interactions

| Élément | Déclencheur | Durée | Technique |
|---|---|---|---|
| Ombre de l'en-tête | Défilement au-delà de 100 px | Instantanée (pas de transition) | Écouteur `scroll` sans limitation de fréquence, qui ajoute une classe d'ombre |
| Méga-menus | Survol, fermeture 150 ms après la sortie | 200 ms, ease-out | `opacity` de 0 à 1 et `translateY` de 4 px à 0. Ni le clavier ni le clic ne les ouvrent |
| Entrées de menu, liens | Survol | 150 ms | Couleur. La tuile de l'icône passe en violet, l'icône en blanc |
| Boutons, pastille | Survol, pression | 150 ms | Couleur de fond seulement, sans soulèvement ni agrandissement |
| Menu mobile | Clic | Fond 200 ms, carte 200 ms après 100 ms | `opacity` en style écrit dans la balise. Voile sans flou |
| Accordéons du menu mobile | Clic | Panneau instantané, chevron 200 ms | Rotation du chevron |
| Ancres | Clic | Natif | `scroll-behavior: smooth` |
| Carrousel des métiers | Glisser, pagination | 300 ms | Swiper 12 complet (environ 155 Ko) pour un seul carrousel. L'alignement est calculé une seule fois au chargement et devient faux après un redimensionnement. Flèches configurées mais absentes. Ni lecture automatique ni boucle |
| Cartes métier | Survol | 300 ms | Ombre |
| Signature du devis | Clic sur « Signer le devis », une seule fois, sans rejeu | 2,3 s | Transitions CSS, `stroke-dashoffset`, confettis en canvas (voir le déroulé ci-dessous) |
| Images | Approche à moins de 300 px | Apparition sèche | Lazy-load JavaScript (WP Rocket). Sections du bas en `content-visibility: auto` sans taille réservée : la barre de défilement saute |
| Chat | Chargement du script | — | Bulle flottante tierce |

**Déroulé de la signature :**
- **0 ms :** le bouton disparaît. Le pavé en verre posé sur le coin du devis passe de 96 à 236 px de haut (`max-height`, 250 ms).
- **300 à 1 300 ms :** 41 segments de trait se dessinent l'un après l'autre, en linéaire, chacun pendant un temps proportionnel à sa longueur.
- **2 000 ms :** quatre effets en même temps :
  - 75 confettis en canvas (durée non mesurée, le script n'a pas chargé) ;
  - un voile vert couvre toute la section (opacité, 300 ms) ;
  - une coche verte monte de 96 px (200 ms) ;
  - le fond du pavé s'éclaircit.

**Défauts dans le code :**
- Les courbes `ease-out-expo` et `ease-out-back` n'existent pas dans la feuille compilée : c'est la courbe par défaut qui joue.
- La règle `.animated path` vise tous les `<path>` de la page.
- Aucune règle `prefers-reduced-motion` dans tout le CSS.
- Tippy et Popper (environ 46 Ko) sont chargés sans servir sur cette page.

**Ce qui n'est pas animé :**
- aucune apparition au défilement ;
- aucune entrée du héros ;
- aucun compteur ;
- logos fixes ;
- captures sans relief ni carrousel ;
- avis fixes ;
- FAQ toute dépliée.

---

## 5. SEO et technique

### 5.1 Le concurrent

**Balises.**
- **Title** (64 caractères), marque en tête : « Costructor - Logiciel BTP : devis, factures, gestion de chantier ».
- **Description** (143 caractères) : elle commence par « Essayez gratuitement le 1er logiciel… », une affirmation invérifiable.
- **Canonical** vers l'accueil ; robots en `index, follow, max-image-preview:large`.
- **Partage :** Open Graph et Twitter sans aucune image. Un lien partagé s'affiche sans visuel.
- **Viewport :** `maximum-scale=1` bloque le zoom (défaut d'accessibilité).
- **Exposé :** versions de WordPress et WP Rocket, `xmlrpc.php`, liens oEmbed.

**Données structurées (Yoast).**
- `WebPage` et `FAQPage` (12 questions). Depuis août 2023, le résultat enrichi FAQ est réservé aux sites officiels et de santé : il ne leur rapporte aucun affichage.
- `BreadcrumbList` à un seul élément, donc inutile.
- `WebSite` avec `SearchAction` : Google a retiré cette boîte de recherche fin 2024.
- `Organization` avec logo et `sameAs`.
- Ni `SoftwareApplication`, ni `Offer`, ni `aggregateRating`.

**Titres.**
- Un seul H1.
- Un H3 arrive avant le premier H2.
- 10 H2 de fonctions, dont un avec un emoji.
- Les cartes métier sont en H4 directement sous un H2.
- « Ils gèrent… » et « Prêt ? » sont en H3 au lieu de H2.
- Les questions de la FAQ sont en `<strong>`.

**Maillage : c'est leur vrai levier.**
- 11 pages de fonctions (`/logiciel-devis/`, `/logiciel-facturation/`, `/facturation-electronique/`…).
- 14 pages `/devis-factures/<métier>/`.
- Tarifs, outils, blog.
- Les menus sont écrits deux fois (ordinateur et mobile) : 110 liens, 56 adresses internes distinctes.
- Le pied de page reprend les 14 métiers et 4 articles sur des mots-clés forts.
- Ancres mots-clés dans le texte, mais 7 « En savoir plus » sur les cartes métier.

**Images.**
- 33 images, aucune avec `width`, `height` ou `srcset`.
- 27 en lazy-load JavaScript, avec une image de remplacement de taille nulle : décalages de mise en page.
- Photo du héros en image de fond CSS : préchargée, mais sans texte alternatif.
- Textes alternatifs bourrés de mots-clés, répétés, parfois faux ; métiers en minuscules et sans accent.

**Poids.**
- **HTML :** 427 Ko bruts (environ 99 Ko compressés), dont environ 3 % de texte visible.
- **JavaScript écrit dans le `<head>`, sans defer :** 246 Ko (Swiper, Popper, tippy, js-cookie, sourcebuster), plus jQuery bloquant.
- **CSS :** 37 Ko écrits dans la page, plus 84 Ko en fichier.
- **Polices :** Lexend en double (copie locale, plus le lien Google Fonts resté en place) ; Inter sur un hôte tiers en 40 `@font-face` ; Font Awesome Pro par un kit JavaScript.

**Scripts tiers.**
- GTM, Ahrefs Web Analytics, un pixel « oaiq », CookieYes.
- Le chat Crisp, chargé sans condition.
- `confetti.js`.
- Turnstile et un plugin de sommaire, alors que la page n'a ni formulaire ni sommaire.
- Un script de parrainage qui réécrit les liens d'inscription.
- `sbjs.init()`, exécuté sans attendre le consentement.
- La vidéo YouTube en iframe direct, sans façade.

### 5.2 Ce que l'accueil de Qonforme fait déjà mieux (relevé en production)

- **Balises :** title de 69 caractères avec le mot-clé d'abord, description de 153 caractères, canonical, image de partage dynamique (`/api/og`).
- **Titres :** un seul H1 qui porte « artisans du bâtiment », des sections en H2, des cartes en H3.
- **Données structurées :** `Organization` et `SoftwareApplication` avec de vraies offres (0 € et 12 € HT), sans note inventée. La FAQ en JSON-LD a le même texte que la FAQ visible, en `<details>`.
- **Polices :** `next/font`, hébergées sur le domaine, `display: swap`.
- **Icônes :** Lucide en SVG, aucune police d'icônes.
- **Images :** `next/image` avec dimensions, `srcset` et `sizes`, WebP, lazy natif, textes alternatifs descriptifs.
- **Scripts tiers :** pixel Meta, Vercel Analytics, Sentry Replay chargé tard. Pas de jQuery, pas de chat, pas de GTM.
- **Inscription :** sur le même domaine.

**À ne pas surestimer :**
- Le HTML pèse 523 Ko bruts (52 Ko compressés), dont 229 Ko de données RSC et 71 Ko de SVG intégrés.
- Le JavaScript propre à l'accueil fait environ 240 Ko compressés. La mesure est approximative.

L'avantage tient à l'absence de scripts tiers lourds, pas à un JavaScript plus léger.

### 5.3 Règles SEO pour la variante B (`/design`)

**Indexation.**
- Canonical vers « / ». C'est déjà le cas dans `app/design/page.tsx`.
- Ni `noindex` ni `Disallow` dans `app/robots.ts`, sinon Google ne voit pas le canonical.
- Title et description hérités de l'accueil.
- La variante reste hors de `app/sitemap.ts`, du plan du site, du menu et du pied de page. Aucun lien interne ne doit pointer vers `/design`.

**Données structurées.**
- Pas de JSON-LD `FAQPage` sur B : celui de la FAQ vit sur l'accueil.
- Pas de `VideoObject` sans vraie vidéo.
- Jamais d'`aggregateRating`.
- `Organization` et `SoftwareApplication` viennent déjà du layout racine.

**Titres.**
- Un seul H1, qui garde « logiciel », « devis », « factur… » et « artisans du bâtiment ».
- Sections en H2, cartes et métiers en H3.

**Maillage.**
- Si B gagne, elle remplace « / ». Elle doit donc garder au moins les liens de l'accueil actuel.
- Métiers vers les 11 pages `/facturation/<métier>`, avec des ancres descriptives.
- Blocs de fonctions vers les guides et modèles existants :
  - devis : `/guide/comment-faire-un-devis`, `/modele/devis-travaux` ;
  - factures : `/guide/premiere-facture`, `/guide/mentions-obligatoires-facture` ;
  - relances : `/modele/lettre-relance-impaye`, `/guide/facture-impayee`, `/outils/calculateur-penalites-retard` ;
  - facture électronique : `/guide/facture-electronique-2026`, `/guide/plateforme-agreee` ;
  - TVA : `/guide/tva-travaux`.
- Sur B, les ancres doivent rester sur la page. Le `/#features` et le logo du pied de page partagé renvoient vers A, ce qui pollue le test.

**Images.**
- Photo du héros en `<Image priority>` avec un texte alternatif qui décrit la scène, jamais en image de fond CSS. Elle doit être la seule image préchargée.
- `sizes` partout.
- `alt=""` et `aria-hidden` pour le décor.

**Performance.**
- La page reste statique : ni `cookies()` ni `headers()` dans la page.
- Les îlots client (carrousel, `CountUp`) reçoivent des données minimales.
- Pas de Swiper : réutiliser `components/landing/carousels.tsx`.
- Pas d'iframe YouTube.
- `content-visibility: auto` seulement avec `contain-intrinsic-size`. Jamais `will-change`.

**Scripts tiers.** Ni chat, ni GTM, ni Turnstile, ni outil de consentement tiers, ni police distante.

### 5.4 Défauts relevés sur l'accueil actuel (hors variante)

1. **À trancher en priorité :** `app/confidentialite/page.tsx` affirme que Qonforme « n'utilise ni Google Analytics, ni Facebook Pixel ». Or `app/layout.tsx` charge le pixel Meta (`fbq`) sur les pages publiques, sans recueil de consentement. Deux choix : retirer le pixel, ou ajouter un consentement et corriger la page. La décision revient au fondateur.
2. **Deux balises viewport :** celle écrite à la main dans `app/layout.tsx` et celle ajoutée par Next. À remplacer par `export const viewport`.
3. **Données structurées :**
   - il manque un nœud `WebSite` (nom « Qonforme ») ;
   - le `logo` de `Organization` pointe vers `og-image.png` au lieu d'un logo carré ;
   - `sameAs` est absent.
4. **Image Twitter :** elle dit « pros du bâtiment », alors que l'image Open Graph dit « artisans du bâtiment ».

---

## 6. Transposition pour Qonforme

### 6.1 Règles à respecter (`CLAUDE.md`, `DECISIONS-STRATEGIQUES.md`)

- **Concurrent :** ne jamais le nommer en public (§ 2).
- **Affirmations interdites :**
  - faux avis, note Google, nombre d'utilisateurs, de devis ou de chantiers ;
  - logos de presse ou de partenaires ;
  - « certifié », « conforme », « homologué », « 100 % conforme eIDAS » ;
  - gains chiffrés sans mesure (§ 2).
- **Aucune promesse de contact humain :** pas de support, de chat, de téléphone, de formation, de « Demander une démo » ni d'import par une équipe (§ 2).
- **Label :** « Solution compatible » uniquement par `components/brand/SolutionCompatible.tsx` (ou `SolutionCompatibleNote`), en ligne, sans ombre ni effet, au moins 192 px de large. Jamais « plateforme agréée ». Aucun logo de l'administration (§ 13).
- **Ne vendre que ce qui est livré (`lib/stripe/plans.ts`) :**
  - **gratuit :** devis illimités, clients et catalogue, factures en brouillon, documents consultables ;
  - **Essentiel (12 € HT par mois, ou 120 € HT par an) :** factures et avoirs illimités, envoi par email avec le PDF, relances automatiques des impayés, devis transformé en facture en un clic, export FEC, tableau de bord ;
  - **encore « à venir » (`upcoming`), donc jamais vendus :** émission via plateforme agréée, réception des factures fournisseurs, signature en ligne ;
  - **formule Artisan :** vendue seulement si ses deux prix Stripe sont configurés (`NEXT_PUBLIC_ARTISAN_ON_SALE`) ;
  - **à ne jamais vendre :** planning, interventions, suivi des temps, marge, IA côté artisan.
- **Paiements :** pas de paiement par carte côté client de l'artisan, virement seulement (§ 12). Pas d'app des stores : le site est installable sur l'écran d'accueil.
- **Design :**
  - aucun élément flottant ni capture posée sur une autre ;
  - ni dégradé ni halo ;
  - jamais de `backdrop-filter` ni de `will-change` sur mobile ;
  - icônes sans fond (`.q-glyph`) ;
  - photos d'artisans jamais présentées comme des clients (§ 6).
- **Ton :** vouvoiement, sans emojis, dates exactes de la réforme, pas de marketing de la peur.

### 6.2 Section par section

| Section du concurrent | Équivalent Qonforme honnête | Pourquoi |
|---|---|---|
| 0. En-tête fixe | `PublicNav` existant. Menu métiers vers les 11 pages `/facturation/<métier>`. Bouton « Créer mon compte gratuit » | Qonforme n'a pas de pages de fonctions : pas de « Plus de 100 fonctionnalités », pas d'entrée vers une page qui n'existe pas |
| 1. Héros | H1 en deux voix, sans IA, qui garde « logiciel », « devis », « factures » et « artisans du bâtiment » (exemple : « Le logiciel de devis et factures des artisans du bâtiment, *gratuit pour vos devis.* »). Quatre puces tirées de `plans.ts` : devis illimités gratuits ; factures, avoirs et relances avec Essentiel à 12 € HT par mois ; devis transformé en facture en un clic ; ordinateur, tablette et téléphone, installable sur l'écran d'accueil. Bouton pilule, puis « Devis gratuits, sans carte bancaire ». `SolutionCompatible` en ligne sous le bouton. Photo d'artisan seule, en `<Image priority>` | Aucune fonction d'IA pour l'artisan. Pas d'avis, donc pas de note. Le carton posé sur la photo serait un élément flottant, et la charte interdit l'ombre sur le logotype |
| 2. Bandeau facture électronique | Dates exactes : réception obligatoire depuis le 1er septembre 2026, émission pour les TPE au 1er septembre 2027. `SolutionCompatibleNote`. Liens vers les guides facture électronique et plateforme agréée. « Factur-X » possible en texte | Le logo des Finances publiques laisserait croire à un agrément, le logo Peppol à un partenariat. Ni emoji ni peur (§ 2). Ne rien écrire au-delà de ce que couvre le raccordement (preuve non consignée, § 13) |
| 3. Logos presse | Bandeau des 11 métiers du bâtiment | Aucune presse ni aucun partenaire réel : rien à inventer |
| 4. Bande « simplicité » | Bande de couleur unie (bleu ou marine) : « En ligne, rien à installer », « Ordinateur, tablette et téléphone », « Devis gratuits, sans carte bancaire » | « Support client gratuit » est une promesse de contact humain. Dégradés refusés par le fondateur |
| 5. Chiffres | Faits de l'offre : « 0 € pour vos devis, illimités », « 12 € HT par mois à la première facture (10 € à l'année) », « 30 jours remboursé », « 11 métiers du bâtiment ». Icônes sans tuile. `CountUp` seulement pour des quantités | Nombre de clients, de devis, de chantiers et note Google : invérifiables ou inexistants |
| 6. Devis | Envoi par email avec le PDF et le logo (gratuit), catalogue de prestations, TVA par ligne, mentions du bâtiment. Liens `/guide/comment-faire-un-devis`, `/modele/devis-travaux`. Une capture, ou un ordinateur et un téléphone côte à côte | Pas d'« attestations de TVA » (remplacées par une mention depuis 2025), pas d'IA, pas de bibliothèque de prix tierce, pas de captures empilées ni de cadres en verre |
| 7. Facturation | Devis transformé en facture en un clic, avoirs, envoi par email avec le PDF, export FEC (Essentiel). Liens vers les guides de la facture. Acomptes et situations seulement si Artisan est en vente | « Certifié conforme » interdit. Pas de paiement par carte côté client (§ 12). Le lien de paiement par virement n'est pas dans `features` et dépend d'une migration |
| 8. Gains chiffrés | Les mécanismes plutôt que des pourcentages : relances automatiques des impayés, devis transformé en facture en un clic, tableau de bord (chiffre du mois, encours, retards). S'inspirer de la section « Payé à l'heure » | 4 h, 32 % et 1 min 30 ne sont pas mesurés : ce seraient de faux chiffres |
| 9. Chantiers | Seulement si Artisan est vendue et la migration appliquée : suivi par chantier (signé, facturé, encaissé, reste à facturer). Sinon, retirer | Pas de Gantt, de photos ni de marge : ces fonctions n'existent pas |
| 10. Interventions | Retirer | Hors cible (§ 4) et inexistant |
| 11. Rentabilité et achats | Retirer, ou la trésorerie à 30, 60 et 90 jours si le fondateur décide de la mettre en avant (elle n'est pas dans `plans.ts`) | Marge et rentabilité n'existent pas. La réception des factures fournisseurs est encore à venir |
| 12. Suivi des temps | Retirer. À la place possible : export FEC (Essentiel) et accès du comptable en lecture seule, si sa migration est appliquée | Inexistant et hors cible |
| 13. Signature électronique | Démonstration « du devis accepté à la facture », déclenchée au clic d'un bouton libellé comme un exemple, avec « Rejouer », une annonce `aria-live` et un bouton d'inscription juste après. Fond blanc ou marine plein. La signature en ligne reviendra à cette place quand elle passera de `upcoming` à `features` | La signature n'est pas encore vendue. « 45 % », « eIDAS » et l'argument environnemental sont invérifiables. Dégradé refusé. Verre flouté interdit sur mobile |
| 14. Métiers | Carrousel des 11 pages métier avec photos, ancres descriptives (« Logiciel de devis pour plombier »), composant de `components/landing/carousels.tsx` | Pas de métiers hors bâtiment. « En savoir plus » répété ne sert pas le référencement. Pas de Swiper |
| 15. Badges | Engagements vrais : documents conservés même sans formule, sans engagement, remboursé 30 jours (garantie en libre-service). « Développé en France » seulement si c'est vérifié | « Compatible loi anti-fraude » sans attestation. « Assistance illimitée » est une promesse humaine |
| 16. Avis | « Nos engagements, noir sur blanc », ou un exemple de devis chiffré avec des données d'exemple annoncées. Plus tard, de vrais avis avec un lien vers leur source | Aucun avis vérifiable aujourd'hui (§ 2) |
| 17. Vidéo | `StepsShowcase` (« Trois étapes », données d'exemple annoncées) | Aucune vidéo n'existe. « En 1 minute » n'est pas mesuré |
| 18. Appel final | « Votre premier devis, gratuit, sans carte bancaire. » Bouton principal vers l'inscription, bouton secondaire « Voir la démo » vers `/demo` (sans compte). Fond blanc ou photo (§ 6) | Pas de nombre d'utilisateurs. Pas de « Demander une démo » (promesse humaine). Pas de montée en gamme cachée vers Artisan |
| 19. FAQ | Accordéon, avec des réponses vraies : gratuité (devis gratuits, payant à la première facture), prix en chiffres, garantie 30 jours, annulation, documents conservés après résiliation, téléphone (site installable, pas d'app des stores), plusieurs appareils, un utilisateur par compte, facture électronique dans les limites du § 13, accès du comptable. Ajouter les objections qu'ils ne traitent pas | Pas de question sur le support, la formation ou l'import : aucun service humain, et l'import de clients n'est pas livré |
| 20. Pied de page | `Footer` existant | Ses liens `/#features` et le logo ramènent vers A : à neutraliser sur B |
| Bulle de chat | Aucune | Promesse de contact humain, et script tiers lourd |

**Boutons sur toute la page.**
- Même densité que le concurrent : un bouton par bloc, en plus de l'en-tête.
- Une barre collante en bas sur mobile, qui manque chez eux.
- Un seul libellé répété : « Créer mon compte gratuit ».
- Sous les boutons principaux : « Devis gratuits, sans carte bancaire · vous payez à partir de votre première facture ».

### 6.3 Mouvement : ce qui se reprend, et comment

Valeurs communes, déjà dans `app/globals.css` :
- apparition par `data-reveal` ;
- décalages `lp-d1` à `lp-d3` ;
- survol de 150 à 200 ms ;
- une scène dure 2,5 s au plus.

Garde-fous :
- tout ce qui bouge respecte « Réduire les animations » ;
- le rendu serveur et l'absence de JavaScript montrent l'état final ;
- opacité, `translate` et `scale` seulement ;
- ni `backdrop-filter` ni `will-change` ;
- rien d'infini.

Section par section :
- **En-tête :** garder la pilule et la barre de lecture. Si l'ombre au défilement est reprise, la porter par un pseudo-élément en opacité, déclenché par une sentinelle (IntersectionObserver), pas par un écouteur `scroll`. Les menus s'ouvrent aussi au clic et au clavier.
- **Héros :** entrée du texte en fondu, une fois. La photo est l'élément LCP : elle ne part jamais d'une opacité nulle. Le logotype ne bouge pas.
- **Bandes et chiffres :** fondu, puis apparition décalée des colonnes. `CountUp` seulement pour les quantités, jamais pour les prix.
- **Blocs de fonctions :** le texte entre par la gauche ou par la droite selon son côté, la capture en zoom, le téléphone avec un léger retard. Les pointillés restent statiques : un `scaleY` déformerait les tirets. Garder un espacement généreux (120 à 190 px).
- **Démonstration au clic :**
  - trait d'environ 0,9 s ;
  - tampon « Accepté » de 0,9 à 1 en `scale`, avec un fondu (250 ms) ;
  - pastille de coche (400 ms) ;
  - 6 à 8 étincelles, une seule fois.
  - **À exclure :** confettis en canvas, fond qui change de couleur, pavé posé sur le papier.
  - **Avec « Réduire les animations » :** l'état final s'affiche tout de suite.
  - **Écart à valider :** le tracé par `stroke-dashoffset` sort de la règle « opacité, translate, scale ». Deux possibilités : le valider explicitement, ou révéler le trait par un cache blanc en `scaleX`.
- **Carrousel des métiers :**
  - défilement natif avec accroche, vrais boutons précédent et suivant ;
  - alignement recalculé au redimensionnement ;
  - pas de lecture automatique, ou alors les règles des carrousels existants (pause hors de l'écran, au survol, au clavier, bouton Pause) ;
  - soulèvement au survol seulement sur les appareils à souris.
- **FAQ :** accordéon. Le contenu apparaît en fondu, la hauteur change d'un coup.
- **Appel final :** apparition en `scale`.
- **Pied de page :** statique.

### 6.4 À vérifier avant de consacrer un bloc à une fonction

- **Logotype « Solution compatible » :**
  - la preuve du raccordement n'est pas consignée (§ 13) ;
  - plusieurs textes disent encore « en préparation » ;
  - `plans.ts` garde l'émission et la réception dans `upcoming`.
  - Ne rien écrire au-delà de ce que couvre réellement le raccordement.
- **Fonctions qui dépendent d'une migration « à appliquer » :**
  - signature en ligne ;
  - lien de paiement par virement ;
  - factures reçues ;
  - chantiers et formule Artisan ;
  - relances réglables (sans la migration : J+30 et J+45) ;
  - mentions du bâtiment automatiques ;
  - accès du comptable.
  - Vérifier en production celles qui sont actives.
- **Formule Artisan :** vendue seulement si `NEXT_PUBLIC_ARTISAN_ON_SALE` vaut « true » au build.
- **Trésorerie :** elle existe dans l'application mais n'est pas listée dans `plans.ts`. Il faut une décision du fondateur avant de la mettre en avant.

---

## 7. Ce que la variante B doit mesurer

### 7.1 Hypothèses

Un test de page entière mesure l'ensemble des changements. Les hypothèses servent à lire le résultat, pas à isoler chaque levier.

- **H1 :** un bouton d'inscription par écran, avec « Devis gratuits, sans carte bancaire » sous les boutons et une barre collante sur mobile, augmente la part de visiteurs qui cliquent vers `/signup`.
- **H2 :** une structure en liste de fonctions (titre à l'impératif, puces, capture), coupée de bandes, se lit plus vite que l'accueil actuel et emmène le visiteur plus loin dans la page.
- **H3 :** le label et l'échéance de la facture électronique placés dans les deux premiers écrans augmentent les inscriptions.
- **Garde-fou :** la variante ne doit pas dégrader la qualité des inscriptions.

### 7.2 Indicateurs

- **Principal :** inscriptions terminées par visiteur unique de chaque version.
- **Secondaires :**
  - clics vers `/signup` par visiteur, avec l'emplacement du bouton cliqué (héros, blocs, appel final, barre mobile) ;
  - clics sur « Voir la démo » ;
  - profondeur de défilement par paliers (25, 50, 75 et 100 %), et atteinte de l'appel final et de la FAQ.
- **Qualité :**
  - part des nouveaux comptes qui créent un premier devis sous 7 jours ;
  - LCP et CLS sur mobile.
- **Découpage :** ordinateur ou téléphone, et source du trafic (campagne, recherche, direct).

À fixer avant le lancement : l'indicateur principal, la durée et le seuil de décision. Ne pas arrêter le test au premier écart.

### 7.3 Ce qui manque aujourd'hui pour mesurer

- Les liens de la variante portent `?ab=design` (`SIGNUP_HREF`, `components/design/kit.tsx`), mais ni `app/signup/page.tsx` ni `POST /api/auth/signup` ne lisent ce paramètre. Aucune inscription n'est rattachée à une version.
- PostHog n'est pas actif dans le build en ligne. Les événements personnalisés de Vercel Analytics demanderaient la formule Pro (à vérifier).
- **À prévoir :**
  - enregistrer la version dans `user_metadata` à l'inscription ;
  - un événement par clic sur un bouton, avec son emplacement ;
  - un événement par palier de défilement ;
  - le tout sans nouvel outil tiers, et en vérifiant le statut du cookie de test au regard des règles de la CNIL sur les traceurs.

### 7.4 Répartir le trafic plus tard (à ne pas faire maintenant)

1. **D'abord, sans toucher à « / » :** envoyer seulement le trafic de campagne vers `/design`, et vers « / » avec les mêmes UTM.
2. **Ensuite, partage 50/50 par le middleware :**
   - **Qui :** seulement un visiteur non connecté qui demande « / ». La décision se prend après la logique de redirection existante.
   - **Tirage :** sans cookie de version, tirage à 50/50 et pose d'un cookie collant, d'une durée au moins égale à celle du test.
   - **Version B :** `NextResponse.rewrite` vers `/design`. L'adresse reste « / », il n'y a pas de redirection, et la page reste statique. Pour la version A, rien ne change.
   - **Googlebot :** traité comme n'importe quel visiteur, sans aucun traitement à part (pas de cloaking). Le canonical « / » de B est déjà en place. Ni `noindex` ni `Disallow`.
   - **Si l'on préfère une adresse visible `/design` :** redirection 302 seulement, jamais 301 ni 308.
   - **Cache :** le choix se fait dans le middleware, jamais dans la page. Le service worker ne met jamais « / » en cache.
   - **Inscription :** `POST /api/auth/signup` lit le cookie de version et l'écrit dans `user_metadata`.
   - **Durée :** test aussi court que possible (recommandation de Google).
3. **Fin du test :**
   - **Si B perd :** supprimer la page, rediriger `/design` vers « / » en 308 dans `next.config.mjs`, retirer le tirage.
   - **Si B gagne :** son contenu passe sur « / », en gardant au moins les liens de l'accueil actuel, puis même redirection.

---

## 8. Sources

**Page étudiée.** https://costructor.co/, relevée le 17/10/2026, avec quatre éléments :
- le HTML complet ;
- la feuille de style ;
- le script du thème ;
- 13 captures à 1 440 × 900 en descendant la page.

Le site limite le débit (erreur 429) : beaucoup d'images et quelques scripts (jQuery, confettis, pixel) n'ont pas chargé. Leur composition est déduite des classes du code. Rien d'autre n'a été téléchargé.

**Fichiers analysés** (dossier de travail de la session) :
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/index.html` : HTML complet (WordPress, thème en Tailwind, WP Rocket).
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/text.txt` : texte extrait, sections balisées.
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/style.css` : feuille de style compilée.
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/main.js` : script du thème (ombre de l'en-tête, signature animée, confettis).
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/shots2/d-00.png` à `d-12.png` : captures.
- `/tmp/claude-0/-home-user-Qonforme-fr/768ede6b-0da0-529d-a192-5ad0f121fa0b/scratchpad/comp/shots3/log.txt` : ressources refusées (429).

**Côté Qonforme :**
- `DECISIONS-STRATEGIQUES.md` (§ 1, 2, 4, 6, 12, 13)
- `ANALYSE-CONCURRENT-COSTRUCTOR-2026-10.md` (05/10/2026 : grille, chiffres d'utilisateurs selon les sources, CAPEB)
- `lib/stripe/plans.ts`
- `app/page.tsx`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/confidentialite/page.tsx`
- `app/design/page.tsx`, `components/design/` (variante B en cours)
- `components/layout/Footer.tsx`, `components/landing/carousels.tsx`, `components/design/CountUp.tsx`
- `app/signup/page.tsx`, `app/api/auth/signup/route.ts`
- `components/dashboard/GettingStarted.tsx`
- `lib/supabase/middleware.ts`, `public/sw.js`
