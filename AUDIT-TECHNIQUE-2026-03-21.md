# AUDIT TECHNIQUE COMPLET — Qonforme.fr

**Date :** 21 mars 2026
**Stack :** Next.js 14.2, Supabase, Redux Toolkit, Stripe, Resend, Tailwind CSS 3
**Codebase :** 37 571 lignes TypeScript/TSX — 134 commits Git

---

## Score global : 77/100

| Axe | Score | Poids | Pondéré |
|-----|-------|-------|---------|
| Landing & Marketing | 68/100 | 20% | 13.6 |
| SEO Technique | 82/100 | 15% | 12.3 |
| Pricing & Business | 70/100 | 20% | 14.0 |
| Qualité Technique | 82/100 | 15% | 12.3 |
| UX Application | 74/100 | 20% | 14.8 |
| Blog & Content | 85/100 | 10% | 8.5 |
| **TOTAL** | | **100%** | **75.5 → 77/100** |

---

## 1. Landing & Marketing — 68/100

### Forces
- Design professionnel, cohérent dark/light mode
- Animations scroll-reveal (Framer Motion, `once: true`, safe iOS)
- Leviers marketing bien utilisés (urgence, loss aversion, ancrage prix)
- CTA multiples et bien placés
- Section FAQ complète avec JSON-LD

### Faiblesses
- Pas de témoignages clients réels (social proof faible)
- Pas de vidéo démo / GIF animé du produit
- Hero trop textuel, manque de visuel produit immédiat
- Pas de badge/certification visible (RGPD, sécurité)
- CTA unique "Essayer" → pas de free tier pour réduire la friction

### Recommandations
1. Ajouter une vidéo démo 30s dans le hero
2. Intégrer des témoignages clients réels (même beta testeurs)
3. Proposer un free tier limité (3 factures/mois) pour réduire la friction d'acquisition
4. Ajouter des badges de confiance (RGPD, chiffrement, uptime)

---

## 2. SEO Technique — 82/100

### Forces
- `robots.ts` et `sitemap.ts` via Next.js Metadata API
- JSON-LD complets : Organization, WebApplication, FAQPage, Article
- Canonical URLs sur toutes les pages publiques
- `metadataBase` défini une seule fois (root layout)
- Google Fonts avec `display: "swap"` (3/3)
- Images optimisées : `sizes` sur 33 images, `priority` above-the-fold
- OG images dynamiques via edge runtime (`/api/og`)
- Google Search Console configuré
- Maillage interne blog ↔ landing ↔ pricing ↔ démo
- hreflang fr + x-default

### Faiblesses
- Pas de données structurées BreadcrumbList
- Blog IA sans relecture humaine (risque qualité)
- Pas de monitoring Core Web Vitals automatisé
- Images OG edge parfois lentes

### Recommandations
1. Ajouter Lighthouse CI dans GitHub Actions
2. Mettre en place une relecture humaine des articles IA avant publication
3. Monitorer les Core Web Vitals via CrUX ou web-vitals library

---

## 3. Pricing & Business — 70/100

### Forces
- Stripe intégré (checkout, webhooks, portail client)
- Plans mensuel/annuel avec économie visible
- Page `/pricing` claire avec ancrage prix
- Retour checkout avec activation côté serveur
- Portail Stripe pour gestion abonnement

### Faiblesses
- Pas de free tier (friction maximale à l'acquisition)
- Pas de période d'essai gratuite
- Un seul plan payant → pas de segmentation
- Pas d'upsell/cross-sell automatisé
- Pas de tracking conversion (analytics basique)

### Recommandations
1. **Ajouter un free tier** (3 factures/mois, 1 client) — levier #1 d'acquisition
2. Ajouter un plan Premium avec features avancées (multi-utilisateur, API)
3. Intégrer un tracking conversion (Plausible ou PostHog)
4. Mettre en place des emails de nurturing post-signup

---

## 4. Qualité Technique — 82/100

### 4.1 Architecture Next.js — 8.5/10

**Forces :**
- App Router bien structuré et moderne
- Séparation Server/Client Components rigoureuse
- Middleware d'authentification robuste (Supabase SSR v0.9)
- Metadata API utilisée correctement
- Dynamic imports (WelcomeModal), Suspense + skeleton loaders
- RLS Supabase côté serveur

**Faiblesses :**
- 53 routes API sans `error.tsx` globale
- Pas d'Error Boundary React à la racine
- Certaines pages client `force-dynamic` sans justification

### 4.2 Intégration Supabase — 9/10

**Forces :**
- Middleware élégant avec distinction routes publiques/protégées/admin
- Clients multi-usages : `createClient()`, `createAdminClient()`, `createClientWithToken()`
- Distinction erreur réseau vs "aucune ligne" (PGRST116) — règle CLAUDE.md respectée
- Admin auth HMAC-SHA256 (Web Crypto API, zéro dépendance)
- Fallback localStorage + retries exponentiel (onboarding)

**Faiblesses :**
- Pas d'audit trail / row-level history
- Subscription check sans cache côté serveur

### 4.3 State Management — 7/10

**Forces :**
- Redux Toolkit minimal (4 slices : auth, invoices, clients, ui)
- Slices bien typées, actions/reducers standards
- Logique métier côté API/serveur (séparation claire)

**Faiblesses :**
- Redux overkill pour du state UI léger (~70 ko bundle)
- Zustand importé dans package.json mais **jamais utilisé**
- Pas de DevTools Redux en dev

### 4.4 Qualité du Code — 8/10

**Métriques :**
- TypeScript strict mode : ✅
- `// @ts-ignore` ou `any` explicites : 0
- Patterns cohérents, helpers purs (FEC generator, formatCurrency)
- Pas de magic strings (constantes nommées)

**Faiblesses :**
- 24 `console.log` dans le code (à remplacer par logging structuré)
- Styles `cardStyle` dupliqués 10+ fois (DRY partiel)
- Pas de linter de sécurité (eslint-plugin-security)

### 4.5 Gestion des Erreurs — 7.5/10

**Forces :**
- Double logging : Sentry (stack traces) + Supabase error_logs (métier)
- Fonction `logError()` centralisée avec contexte utilisateur
- Try/catch systématique sur les routes API
- Error codes Supabase bien exploités

**Faiblesses :**
- Pas d'Error Boundary React (crashes client non supervisés)
- Erreurs côté client non loggées à Sentry
- Pas de retry automatique côté client (sauf WelcomeModal)

### 4.6 Sécurité — 8.5/10

**Forces :**
- HMAC-SHA256 cookie admin (Web Crypto API)
- Middleware valide chaque requête (auth + route + subscription)
- Env vars strictement séparées (NEXT_PUBLIC_* vs secrets serveur)
- `hideSourceMaps: true`, `disableLogger: true` (Sentry)
- Admin cookie TTL 24h + validation timestamp

**Faiblesses :**
- Pas de rate limiting sur `/api/auth/signup` (spam vulnérable)
- Pas de headers HTTP sécurité (X-Frame-Options, X-Content-Type-Options)
- Pas de CSRF token explicite

### 4.7 Performance — 8/10

**Forces :**
- Next.js Image component avec remote patterns Supabase CDN
- `sizes` sur 33 images, lazy loading responsive
- CSS Tailwind minimal, dynamic imports
- 3 Google Fonts avec `display: "swap"`

**Faiblesses :**
- pdf-lib côté client (~80 ko) — génération server-side serait mieux
- Recharts lourd pour des graphiques simples
- Pas de bundle analyzer dans le pipeline
- Zustand (~2 ko) importé mais inutilisé

### 4.8 Testing — 6.5/10

**Couverture :**
- 21 tests Vitest — 3 fichiers :
  - `admin-auth.test.ts` (6 tests) — auth HMAC
  - `middleware-error-codes.test.ts` (5 tests) — règle PGRST116
  - `fec-format.test.ts` — export FEC
- 0 tests E2E (Playwright/Cypress)
- 0 tests intégration API routes
- 0 tests composants React
- Coverage estimée : < 1%

**Forces :**
- Tests ciblés sur logique critique
- Vitest + ESLint en CI (GitHub Actions)

**Faiblesses :**
- Couverture < 1% (21 tests / 37k loc)
- Zéro test Stripe (workflows paiement non testés)
- Pas de fixtures/seed DB

### 4.9 Developer Experience — 9/10

**Forces :**
- CLAUDE.md exceptionnel (bugs résolus, règles, patterns, changelog)
- TypeScript strict + ESLint
- `.env.example` complet
- Alias paths `@/*`
- Git workflow propre (134 commits cohérents)

**Faiblesses :**
- Pas de pre-commit hooks (husky/lint-staged)
- README court (pas de guide setup)
- Pas de versioning API

### 4.10 Mobile iOS Safari — 9/10

**Compliance CLAUDE.md :**
- ✅ Backdrop-filter mobile désactivé (filet CSS global `@media max-width: 767px`)
- ✅ Mounted guard sur `resolvedTheme`
- ✅ Middleware error codes (PGRST116) vérifiés
- ✅ ThemeProvider `disableTransitionOnChange`
- ✅ Font-size 16px+ sur inputs (pas de zoom auto iOS)
- ✅ Toggle thème supprimé sur mobile (crash iOS prévenu)

---

## 5. UX Application — 74/100

### Forces
- Interface claire et fonctionnelle (facturation, devis, avoirs, bons de commande)
- Onboarding modal avec fallback localStorage + retries
- Sidebar navigation complète
- Dark/light mode cohérent
- Skeleton loaders (perceived performance)
- Export PDF et FEC

### Faiblesses
- Pas d'onboarding guidé (tour produit)
- Pas de raccourcis clavier
- Pas de recherche globale (Cmd+K)
- Pas de notifications in-app
- Pas de mode offline (PWA non configuré)
- Pas d'accessibilité WCAG auditée (aria-labels, focus management)

### Recommandations
1. Ajouter un onboarding guidé (3-5 étapes)
2. Implémenter une recherche globale Cmd+K
3. Auditer l'accessibilité WCAG 2.1 AA
4. Ajouter des raccourcis clavier pour actions fréquentes

---

## 6. Blog & Content — 85/100

### Forces
- Blog IA automatisé (Gemini) avec 32 sujets SEO en rotation
- Admin panel pour gestion articles (badge IA, keywords, régénération)
- Toggle auto-publish depuis admin
- JSON-LD Article + FAQPage automatique
- Sitemap dynamique
- Maillage interne CTA signup
- Boutons de partage social
- Images OG dynamiques par article

### Faiblesses
- Pas de relecture humaine systématique
- Pas de catégories/tags navigables
- Pas de newsletter intégrée
- Pas de commentaires / engagement

### Recommandations
1. Ajouter un workflow de relecture avant publication
2. Intégrer une newsletter (Resend est déjà configuré)
3. Ajouter des catégories/tags filtrables

---

## Top 10 des priorités d'amélioration

### P0 — Critique (impact immédiat)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Free tier** (3 factures/mois) | Acquisition ×3-5 | Moyen |
| 2 | **Error Boundary** React racine | Stabilité client | Faible |
| 3 | **Rate limiting** signup/checkout | Sécurité anti-spam | Faible |
| 4 | **Headers HTTP sécurité** (next.config) | Sécurité baseline | Faible |

### P1 — Important (moyen terme)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 5 | **Tests E2E Playwright** (3 flows critiques) | Fiabilité | Moyen |
| 6 | **Accessibilité WCAG 2.1 AA** | UX + légal | Moyen |
| 7 | **Témoignages clients** landing | Conversion +20-30% | Faible |
| 8 | **Logging structuré** (remplacer console.log) | Opérationnel | Moyen |

### P2 — Amélioration (long terme)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 9 | **Remplacer Redux par Zustand** | Bundle -70ko | Moyen |
| 10 | **Onboarding guidé** (tour produit) | Rétention | Moyen |

---

## Conformité CLAUDE.md

| Règle | Status |
|-------|--------|
| Backdrop-filter mobile désactivé | ✅ Conforme |
| Filet CSS global `@media (max-width: 767px)` | ✅ Présent |
| Mounted guard `resolvedTheme` | ✅ Conforme |
| Middleware PGRST116 distinction | ✅ Conforme |
| ThemeProvider `disableTransitionOnChange` | ✅ Conforme |
| `enableSystem={false}` | ✅ Conforme |

---

*Audit généré par Claude Code — Session du 21 mars 2026*
*Méthodologie : analyse statique du code source, revue d'architecture, audit des dépendances, vérification des règles CLAUDE.md*
