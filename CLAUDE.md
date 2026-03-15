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
