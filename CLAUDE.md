# CLAUDE.md — Règles et pièges connus pour Qonforme

Ce fichier est lu automatiquement par Claude Code à chaque session.
Il documente les décisions architecturales critiques et les bugs résolus à ne jamais réintroduire.

---

## 🚨 RÈGLE ABSOLUE — Backdrop-filter sur mobile iOS Safari

### Le bug
`backdrop-filter: blur()` combiné avec `will-change: transform` sur les éléments
du header provoque un **crash GPU en boucle infinie sur iOS Safari** lors du
changement de thème (dark/light).

Mécanisme :
1. Le changement de thème force le GPU à re-capturer et re-flouter le fond derrière chaque pilule
2. Les couches GPU séparées (`will-change`) saturent la mémoire mobile
3. Safari tue le process web → rechargement de la page
4. Le script inline de `next-themes` réapplique `class="dark"` → même crash → boucle

### La règle
**NE JAMAIS appliquer `backdrop-filter: blur()` + `will-change: transform` sur mobile.**

Pattern correct (voir `globals.css` et `Header.tsx`) :
```css
.header-pill-glass {
  /* Mobile : fond solide, PAS de backdrop-filter */
  backdrop-filter: none !important;
  will-change: auto !important;
  transform: none !important;
}

@media (min-width: 768px) {
  .header-pill-glass {
    /* Desktop uniquement : glass complet */
    backdrop-filter: blur(8px) !important;
    will-change: transform !important;
    transform: translateZ(0) !important;
  }
}
```

Tout nouvel élément avec `backdrop-filter` doit utiliser ce pattern ou une media query équivalente.

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
