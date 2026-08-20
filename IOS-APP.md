# Qonforme sur iPhone — PWA et application App Store

Ce document couvre les deux façons dont Qonforme s'installe sur un iPhone, et
comment compiler l'app native.

> **La web app n'est pas remplacée.** Les deux chemins servent exactement le même
> code Next.js, depuis le même serveur. Un déploiement Vercel met à jour le site,
> la PWA et l'app native en même temps. Il n'y a pas de second codebase.

---

## 1. Les deux chemins, en résumé

|  | PWA (« Sur l'écran d'accueil ») | App native (App Store) |
|---|---|---|
| **Disponible** | Immédiatement, en production | Après compilation + validation Apple |
| **Coût** | 0 € | 99 €/an (Apple Developer Program) |
| **Matériel requis** | Aucun | Un Mac avec Xcode |
| **Installation** | Safari → Partager → Sur l'écran d'accueil | App Store |
| **Notifications push** | Non fiables sur iOS | Oui (APNs) |
| **Appareil photo, partage natif, haptique** | Limités | Oui |
| **Visible dans l'App Store** | Non | Oui |
| **Délai de mise à jour** | Instantané (déploiement Vercel) | Instantané aussi — le contenu vient du serveur |

Les deux partagent la même base : la PWA est déjà active, l'app native est une
coquille qui l'enveloppe.

---

## 2. La PWA — déjà en place

Rien à faire, c'est actif dès le prochain déploiement.

**Ce qui a été mis en place**

- `public/manifest.json` — nom, icônes, mode plein écran, raccourcis (nouvelle
  facture / nouveau devis / clients accessibles par appui long sur l'icône) ;
- `public/sw.js` — service worker : cache des assets, page hors-ligne ;
- `public/splash/` — 40 écrans de démarrage, un par modèle d'iPhone/iPad et par
  orientation (sans eux, iOS lance l'app sur un écran blanc) ;
- `components/pwa/InstallPrompt.tsx` — invite à l'installation, refusable 30 jours ;
- `public/offline.html` — écran affiché en cas de coupure réseau.

**Régénérer les images** après un changement de logo :

```bash
npm run pwa:assets
```

Le script lit `public/web-app-manifest-512x512.png` et régénère splash screens,
icônes maskable et `lib/pwa/apple-splash-screens.ts`.

### Ce que le service worker met en cache — et ce qu'il ne met jamais

C'est le point sensible : le Cache Storage est **partagé par toutes les sessions**
d'un même navigateur. Mettre en cache le HTML d'une page authentifiée exposerait
les factures d'un utilisateur à la personne suivante sur le même appareil.

| Mis en cache | Jamais mis en cache |
|---|---|
| `/_next/static/*`, polices, icônes, splash | `/api/*` — sans exception |
| Pages 100 % publiques (`/blog`, `/pricing`, `/outils`, `/guide`…) | `/dashboard`, `/invoices`, `/clients`, `/settings`… |
| Images optimisées | `/`, `/login`, `/signup` — leur réponse dépend de l'état de connexion |

La liste des préfixes cachables dans `public/sw.js` doit rester alignée sur
`purePublicPaths` dans `lib/supabase/middleware.ts`. **Si tu ajoutes une route
publique au middleware, ajoute-la aussi au service worker** — sinon elle ne sera
simplement pas disponible hors ligne (pas de risque de sécurité, juste une perte
de fonctionnalité).

À la déconnexion, `purgePwaPageCache()` vide le cache de pages par sécurité.

---

## 3. L'app native — compilation

### Prérequis

1. Un **Mac** (Xcode ne tourne que sur macOS) ;
2. **Xcode 16+** depuis le Mac App Store, ouvert une première fois pour qu'il
   installe ses composants ;
3. Un compte **Apple Developer** (99 €/an) pour publier — un compte Apple
   gratuit suffit pour tester sur son propre iPhone.

**CocoaPods n'est pas nécessaire.** Capacitor 8 génère un projet basé sur
Swift Package Manager : il n'y a ni `Podfile` ni `pod install`, Xcode résout
les dépendances lui-même à l'ouverture.

### Lancer le projet iOS

Le dossier `ios/` **est versionné** — il porte la configuration Xcode, l'icône
et les écrans de démarrage. Rien à générer :

```bash
npm install
npm run ios:sync    # aligne config, plugins et assets web
npm run ios:open    # ouvre Xcode
```

Dans Xcode : sélectionner la cible **App**, onglet *Signing & Capabilities*,
choisir ton équipe de développement. Puis ▶ pour lancer sur simulateur ou iPhone.

### Régénérer depuis zéro

Seulement si le projet Xcode est corrompu ou après une montée de version majeure
de Capacitor :

```bash
rm -rf ios
npm run ios:add       # recrée ios/
npm run ios:assets    # réinjecte l'icône et les écrans de démarrage
npm run ios:sync
```

### Changer le logo

`assets/icon.png`, `assets/splash.png` et `assets/splash-dark.png` sont générés
par `npm run pwa:assets` à partir du logo source. Pour les répercuter dans
Xcode :

```bash
npm run pwa:assets    # régénère les sources + tous les assets PWA
npm run ios:assets    # les décline dans le catalogue Xcode
```

### Premier lancement : viser la production

Par défaut l'app charge `https://qonforme.fr`. **C'est le chemin à privilégier
pour le premier essai** : rien à configurer, et HTTPS évite le blocage ATS
décrit ci-dessous. La coquille native et ses plugins fonctionnent que le site
déployé embarque ou non les nouveautés PWA.

### Développement contre un serveur local

```bash
npm run dev                                                  # terminal 1
CAPACITOR_SERVER_URL=http://localhost:3000 npm run ios:sync  # terminal 2
```

Sur **simulateur**, `localhost` fonctionne : il partage le réseau du Mac.
Sur **iPhone physique**, `localhost` désigne le téléphone lui-même — il faut
l'IP du Mac sur le réseau local (`ipconfig getifaddr en0`).

#### Le piège ATS

iOS bloque le HTTP en clair par défaut (App Transport Security). Deux points
vérifiés qu'il faut connaître :

- l'option `server.cleartext` de `capacitor.config.ts` **n'agit que sur
  Android** — elle écrit `usesCleartextTraffic` dans le manifest Android et ne
  touche pas iOS ;
- le template `Info.plist` livré par `@capacitor/ios` ne contient **aucune**
  exception ATS.

Pour un serveur local en `http://`, ajouter à `ios/App/App/Info.plist` :

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

`NSAllowsLocalNetworking` n'ouvre que le réseau local et laisse ATS actif pour
le reste d'Internet. **À retirer avant toute soumission à l'App Store** — Apple
demande une justification pour toute exception ATS.

Alternative sans rien modifier : exposer le serveur de dev en HTTPS via un
tunnel (`cloudflared tunnel --url http://localhost:3000`) et pointer
`CAPACITOR_SERVER_URL` sur l'URL HTTPS obtenue.

### Après chaque changement de configuration

```bash
npm run ios:sync
```

Nécessaire seulement quand `capacitor.config.ts` change ou qu'un plugin est
ajouté. Le code de l'app, lui, vient du serveur : **aucune recompilation n'est
nécessaire pour livrer une nouvelle fonctionnalité.**

---

## 4. Capacités natives disponibles dans le code

Tous ces helpers fonctionnent aussi sur le web, avec un repli propre. On peut
donc les appeler sans condition depuis n'importe quel composant.

| Helper | Sur l'app iOS | Sur le web |
|---|---|---|
| `hapticImpact()` / `hapticNotify()` — `lib/native/feedback.ts` | Taptic Engine | Sans effet |
| `shareContent()` — `lib/native/share.ts` | Feuille de partage iOS | Web Share API, sinon copie du lien |
| `openExternalUrl()` — `lib/native/browser.ts` | SFSafariViewController | `window.open` |
| `initPushNotifications()` — `lib/native/push.ts` | APNs | Sans effet |
| `capturePhoto()` — `lib/native/camera.ts` | Choix caméra/photothèque natif | `null` (voir note) |

**`openExternalUrl()` est obligatoire pour Stripe Checkout.** Laisser un tunnel
de paiement s'exécuter dans la WKWebView pose trois problèmes : Apple le refuse
(règle 3.1), les cookies de Safari ne sont pas partagés donc la carte doit être
ressaisie, et l'utilisateur se retrouve bloqué sur la page Stripe sans retour.

**`capturePhoto()` suit un pattern différent des trois autres** : au lieu d'un
repli web fonctionnel, elle retourne `null` sur le web et c'est au composant
appelant de masquer le bouton (`isNativeApp() && <Button.../>`) plutôt que de
l'appeler à l'aveugle. Pas de repli "propre" à écrire ici : le `<input
type="file" accept="image/*">` déjà présent couvre déjà ce cas sur mobile web
(il ouvre nativement l'appareil photo dans la plupart des navigateurs), donc
dupliquer le bouton n'aurait ajouté aucune valeur, juste de la confusion.
Utilisée dans `components/settings/InvoiceSettingsForm.tsx` (photo du logo
entreprise) — nécessite `NSCameraUsageDescription` et
`NSPhotoLibraryUsageDescription` dans `Info.plist` (déjà ajoutées).

**`components/native/PrivacyScreen.tsx`** — pas un helper `lib/native/`, un
composant autonome monté à côté de `NativeAppInit` dans `app/layout.tsx`.
Cache le contenu de l'app (montants de factures, IBAN…) dans l'aperçu du
sélecteur d'apps iOS dès que l'app quitte le premier plan
(`App.addListener('appStateChange', …)`), avec un fond opaque plutôt qu'un
flou (`backdrop-filter` interdit sur mobile, règle CLAUDE.md). Sans lui,
n'importe qui avec un accès physique momentané au téléphone verrait ces
données sans déverrouiller l'app.

---

## 5. Premier lancement — onboarding et amorçage push

Deux écrans plein écran, natifs uniquement, chacun montré **une seule fois
par appareil** (`@capacitor/preferences`, jamais reproposés après un skip) :

| Écran | Cible | Déclenché | Composant |
|---|---|---|---|
| Carrousel de découverte (3 écrans) | Quelqu'un qui installe l'app depuis le Store, avant toute connexion | Au montage de `NativeAppInit`, inconditionnel | `AppOnboardingCarousel.tsx` |
| Amorçage notifications (1 écran) | Client déjà connecté | Après connexion, si le statut d'autorisation push est encore `prompt` | `PushPrimingScreen.tsx` |

Le second attend explicitement que le premier soit passé : `NativeAppInit`
retient un état `onboardingDone`, et l'effet d'amorçage push ne s'exécute
qu'une fois celui-ci à `true` — sinon un client existant qui installe l'app
pour la première fois (session déjà valide, restaurée dès le montage)
pourrait voir la popup push se déclencher **par-dessus** le carrousel de
découverte.

Les deux CTA de conversion du dernier écran (« Créer un compte gratuitement »
/ « J'ai déjà un compte ») gardent le carrousel monté le temps que la
navigation vers `/signup` ou `/login` aboutisse réellement (comparaison sur
`usePathname()`, avec un filet de sécurité de 1,5 s) — sinon la page déjà
chargée en dessous (`/login`, servie par le middleware) flashe une fraction
de seconde avant que la bonne page ne prenne sa place.

Un client existant qui installe l'app pour la première fois sur un nouvel
appareil verra quand même le carrousel : rien ne le distingue côté client
d'une personne qui découvre Qonforme, et le contenu reste pertinent pour lui
(« J'ai déjà un compte » est justement son chemin).

---

## 6. Notifications push — état d'avancement

**Fait, côté code :** demande d'autorisation, récupération du jeton APNs,
envoi à `/api/native/push-token`, table `push_tokens` avec RLS (migration déjà
appliquée), révocation à la déconnexion, ouverture de la bonne page au tap sur
une notification — **et maintenant l'émetteur côté serveur**
(`lib/push/apns.ts`), branché dans le cron `app/api/cron/send-reminders/route.ts` :
chaque relance J+30/J+45 envoie désormais une notification push en plus de
l'email, avec le même contenu (montant, numéro de facture, client).

Aucune dépendance ajoutée : `node:http2` (APNs n'accepte que du HTTP/2) et
`node:crypto` (signature JWT ES256 avec la clé .p8) suffisent. La connexion
HTTP/2 est ouverte une seule fois par run de cron et réutilisée pour tous les
envois — Apple traite une reconnexion par notification comme un usage abusif.
Testé : `__tests__/apns-jwt.test.ts` vérifie que la signature produite est
authentifiable avec la clé publique correspondante.

Chaque notification porte aussi `aps.badge` (nombre de factures au statut
`overdue` de l'utilisateur) — iOS met à jour le badge sur l'icône de l'app
sans rien de plus côté client, c'est natif dès qu'un push distant l'inclut.
**Limite connue :** rien ne le remet à jour/zéro quand l'utilisateur ouvre
l'app et traite ses factures — iOS ne le fait pas tout seul pour un badge
posé par un push distant. Nécessiterait un plugin tiers
(`@capawesome/capacitor-badge`, pas de solution officielle Capacitor) non
ajouté pour l'instant : ça veut dire un nouveau `npx cap sync` + rebuild à
tester sur appareil, pour un gain secondaire par rapport au reste de cette
section. À ajouter si ça devient gênant en usage réel.

**Tant que la config ci-dessous n'est pas en place, le cron continue de
fonctionner normalement par email** — `openApnsClient()` retourne `null` et
logue un avertissement une fois, sans jamais bloquer les relances existantes.

**Reste à faire — 3 actions de ton côté, aucune ligne de code :**

1. **Créer une clé APNs (.p8)** dans le portail Apple Developer :
   *Certificates, Identifiers & Profiles* → *Keys* → bouton **+** → cocher
   *Apple Push Notifications service (APNs)* → *Continue* → *Register* →
   **Download** (le fichier .p8 ne se télécharge qu'**une seule fois** —
   à conserver précieusement). Noter aussi le **Key ID** affiché à l'écran
   (10 caractères) et le **Team ID** du compte (en haut à droite du portail,
   ou *Membership* → *Team ID*).

2. **Activer la capacité *Push Notifications* dans Xcode** : projet *App* →
   onglet *Signing & Capabilities* → *+ Capability* → *Push Notifications*.
   Indispensable même si l'envoi se fait depuis le serveur : sans cette
   capacité, iOS ne délivre aucun jeton APNs à l'app, et `push_tokens` reste
   vide quoi qu'il arrive. Après l'avoir ajoutée, relancer l'app une fois
   depuis Xcode et vérifier qu'une ligne apparaît dans `push_tokens` (table
   Supabase) — c'est le signe que l'enregistrement fonctionne bout en bout.

3. **Ajouter 3 variables d'environnement sur Vercel** (*Project Settings* →
   *Environment Variables*) :
   - `APNS_KEY_ID` — le Key ID de l'étape 1
   - `APNS_TEAM_ID` — le Team ID de l'étape 1
   - `APNS_PRIVATE_KEY` — le contenu du fichier .p8 (ouvrir avec un éditeur de
     texte, copier-coller tel quel, lignes `-----BEGIN PRIVATE KEY-----` /
     `-----END PRIVATE KEY-----` comprises)

   Inutile de définir `APNS_ENVIRONMENT` : `lib/push/apns.ts` détecte tout
   seul si un jeton vient d'un build Xcode Debug (sandbox) ou App
   Store/TestFlight (production), et retente automatiquement sur l'autre
   serveur en cas de refus.

Le payload envoyé contient `{ "path": "/invoices/<id>" }` : `NativeAppInit`
ouvre ce chemin au tap, et rejette toute valeur qui n'est pas un chemin interne.

**Pour tester sans attendre J+30 :** modifier temporairement en base la
`due_date` d'une facture au statut `sent`/`overdue` à plus de 30 jours dans le
passé, puis appeler `GET /api/cron/send-reminders` avec le header
`Authorization: Bearer <CRON_SECRET>` (Postman, curl, ou une extension
navigateur permettant d'ajouter un header). Vérifier la notification sur
l'iPhone **et** la ligne `results` retournée par la route (`push_sent`
compte les envois réussis séparément des emails).

---

## 7. Soumission à l'App Store — les deux risques réels

### Règle 4.2 « Minimum Functionality »

Apple refuse les apps qui ne sont qu'un site web emballé. C'est **le** risque
principal de cette approche.

Ce qui plaide en notre faveur, à mettre en avant dans les notes de review :

- notifications push de relance de factures impayées, badge sur l'icône (impossible en web sur iOS) ;
- feuille de partage native pour envoyer un PDF de facture ;
- appareil photo pour photographier le logo de l'entreprise ;
- écran de confidentialité : les données financières sont masquées dans le sélecteur d'apps iOS ;
- retour haptique et écrans de démarrage natifs ;
- fonctionnement hors-ligne.

⚠️ Ne jamais lister ici une capacité qui n'est pas réellement branchée à une
fonctionnalité utilisable — un reviewer Apple qui ne retrouve pas ce qui est
annoncé dans les notes de review est le pire scénario, pire que ne rien dire
du tout. Cette liste doit rester synchronisée avec le tableau de la section 4.

**Ne pas soumettre avant que les push fonctionnent réellement** (section 6) :
c'est l'argument le plus solide du dossier.

### Règle 3.1 — paiements

Qonforme est un logiciel de facturation vendu à des professionnels. La règle
**3.1.3(e) « Enterprise Services »** autorise le paiement hors achat intégré pour
les services vendus à des entreprises plutôt qu'à des particuliers.

Ce point mérite d'être vérifié auprès d'Apple avant soumission : une lecture
défavorable imposerait l'achat intégré et 15 à 30 % de commission. Deux
précautions qui réduisent nettement le risque :

- l'abonnement se souscrit **en dehors de l'app**, jamais dans un écran natif ;
- ne pas afficher de tarif ni de bouton d'abonnement dans l'app ; l'orienter vers
  la gestion des factures, pas vers la vente.

### Checklist avant soumission

- [ ] Migration `push_tokens` appliquée en production
- [ ] Notifications push testées de bout en bout sur un iPhone réel
- [ ] Stripe Checkout s'ouvre bien via `openExternalUrl()`, jamais dans la webview
- [ ] Connexion, création de facture, envoi par email testés sur appareil physique
- [ ] Politique de confidentialité renseignée (`/confidentialite` existe déjà)
- [ ] Compte de démonstration fourni aux relecteurs Apple
- [ ] Captures d'écran pour chaque taille d'iPhone requise
- [ ] Notes de review listant explicitement les fonctions natives

---

## 8. Pièges connus

**Ne jamais ajouter `backdrop-filter` ni `will-change: transform` sur mobile.**
Voir la règle en tête de `CLAUDE.md` : cela provoque un crash GPU en boucle sur
iOS Safari lors du changement de thème. La WKWebView de l'app native utilise le
même moteur — le crash s'y reproduirait à l'identique.

**Ne pas passer `statusBarStyle` à `black-translucent`.** Le contenu passerait
sous la barre d'état et il faudrait gérer `env(safe-area-inset-top)` dans
chacun des ~20 layouts. Un seul oubli masquerait l'heure.

**Ne pas activer `limitsNavigationsToAppBoundDomains`.** Cela restreindrait la
navigation aux domaines déclarés dans `WKAppBoundDomains` et casserait les
redirections Stripe et Supabase Auth.

**Ne jamais mettre de chemin dans `server.url` lui-même** (`.../dashboard`,
`.../login`…). Piège réel, reproduit en test sur simulateur : l'app entière
s'ouvrait dans Safari au lieu de rester dans la coquille, dès la première
redirection du middleware.

Capacitor réutilise `server.url`, chaîne pour chaîne, comme préfixe pour
décider si une navigation reste « dans l'app » — `WebViewDelegationHandler.swift` :
```swift
let isApplicationNavigation = navURL.absoluteString.starts(with: bridge.config.serverURL.absoluteString)
if !isApplicationNavigation, toplevelNavigation {
    UIApplication.shared.open(navURL, ...)   // éjecte vers Safari
    decisionHandler(.cancel)
}
```
Avec `server.url = ".../dashboard"`, la redirection du middleware vers
`/login` (chemin différent) échoue ce préfixe, et Safari s'ouvre à la place
de la WKWebView.

`server.url` doit toujours être la **racine du domaine** — le préfixe matche
alors n'importe quel chemin. Pour un point d'entrée différent de `/`, utiliser
`server.appStartPath` (un champ Capacitor séparé, qui ne participe jamais à
cette comparaison) : c'est ce que fait `capacitor.config.ts` pour ouvrir sur
`/dashboard` plutôt que la landing marketing, sans casser les redirections
internes du middleware (connecté → tableau de bord, non connecté → `/login`).

Une query string dans `CAPACITOR_SERVER_URL` (`?source=...`) est acceptée
mais silencieusement ignorée : `appStartPath` ne prend que le chemin, jamais
la requête (`URL.appendingPathComponent` d'iOS encoderait le `?` littéralement
et casserait la route).

**Le `theme-color` doit rester la couleur de fond de l'app**, pas le bleu de
marque : en plein écran, iOS peint la barre d'état avec cette couleur, juste
au-dessus d'un header clair. `components/pwa/ThemeColorSync.tsx` la bascule
automatiquement en sombre quand l'utilisateur change de thème.
