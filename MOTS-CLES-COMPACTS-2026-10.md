# Mots-clés compacts de Qonforme (octobre 2026)

> Document interne. Il nomme un concurrent : ne jamais reprendre ce nom dans un contenu public (CLAUDE.md, `DECISIONS-STRATEGIQUES.md` § 2).
> Relevé le 16/10/2026. Méthode : « compact keywords » du skill expert-seo (requêtes de bas de funnel, très précises, qui décrivent un scénario d'achat).

## 1. Résumé

- **Niche** : artisans du bâtiment (11 métiers), surtout seuls ou en petite équipe. **Offre réelle**, lue sur /pricing en ligne le 16/10 : devis gratuits et illimités pour toujours, envoi des devis par email compris ; factures, relances et export FEC avec Essentiel (12 € HT/mois ou 120 € HT/an). La formule Artisan (situations, acomptes, retenue de garantie, autoliquidation, chantiers) est affichée « Bientôt » et n'est pas en vente. La signature en ligne, la réception des factures fournisseurs et l'émission par une plateforme agréée sont « à venir ». Pas d'application dans les stores : le site et la PWA.
- **Ce que disaient les 200 mots-clés du concurrent** : 130 renvoient à ses calculateurs, 44 à des articles d'information (salaires, définitions) et 24 à sa page d'accueil (sa marque, plus quelques requêtes larges comme « logiciel devis facture bâtiment »). Presque aucun n'est un mot-clé compact pour Qonforme : seuls « exemple devis électricité » et « logiciel devis facture bâtiment gratuit » s'en approchent. Ce qui compte, c'est la structure de son site : une page « logiciel » par métier (`/devis-factures/{métier}`, 14 métiers) et un article « exemple de devis » par métier (13 métiers). Or, dans les résultats lus le 15 et le 16/10, ses pages métier ne sont dans le top 10 sur aucune requête métier, et ses articles « exemple de devis » n'apparaissent que deux fois : peinture (7ᵉ) et « devis modèle » (6ᵉ, avec l'exemple d'électricien). **Cet espace est ouvert.**
- **Deux familles de mots-clés compacts se dégagent :**
  1. « exemple / modèle de devis [métier] » : volumes de 50 à 390 par mois, difficulté 0, résultats faibles (Pinterest, Scribd, forums, TikTok, pages pour particuliers).
  2. « logiciel (de) devis [métier] » : petits volumes, mais coût par clic de 8 à 36 € (forte valeur). La Search Console prouve déjà la demande : `/facturation/macon` reçoit « logiciel devis maçon » (20 affichages, position 27,8) et 5 variantes, alors que son titre ne contient même pas le mot « devis ».
- **Hypothèses** : volumes et difficultés sont des estimations DataForSEO (via OpenSEO, France, par mois), à confirmer par la Search Console après publication. Aucune position n'est promise.

## 2. Notation

Chaque note va de 0 à 3. `Score = (Intention + Business) × Gagnabilité + Demande` (21 au plus). 14 et plus : prioritaire ; 8 à 13 : secondaire ; moins de 8 : écarter ou surveiller.

- **Intention** : 3 = choisir un logiciel ; 2 = utiliser un modèle ou un exemple tout de suite (public mêlé de pros et de particuliers) ; 1 = apprendre ; 0 = autre besoin.
- **Business** : 3 = notre offre répond exactement et le public est surtout des pros du bâtiment ; 2 = elle répond, mais le public est large ou mêlé ; 1 = surtout des particuliers.
- **Gagnabilité** (lecture du top 10 le 16/10, en plus de la difficulté) : 3 = au moins 5 résultats faibles (forum, réseau social, Pinterest ou Scribd, page ancienne, page hors sujet) ; 2 = 3 ou 4 ; 1 = 2 au plus ; 0 = verrouillé. « hyp. » = top 10 non lu, note supposée d'après la difficulté.
- **Demande** (volume mensuel de la variante principale et des variantes de même intention) : 0 = aucune donnée ou 10 ; 1 = 20 à 60 ; 2 = 70 à 250 ; 3 = 260 et plus.

## 3. Carte des mots-clés compacts

| # | Requête principale (variantes) | Scénario d'achat | I | B | G | D | Score | Adéquation | Page | Données |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | exemple devis électricité (devis électricité exemple 210, devis electricite 2 400 mêlé) | Électricien qui chiffre un tableau ou des prises et veut un devis à recopier | 2 | 3 | 3 | 2 | **17** | oui | `/modele/devis-electricien` (existe, inconnue de Google) | 210/mois, KD 0 ; top 10 lu (Scribd ×5, Pinterest ×2) |
| 2 | exemple devis maçon (exemple devis maçonnerie 170, modèle devis maçonnerie, devis type maçonnerie) | Maçon qui chiffre dalle, mur, ouverture et cherche un devis maçonnerie complet | 2 | 2 | 3 | 3 | **15** | oui | à créer : `/modele/devis-macon` | 170 + 170/mois, KD 0 ; top 10 lu (Pinterest, guide générique, 4 pages pour particuliers) |
| 3 | exemple devis paysagiste (exemple devis élagage 110, exemple devis jardinier 90) | Paysagiste qui chiffre un aménagement ou un entretien de jardin | 2 | 2 | 3 | 3 | **15** | oui | à créer : `/modele/devis-paysagiste` | 390/mois, KD 0 ; top 10 lu (TikTok, YouTube, forum, page de 2022) |
| 4 | logiciel devis maçon (logiciel devis facture maçon, logiciel devis maçonnerie 30, logiciel devis maçon gratuit, logiciel facturation maçon) | Maçon qui cherche un logiciel pour faire ses devis | 3 | 3 | 2 | 1 | **13** | oui | `/facturation/macon` (existe : titre à revoir) | Search Console : 20 affichages, position 27,8, + 5 variantes |
| 5 | logiciel plombier (logiciel devis plombier 30, logiciel facturation plombier 30, logiciel devis plomberie 30) | Plombier qui choisit un logiciel de devis et de factures | 3 | 2 | 2 | 3 | **13** | oui (pas de gestion des interventions) | `/facturation/plombier` (titre à revoir) | 260/mois, KD 0 ; top 10 lu |
| 6 | logiciel devis électricien (logiciel facturation électricien 20, logiciel devis facture électricien 10) | Électricien qui cherche un logiciel de devis | 3 | 3 | 2 hyp. | 1 | **13** | oui | `/facturation/electricien` (titre à revoir) | 30/mois, KD 0, coût par clic 12 € ; top 10 non lu |
| 7 | logiciel devis paysagiste (logiciel facturation paysagiste 30) | Paysagiste qui cherche un logiciel de devis | 3 | 3 | 2 hyp. | 1 | **13** | oui | `/facturation/paysagiste` (titre à revoir) | 30/mois, KD 0, coût par clic 18 € |
| 8 | exemple devis peintre (exemple devis peinture 320, modèle devis peinture 90) | Peintre qui prépare un devis de peinture intérieure | 2 | 3 | 2 | 3 | **13** | oui | à créer : `/modele/devis-peintre` | 320 + 320/mois, KD 0 ; top 10 lu (3 pages pour particuliers) |
| 9 | exemple devis plombier (exemple devis plomberie 140, modèle devis plomberie 20) | Plombier qui chiffre une salle de bains ou un dépannage | 2 | 3 | 2 | 3 | **13** | oui | à créer : `/modele/devis-plombier` | 140 + 140/mois, KD 0 ; top 10 lu (Scribd, Pinterest, page pour particuliers) |
| 10 | logiciel chauffagiste | Chauffagiste qui choisit un logiciel de devis | 3 | 2 | 2 | 2 | **12** | oui (pas de contrats d'entretien ni d'interventions) | `/facturation/chauffagiste` (titre à revoir) | 140/mois, KD 0, coût par clic 18 € ; top 10 lu |
| 11 | exemple devis placo (plâtrerie 20) | Plaquiste qui chiffre cloisons et doublages | 2 | 3 | 2 hyp. | 2 | **12** | oui | à créer : `/modele/devis-plaquiste` | 110/mois, KD 0 |
| 12 | exemple devis carrelage (exemple devis carreleur 70, modèle devis carrelage) | Carreleur qui chiffre une pose de sol ou de faïence | 2 | 3 | 2 hyp. | 2 | **12** | oui | `/modele/devis-travaux` (déjà un exemple de carrelage) ou à créer `/modele/devis-carreleur` | 70 + 70/mois, KD 0 |
| 13 | logiciel devis carreleur / couvreur / plaquiste (10 chacun, coût par clic jusqu'à 35 €) | Artisan qui cherche un logiciel pour son métier | 3 | 3 | 2 hyp. | 0 | **12** | oui | pages `/facturation/{métier}` (titre à revoir) | 10/mois chacun |
| 14 | devis vierge pdf (modèle devis vierge 70, devis vierge gratuit, word, excel) | Artisan qui veut un devis vierge à imprimer et remplir à la main | 2 | 2 | 2 | 3 | **11** | oui | `/modele` (le PDF vierge existe) | 170 + 70/mois, KD 1 ; top 10 lu (PDF de 2018, Pinterest, Scribd) |
| 15 | devis en ligne gratuit | Artisan qui veut faire un devis en ligne sans payer | 2 | 2 | 2 | 3 | **11** | oui | `/outils/generateur-devis-gratuit` et `/modele` | 1 300/mois, KD 11 ; Search Console : `/modele` 11ᵉ sur « devis en ligne gratuitement » ; le concurrent est 1ᵉʳ |
| 16 | modèle devis (devis modèle 2 400, devis template 480) | Artisan qui cherche un modèle | 2 | 2 | 2 | 3 | **11** | oui | `/modele` (existe, 4ᵉ à 7ᵉ) | Search Console : 108 affichages, aucun clic |
| 17 | exemple devis climatisation (exemple devis chauffage, pompe à chaleur) | Chauffagiste ou frigoriste qui chiffre une installation | 2 | 2 | 2 hyp. | 2 | **10** | oui | à créer plus tard : `/modele/devis-chauffagiste` | 90/mois, KD 0 |
| 18 | logiciel devis facture bâtiment (logiciel devis bâtiment 320, logiciel facturation btp 260, logiciel devis btp 210) | Artisan qui compare les logiciels | 3 | 3 | 1 | 3 | **9** | oui | page d'accueil (existe) | 880/mois, KD 10 ; top 10 lu (comparatifs, éditeurs installés ; concurrent 2ᵉ) |
| 19 | exemple devis toiture (charpente 70, couverture 20) | Surtout des particuliers qui estiment le prix d'une toiture | 2 | 1 | 2 | 3 | **9** | oui | plus tard : `/modele/devis-couvreur` | 210/mois, KD 0 ; top 10 lu (pages pour particuliers, une page de 2022 qui cite encore le seuil de 150 €) |
| 20 | logiciel devis bâtiment gratuit (logiciel devis facture bâtiment gratuit 170, meilleur logiciel devis facture bâtiment gratuit 210) | Artisan qui cherche un outil de devis gratuit | 3 | 2 | 1 | 3 | **8** | partielle : devis gratuits, factures payantes | page d'accueil ou page « devis gratuits » | 90 à 210/mois, KD 3 à 21 ; top 10 lu (comparatifs et éditeurs) |
| 21 | logiciel devis artisan (logiciel devis facture artisan 70) | Artisan qui choisit un logiciel | 3 | 3 | 1 | 2 | **8** | oui | page d'accueil | 90/mois, KD 0, coût par clic 29 € ; top 10 lu |
| 22 | exemple devis terrassement, salle de bains, rénovation d'appartement, ravalement | Surtout des particuliers | 2 | 1 | 2 hyp. | 2 | **8** | oui | à garder pour plus tard | 50 à 140/mois |
| 23 | logiciel devis gratuit | Tout indépendant qui veut un outil de devis gratuit | 3 | 2 | 1 hyp. | 3 | **8** | oui (devis) | page d'accueil | 480/mois, KD 33 |
| 24 | modèle devis excel gratuit (devis excel gratuit 70, devis word gratuit 20) | Tout indépendant qui veut un tableur | 2 | 2 | 1 | 3 | **7** | oui | `/modele` (l'Excel existe) | 390/mois, KD 0 ; top 10 lu (pages d'éditeurs) |
| 25 | logiciel devis menuisier (logiciel devis facture menuisier 20) | Menuisier qui cherche un logiciel | 3 | 2 | 1 | 2 | **7** | partielle (pas de configurateur de menuiseries) | `/facturation/menuisier` | 70/mois, KD 0 ; top 10 lu (logiciels spécialisés) |
| 26 | exemple facture plombier (modèle facture plombier 40 ; même schéma pour électricien 90, peintre 90, btp 70) | Artisan qui prépare une facture | 2 | 3 | 1 | 2 | **7** | oui (Essentiel) | plus tard, une section des pages d'exemple | 110/mois, KD 0 ; top 10 lu (pages d'éditeurs) |
| 27 | logiciel devis facture auto entrepreneur | Micro-entrepreneur, tous métiers | 3 | 2 | 1 | 2 | **7** | oui | `/devenir-a-son-compte` | 110/mois, KD 28 ; top 10 lu (comparatifs) |
| 28 | exemple devis menuiserie / serrurier | Menuisier, serrurier | 2 | 3 | 1 | 1 | **6** | oui | surveiller | 50/mois, KD 45 à 46 |

### Écartés (porte d'adéquation, intention ou règle de communication)

| Requête | Volume | Raison |
|---|---|---|
| logiciel facturation auto entrepreneur gratuit | 720 | Les factures ne sont pas gratuites chez Qonforme |
| factures et devis gratuit, logiciel devis facture gratuit | 1 300 chacun | Même raison (et KD 59-60). `/modele` est déjà 3ᵉ sur la première, mais une page qui promettrait des factures gratuites serait fausse |
| logiciel devis facture sans abonnement | 90 | Les factures demandent une formule (sans engagement, mais avec abonnement) |
| logiciel paysagiste | 260 | Les internautes cherchent un logiciel de conception de jardin (3D, IA) |
| logiciel électricien | 110 | Les internautes cherchent un logiciel de schémas électriques (CAO) |
| logiciel peintre | 110 | Intention incertaine (coût par clic de 0,18 €, sans doute un logiciel de dessin) |
| application devis gratuit, appli devis facture | 170 chacun | Applications des stores et comparatifs ; Qonforme n'a pas d'application native |
| facture situation de travaux, logiciel situation de travaux, retenue de garantie facture, facture autoliquidation | 10 à 40 | La formule Artisan n'est pas en vente. **À reprendre dès qu'elle l'est** (la Search Console montre déjà « retenue de garantie » : 64 affichages) |
| signature électronique de devis | — | Affichée « à venir » sur /pricing |
| facture électronique gratuite, logiciel facture électronique artisan | 9 900… | L'émission par une plateforme agréée est « à venir », et les factures ne sont pas gratuites |
| alternative à [concurrent], comparatif de logiciels de devis | — | Interdit de nommer un concurrent dans un contenu public |
| meilleur logiciel… | 20 à 210 | « Meilleur » n'est pas vérifiable, et un classement nommerait des concurrents |
| batiprix, devis IA, chiffrage automatique | 4 400… | Fonctions absentes (pas de bibliothèque de prix, pas d'IA) |

## 4. Top 10 à créer ou à modifier

| Ordre | Action | Requêtes visées | Score | Effort |
|---|---|---|---|---|
| 1 | Retitrer les 11 pages métier « Logiciel de devis et facture pour {métier} » (une ligne dans `lib/pseo/metiers.ts`) | n° 4 à 7, 10, 13 | 12-13 | très faible |
| 2 | Faire indexer et relier `/modele/devis-electricien` (déjà en ligne) | n° 1 | 17 | faible |
| 3 | Créer `/modele/devis-macon` | n° 2 | 15 | moyen |
| 4 | Créer `/modele/devis-paysagiste` | n° 3 | 15 | moyen |
| 5 | Créer `/modele/devis-peintre` | n° 8 | 13 | moyen |
| 6 | Créer `/modele/devis-plombier` | n° 9 | 13 | moyen |
| 7 | « Devis vierge » dans les titres de section et l'introduction de `/modele` | n° 14 | 11 | très faible |
| 8 | Créer `/modele/devis-plaquiste` | n° 11 | 12 (hyp.) | moyen |
| 9 | Créer `/modele/devis-carreleur`, ou renforcer l'exemple de carrelage de `/modele/devis-travaux` | n° 12 | 12 (hyp.) | moyen |
| 10 | Titre de `/outils/generateur-devis-gratuit` sur « devis en ligne gratuit » | n° 15 | 11 | très faible |

Chaque page d'exemple doit avoir sa propre valeur, comme `/modele/devis-electricien` : des lignes réelles du métier (catalogue `lib/catalogue/trades.ts`), ses règles de TVA, ses mentions, ses fichiers Word, Excel et PDF construits à partir du même objet, et des prix annoncés comme fictifs. Jamais une page recopiée en changeant le nom du métier (garde-fou « pages en série »).

## 5. Fiches des trois premières pages

### Page compacte : exemple devis maçon

- **Scénario d'achat** : maçon à son compte ou en petite équipe qui doit chiffrer une dalle, un mur ou une petite maçonnerie de rénovation, et veut un devis complet à recopier sans oublier une mention.
- **Variantes regroupées** : exemple devis maçon, exemple devis maçonnerie, modèle devis maçonnerie, devis type maçonnerie.
- **Offre associée** : le modèle vierge (Word, Excel, PDF) et les devis gratuits et illimités · **Action attendue** : créer un compte gratuit.

Les 5 emplacements :
- Title : « Exemple de devis maçon chiffré (Word, Excel, PDF) »
- Méta description : « Exemple de devis de maçonnerie chiffré : dalle, mur, déchets de chantier, TVA à 10 % ou 20 %, assurance décennale. À télécharger en Word, Excel ou PDF. »
- URL : `/modele/devis-macon`
- H1 : « Exemple de devis de maçon »
- Première phrase : « Voici un exemple de devis de maçonnerie complet, chiffré ligne par ligne, à télécharger en Word, Excel ou PDF et à adapter à votre chantier. »

Contenu :
- Réponse au critère : un devis chiffré (par exemple dalle de terrasse et muret en parpaings, évacuation des déchets), quantités cohérentes avec `/outils/calculateur-beton`, total HT, TVA par taux, TTC et acompte calculés par le code des générateurs, prix annoncés fictifs.
- Règles propres au métier, déjà vérifiées dans le dépôt : décennale et attestation (C. assurances L243-2), déchets de chantier (C. environnement L541-21-2-3), TVA à 10 % en rénovation d'un logement de plus de deux ans et 20 % dans le neuf (`lib/pseo/guides.ts`, guide TVA des travaux).
- Preuves : textes cités, calculs reproductibles, aucun avis ni chiffre de clients.
- Questions fréquentes : devis obligatoire ? payant ? quelle durée de validité ? quel acompte ?

Maillage :
- Liens sortants : `/facturation/macon`, `/outils/calculateur-beton`, `/guide/mentions-obligatoires-devis`, inscription.
- Liens entrants : `/facturation/macon`, `/devenir-a-son-compte/macon`, `/modele`, le guide « Comment faire un devis », l'article de blog « Facturation Maçon : 8 erreurs » (voir § 6).
- Schema : Article + FAQPage. Indexable, dans le plan du site.

### Page compacte : exemple devis paysagiste

- **Scénario d'achat** : paysagiste qui chiffre un aménagement (engazonnement, plantations, dallage, clôture) ou un entretien, souvent pour des particuliers.
- **Variantes regroupées** : exemple devis paysagiste, exemple devis élagage, exemple devis jardinier.
- **Offre associée** : modèle et devis gratuits · **Action attendue** : créer un compte gratuit.

Les 5 emplacements :
- Title : « Exemple de devis paysagiste chiffré (Word, Excel, PDF) »
- Méta description : « Exemple de devis de paysagiste chiffré : aménagement, plantations, entretien, TVA à 20 % des espaces verts, mentions obligatoires. Word, Excel ou PDF. »
- URL : `/modele/devis-paysagiste`
- H1 : « Exemple de devis de paysagiste »
- Première phrase : « Voici un exemple de devis de paysagiste complet, chiffré ligne par ligne, à télécharger et à adapter à votre chantier. »

Contenu :
- L'angle unique, que les pages du top 10 n'expliquent pas : l'aménagement et l'entretien des espaces verts sont exclus des taux réduits (CGI, art. 279-0 bis, 2 bis ; déjà cité dans `lib/catalogue/trades.ts`), donc TVA à 20 %, même chez un particulier.
- **À vérifier sur les sources officielles avant d'écrire** : les règles du crédit d'impôt « services à la personne » (petits travaux de jardinage seulement, sous conditions) et le seuil à partir duquel le devis est obligatoire pour ces services. L'ancienne page « jardinier », supprimée le 15/10, citait 100 € TTC par mois : à revérifier, rien n'est repris tel quel.
- Preuves, questions fréquentes et maillage : comme la page maçon (`/facturation/paysagiste`, `/modele`, guide TVA des travaux).

### Modification : titres des 11 pages métier

- **Scénario d'achat** : artisan qui cherche « logiciel devis {métier} » pour faire ses devis.
- **Preuve** : la Search Console associe déjà ces requêtes à `/facturation/macon`, alors que le titre (« Logiciel de facturation pour Maçon ») ne contient pas le mot que les gens tapent.
- **Changement proposé** (`lib/pseo/metiers.ts:58`) :
  - avant : title « Logiciel de facturation pour Maçon | Qonforme », H1 « Logiciel de facturation pour maçon » ;
  - après : title « Logiciel de devis et facture pour maçon | Qonforme », H1 « Logiciel de devis et facture pour maçon ».
- Adresses inchangées (aucune redirection) ; nom du métier en minuscules dans le titre ; descriptions déjà correctes (« Devis gratuits et illimités »).

## 6. Conséquences pour les articles du blog

Les mots-clés compacts vont sur des pages d'exemple et des pages métier, **pas sur les articles** : le blog reste de l'information (notoriété, liens, haut de l'entonnoir). Avant de modifier les articles, il faut donc d'abord créer les pages compactes, puis rattacher les articles qui leur font concurrence :

| Articles concernés | Concurrence avec | Proposition |
|---|---|---|
| 8 articles « Facture / Facturation électricien » | `/modele/devis-electricien`, `/facturation/electricien` | Garder 1 ou 2 articles d'information (mentions, erreurs) et rediriger les autres (301) vers l'exemple ou l'article gardé |
| « Facturation Maçon : 8 erreurs courantes… » | future `/modele/devis-macon` | Reprendre ce qui est utile dans la page d'exemple, puis rediriger ; ou garder l'article avec un lien bien visible |
| « Facture Peintre Bâtiment : 9 erreurs… » | future `/modele/devis-peintre` | Idem |
| 3 articles « Plombier » (Simplifiez votre quotidien, Comptabilité pour plombiers, 10 outils numériques) | `/facturation/plombier`, future `/modele/devis-plombier` | En regrouper 2 en un seul article d'information, avec des liens vers les pages compactes |
| « Facturation Menuisier : 8 erreurs… » | `/facturation/menuisier` | Garder, ajouter les liens |
| « Logiciel de facturation pour artisan en 2026 : la checklist », « Facturation gratuite vs payante » | page d'accueil | Garder comme articles d'information, liens vers l'accueil et /pricing |

Google ne connaît presque aucun de ces articles (3 sur 61 ont eu une impression en 3 mois). Les redirections sont donc sans risque, mais elles touchent au référencement : chacune sera montrée avant d'être faite.

## 7. Plan de validation

- **Top 10 non lu** (« hyp. ») : exemple devis placo, exemple devis carrelage, exemple devis climatisation, logiciel devis électricien, paysagiste et peintre, logiciel devis gratuit. Environ 3 crédits OpenSEO par requête ; il en reste 44.
- **Volumes** : estimations de Google Ads, souvent sous-estimées pour les requêtes très précises. Confirmation dans la Search Console 4 à 8 semaines après publication.
- **Faits à vérifier avant d'écrire** : règles du crédit d'impôt pour l'entretien de jardin (page paysagiste).
- **À surveiller** : mise en vente de la formule Artisan (les requêtes situations, retenue de garantie et autoliquidation reviennent alors dans la carte) ; activation de la signature en ligne en production.

## 8. Sources

- 200 mots-clés du concurrent (export « domain overview » transmis par le fondateur, 15/10/2026) et ses 100 premiers mots-clés relevés par OpenSEO le 15/10.
- Plan du site public du concurrent (`sitemap_index.xml`, 16/10) : 119 pages et 77 articles.
- Search Console de qonforme.fr, 16 derniers mois (131 requêtes).
- OpenSEO (DataForSEO, France, langue française) : métriques de 230 mots-clés et 20 pages de résultats Google lues sur 10 positions, le 16/10/2026. Crédits utilisés : 123 (167 → 44).
- Offre de Qonforme : `/pricing` en ligne le 16/10/2026 et `lib/stripe/plans.ts`.
