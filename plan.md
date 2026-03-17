# Plan — Blog automatisé IA (Gemini)

## Contexte

L'infrastructure blog est déjà en place :
- Table `blog_posts` (slug, title, excerpt, content, cover_url, is_published, published_at)
- Admin : CRUD complet (list, create, edit, delete, publish/unpublish)
- Public : `/blog` (listing) + `/blog/[slug]` (article avec Markdown → HTML)
- Cron auth pattern : Bearer `CRON_SECRET` (utilisé par les relances)
- Markdown parser : `lib/markdown.ts`

## Architecture cible

### 1. Migration Supabase — Nouvelles colonnes `blog_posts`

Ajouter des colonnes pour traquer la génération IA :

```sql
ALTER TABLE blog_posts ADD COLUMN ai_generated    boolean DEFAULT false;
ALTER TABLE blog_posts ADD COLUMN ai_model        text;           -- ex: "gemini-2.0-flash"
ALTER TABLE blog_posts ADD COLUMN ai_prompt       text;           -- prompt utilisé
ALTER TABLE blog_posts ADD COLUMN ai_keywords     text[];         -- mots-clés SEO ciblés
ALTER TABLE blog_posts ADD COLUMN auto_publish     boolean DEFAULT false; -- publié auto par cron
```

Pas de nouvelle table — on enrichit `blog_posts` directement.

### 2. Variables d'environnement

```bash
# .env / .env.example
GEMINI_API_KEY=...                    # Clé API Google AI Studio
BLOG_AUTO_PUBLISH=false               # true = publication auto, false = brouillon
```

### 3. Lib Gemini — `lib/ai/gemini.ts`

Module centralisé pour l'appel à l'API Gemini :

- **`generateBlogPost(topic, keywords)`** → `{ title, slug, excerpt, content, keywords }`
  - System prompt SEO expert francophone (facturation électronique, TPE, artisans)
  - Instructions : titre accrocheur, H2/H3 structurés, 1500-2500 mots, mots-clés naturels, FAQ en fin d'article, conclusion avec CTA
  - Modèle : `gemini-2.0-flash` (rapide, bon marché, suffisant pour du contenu)

- **`generateCoverImage(title, excerpt)`** → `Buffer` (image PNG)
  - Utilise Gemini Imagen (génération d'images) ou un prompt Gemini pour décrire une image + génération via l'API
  - Image 1200x630 (format OG)
  - Upload vers Supabase Storage bucket `blog-covers`
  - Retourne l'URL publique

### 4. Lib SEO — `lib/ai/seo-topics.ts`

Liste de thématiques et mots-clés pour la rotation quotidienne :

```typescript
export const SEO_TOPICS = [
  {
    topic: "Facturation électronique obligatoire 2026",
    keywords: ["facturation électronique 2026", "obligation facturation", "TPE artisan"],
    category: "réglementation"
  },
  {
    topic: "Comment créer une facture Factur-X conforme",
    keywords: ["factur-x", "EN 16931", "facture conforme"],
    category: "tutoriel"
  },
  // ... 30-50 sujets en rotation
]

export function getNextTopic(existingSlugs: string[]): Topic | null
// Sélectionne un sujet pas encore traité, ou une variation si tous couverts
```

### 5. Endpoint Cron — `app/api/cron/generate-blog/route.ts`

```
GET /api/cron/generate-blog
Auth: Authorization: Bearer {CRON_SECRET}
```

Logique :
1. Auth Bearer `CRON_SECRET` (pattern existant)
2. Récupère les slugs existants (éviter les doublons)
3. Sélectionne le prochain sujet via `getNextTopic()`
4. Appelle `generateBlogPost()` → titre, slug, excerpt, contenu Markdown
5. Appelle `generateCoverImage()` → upload Supabase Storage → URL
6. Insert dans `blog_posts` avec `ai_generated: true`, `ai_model`, `ai_prompt`, `ai_keywords`
7. Si `BLOG_AUTO_PUBLISH=true` → `is_published: true`, `published_at: now()`
8. Sinon → `is_published: false` (brouillon, review admin)
9. Log dans `cron_logs` (succès/erreur, durée, tokens utilisés)
10. Retourne JSON avec résultat

### 6. Admin — Page de gestion IA blog — `app/admin/(panel)/blog/ai/page.tsx`

Nouvelle page dans l'admin `/admin/blog/ai` avec :

**Section 1 — Contrôles**
- Toggle ON/OFF publication automatique (met à jour un setting en base ou env)
- Bouton "Générer un article maintenant" (appel API manuel)
- Sélecteur de sujet (dropdown des topics disponibles) ou champ libre
- Champ mots-clés SEO personnalisés

**Section 2 — Historique des générations**
- Tableau des articles générés par l'IA (filtre `ai_generated = true`)
- Colonnes : date, titre, mots-clés, statut (brouillon/publié), modèle, actions
- Bouton "Voir" → ouvre l'éditeur existant
- Bouton "Publier" / "Dépublier" rapide
- Bouton "Régénérer" → relance la génération sur le même sujet

**Section 3 — Statistiques**
- Nombre total d'articles IA générés
- Articles publiés vs brouillons
- Dernier article généré (date + titre)

### 7. Admin API — `app/api/admin/blog/generate/route.ts`

```
POST /api/admin/blog/generate
Auth: Admin cookie (isAdminAuthenticated)
Body: { topic?: string, keywords?: string[], auto_publish?: boolean }
```

- Même logique que le cron, mais déclenché manuellement depuis l'admin
- Accepte un sujet personnalisé ou utilise `getNextTopic()`
- Retourne l'article généré pour preview immédiat

### 8. Mise à jour BlogEditor

Ajouter dans l'éditeur existant :
- Badge "Généré par IA" si `ai_generated = true`
- Affichage des mots-clés SEO (`ai_keywords`) sous forme de tags
- Bouton "Régénérer avec l'IA" (appelle l'API de génération avec le même sujet)

### 9. Mise à jour AdminSidebar

- Sous-menu Blog : "Articles" + "Génération IA"
- Ou lien direct "Blog IA" dans la sidebar

### 10. Supabase Storage — Bucket `blog-covers`

- Créer le bucket `blog-covers` (public read)
- Upload des images générées par Gemini
- URL pattern : `https://{project}.supabase.co/storage/v1/object/public/blog-covers/{slug}.png`

### 11. Sitemap dynamique

Modifier `app/sitemap.ts` pour inclure dynamiquement les articles publiés :

```typescript
// Fetch tous les slugs publiés
const { data: posts } = await supabase
  .from('blog_posts')
  .select('slug, updated_at')
  .eq('is_published', true)

// Ajouter chaque article au sitemap
posts.forEach(post => sitemap.push({
  url: `${baseUrl}/blog/${post.slug}`,
  lastModified: new Date(post.updated_at),
  changeFrequency: 'monthly',
  priority: 0.7,
}))
```

## Ordre d'implémentation

| Étape | Quoi | Dépendance |
|-------|------|------------|
| 1 | Migration Supabase (nouvelles colonnes) | — |
| 2 | `.env.example` + `GEMINI_API_KEY` | — |
| 3 | `lib/ai/gemini.ts` (génération texte + image) | Étape 2 |
| 4 | `lib/ai/seo-topics.ts` (liste sujets + rotation) | — |
| 5 | `app/api/cron/generate-blog/route.ts` (cron endpoint) | Étapes 3, 4 |
| 6 | `app/api/admin/blog/generate/route.ts` (trigger manuel) | Étape 3 |
| 7 | `app/admin/(panel)/blog/ai/page.tsx` (UI admin) | Étape 6 |
| 8 | Mise à jour `BlogEditor` (badge IA, keywords, régénérer) | Étape 3 |
| 9 | Mise à jour `AdminSidebar` (lien Blog IA) | — |
| 10 | Sitemap dynamique | — |
| 11 | Bucket Supabase Storage `blog-covers` | — |
| 12 | Configurer cron-job.org (1x/jour) | Étape 5 |

## Fichiers à créer

- `supabase/migrations/20260317_blog_ai_columns.sql`
- `lib/ai/gemini.ts`
- `lib/ai/seo-topics.ts`
- `app/api/cron/generate-blog/route.ts`
- `app/api/admin/blog/generate/route.ts`
- `app/admin/(panel)/blog/ai/page.tsx`

## Fichiers à modifier

- `.env.example` — ajouter `GEMINI_API_KEY`, `BLOG_AUTO_PUBLISH`
- `app/sitemap.ts` — articles blog dynamiques
- `components/admin/BlogEditor.tsx` — badge IA, keywords, bouton régénérer
- `components/admin/AdminSidebar.tsx` — lien Blog IA
