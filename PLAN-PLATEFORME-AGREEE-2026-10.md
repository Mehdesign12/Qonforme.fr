# Plan : raccorder Qonforme à une plateforme agréée

> Établi le **06/10/2026** à partir de 5 recherches (Super PDP, Iopole, les autres plateformes agréées, le cadre réglementaire, le code de Qonforme), chacune revérifiée à la source par deux vérificateurs indépendants, puis 3 plans concurrents notés par un arbitre. Les faits non confirmés sont listés en section 9. Sources en fin de document.
>
> Document interne. Super PDP est un **fournisseur**, pas un concurrent : il sera nommé dans l'application, les CGU et la politique de confidentialité, parce que l'artisan doit savoir à qui il donne son accord. Aucun usage marketing de son nom.

---

## 1. La réponse courte

**Se raccorder à Super PDP par son offre API « marque grise », en commençant par la réception seule, gratuite pour tous les comptes.**

- Super PDP est une plateforme agréée, immatriculée définitivement le 22/12/2025 (liste DGFiP), en production depuis avril 2026, certifiée ISO 27001.
- **Prix publics, sans rendez-vous commercial :** 0,01 € HT par facture, 2 € HT de vérification d'identité par artisan, minimum de 10 € HT par an.
- **Bac à sable gratuit et immédiat**, documentation et OpenAPI publiques.
- **Qonforme n'a aucun mandat à gérer :** l'artisan crée son accès chez Super PDP et autorise Qonforme à y accéder.
- C'est aussi l'un des deux partenaires du concurrent du bâtiment : la voie est éprouvée.

**Pour l'artisan :** un bouton « Activer la réception » dans Qonforme, 5 écrans chez Super PDP (email, SIREN pré-rempli, accord formel, vérification d'identité sur téléphone, autorisation donnée à Qonforme), puis ses factures fournisseurs arrivent seules dans « Factures reçues ».

**Ce qui n'est pas simple :** il n'y a pas encore de webhook chez Super PDP. Qonforme doit aller chercher les factures toutes les 15 minutes (tâche planifiée, comme les emails de démarrage). Et l'interface `lib/pa` doit changer : elle supposait des clés globales et un webhook, alors que Super PDP donne un jeton par artisan.

**Effort estimé :** 50 à 70 h pour la réception (dont 5 à 7 h de sécurité à corriger d'abord), puis 55 à 75 h pour l'émission. **Mise en service visée :** réception pour tous fin novembre ou début décembre 2026 ; émission prête en juillet 2027, avant l'obligation du 1er septembre 2027.

### Pourquoi pas les autres

| Plateforme | Pourquoi pas en premier |
|---|---|
| **Iopole** | Aucun prix publié, frais de mise en route, plan d'entrée à 5 000 factures/mois, inscription des artisans par lien magique et selfie vidéo. Un éditeur du bâtiment y est encore en pilote en France après 3 à 6 mois. Bonne seconde source plus tard. |
| **B2Brouter** | Bac à sable en libre-service et mode « réception seule », mais 99 €/mois après 6 mois de programme startups, plus un prix par utilisateur non publié, et contact commercial pour la production. **Repli** si Super PDP répond mal aux questions écrites. |
| **Pennylane** | Gratuit pour l'éditeur, mais partenariat sur dossier, et Pennylane vend lui-même de la facturation aux micro-entreprises. |
| **Qonto, Invopop, Seqino, Ademico, Storecove** | API propriétaire ou sans webhook, contrat obligatoire, ou coût 5 à 10 fois supérieur (Ademico ≈ 2 400 €/an pour 100 artisans contre ≈ 240 € chez Super PDP). |
| **Un connecteur unique « norme AFNOR XP Z12-013 »** | Séduisant mais théorique aujourd'hui : seuls Super PDP et Pennylane disent l'implémenter, et l'API de Super PDP à cette norme a encore des limites. À garder pour un adaptateur de secours. |

---

## 2. Ce que dit la réglementation (vérifié)

- **Aucune certification « solution compatible ».** La DGFiP a créé un logo gratuit, d'usage libre, qu'un éditeur appose lui-même s'il est raccordé à au moins une plateforme agréée, **pour les seules fonctions qu'il propose**. L'État peut en retirer l'usage. La marque « Plateforme agréée » est interdite à Qonforme.
- **Les obligations pèsent sur l'entreprise et sur la plateforme, pas sur l'éditeur** : vérification d'identité, annuaire, transmission à l'administration, accord formel.
- **Calendrier :** réception pour toutes les entreprises depuis le 01/09/2026 ; émission et e-reporting au 01/09/2027 pour PME, TPE et micro. Le guide pratique (juillet 2026) ne sanctionne pas une entreprise engagée dans une « trajectoire sérieuse de mise en conformité ».
- **Statuts obligatoires du cycle de vie :** 200 Déposée, 210 Refusée, 212 Encaissée, 213 Rejetée. Les autres sont facultatifs.
- **Clients particuliers :** aucune facture électronique, mais un e-reporting à partir du 01/09/2027 (cumuls journaliers), et l'e-reporting de paiement seulement quand la TVA est due à l'encaissement (pas en autoliquidation).
- **Conservation :** 6 ans pour le fisc, 10 ans pour une société commerciale (Code de commerce) : l'archivage de Qonforme doit viser 10 ans.
- **Sanctions** (loi de finances 2026) : 50 € par facture (plafond 15 000 €/an), 500 € par e-reporting manquant, et pour la réception 500 € puis 1 000 € après mise en demeure.

---

## 3. Ce que doit faire le fondateur

Dans l'ordre. Les étapes 1 à 4 se font cette semaine.

0. **Vérifier la société éditrice.** Super PDP exige pour la production un représentant légal et une entreprise vérifiés. Les mentions légales du site citent « Qonforme SAS » sans SIREN : les compléter.
1. **Ouvrir le bac à sable** (15 min) : compte « Développeur⋅euse » sur superpdp.tech, création d'une application OAuth de test. Les clés vont seulement dans l'environnement Preview de Vercel.
2. **Archiver en PDF** la page tarifs, les CG, la politique de données et la liste DGFiP : ces pages changent sans prévenir.
3. **Écrire à Super PDP** avec les questions de la section 8 et demander des réponses écrites. C'est un achat chez un fournisseur, pas du démarchage. **Pas d'ouverture à tous avant ces réponses.**
4. **Consigner trois décisions** dans `DECISIONS-STRATEGIQUES.md` :
   - réception gratuite pour tous les comptes, y compris sans formule ; émission et e-reporting dans Essentiel ;
   - Super PDP nommé dans l'application, les CGU et la confidentialité (fournisseur, pas concurrent) ;
   - aucune mention « conforme », « certifié » ou « solution compatible » avant qu'une vraie facture soit arrivée par la plateforme.
5. **Créer le compte de production** (représentant légal), passer la vérification d'identité sur téléphone et celle de l'entreprise, attendre le statut « verified ».
6. **Créer l'application OAuth de production** : type confidentiel, retour exact `https://qonforme.fr/api/pa/callback`, IBAN et mandat SEPA (c'est l'abonnement payé par Qonforme). Le co-branding (logo et nom Qonforme sur les écrans de Super PDP) est facultatif.
7. **Signer un accord de sous-traitance RGPD** avec Super PDP avant de l'ajouter à la politique de confidentialité. Faire préciser l'hébergement (France sur une page, Union européenne dans les CG).
8. **Variables Vercel** (Production et Preview séparées) : `PA_PROVIDER=superpdp`, `SUPERPDP_CLIENT_ID`, `SUPERPDP_CLIENT_SECRET`, `PA_TOKEN_SECRET` (32 octets, fixé une fois pour toutes : le changer oblige chaque artisan à refaire le parcours).
9. **Supabase** : appliquer `20261003_received_invoices.sql` et les deux nouvelles migrations du plan.
10. **cron-job.org** : une tâche toutes les 15 minutes sur `https://qonforme.fr/api/cron/pa-sync`, avec `Authorization: Bearer <CRON_SECRET>`.
11. **Paiement** : compte toujours approvisionné et alerte sur les prélèvements. Au-delà de 10 jours de retard, Super PDP peut couper l'accès de **tous** les artisans rattachés.
12. **Recette réelle** : faire soi-même le parcours avec le SIREN de la société éditrice, vérifier l'adresse d'annuaire `0225:<SIREN>` et l'arrivée d'une vraie facture fournisseur. Laisser tourner une à deux semaines.
13. **Bêta** : bouton visible dans Paramètres pour les comptes qui le choisissent ; rapprocher la première facture de Super PDP du compteur interne ; ouvrir à tous après les réponses écrites.
14. **Communication**, une fois la réception réellement active : « réception de vos factures fournisseurs par une plateforme agréée ». Le logo « Solution compatible » seulement pour la réception, avec la mention exigée par la charte DGFiP.

---

## 4. Ce que vit l'artisan

1. **Entrée** : une carte « Recevez vos factures fournisseurs ici » sur le tableau de bord, dans « Factures reçues », dans Paramètres › Facturation électronique et sur « Par quoi voulez-vous commencer ? ». Rien d'imposé à l'inscription, pour ne pas freiner le premier devis.
2. **Écran Qonforme « Avant de commencer »** : rappel de la raison sociale et du SIREN, texte factuel (obligation depuis le 1er septembre 2026, Qonforme se raccorde à Super PDP, gratuit dans Qonforme, pièce d'identité et téléphone à prévoir, Qonforme ne voit pas la pièce d'identité). Boutons « Activer la réception » et « Plus tard ».
3. **Chez Super PDP** (marque Super PDP visible) : email et code ; SIREN pré-rempli et choix du représentant légal dans la liste des registres ; case d'accord formel avec inscription immédiate à l'annuaire ; vérification d'identité sur téléphone ; autorisation « Qonforme aura accès à mes factures, pourra envoyer mes factures, et gérer mes lignes d'annuaire ». Retour automatique dans Qonforme.
4. **Retour dans Qonforme, un état clair** : vérification en cours ; vérification manuelle par la plateforme (sans délai promis) ; transfert depuis une ancienne plateforme (jusqu'à 5 jours) ; vérification refusée avec « Recommencer » ; ou **réception active** avec l'adresse `0225:<SIREN>` et l'heure de la dernière relève, plus un email « La réception est active ».
5. **Entreprise absente de l'annuaire** : le parcours de Super PDP s'arrête. Qonforme explique les deux causes officielles et propose un message type, avec le SIREN, à envoyer au service des impôts. L'import manuel reste disponible.
6. **Au quotidien** : les factures arrivent seules, environ 15 minutes au plus après leur dépôt, avec l'original téléchargeable. Un email au plus par jour (« 2 nouvelles factures : … »). Statuts facultatifs avec « Transmis le … » ou « En attente de transmission ».
7. **En 2027, avec Essentiel** : rien de nouveau à signer (à confirmer par Super PDP). Le bouton « Envoyer » ne change pas : client professionnel dans l'annuaire, la facture part par la plateforme ; particulier, email avec le PDF et e-reporting automatique. « Marquer comme payée » demande la date et transmet l'encaissement quand c'est requis.

---

## 5. Ce qui se code

### Phase 1 : réception (50 à 70 h)

| # | Étape | Fichiers | Effort |
|---|---|---|---|
| 0 | **Sécurité d'abord.** (a) Écriture serveur seule sur les factures reçues : retirer les politiques INSERT, UPDATE et DELETE de `received_invoices`, INSERT de `received_invoice_events` et DELETE du bucket (aujourd'hui, un utilisateur peut fabriquer sur son propre compte une facture « venue de la plateforme » ou une fausse trace « Transmis »). (b) Contrôler le SIREN côté serveur dans `app/api/company/route.ts` (aucun contrôle aujourd'hui, alors qu'il sert au rattachement). (c) Ne plus abandonner une facture illisible avec une réponse 200, et tracer un doublon. | nouvelle migration, `app/api/received-invoices/**`, `app/api/company/route.ts`, `lib/reception/ingest.ts` | 5-7 h |
| 1 | Table `pa_connections` sans politique RLS (serveur seul) : artisan, fournisseur, identifiant chez la plateforme, SIREN vérifié, adresse d'annuaire, état, jetons chiffrés, curseurs, bail, dernière relève, dernière erreur. File `pa_status_outbox`. Idempotence des événements. | migration, `lib/supabase/schema-guard.ts` | 3-4 h |
| 2 | Chiffrement générique AES-256-GCM des jetons (`lib/signature/crypto.ts` n'est pas réutilisable tel quel). | `lib/crypto/secret-box.ts` | 1-2 h |
| 3 | **Nouveau contrat `lib/pa`** : chaque méthode reçoit la connexion de l'artisan ; ajout de l'autorisation OAuth, de l'échange de code, du renouvellement de jeton, de l'état de vérification, de la relève des factures et des événements, du téléchargement de l'original, de la révocation. Le webhook devient facultatif. Qonforme ne stocke que les codes DGFiP 200 à 213. | `lib/pa/types.ts`, `lib/pa/adapters/none.ts`, tests | 2-3 h |
| 4 | **Adaptateur Super PDP** : OAuth avec PKCE et SIREN pré-rempli, réception forcée de la ligne d'annuaire, relève paginée des factures et des événements, envoi des statuts, correspondance des codes. | `lib/pa/adapters/superpdp.ts`, `lib/pa/index.ts`, `.env.example` | 8-12 h |
| 5 | Connexions côté serveur : bail par connexion et renouvellement du jeton en une écriture conditionnelle (le jeton change à chaque usage : deux relèves simultanées feraient perdre l'accès). | `lib/pa/connections.ts` | 3-4 h |
| 6 | Routes `connect`, `callback` (vérifier le `state`, refuser un SIREN différent de celui du compte), `disconnect`, `status`. Jamais en cache ni publiques. | `app/api/pa/*` | 4-5 h |
| 7 | **Cron de relève** toutes les 15 min : budget de temps, 10 connexions en parallèle au plus, curseur avancé seulement après écriture, file des statuts vidée, journal dans `cron_logs`. | `app/api/cron/pa-sync/route.ts` | 5-7 h |
| 8 | Ingestion : rattachement par la connexion (plus par le SIREN déclaré), facture illisible gardée « à vérifier », limite de taille relevée pour la plateforme, doublon traité comme succès, statuts idempotents et ordonnés. | `lib/reception/*`, migration du bucket | 4-6 h |
| 9 | Statuts posés par l'artisan mis en file avec nouvel essai automatique. | `app/api/received-invoices/[id]/route.ts`, `components/reception/*` | 2-3 h |
| 10 | Interface : un composant d'activation à états, sur les vues partagées pour que la démo suive ; mentions « En préparation » rendues conditionnelles ; message type pour l'impôt si l'entreprise est absente de l'annuaire. | `components/einvoicing/ActivationCard.tsx`, `EInvoicingView`, `ReformCard`, `SettingsOverview`, `Sidebar`, `PlatformNotice`, `ImportView`, `lib/demo/reception.ts` | 6-8 h |
| 11 | Deux emails : « La réception est active », résumé quotidien des factures reçues (désactivable). | `lib/email/templates/*` | 2-3 h |
| 12 | Textes : CGU (le terme « PDP » est périmé), politique de confidentialité (Super PDP comme sous-traitant), `lib/stripe/plans.ts` (réception passée des fonctions « à venir » aux fonctions gratuites), supervision dans `/admin/health`. | `app/cgu`, `app/confidentialite`, `lib/stripe/plans.ts`, `app/admin/(panel)/health` | 2-4 h |
| 13 | Tests (adaptateur, callback, cron, ingestion) et recette complète dans le bac à sable entre les deux entreprises fictives. | `__tests__/pa-*.test.ts` | 8-10 h |

### Phase 2 : émission (55 à 75 h, sous Essentiel, prête en juillet 2027)

- Figer le Factur-X à l'émission (fichier stocké avec son empreinte, au lieu d'être régénéré depuis des données modifiables).
- File d'envoi vers la plateforme après émission et pour les avoirs, avec validation préalable et identifiant externe pour ne jamais envoyer deux fois. L'envoi ne bloque jamais l'email.
- Adresse du client tirée de l'annuaire ; client absent de l'annuaire ou particulier : e-reporting (mention `BAR=B2C`).
- Statuts des factures émises (200, 201, 210, 213) remontés par la relève ; ajout d'un statut « refusée » dans `lib/utils/document-status.ts` et décision à prendre sur une facture rejetée (avoir interne selon les spécifications DGFiP, ou correction et renvoi selon le guide).
- « Marquer comme payée » qui enregistre la date et transmet l'encaissement (212) quand la TVA est due à l'encaissement.
- Régime de TVA transmis à la plateforme depuis le profil légal.
- Revalider le Factur-X avec les règles françaises de juin 2026 (validé aujourd'hui avec celles de février 2026).

### Phase 3 : seulement si un déclencheur survient

Hausse de prix, panne grave, perte d'immatriculation ou API cassée : adaptateur de secours à la norme AFNOR XP Z12-013 (10 à 15 h). La colonne « fournisseur » permet alors de raccorder les nouveaux comptes ailleurs pendant que les anciens migrent par la portabilité légale.

---

## 6. Coûts

Grille publique de Super PDP (HT) : 0,01 € par facture jusqu'à 10 000 par mois, 0,005 € jusqu'à 100 000, 0,0025 € au-delà ; 2 € par vérification d'identité ; minimum de 10 € par an. Sans engagement, prélèvement mensuel.

Hypothèses (pire cas, à confirmer) : les factures reçues sont facturées comme les émises ; 15 factures reçues par mois et par artisan, plus 20 émises à partir de 2027 ; 2 € de vérification une fois par artisan.

| Artisans raccordés | Réception seule | Réception et émission | Vérifications (une fois) |
|---|---|---|---|
| 50 | 7,50 €/mois | 17,50 €/mois | 100 € |
| 500 | 75 €/mois | 87,50 à 137,50 €/mois | 1 000 € |
| 5 000 | 375 à 425 €/mois | 437,50 à 737,50 €/mois | 10 000 € |

Les fourchettes viennent de ce que la grille ne dit pas : les paliers s'appliquent-ils par tranche ou sur tout le volume ?

**Par artisan :** environ 0,15 € par mois en réception, 0,35 € avec l'émission, soit moins de 3 % d'Essentiel. Le seul poste notable est la vérification à 2 € pour des comptes gratuits qui ne paieront jamais : bouton ouvert seulement avec un SIREN valide, une seule connexion par SIREN.

---

## 7. Calendrier

| Période | Fondateur | Code |
|---|---|---|
| Semaine du 6 octobre | Société vérifiée, bac à sable, CG archivées, questions envoyées, décisions consignées | Sécurité préalable, migrations, chiffrement, nouveau contrat `lib/pa` |
| 13 au 24 octobre | Compte et application OAuth de production, accord RGPD | Adaptateur, routes, cron, ingestion, interface et démo, emails, tests, recette en bac à sable |
| 27 au 31 octobre | Migrations en production, tâche planifiée, raccordement de la société éditrice | Bouton en bêta dans Paramètres |
| Novembre | Bêta volontaire, rapprochement de la première facture Super PDP | Corrections |
| Fin novembre, début décembre | **Ouverture à tous**, si les réponses écrites le permettent | — |
| Janvier à mars 2027 | — | Émission, en bac à sable |
| Avril à juin 2027 | Émission volontaire pour les abonnés Essentiel | — |
| Juillet 2027 | Tout est prêt avant l'obligation du 1er septembre 2027 | — |

---

## 8. Questions à poser par écrit à Super PDP

1. Les factures **reçues** sont-elles facturées au même tarif que les émises ? Et les statuts, et les factures marquées `BAR=B2C` pour l'e-reporting ?
2. Les paliers de prix s'appliquent-ils par tranche ou à tout le volume du mois ?
3. Les 2 € de vérification sont-ils facturés une fois par artisan, ou à chaque tentative, revue manuelle ou changement de représentant ?
4. Minimum de facturation : 10 € par an (page tarifs) ou minimum mensuel (CG, sans montant) ?
5. Pouvons-nous inclure votre service dans notre abonnement et l'offrir gratuitement pour la réception, malgré la clause « Accès » des CG ? Pouvons-nous renoncer à être cité comme client ?
6. **Si notre abonnement s'arrête** (résiliation, impayé) : combien de temps les artisans gardent-ils la réception ? Peuvent-ils passer seuls à votre offre « Compte » gratuite sans nouvelle vérification ni perte de leur ligne d'annuaire ?
7. Un artisan rattaché peut-il se connecter lui-même à son compte Super PDP ? Ses opérations sont-elles facturées sur notre abonnement ? Que devient son compte s'il révoque notre accès ?
8. La limite de 30 appels par seconde et 10 connexions vaut-elle pour toute notre application ou pour chaque artisan ? Quelle fréquence de relève recommandez-vous ?
9. Date, format et signature des futurs webhooks ?
10. Un raccordement fait « en réception seule » permettra-t-il d'émettre en 2027 sans nouveau parcours ?
11. Pouvons-nous consulter l'annuaire avec nos propres identifiants pour vérifier le SIREN d'un artisan avant de le rediriger ?
12. Délais habituels d'une revue manuelle et de l'activation de la ligne d'annuaire ? Que faire pour un micro-entrepreneur en franchise de TVA absent de l'annuaire ?
13. Taille maximale d'une facture reçue, durée d'archivage chez vous, plafond de stockage et prix d'un dépassement ?
14. Durée de gratuité du bac à sable, délai de validation du co-branding ?
15. Fournissez-vous un accord de sous-traitance RGPD ? Hébergement en France ou dans l'Union européenne ? Liste de vos sous-traitants ?
16. Date de la version stable de l'API (aujourd'hui « v1.beta ») et préavis avant un changement cassant ?
17. Factures « fourniture et pose » (biens et services) à des particuliers en e-reporting : date de prise en charge ? Raccordement à Chorus Pro pour le secteur public ?
18. Facture émise rejetée (213) : nouvel envoi sous le même numéro, ou avoir interne puis nouvelle facture ?

---

## 9. Risques et faits non confirmés

### Risques

- **Dépendance contractuelle.** Si l'abonnement de Qonforme est résilié ou impayé plus de 10 jours, les CG prévoient la coupure de l'accès de tous les artisans rattachés, exposés alors à l'amende pour défaut de réception. Parades : compte approvisionné avec alerte, réponse écrite sur la continuité (question 6), export complet toujours disponible.
- **API encore en « v1.beta »**, sans engagement de disponibilité chiffré : surveiller les notes de version.
- **Pas de webhook** : délai d'environ 15 minutes, et un volume d'appels qui croît avec le nombre d'artisans.
- **Jeton renouvelé à chaque usage** : une écriture concurrente mal protégée ou un `PA_TOKEN_SECRET` changé fait perdre l'accès, et l'artisan doit refaire le parcours.
- **Friction de la vérification d'identité** sur téléphone pour un micro-entrepreneur ; parcours bloqué si l'entreprise est absente de l'annuaire. L'import manuel reste visible.
- **Portabilité** : un artisan qui a déjà une plateforme attend jusqu'à 5 jours de transfert ; à présenter comme un transfert, pas comme une panne.
- **Marque grise** : l'artisan voit Super PDP et son offre gratuite. La valeur de Qonforme est l'intégration (boîte de réception, statuts, comptable, émission en 2027), pas l'accès.
- **Phase 2** : Super PDP ne gère pas encore l'e-reporting des factures mixtes biens et services à des particuliers, cas courant de la fourniture et pose ; pas encore de Chorus Pro.
- **Taille du fournisseur** : SAS au capital de 50 000 €. Atténuations : liste DGFiP suivie chaque mois, portabilité légale de l'adresse d'annuaire, réversibilité gratuite de 3 mois prévue aux CG, originaux conservés 10 ans chez Qonforme.

### Faits sur lesquels le plan repose sans confirmation

- Facturation des factures reçues, mode d'application des paliers, unicité des 2 € par artisan, montant réel du minimum.
- Droit d'inclure le service dans l'abonnement Qonforme (déduit de la page tarifs, contredit en apparence par la clause « Accès »).
- Sort des artisans si l'abonnement de Qonforme cesse.
- Création de l'application OAuth de production entièrement en libre-service (vu dans l'interface, pas garanti).
- Émission en 2027 avec le même raccordement, sans nouveau parcours.
- Accès à l'annuaire avec les identifiants de Qonforme, portée des limites d'appels, paramètre exact de téléchargement de l'original.
- Délais de revue manuelle et d'activation de l'annuaire (les « 3 jours ouvrés » du concurrent sont son affirmation).
- Hébergement de Super PDP en France ou seulement dans l'Union européenne.
- Existence et SIREN de la société éditrice « Qonforme SAS ».
- Efforts de développement et volumes par artisan : estimations.
- Conformité du Factur-X de Qonforme aux règles de juin 2026 et acceptation par Super PDP en émission.

---

## Sources (consultées le 06/10/2026)

**Réglementation**
- [Liste des plateformes agréées](https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees) et [fichier de la liste](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/listes_plateformes_agreees/liste_pa_attente_rapport_audit.xlsx).
- [Guide pratique](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf), [FAQ](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/faq_tout_savoir_facturation-electronique.pdf), [calendrier](https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation), [spécifications externes v3.2](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/specification_externes_b2b/specifications-externes-v3.2.zip).
- [Logos « Plateforme agréée » et « Solution compatible »](https://www.impots.gouv.fr/presentation-des-logos-plateforme-agreee-et-solution-compatible), [charte du logo](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fe_charte-utilisation-logotype-solution-compatible.pdf).
- Légifrance : [JORFTEXT000054499535](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054499535), [JORFARTI000053508878](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000053508878) ; [décret 2026-677](https://www.associatheque.fr/fr/fichiers/actualite/decret-2026-677-NOR-CPPE2610307D.pdf), [arrêté du 27/07/2026](https://www.associatheque.fr/fr/fichiers/actualite/arrete-20260707-texte-27-NOR-CPPE2610309A.pdf).
- [Check-list FNFE-MPE, volet B](https://fnfe-mpe.org/wp-content/uploads/2026/07/2026-07-27-RFE-Check-List-Demarrage-Volet-B-VF.pdf) ; [norme AFNOR XP Z12-013](https://www.boutique.afnor.org/fr-fr/norme/xp-z12013/api-pour-interfacer-les-systemes-dinformations-des-entreprises-avec-les-pla/fa301170/601639).

**Super PDP**
- [Tarifs](https://www.superpdp.tech/tarifs), [fonctionnalités](https://www.superpdp.tech/fonctionnalites), [OpenAPI](https://api.superpdp.tech/openapi/superpdp.json), [certificat ISO 27001](https://www.superpdp.tech/certificat-iso-27001.pdf), [exemple d'intégration](https://github.com/superpdp/examples/blob/main/erp.go).
- Documentation : articles [4](https://api.superpdp.tech/internal/articles/4/html), [7](https://api.superpdp.tech/internal/articles/7/html), [8](https://api.superpdp.tech/internal/articles/8/html), [9](https://api.superpdp.tech/internal/articles/9/html), [10](https://api.superpdp.tech/internal/articles/10/html), [14](https://api.superpdp.tech/internal/articles/14/html), [15](https://api.superpdp.tech/internal/articles/15/html), [19](https://api.superpdp.tech/internal/articles/19/html), [20](https://api.superpdp.tech/internal/articles/20/html) ; [CG](https://api.superpdp.tech/internal/articles/11/html) ; [politique de données](https://api.superpdp.tech/internal/articles/16/html).

**Autres plateformes**
- [Iopole, tarifs](https://www.iopole.com/tarifs), [API](https://api.ppd.iopole.fr/v1/api/operator/invoicing), [cas Axiobat](https://www.iopole.com/usecase-einvoicing-Axiobat).
- [B2Brouter, France](https://docs.b2brouter.net/fr/developers/guides-by-country/france/dgfip-e-invoicing-and-e-reporting/), [programme startups](https://www.b2brouter.net/fr/programme-pour-startups/).
- [Pennylane](https://www.pennylane.com/fr/facture-electronique-scpa), [Invopop](https://www.invopop.com/pricing), [Ademico](https://ademico-software.com/peppol/france-e-invoicing/).
- [Vercel, limites des fonctions](https://vercel.com/docs/functions/limitations).

**Code de Qonforme lu** : `lib/pa/types.ts`, `lib/pa/index.ts`, `app/api/pa/webhook/route.ts`, `lib/reception/ingest.ts`, `supabase/migrations/20261003_received_invoices.sql`, `app/api/company/route.ts`, `app/api/received-invoices/[id]/route.ts`, `lib/signature/crypto.ts`, `lib/utils/document-status.ts`, `lib/facturx/xml.ts`, `components/settings/EInvoicingView.tsx`.
