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
2. **Xcode 16+** depuis le Mac App Store ;
3. **CocoaPods** : `sudo gem install cocoapods` ;
4. Un compte **Apple Developer** (99 €/an) pour publier — un compte gratuit
   suffit pour tester sur son propre iPhone.

### Première génération du projet iOS

Le dossier `ios/` n'est pas dans le dépôt : il se génère.

```bash
npm install
npm run ios:add     # crée ios/ — une seule fois
npm run ios:sync    # copie la config + installe les pods
npm run ios:open    # ouvre Xcode
```

Dans Xcode : sélectionner la cible **App**, onglet *Signing & Capabilities*,
choisir ton équipe de développement. Puis ▶ pour lancer sur simulateur ou iPhone.

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

**`openExternalUrl()` est obligatoire pour Stripe Checkout.** Laisser un tunnel
de paiement s'exécuter dans la WKWebView pose trois problèmes : Apple le refuse
(règle 3.1), les cookies de Safari ne sont pas partagés donc la carte doit être
ressaisie, et l'utilisateur se retrouve bloqué sur la page Stripe sans retour.

---

## 5. Notifications push — état d'avancement

**Fait :** demande d'autorisation, récupération du jeton APNs, envoi à
`/api/native/push-token`, table `push_tokens` avec RLS, révocation à la
déconnexion, ouverture de la bonne page au tap sur une notification.

**Reste à faire pour envoyer réellement une notification :**

1. Appliquer la migration `supabase/migrations/20260818_create_push_tokens.sql` ;
2. Créer une **clé APNs** (.p8) dans le portail Apple Developer ;
3. Activer *Push Notifications* dans les capacités Xcode ;
4. Écrire l'émetteur côté serveur — le plus simple est de brancher l'envoi APNs
   dans le cron existant `app/api/cron/send-reminders/route.ts`, qui sait déjà
   quelles factures sont en retard. Récupérer les jetons via le client
   `service_role` (il contourne la RLS), et supprimer ceux qu'APNs signale invalides.

Le payload doit contenir `{ "path": "/invoices/<id>" }` : `NativeAppInit` ouvre
ce chemin au tap, et rejette toute valeur qui n'est pas un chemin interne.

---

## 6. Soumission à l'App Store — les deux risques réels

### Règle 4.2 « Minimum Functionality »

Apple refuse les apps qui ne sont qu'un site web emballé. C'est **le** risque
principal de cette approche.

Ce qui plaide en notre faveur, à mettre en avant dans les notes de review :

- notifications push de relance de factures impayées (impossible en web sur iOS) ;
- feuille de partage native pour envoyer un PDF de facture ;
- appareil photo pour capturer un logo ou un justificatif ;
- retour haptique et écrans de démarrage natifs ;
- fonctionnement hors-ligne.

**Ne pas soumettre avant que les push fonctionnent réellement** (section 5) :
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

## 7. Pièges connus

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

**Le `theme-color` doit rester la couleur de fond de l'app**, pas le bleu de
marque : en plein écran, iOS peint la barre d'état avec cette couleur, juste
au-dessus d'un header clair. `components/pwa/ThemeColorSync.tsx` la bascule
automatiquement en sombre quand l'utilisateur change de thème.
