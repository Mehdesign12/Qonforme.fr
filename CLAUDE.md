# CLAUDE.md — Règles et pièges connus pour Qonforme

Ce fichier est lu automatiquement par Claude Code à chaque session.
Il documente les décisions architecturales critiques et les bugs résolus à ne jamais réintroduire.

---

## 🚨 RÈGLE ABSOLUE — Backdrop-filter sur mobile iOS Safari

### Le bug
`backdrop-filter: blur()` combiné avec `will-change: transform` provoque un
**crash GPU en boucle infinie sur iOS Safari** lors du changement de thème (dark/light).
Le crash n'est pas limité au header : **n'importe quel élément avec `backdrop-filter`
visible à l'écran au moment du changement de thème peut déclencher le crash**.

Mécanisme :
1. Le changement de thème force le GPU à re-capturer et re-flouter le fond derrière chaque élément
2. Les couches GPU séparées (`will-change`) saturent la mémoire mobile
3. Safari tue le process web → rechargement de la page
4. Le script inline de `next-themes` réapplique `class="dark"` → même crash → boucle

### La règle (mise à jour après deuxième occurrence du bug)

**NE JAMAIS utiliser `backdrop-filter: blur()` ou `will-change: transform` sur mobile,
peu importe le composant (header, card, modal, overlay, barre de recherche, etc.).**

#### Filet de sécurité CSS global (dans `globals.css`)
Une règle `@media (max-width: 767px)` désactive tout `backdrop-filter` et tout
`will-change: transform` sur mobile, quelle que soit la source. **Ne jamais supprimer
cette règle.**

#### Pattern pour chaque composant
```tsx
// ✅ Correct — modal overlay
<div className="fixed inset-0 bg-black/50 md:backdrop-blur-sm" />

// ✅ Correct — card avec fond solide (--card-glass-bg est opaque !)
const cardStyle = {
  background: 'var(--card-glass-bg)',   // solide → backdrop-filter inutile
  boxShadow:  'var(--card-glass-shadow)',
  // ❌ NE PAS AJOUTER : backdropFilter: 'blur(12px)' — inutile ET crashe iOS
}

// ✅ Correct — header pill
// Utiliser la classe .header-pill-glass (CSS gère mobile/desktop)

// ❌ Incorrect — backdrop-filter sans restriction mobile
const cardStyle = { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }
<div className="backdrop-blur-sm" />  // sur un élément toujours visible
```

#### Pattern layout (wrappers autour du header)
```tsx
// ✅ Correct — isolation CSS sans GPU
<div style={{ isolation: "isolate", contain: "layout style" }}>
  <HeaderServer />
</div>
<main style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", overscrollBehavior: "none" }}>

// ❌ Incorrect — willChange crée des couches GPU qui amplifient le crash
<div style={{ isolation: "isolate", willChange: "transform", transform: "translateZ(0)" }}>
```

### Récapitulatif des fichiers modifiés lors du second fix
- `app/globals.css` — règle de sécurité `@media (max-width: 767px)` ajoutée
- `app/invoices/page.tsx`, `app/quotes/page.tsx`, `app/clients/page.tsx`,
  `app/purchase-orders/page.tsx`, `components/invoices/NewInvoiceForm.tsx` — `backdropFilter` retiré des `cardStyle`
- `app/clients/page.tsx` — `backdropFilter` retiré de la barre de recherche
- `app/invoices/layout.tsx`, `app/quotes/layout.tsx`, `app/clients/layout.tsx`,
  `app/products/layout.tsx`, `app/settings/layout.tsx`, `app/purchase-orders/layout.tsx`,
  `app/credit-notes/layout.tsx` — `willChange`/`transform: translateZ(0)` retirés des wrappers
- `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/shared/SendEmailModal.tsx`,
  `components/layout/Sidebar.tsx`, `components/invoices/InvoiceDetail.tsx`,
  `app/quotes/[id]/page.tsx`, `app/purchase-orders/[id]/page.tsx`,
  `app/credit-notes/[id]/page.tsx` — `backdrop-blur-*` rendu desktop-only (`md:backdrop-blur-*`)

---

## 🚨 RÈGLE — Champs de formulaire : jamais moins de 16px sur mobile

### Le bug
iOS Safari/WKWebView zoome automatiquement toute la page quand un `<input>`,
`<select>` ou `<textarea>` reçoit le focus si son `font-size` calculé est
inférieur à 16px. Comportement natif iOS (pensé pour le web ouvert, pas pour
une app), pas un bug du site — mais dans l'app native, l'utilisateur doit
dézoomer manuellement à chaque champ, et le zoom persiste souvent après avoir
quitté le champ.

### La règle
**Aucun champ ne doit avoir un `font-size` inférieur à 16px sur mobile.**

#### Filet de sécurité CSS global (dans `globals.css`)
Une règle `@media (max-width: 767px)` force `font-size: 16px !important` sur
tout `input`/`select`/`textarea`, quelle que soit la source (Tailwind, style
inline, composant tiers). **Ne jamais supprimer cette règle** — même filet de
sécurité que la règle backdrop-filter ci-dessus.

#### Pattern pour chaque composant
```tsx
// ✅ Correct — 16px sur mobile, densité normale sur desktop
const inputBase = "... text-base md:text-sm ..."

// ✅ Correct — composant partagé components/ui/input.tsx (déjà conforme)
className="... text-base md:text-sm ..."

// ❌ Incorrect — sous 16px sur mobile, déclenche le zoom iOS
const inputBase = "... text-sm ..."       // 14px
const inputBase = "... text-[15px] ..."   // 15px
```

Le filet de sécurité global rattrape un oubli, mais corriger chaque
composant reste préférable : ça évite de dépendre d'un `!important` et ça
documente l'intention directement dans le code.

---

## 🚨 RÈGLE — Composants `next-themes` : toujours vérifier `mounted`

### Le bug
`resolvedTheme` de `useTheme()` est `undefined` côté serveur. Sans garde `mounted`,
l'attribut `src` d'une `<Image>` change entre le SSR et le client → mismatch
d'hydratation → boucle de recovery React sur mobile.

### La règle
**Tout composant qui utilise `resolvedTheme` pour changer le rendu (src d'image, etc.)
doit avoir un garde `mounted`.**

```tsx
// ✅ Correct
const { resolvedTheme } = useTheme()
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

<Image src={mounted && resolvedTheme === 'dark' ? LOGO_DARK : LOGO} ... />

// ❌ Incorrect — mismatch d'hydratation
const { resolvedTheme } = useTheme()
<Image src={resolvedTheme === 'dark' ? LOGO_DARK : LOGO} ... />
```

---

## 🚨 RÈGLE — Middleware : distinguer erreur réseau et "pas de données"

### Le bug
Dans le middleware Supabase, une requête `.single()` qui échoue (timeout, réseau)
retourne `data: null` — identique à "aucune ligne trouvée". Sans distinction,
une erreur réseau sur mobile lent redirige l'utilisateur vers `/pricing` à tort.

### La règle
**Toujours vérifier le code d'erreur Supabase avant de rediriger.**

```typescript
// ✅ Correct
const { data: sub, error } = await supabase.from('subscriptions')...single()

if (error && error.code !== 'PGRST116') {
  // PGRST116 = no rows found (légitime)
  // Autre erreur = problème réseau/technique → laisser passer
  return supabaseResponse
}
if (!sub) { /* redirect to /pricing */ }

// ❌ Incorrect — redirige aussi sur erreur réseau
const { data: sub } = await supabase.from('subscriptions')...single()
if (!sub) { /* redirect to /pricing */ }
```

---

## 🚨 RÈGLE — Mode démo : toujours synchronisé avec le tableau de bord réel

### Le principe
Le mode démo (`/demo/*`) doit être un **miroir exact** du tableau de bord réel en termes
d'UI, de layout et de fonctionnalités. Seules les données sont fictives (mock data).

### La règle
**Toute modification apportée au dashboard réel doit être répliquée dans la démo.**

Cela inclut :
- **Sidebar** (`Sidebar.tsx` → `DemoSidebar.tsx`) : nouvelles entrées de navigation,
  changement de logo, ajout/suppression de liens, styles
- **Header** (`Header.tsx` → `DemoHeader.tsx`) : nouveau CTA contextuel, changement
  de breakpoint, nouveau bouton dans la pilule, modification du dropdown
- **Pages** (`app/dashboard/` → `app/demo/`, composants dans `components/` → `components/demo/`) :
  nouveau widget, nouvelle section, modification de layout
- **Bottom nav mobile** (`MobileBottomNav` → `DemoMobileBottomNav`) : nouvel onglet,
  changement d'icône

### Correspondance des fichiers

| Réel | Démo |
|------|------|
| `components/layout/Sidebar.tsx` | `components/layout/DemoSidebar.tsx` |
| `components/layout/Header.tsx` | `components/layout/DemoHeader.tsx` |
| `app/dashboard/page.tsx` | `app/demo/page.tsx` |
| `app/dashboard/layout.tsx` | `app/demo/layout.tsx` |
| `app/{section}/page.tsx` | `app/demo/{section}/page.tsx` |
| `components/{section}/*.tsx` | `components/demo/*.tsx` |

### Ce qui reste spécifique à la démo
- Données fictives (mock data hardcodé, pas de Supabase)
- Badge "DÉMO" dans le header et la sidebar
- CTA "Créer mon compte →" dans le footer sidebar (au lieu de "Se déconnecter")
- Pas de vraie authentification ni logout
- Routes préfixées `/demo/`

### Checklist avant de considérer une tâche comme terminée
- [ ] La modification a été faite dans le composant réel
- [ ] La même modification a été répliquée dans le composant démo correspondant
- [ ] Les deux versions sont visuellement identiques (même styles, mêmes breakpoints)

---

## Configuration ThemeProvider

```tsx
// Dans app/layout.tsx — configuration obligatoire
<ThemeProvider
  attribute="class"
  defaultTheme="light"
  enableSystem={false}
  disableTransitionOnChange   // ← OBLIGATOIRE : prévient les transitions CSS
                               //   simultanées qui peuvent saturer le GPU mobile
>
```

`disableTransitionOnChange` est **requis**. Sans lui, next-themes permet aux
transitions CSS de se déclencher pendant le changement de thème, ce qui peut
causer des problèmes de performance sur mobile.

---

## Stack technique

- **Next.js** 14.2.x (App Router)
- **Supabase** (`@supabase/ssr` v0.9.x) — auth via cookies middleware
- **next-themes** v0.4.x — thème stocké dans `localStorage` clé `'theme'`
- **Tailwind CSS** v3
- **Redux** (via `@reduxjs/toolkit`) — état UI client
- **Stripe** — abonnements

## Structure des routes protégées

```
/ login /signup → publics
/dashboard /invoices /quotes /clients /settings /products /credit-notes /purchase-orders → protégés
/settings/billing → protégé mais exempt de vérification d'abonnement
/pricing → public (même pour utilisateurs connectés)
```

Le middleware vérifie dans l'ordre :
1. Route publique → passe
2. Route protégée sans utilisateur → redirect `/login`
3. Route protégée avec utilisateur → vérifie abonnement → redirect `/pricing` ou `/settings/billing`

---

## 🔍 Audit SEO — Règles d'implémentation

> Audit complet documenté dans `README.md` section "Audit SEO — TODO list complète".
> Les règles ci-dessous sont à respecter lors de l'implémentation des correctifs SEO.

### Fichiers à créer
- `app/robots.ts` — Next.js metadata API, bloquer `/admin/*`, `/dashboard/*`, `/api/*` et toutes routes protégées
- `app/sitemap.ts` — Next.js metadata API, routes publiques uniquement

### Règles JSON-LD
- Placer le `<script type="application/ld+json">` dans le `<head>` via les metadata exports Next.js ou via un composant dans le layout
- Schemas requis : `Organization`, `FAQPage` (landing), `Product`/`Offer` (pricing), `WebApplication`
- Ne jamais dupliquer les schemas entre pages

### Règles images
- **NE JAMAIS utiliser `unoptimized={true}`** sur les images Supabase CDN (le remote pattern est déjà configuré)
- Images above-the-fold : `priority={true}`, pas de `loading="lazy"`
- Images below-the-fold : `loading="lazy"`, pas de `priority`
- Toujours ajouter `sizes` sur les images responsives

### Règles metadata par page
- Chaque page publique doit exporter un objet `metadata` avec au minimum `title` et `description`
- Les descriptions doivent faire 150-160 caractères, être uniques, et contenir les mots-clés cibles
- Ajouter `alternates: { canonical: '/path' }` sur chaque page publique
- `metadataBase` doit être défini **une seule fois** dans le root layout

### Fonts
- Toutes les déclarations Google Fonts dans `layout.tsx` doivent avoir `display: "swap"`

---

## 🚨 RÈGLE — Service worker : jamais de données authentifiées en cache

### Le risque
Le Cache Storage est persistant et **partagé par toutes les sessions** d'un même
navigateur. Mettre en cache le HTML d'une route authentifiée exposerait les
factures d'un utilisateur à la personne suivante sur le même appareil, et
afficherait des données périmées après déconnexion.

### La règle
**`public/sw.js` ne met en cache que des assets immuables et des pages 100 % publiques.**

La liste `CACHEABLE_PAGE_PREFIXES` dans `public/sw.js` doit rester alignée sur
`purePublicPaths` dans `lib/supabase/middleware.ts` — ce sont les seules routes
dont la réponse est identique pour tous les visiteurs.

```js
// ✅ Correct — page publique, réponse identique pour tous
const CACHEABLE_PAGE_PREFIXES = ['/blog', '/pricing', '/outils', '/guide']

// ❌ Incorrect — /dashboard dépend de l'utilisateur connecté
const CACHEABLE_PAGE_PREFIXES = ['/blog', '/dashboard']
```

Ne jamais mettre en cache :
- `/api/*` — sans exception (réponses authentifiées ou à effet de bord) ;
- les routes protégées (`/dashboard`, `/invoices`, `/clients`, `/settings`…) ;
- `/`, `/login`, `/signup` — publiques, mais le middleware y redirige selon
  l'état de connexion.

**En ajoutant une route publique au middleware**, l'ajouter aussi au service
worker (sinon elle est simplement indisponible hors ligne — pas de risque de
sécurité, juste une perte de fonctionnalité).

---

## 🚨 RÈGLE — Code natif : toujours un repli web

### Le principe
Le même code React sert le site web et l'app iOS compilée. Aucun composant ne
doit supposer la présence de la coquille native.

### La règle
**Tout appel à un plugin Capacitor passe par `lib/native/`, jamais par un import
direct dans un composant.**

```tsx
// ✅ Correct — fonctionne sur le web comme dans l'app
import { hapticImpact } from '@/lib/native/feedback'
import { shareContent } from '@/lib/native/share'

// ❌ Incorrect — casse le web et alourdit le bundle
import { Haptics } from '@capacitor/haptics'
```

Les helpers de `lib/native/` sont gardés par `isNativeApp()` et importent les
plugins dynamiquement : le bundle web ne les embarque pas.

**Stripe Checkout et tout lien externe doivent passer par `openExternalUrl()`** —
un tunnel de paiement dans la WKWebView est refusé par Apple (règle 3.1), ne
partage pas les cookies Safari et piège l'utilisateur sans retour possible.

Détails complets dans `IOS-APP.md`.

---

## 📋 Suivi des modifications

> **Instruction pour Claude Code** : À chaque session, ajouter une ligne dans ce tableau pour toute modification significative apportée au projet (nouvelle feature, correction bug, refacto, mise à jour copywriting, fix build, etc.). Même règle dans `README.md` section "Suivi des modifications".

| Date | Modification | Fichiers principaux |
|------|--------------|---------------------|
| 2026-03-15 | Scroll-reveal landing (FadeIn `motion/react`, `once: true`, safe iOS) | `app/page.tsx`, `components/landing/` |
| 2026-03-15 | Fix build TypeScript (prop `style` FadeIn, accolades fermantes) | `app/page.tsx` |
| 2026-03-15 | Correction README + CLAUDE.md : suppression essai 7j, PPF = guide manuel, Stripe = implémenté | `README.md`, `CLAUDE.md` |
| 2026-03-15 | Refonte copywriting landing : suppression promesses fausses PPF auto, leviers marketing (urgence, loss aversion, ancrage prix), features enrichies | `app/page.tsx`, `lib/stripe/plans.ts`, `components/billing/PricingSelector.tsx`, `components/landing/LandingHero.tsx` |
| 2026-03-15 | Email de bienvenue post-inscription : template HTML complet, intégré dans la route signup en fire-and-forget | `lib/email/templates/welcome.ts`, `app/api/auth/signup/route.ts` |
| 2026-03-15 | Fix abonnement annuel non reconnu : `return_url` avec placeholder `{CHECKOUT_SESSION_ID}` + activation côté serveur dans `/pricing/return` | `app/api/stripe/checkout/route.ts`, `app/pricing/return/page.tsx` |
| 2026-03-15 | Fix détection `RESEND_FROM_EMAIL` manquant : `console.warn` si fallback `onboarding@resend.dev`, nettoyage `.env.example` | `lib/email/resend.ts`, `.env.example` |
| 2026-03-15 | Export FEC (Fichier des Écritures Comptables) : générateur pur + API `GET /api/export/fec` + page `/settings/exports` | `lib/export/fec.ts`, `app/api/export/fec/route.ts`, `app/settings/exports/` |
| 2026-03-15 | Tests unitaires Vitest (21 tests : admin-auth HMAC, logique middleware, formatage FEC) + CI GitHub Actions (lint + tests sur push) | `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `__tests__/` |
| 2026-03-15 | Santé système admin : table `cron_logs`, cron persiste ses runs, API `/api/admin/health` (ping Supabase/Stripe/Resend + stats users), page `/admin/health`, lien sidebar | `supabase/migrations/20260315_create_cron_logs.sql`, `app/api/cron/send-reminders/route.ts`, `app/api/admin/health/route.ts`, `app/admin/(panel)/health/page.tsx`, `components/admin/AdminSidebar.tsx` |
| 2026-03-15 | Refonte complète de la démo : composants démo (stats, graphique, top clients, factures récentes), pages manquantes (devis, produits, bons de commande, avoirs), sidebar complète, liens internes corrigés | `app/demo/`, `components/demo/`, `components/layout/DemoSidebar.tsx`, `components/layout/DemoHeader.tsx` |
| 2026-03-17 | Fix onboarding persistant : fallback localStorage + retries backoff exponentiel + redirect si company inexistante | `components/dashboard/DashboardClient.tsx`, `components/onboarding/WelcomeModal.tsx`, `app/dashboard/page.tsx` |
| 2026-03-17 | Header mobile : suppression toggle thème (crash iOS), ajout style pilules (titre + actions), toggle conservé sur desktop uniquement | `components/layout/Header.tsx`, `components/layout/DemoHeader.tsx` |
| 2026-03-17 | Audit SEO complet : TODO list 15 items (robots.ts, sitemap.ts, JSON-LD, canonical, meta descriptions, images, fonts, etc.) documentée dans README.md + règles d'implémentation dans CLAUDE.md | `README.md`, `CLAUDE.md` |
| 2026-03-17 | SEO priorité HAUTE : robots.ts, sitemap.ts, JSON-LD (Organization+WebApplication+FAQPage), retrait `unoptimized` (9 fichiers), `metadataBase`+canonical, font `display: swap` (3/3), lazy loading images | `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx`, `app/page.tsx`, `components/landing/LandingHero.tsx`, + 7 fichiers |
| 2026-03-17 | SEO priorité MOYENNE : canonical+description sur 8 pages publiques, noindex admin, fix backdrop-filter LandingHero mobile (CLAUDE.md compliant) | `app/pricing/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/demo/page.tsx`, `app/admin/(panel)/layout.tsx`, `components/landing/LandingHero.tsx`, + 4 fichiers |
| 2026-03-17 | SEO priorité BASSE : hreflang fr+x-default, vérification liens footer, évaluation breadcrumbs (non pertinent) et OG dynamiques (reporté) | `app/layout.tsx` |
| 2026-03-17 | SEO images : attribut `sizes` ajouté sur 33 images (10 fichiers) — audit SEO item S4 complété | `app/page.tsx`, `components/landing/LandingHero.tsx`, `app/pricing/page.tsx`, `components/auth/AuthLayout.tsx`, `app/pricing/checkout/CheckoutPageClient.tsx`, `components/billing/BillingPageClient.tsx`, `components/layout/Sidebar.tsx`, `components/legal/LegalLayout.tsx`, `components/onboarding/WelcomeModal.tsx`, `app/not-found.tsx` |
| 2026-03-17 | SEO OG dynamiques : route `app/api/og/route.tsx` (edge, ImageResponse), images OG personnalisées par page publique | `app/api/og/route.tsx`, `app/layout.tsx`, `app/pricing/page.tsx`, `app/demo/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` |
| 2026-03-17 | Page `/confidentialite` : politique de confidentialité complète (RGPD, cookies, sous-traitants, droits, sécurité) + sitemap + OG dynamique | `app/confidentialite/page.tsx`, `app/sitemap.ts` |
| 2026-03-17 | Blog public SEO : pages listing `/blog` + article `/blog/[slug]`, parser Markdown, lien nav + footer, sitemap, OG dynamiques par article, CTA signup en bas d'article | `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `lib/markdown.ts`, `app/sitemap.ts`, `components/landing/LandingHero.tsx`, `app/page.tsx` |
| 2026-03-17 | Blog IA automatisé Gemini : migration AI columns, lib Gemini (texte+image), 32 sujets SEO rotation, cron `/api/cron/generate-blog`, admin API `/api/admin/blog/generate`, page admin `/admin/blog/ai`, BlogEditor (badge IA+keywords+régénérer), sidebar Blog IA, sitemap dynamique | `supabase/migrations/20260317_blog_ai_columns.sql`, `lib/ai/gemini.ts`, `lib/ai/seo-topics.ts`, `app/api/cron/generate-blog/route.ts`, `app/api/admin/blog/generate/route.ts`, `app/api/admin/blog/ai-posts/route.ts`, `app/admin/(panel)/blog/ai/page.tsx`, `components/admin/BlogEditor.tsx`, `components/admin/AdminSidebar.tsx`, `app/sitemap.ts`, `.env.example` |
| 2026-03-18 | Fix logo footer cassé + boutons partage blog réduits + `<img>` → `<Image>` blog | `components/layout/Footer.tsx`, `app/pricing/checkout/CheckoutPageClient.tsx`, `components/blog/ShareButtons.tsx`, `app/blog/[slug]/page.tsx`, `components/blog/ArticleCard.tsx`, `components/blog/HeroArticle.tsx`, `components/blog/CategoryFilter.tsx` |
| 2026-03-18 | SEO-7 JSON-LD FAQPage : extraction auto des H2/H3 en `?` → schema FAQ + Article sur chaque page blog | `lib/blog-utils.ts`, `app/blog/[slug]/page.tsx` |
| 2026-03-18 | SEO-6 Google Search Console : meta verification via `NEXT_PUBLIC_GSC_VERIFICATION` env var | `app/layout.tsx`, `.env.example` |
| 2026-03-18 | SEO-6 Indexation Google : sitemap soumis dans GSC, demande d'indexation manuelle sur pages prioritaires (/, /pricing, /blog, /signup) | — (action manuelle GSC) |
| 2026-03-18 | SEO-8 Maillage interne : liens croisés blog ↔ landing ↔ pricing ↔ démo (headers nav, CTA cards, section "Aller plus loin", CTA articles blog) | `app/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `components/billing/PricingSelector.tsx`, `app/demo/page.tsx` |
| 2026-03-19 | Admin toggle auto-publish blog : table `app_settings` (clé-valeur), API `/api/admin/settings` (GET/PUT), toggle dans `/admin/blog/ai`, cron lit depuis DB avec fallback env var | `supabase/migrations/20260319_create_app_settings.sql`, `app/api/admin/settings/route.ts`, `app/admin/(panel)/blog/ai/page.tsx`, `app/api/cron/generate-blog/route.ts` |
| 2026-03-21 | Audit technique complet : revue architecture, sécurité, performance, testing, mobile, SEO, UX — score 77/100, top 10 priorités documentées | `AUDIT-TECHNIQUE-2026-03-21.md` |
| 2026-03-23 | Brand Studio admin : analyse d'image inspiration (Gemini Vision) + génération image brandée (Nano Banana 2) + galerie Supabase Storage + page `/admin/brand-studio` + sidebar | `lib/ai/gemini.ts`, `app/api/admin/brand-studio/route.ts`, `app/admin/(panel)/brand-studio/page.tsx`, `components/admin/AdminSidebar.tsx` |
| 2026-03-23 | Fix envoi factures/devis par email : bouton "Envoyer" ne faisait que changer le statut sans appeler `/send`. Ajout appel API réel + `maxDuration=30` sur toutes les routes d'envoi | `components/invoices/NewInvoiceForm.tsx`, `components/quotes/NewQuoteForm.tsx`, `app/api/invoices/[id]/send/route.ts`, + 4 routes |
| 2026-03-23 | Refonte démo : dark mode sur 12 pages, pages détail facture/devis, formulaire création devis, bouton retour accueil, CTA header corrigés | `app/demo/`, `components/demo/`, `components/layout/DemoSidebar.tsx`, `components/layout/DemoHeader.tsx`, `components/invoices/DemoInvoiceForm.tsx`, `components/quotes/DemoQuoteForm.tsx` |
| 2026-03-23 | Brand Studio v2 : suppression galerie, métadonnées (ratio/instructions), skeletons, éditeur brand guidelines dynamiques (app_settings), toast paste, compteur caractères, table `brand_studio_generations` | `app/admin/(panel)/brand-studio/page.tsx`, `app/api/admin/brand-studio/route.ts`, `lib/ai/gemini.ts`, `supabase/migrations/20260323_brand_studio_generations.sql` |
| 2026-03-25 | Thème clair par défaut : suppression auto dark mode nocturne (18h-5h), thème initial toujours "light", toggle manuel conservé sur desktop | `components/layout/AutoDarkMode.tsx` |
| 2026-03-25 | Bannière info personnalisation factures : tip horizontal (Sparkles, CTA → `/settings/invoices`), masquée si logo existant ou fermée, responsive, répliquée dans démo | `components/invoices/NewInvoiceForm.tsx`, `components/invoices/DemoInvoiceForm.tsx` |
| 2026-03-25 | Fix page démo factures : ajout `'use client'` (onClick sur Server Component causait un crash) | `app/demo/invoices/page.tsx` |
| 2026-03-25 | pSEO : 3 axes (28 métiers, 9 guides, 8 modèles), ~45 pages statiques, JSON-LD, OG dynamiques, maillage interne, sitemap | `lib/pseo/`, `app/facturation/[slug]/`, `app/guide/[slug]/`, `app/modele/[slug]/`, `app/sitemap.ts` |
| 2026-04-04 | Outils gratuits SEO : plan 12 outils (3 sprints), hub `/outils`, mega-menu dropdown "Outils gratuits" dans le header landing (desktop + mobile), sitemap, TODO dans README | `app/outils/page.tsx`, `components/landing/LandingHero.tsx`, `app/sitemap.ts`, `README.md`, `CLAUDE.md` |
| 2026-04-04 | Sprint 1 outils gratuits : 4 outils interactifs (calculateur TVA, simulateur charges AE, vérificateur SIRET, générateur facture PDF), libs métier, API routes, layouts SEO (metadata, JSON-LD, OG, FAQ, maillage interne) | `app/outils/*/page.tsx`, `app/outils/*/layout.tsx`, `app/api/outils/*/route.ts`, `lib/outils/tva.ts`, `lib/outils/charges.ts` |
| 2026-04-04 | Sprint 2 outils gratuits : 4 outils interactifs (générateur devis PDF, calculateur pénalités retard, vérificateur mentions obligatoires, vérificateur conformité facture), lib pénalités, API devis, design unifié (pill header, hero gradient, CTA sticky) | `app/outils/*/page.tsx`, `app/outils/*/layout.tsx`, `app/api/outils/devis/route.ts`, `lib/outils/penalites.ts` |
| 2026-04-04 | Sprint 3 outils gratuits : 4 outils interactifs (simulateur seuil TVA, simulateur revenus net, générateur n° facture, générateur conditions paiement), hub 12/12 outils actifs, tous les badges "Bientôt" supprimés | `app/outils/*/page.tsx`, `app/outils/*/layout.tsx` |
| 2026-06-15 | Fix indexation Google "Autre page avec balise canonique sélectionnée par l'utilisateur" : domaine primaire Vercel inversé (www.qonforme.fr servait 200 alors que tout le code déclare qonforme.fr comme canonique). qonforme.fr → Production (200), www.qonforme.fr → redirect 308 vers qonforme.fr. Aucun changement de code, config Vercel uniquement | — (config Vercel : Settings → Domains) |
| 2026-07-02 | Audit SEO/GEO complet : cause racine identifiée sur le plafond d'indexation — 780 pages pSEO géo (métier×ville) orpheline, retirées du sitemap le 09/04 mais toujours crawlables sans noindex, jugées thin content par Google et pénalisant la confiance du domaine entier. Passage en `robots: noindex,follow` en attendant une refonte avec contenu différencié par ville. Recommandation de pause de l'auto-publication du blog IA (toggle admin `/admin/blog/ai`) le temps d'un audit qualité des 70 articles existants | `app/facturation/[slug]/[ville]/page.tsx` |
| 2026-08-18 | Transformation en app iOS : PWA complète (service worker avec cache strictement non authentifié, 40 splash screens iOS, manifest enrichi + raccourcis, invite d'installation, bannière hors-ligne, mode plein écran) + coquille native Capacitor (config, plugins natifs, pont haptique/partage/browser, push APNs avec table `push_tokens` et route d'enregistrement). Aucun code existant supprimé — l'app native charge le même site. Doc : `IOS-APP.md` | `public/sw.js`, `public/manifest.json`, `public/splash/`, `components/pwa/`, `components/native/`, `lib/pwa/`, `lib/native/`, `capacitor.config.ts`, `app/api/native/push-token/`, `supabase/migrations/20260818_create_push_tokens.sql`, `app/layout.tsx`, `app/globals.css`, `next.config.mjs`, `IOS-APP.md` |
| 2026-08-18 | Fix point d'entrée app iOS : server.url pointait sur le domaine nu (landing marketing SEO) au lieu de /dashboard — le middleware sait déjà rediriger proprement (connecté → tableau de bord, non connecté → /login). Ajout `?source=native-app` pour distinguer ce trafic dans PostHog/GA, sur le modèle de `?source=pwa` | `capacitor.config.ts`, `IOS-APP.md` |
| 2026-08-18 | Fix critique app iOS : app entière éjectée vers Safari au lieu de rester dans la coquille native, dès la première redirection (middleware /dashboard → /login). Cause identifiée dans le code source Capacitor (WebViewDelegationHandler.swift) : la comparaison isApplicationNavigation fait un match de préfixe littéral sur server.url — un chemin dedans (/dashboard) faisait échouer toute redirection vers un autre chemin. server.url revient à la racine du domaine, le chemin de démarrage passe par le champ Capacitor dédié server.appStartPath, qui ne participe jamais à cette comparaison | `capacitor.config.ts`, `IOS-APP.md` |
| 2026-08-19 | Écran d'amorçage avant la demande d'autorisation push (au lieu d'un onboarding générique 3 écrans, écarté après discussion — l'audience principale de l'app est des clients existants, pas des découvreurs) : explique le bénéfice concret (alertes d'échéance/retard) avant la popup système iOS, montré une seule fois par appareil (Preferences), jamais reproposé après un "Plus tard" pour éviter de renvoyer la popup froide | `lib/native/push.ts`, `components/native/PushPrimingScreen.tsx`, `components/native/NativeAppInit.tsx` |
| 2026-08-19 | Onboarding de découverte App/Play Store (3 écrans, montré une fois par appareil avant toute connexion — public distinct de l'amorçage push ci-dessus) : même langage visuel que le dashboard réel (dégradé `--dashboard-bg`, halos radiaux, picto Q de la sidebar), écran de conversion final (créer un compte / déjà client), séquencé avant l'amorçage push existant (`NativeAppInit` attend `onboardingDone`), overlay maintenu jusqu'à navigation réelle vers `/signup`/`/login` pour éviter un flash de la mauvaise page | `lib/native/onboarding.ts`, `components/native/AppOnboardingCarousel.tsx`, `components/native/NativeAppInit.tsx`, `IOS-APP.md` |
| 2026-08-19 | Fix zoom automatique iOS au focus d'un champ (signalé pendant un test de création de compte dans l'app) : les 5 formulaires auth avaient un `font-size` sous le seuil 16px (`text-sm`/`text-[15px]`) qui déclenche le zoom natif iOS Safari/WKWebView ; corrigés en `text-base md:...`, + filet de sécurité CSS global (`@media max-width:767px`) pour tout champ présent ou futur | `app/globals.css`, `components/auth/SignupForm.tsx`, `components/auth/CompanyForm.tsx`, `components/auth/LoginForm.tsx`, `components/auth/ForgotPasswordForm.tsx`, `components/auth/ResetPasswordForm.tsx` |
| 2026-08-19 | Émetteur APNs côté serveur (dernière brique manquante des notifications push) : client HTTP/2 + JWT ES256 sans dépendance ajoutée (`node:http2`/`node:crypto`), connexion réutilisée pour tout un run de cron, repli automatique sandbox/production sur `BadDeviceToken`, purge des jetons qu'Apple signale invalides. Branché dans le cron de relances existant — une notification push accompagne désormais chaque relance email J+30/J+45. Fonctionne en dégradé (email seul) tant que la clé APNs n'est pas configurée. Test unitaire de la signature JWT (authentifiable avec la clé publique) | `lib/push/apns.ts`, `app/api/cron/send-reminders/route.ts`, `__tests__/apns-jwt.test.ts`, `.env.example`, `IOS-APP.md` |
| 2026-08-20 | Fonctionnalités natives pour renforcer le dossier de soumission App Store (règle 4.2 Minimum Functionality) : capture photo du logo entreprise (`capturePhoto()`, réutilise l'endpoint d'upload existant, `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` ajoutées), écran de confidentialité masquant les données financières dans le sélecteur d'apps iOS (fond opaque, pas de backdrop-filter), badge sur l'icône = nombre de factures en retard (via `aps.badge`, pas de plugin supplémentaire — remise à zéro à l'ouverture non implémentée, nécessiterait un plugin tiers) | `lib/native/camera.ts`, `components/settings/InvoiceSettingsForm.tsx`, `ios/App/App/Info.plist`, `components/native/PrivacyScreen.tsx`, `app/layout.tsx`, `app/api/cron/send-reminders/route.ts`, `IOS-APP.md` |
| 2026-08-31 | Audit complet de la plateforme (build local avec credentials factices, lint, 26 tests unitaires, smoke-test HTTP de toutes les routes publiques/protégées/admin/API, captures d'écran desktop+mobile) : 990/990 pages générées, tout est vert. Bug trouvé et corrigé : `/admin` et `/admin/health` affichaient silencieusement "0 utilisateurs" quand `listUsers()` (API Auth Admin Supabase, sous-système distinct de PostgREST) échouait, au lieu d'un état d'erreur comme les 3 autres checks de service — même piège que la règle middleware ci-dessus, cette fois dans le panneau censé le détecter. `/admin/health` factorise maintenant cette erreur dans le bandeau global "Incident détecté" | `app/admin/(panel)/page.tsx`, `app/admin/(panel)/health/page.tsx` |
| 2026-08-31 | Revue de code des parcours métier (devis/factures/clients/PDF) demandée après l'audit ci-dessus, faute d'accès à un vrai backend pour tester en conditions réelles : 14 bugs confirmés par lecture directe du code (pas de simples suppositions du sous-agent de revue) puis corrigés, avec tests de non-régression pour les 2 plus critiques. **Numérotation** : les factures créées directement et celles issues d'une conversion de devis utilisaient deux compteurs jamais synchronisés (`MAX(invoice_number)` vs `companies.invoice_sequence`) → doublons quasi systématiques dès la première conversion ; les 4 types de documents (factures/devis/avoirs/bons de commande) triaient aussi leur numéro comme du TEXTE, cassant au 1000e document ("999" > "1000" lexicographiquement). Centralisé dans `lib/utils/document-numbering.ts` (calcul du vrai max côté appli + retry sur conflit) ; migration `UNIQUE(user_id, *_number)` écrite mais **non appliquée** (pas d'accès au Supabase réel de Qonforme depuis cette session — à appliquer manuellement, voir le commentaire en tête du fichier). **Sécurité** : `logo_url` était fetch()é côté serveur sans validation à chaque PDF généré (SSRF) → `lib/utils/logo-url.ts` n'autorise plus que le bucket Storage du projet. **Intégrité facture** : `PATCH /api/invoices/[id]` n'avait aucune garde de statut (une facture envoyée/payée restait modifiable par appel direct) ; un avoir partiel soldait à tort la facture entière (bloquant tout avoir suivant et faussant le CA encaissé) → vérifie maintenant le cumul des avoirs déjà émis. **UX/quota** : "Aperçu PDF" créait une vraie facture brouillon et consommait le quota mensuel du plan Starter → nouvelle route `POST /api/invoices/preview-pdf`, purement en mémoire, sans aucune écriture. **Notables** : toggle "voir les inactifs" sur `/products` structurellement impossible à afficher (données déjà pré-filtrées avant que le bouton n'apparaisse), SIREN client validé par regex seule sans la clé de Luhn déjà utilisée pour l'entreprise, recherche produit cassée par une virgule/parenthèse (interpolation brute dans un filtre PostgREST `.or()`), "en retard" déclenché 1-2h trop tôt en heure française (comparaison UTC), couleur hex courte (`#fff`) mal interprétée, dates par défaut figées au chargement du module JS, polices PDF non subsettées (+1 Mo par document) | `lib/utils/document-numbering.ts`, `lib/utils/logo-url.ts`, `app/api/invoices/preview-pdf/route.ts`, `app/api/{invoices,quotes,purchase-orders}/route.ts`, `app/api/invoices/[id]/{route,credit/route}.ts`, `app/api/quotes/[id]/convert/route.ts`, `app/api/company/route.ts`, `app/api/products/route.ts`, `app/products/page.tsx`, `components/clients/NewClientForm.tsx`, `components/invoices/{InvoiceDetail,NewInvoiceForm}.tsx`, `components/quotes/NewQuoteForm.tsx`, `lib/pdf/*.ts`, `supabase/migrations/20260901_unique_document_numbers.sql`, `__tests__/{document-numbering,logo-url}.test.ts` |
| 2026-08-31 | Validation en conditions réelles des 14 correctifs ci-dessus, contre le vrai backend de production (compte de test clairement identifié `claude-audit-test-…@example.com`, `(A SUPPRIMER)` partout — non nettoyé, cette session n'a pas d'accès admin/Supabase réel pour le supprimer). Signup réel + session Supabase générée avec la vraie lib `@supabase/ssr` (le navigateur headless ne passe pas par le proxy réseau de cet environnement — connexions vers qonforme.fr systématiquement resets, appels HTTP directs utilisés à la place). Tout confirmé sur données réelles : numérotation devis→facture (D/F-2026-001/002, aucun doublon), avoir partiel (statut inchangé après un avoir partiel, sur-crédit rejeté, passage à "credited" seulement une fois soldé), immutabilité facture non-brouillon (403), SSRF logo_url (URL interne rejetée, Storage légitime acceptée), recherche produit virgule/parenthèse, toggle produits inactifs, aperçu PDF (3 appels → 0 facture créée), PDF Factur-X valide et 17,5 Ko (vs ~1 Mo avant subsetting), bon de commande. **Faille découverte en testant, non corrigée (choix explicite)** : `/api/quotes/[id]/convert` (et `/api/clients`, `/api/quotes`, `/api/products`, `/api/purchase-orders` en création) ne vérifient aucun abonnement actif — seule la création directe de facture (`POST /api/invoices`) appelle `canCreateInvoice()`. Un compte sans abonnement peut donc émettre des factures illimitées via conversion de devis, contournant le paywall Starter/Pro | — (validation uniquement, aucun fichier modifié) |
