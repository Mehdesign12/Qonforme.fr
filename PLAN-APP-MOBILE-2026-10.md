# Plan — Application mobile native (iOS et Android)

> **Statut : plan à valider. Aucun code écrit.** Orientation décidée par le fondateur le 19/10/2026 (`DECISIONS-STRATEGIQUES.md` § 15) : rouvrir l'app native, iOS et Android, **sans achat dans l'app**. Ce plan dit ce que cela implique, ce qui est vérifié, ce qui ne l'est pas, et les décisions qui restent au fondateur. Rien ne se code avant sa validation.

---

## 1. Ce qui est décidé

- Une app **iOS et Android**, qui charge le site (coquille Capacitor, comme avant le 02/10).
- **Aucun achat dans l'app** : ni prix, ni bouton d'abonnement, ni lien, ni appel à l'action vers un achat hors de l'app. L'abonnement se prend sur le site, par Stripe, comme aujourd'hui.
- Inchangé : Stripe uniquement pour l'abonnement (§ 12 et § 14), la PWA reste disponible, le mur de paiement reste côté serveur à l'émission.

C'est la voie « application gratuite compagnon d'un outil payant en ligne » de l'article 3.1.3(f) des règles d'Apple. C'est aussi ce qui avait fait retirer l'app le 02/10 : le mur de paiement à la première facture ne peut pas s'afficher dans l'app. Le plan traite ce point en premier (§ 2).

## 2. Ce que devient le produit dans l'app

L'app est gratuite et complète pour tout ce qui est gratuit sur le site.

| Compte | Dans l'app |
|---|---|
| **Sans formule** | Devis (création, envoi par email, lien de consultation), clients, catalogue, brouillons de factures, consultation et téléchargement des documents, trésorerie, réception des factures. |
| **Essentiel / Artisan** (abonnement pris sur le site) | Tout ce qui précède, plus l'émission des factures, les relances, la signature en ligne, et pour Artisan les chantiers et situations. Identique au site. |

Quand un geste demande une formule (envoyer une facture, la sortir du brouillon, relancer, faire signer en ligne), **le serveur répond comme aujourd'hui (402)**, mais l'app n'ouvre pas `PaywallDialog` : elle affiche un message sans prix, sans bouton d'achat et sans lien. Le texte exact est une décision du fondateur (D2, § 9).

Conséquence à accepter : un artisan qui s'inscrit dans l'app et veut émettre sa première facture ne peut pas s'abonner dans l'app. Il doit le faire sur le site, et l'app ne le lui dit pas. Le parcours d'abonnement passe par les emails (hors app) et le site. C'est le prix du choix « pas d'achat dans l'app ».

## 3. Règles des magasins : ce qui est vérifié, ce qui ne l'est pas

Vérifié le 19/10/2026 par recherche. Les directives sont un « document vivant » : relire le texte officiel le jour de la soumission.

- **Apple, 3.1.3(f), Free Stand-alone Apps** : une app gratuite, compagnon d'un outil web payant, n'a pas à utiliser l'achat intégré si **aucun achat n'a lieu dans l'app et qu'elle ne contient aucun appel à l'action vers un achat hors de l'app**. Les exemples cités (VoIP, stockage, email, hébergement) ne sont pas confirmés comme exhaustifs par Apple ; un éditeur d'app compagnon (NextDNS) a vu son app retirée sur ce fondement et a fait appel. **Risque réel, pas une formalité.**
- **Apple, Union européenne** : le cadre a changé au 1er octobre 2026 (« Attachment 14 »). Des liens vers un achat sur le site sont possibles dans l'UE, avec une commission sur les achats faits dans les 7 jours après le clic. **Non retenu** (le fondateur a choisi « pas d'achat dans l'app »), mais c'est une piste ultérieure. Les chiffres de commission lus sont de seconde main et se contredisent : ne rien en conclure.
- **Google Play** : comptes « organisation » dispensés du test fermé (12 testeurs, 14 jours) imposé aux comptes personnels récents ; vérification des développeurs Android en cours de déploiement (source unique, à confirmer sur la page de Google). **Le texte de la politique de paiements de Google n'a pas été lu** : le même écran sans achat devrait passer, à confirmer avant de soumettre.
- **De mémoire, à relire dans les directives avant de s'y fier** : Apple 5.1.1(v) impose de pouvoir **supprimer son compte depuis l'app** ; Apple 4.2 rejette les coquilles qui ne font que charger un site ; Apple demande, pour la distribution dans l'UE, le statut de professionnel (trader, règlement sur les services numériques) avec **adresse, téléphone et email** affichés sur la fiche ; Sign in with Apple n'est requis que si l'app propose une connexion par un service tiers (Qonforme n'en propose pas).

## 4. Constat dans le code (19/10/2026)

- **Aucune suppression de compte par l'utilisateur** : `app/api/auth` ne contient que `callback`, `reset-password`, `signup` ; aucune route ne supprime un utilisateur ou son entreprise. Bloquant pour Apple (et pour le droit à l'effacement du RGPD). Voir D3.
- **Surfaces de vente dans l'application connectée** (à masquer en mode « app »), relevées par recherche dans `app`, `components`, `lib` : `PaywallDialog` et `ArtisanNotice` utilisés par `InvoiceDetail`, `NewInvoiceForm`, `NewQuoteForm`, `RemindButton`, `useQuoteBilling`, `useSignaturePanel`, les pages `quotes/[id]`, `quotes/[id]/edit`, `invoices/[id]/edit`, `purchase-orders/[id]`, `chantiers` et `ChantierListView`/`ChantierDetailView` ; textes « Essentiel », « Abonnement », « Passer à… » dans `components/layout/{Header,Sidebar,nav,shell}`, `components/settings/{sections,SettingsOverview,ReminderSettingsForm,OnboardingEmailsCard}`, `components/signature/{SignaturePanel,SignatureSettingsCard}`, `components/reminders/RemindersView` ; pages `settings/billing`, `signup/plan`, `pricing`. Liste à confirmer à l'écran, pas seulement par recherche de texte.
- **Pages publiques** (accueil, tarifs, blog, guides) : ne doivent pas s'ouvrir dans l'app (elles affichent les prix).
- **Traceurs** : le bandeau de cookies, le pixel Meta et PostHog sont chargés sur le site après accord. Dans l'app : aucun traceur et aucun bandeau (voir § 5).
- **Ancien code natif** : présent dans l'historique git (par exemple `f2d5e7f` pour l'émetteur APNs `lib/push/apns.ts`) ; le retrait du 02/10 est consigné dans `CLAUDE.md`. Les leçons de la ligne du 18/08 (domaine à la racine, `appStartPath`) restent valables. La table `push_tokens` existe et n'est plus utilisée.

## 5. Architecture

1. **Coquille Capacitor** (version courante à choisir au démarrage, pas figée ici) : charge `https://qonforme.fr` à la racine du domaine, chemin de démarrage par `appStartPath`, jamais un chemin dans `server.url` (piège du 18/08). Identifiant d'application à décider (D7), par exemple `fr.qonforme.app`.
2. **Reconnaître l'app côté serveur** : jeton ajouté au user-agent par la coquille (`appendUserAgent`), lu par **un seul assistant** (`lib/native/context.ts`) utilisé par le middleware et les composants serveur. Le masquage ne peut pas dépendre du client seul : les composants serveur rendent les prix. À vérifier : les pages publiques sont servies en cache ; la redirection se fait dans le middleware avant le cache, et la réponse ne doit pas dépendre du user-agent pour un navigateur ordinaire.
3. **Liste blanche de routes en mode app** : application connectée seulement. Accueil, tarifs, blog, guides, modèles, outils, glossaire, `settings/billing`, `signup/plan`, `pricing` redirigent vers `/dashboard` (connecté) ou `/login`. Les liens externes s'ouvrent dans le navigateur du téléphone.
4. **Un seul composant de garde** pour toute surface de vente (`WebOnly` côté serveur et client) plutôt que des `if` dispersés ; test automatique qui rend chaque page de l'application avec le jeton d'app et vérifie l'absence de « € », « Essentiel », « Artisan », « abonn », « tarif », `/pricing`, `/settings/billing`.
5. **Aucun traceur dans l'app** : même traitement que `NO_TRACKING_PATHS` (`lib/consent.ts`) pour tout le mode app, sans bandeau. Simplifie aussi les étiquettes de confidentialité des magasins.
6. **Service worker** non enregistré dans la coquille (la coquille ne fait pas de hors-ligne ; le site garde le sien).
7. **Règles existantes inchangées** : pas de `backdrop-filter` ni `will-change` sur mobile, champs à 16 px, zones sûres, garde `mounted` sur `resolvedTheme`.
8. **Inscription et connexion** dans l'app : email et mot de passe (déjà en deux champs). Voir D1 sur l'inscription.

## 6. Fonctions natives (pour la règle 4.2 : une app, pas un site encadré)

Choisies parce qu'elles servent le produit et n'exigent aucun achat : **déverrouillage par Face ID / empreinte** ; **partage natif du PDF** d'un devis ou d'une facture ; **photo du chantier ou du logo** par l'appareil ; **notifications** (virement déclaré, devis signé ou refusé, échéance à venir : contenu neutre, jamais promotionnel) ; **écran de confidentialité** opaque dans le sélecteur d'apps (jamais de `backdrop-filter`). Les notifications demandent un émetteur APNs et un émetteur FCM, une écriture dans `push_tokens` et un réglage par type : c'est le lot le plus lourd (D6).

## 7. Lots, dans l'ordre

| Lot | Contenu | Où ça se fait |
|---|---|---|
| **0. Prérequis** | Comptes Apple Developer et Google Play **au nom de Diez Agency LLC** (statut organisation : numéro D-U-N-S demandé pour Apple, délai de vérification à compter en semaines), adresse du siège de la LLC à renseigner dans `lib/legal/publisher.ts` (aussi exigée par les mentions légales), coordonnées de professionnel affichées sur la fiche, page de support, politique de confidentialité à jour. | Fondateur |
| **1. Mode « app » côté web** | Jeton, assistant, liste blanche, masquage de toutes les surfaces de vente, aucun traceur, test automatique du § 5.4. | Cette session (testable dans un navigateur avec le jeton) |
| **2. Suppression de compte** | Route et écran dans Paramètres, confirmation, sort des documents émis selon D3, email de confirmation. Utile aussi sur le site (RGPD). | Cette session |
| **3. Coquille Capacitor** | Config, plateformes iOS et Android, icônes et écrans de démarrage, `cap sync`. | Cette session jusqu'à `cap sync` ; **compilation iOS sur un Mac** (ou une machine macOS d'intégration continue), Android avec Android Studio |
| **4. Fonctions natives** | Selon § 6 et D6. | Mêmes limites |
| **5. Dossier de soumission** | Captures, descriptions, étiquettes de confidentialité, **compte de démonstration pour le relecteur** (voir risques), notes expliquant 3.1.3(f). | Fondateur, brouillons par la session |
| **6. Test puis soumission** | TestFlight et test interne Android, puis soumission. | Fondateur |

Ce conteneur Linux ne peut ni compiler pour iOS ni publier sur les magasins.

## 8. Risques

1. **Rejet Apple au titre de 3.1.3(f) ou 4.2** : l'interprétation de « appel à l'action » est celle du relecteur. Prévoir une réponse écrite et un second tour. Le plan n'a aucun moyen de l'écarter d'avance.
2. **Le relecteur doit pouvoir essayer l'émission** : il lui faut un compte avec formule, sans voir de prix. Le compte d'essai Stripe (bac à sable) existe pour cela ; **à vérifier que l'abonnement d'essai ouvre l'émission en production** pour ce compte.
3. **Un artisan inscrit dans l'app reste bloqué à la première facture** s'il ne sait pas qu'il doit s'abonner sur le site (D1, D2).
4. **Deux circuits de distribution** à maintenir (site, PWA, magasins) ; une mise à jour du site vaut mise à jour de l'app, sauf pour la partie native.
5. **Les coordonnées de professionnel** exigées sur la fiche (UE) sont en tension avec « aucune promesse de contact humain » : une adresse et un email suffisent à l'obligation légale, un téléphone est à trancher (D4).
6. **Délais hors du code** : comptes organisation, vérification, première revue (plusieurs jours à plusieurs semaines, non mesurés ici).

## 9. Décisions en attente

- **D1. Inscription dans l'app ?** Recommandé : oui (les devis gratuits sont l'entrée du produit), la conversion passant par la séquence d'emails déjà en place (« ce que change Essentiel »). À vérifier : que l'email hors app est bien admis par Apple ; sinon, connexion seule.
- **D2. Message à l'émission sans formule.** Neutre (« Cette action n'est pas disponible avec votre compte. ») ou qui renvoie au compte en ligne (« Gérez votre compte sur qonforme.fr. »). Le second aide l'artisan mais est le plus exposé à un rejet.
- **D3. Suppression de compte et documents émis.** Les factures émises ne se suppriment pas (numérotation continue, conservation légale, règle « documents émis »). Option recommandée à valider avec l'expert-comptable : l'utilisateur supprime son compte, ses données personnelles sont effacées ou anonymisées, les écritures comptables obligatoires sont conservées sous forme anonymisée pendant la durée légale, et l'écran le dit.
- **D4. Coordonnées affichées sur la fiche** (adresse, email, téléphone).
- **D5. Qui possède et paie les comptes développeur** (au nom de la LLC ; frais à vérifier chez Apple et Google).
- **D6. Notifications dès la première version, ou plus tard.** Recommandé : plus tard ; les fonctions du reste du § 6 suffisent pour 4.2 si elles sont réelles.
- **D7. Nom de l'app et identifiant** (`fr.qonforme.app` proposé).

## 10. Hors périmètre

Achat intégré (StoreKit, Play Billing) ; lien vers le site pour acheter, même autorisé dans l'UE ; Stripe Connect ; hors-ligne de l'application connectée (interdit par la règle du service worker) ; réactivation de l'invite « Installer Qonforme » du site (désactivée le 19/10, `lib/pwa/config.ts`).

---

**Sources consultées le 19/10/2026** : directives App Store (3.1.3(f)) via [Apple, App Review Guidelines](https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-English-UK.pdf) et [forum développeurs Apple, 3.1.3(f)](https://developer.apple.com/forums/thread/781935) ; cadre UE via [Apple Developer, paiements dans l'UE](https://developer.apple.com/support/communication-and-promotion-of-offers-on-the-app-store-in-the-eu/) (chiffres de commission de seconde main, non retenus) ; Google Play via des blogs de développeurs, non via la documentation de Google : à confirmer.
