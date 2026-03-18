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
