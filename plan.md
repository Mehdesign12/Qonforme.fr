# Plan : Diversité des sujets + qualité des images blog IA

## Diagnostic

### Problème 1 — Aucune diversité de sujets (CRITIQUE)
**Cause racine** : `getNextTopic()` compare les slugs DB contre les slugs dérivés des titres `SEO_TOPICS`. Mais Gemini génère son **propre titre** (différent du sujet fourni), et le slug est en plus suffixé d'un timestamp. Résultat : la comparaison ne matche jamais → le système retourne **toujours le 1er sujet**.

Exemple :
- Sujet fourni : "Facturation électronique obligatoire 2026 : ce que les artisans doivent savoir"
- Titre Gemini : "Facturation Électronique 2026 : Le Guide Complet pour les Artisans et TPE"
- Slug DB : `facturation-electronique-2026-le-guide-complet-artisans-tpe-k9f2a`
- Slug attendu par `getNextTopic` : `facturation-electronique-obligatoire-2026-ce-que-les-artisans-doivent-savoir`
- → Jamais de match → toujours le même sujet

### Problème 2 — Imagen génère du texte charabia sur les images
Le prompt mentionne "Qonforme", le titre de l'article, et le code hex "#2563EB". Imagen 4.0 interprète ces éléments textuels et tente de les dessiner → résultat illisible ("Mandatire Electronuce", "#2563EB" en badge, etc.).

### Problème 3 — L'illustration ne remplit pas tout le cadre
Le prompt ne précise pas assez que le visuel doit être edge-to-edge sans marges.

---

## Modifications

### Étape 1 — Corriger la rotation des sujets

**Fichier** : `lib/ai/seo-topics.ts`
- Changer `getNextTopic(existingSlugs: string[])` → `getNextTopic(usedTopics: string[])`
- Comparer par **inclusion du sujet original** dans le champ `ai_prompt` stocké en DB (qui contient `"Sujet: {topic} | Mots-clés: ..."`)

**Fichiers** : `app/api/admin/blog/generate/route.ts` + `app/api/cron/generate-blog/route.ts`
- Fetch `ai_prompt` au lieu de `slug` depuis les posts existants
- Passer les `ai_prompt` à `getNextTopic()` pour matcher les sujets déjà couverts

### Étape 2 — Enrichir les sujets SEO

**Fichier** : `lib/ai/seo-topics.ts`
- Ajouter ~15 nouveaux sujets dans des catégories complémentaires (toujours en lien avec Qonforme) :
  - **Gestion d'entreprise** : tableaux de bord, suivi de CA, gestion administrative
  - **Comptabilité pratique** : rapprochement bancaire, bilan simplifié, charges déductibles
  - **Digital & productivité** : outils numériques artisan, gain de temps, paperasse zéro
  - **Réglementaire élargi** : RGPD pour TPE, assurances obligatoires artisan, URSSAF
  - **Cas d'usage / témoignages** : parcours type d'un artisan qui se numérise

### Étape 3 — Réécrire le prompt image (zéro texte + plein cadre)

**Fichier** : `lib/ai/gemini.ts`
- **Supprimer toute mention de nom de marque, titre d'article, et code hex** du prompt image — c'est exactement ce qu'Imagen tente de dessiner
- Insistance triple : "absolutely no text, no words, no letters, no numbers, no labels, no watermarks anywhere in the image"
- Ajout explicite : "full-bleed illustration filling the entire canvas edge-to-edge, no margins, no borders, no empty background"
- Style : "vector isometric illustration" avec palette bleue et blanche (sans code hex)
- Varier le sujet visuel selon la **catégorie** du topic

### Étape 4 — Passer la catégorie à `generateCoverImage`

**Fichier** : `lib/ai/gemini.ts`
- Nouveau paramètre `category` : `generateCoverImage(title, excerpt, category)`
- Mapping catégorie → éléments visuels :
  - `réglementation` → documents officiels, sceaux, balance juridique
  - `tutoriel` → écrans, étapes, flèches de workflow
  - `guide` → checklists, livres, loupe
  - `comparatif` → graphiques, barres de comparaison, balances
  - `pratique` → outils métier (marteau, clé, pinceau) + facture
  - `actualité` → calendrier, horloge, nouvelles
  - `gestion` → tableaux de bord, graphiques CA, calculatrice
  - `comptabilité` → livres de comptes, colonnes chiffres, bilan
  - `digital` → cloud, smartphone, connexions réseau
  - `cas-usage` → personnage artisan stylisé, atelier

**Fichiers** : routes admin + cron
- Passer la catégorie du topic sélectionné (ou `"guide"` par défaut pour les topics custom)

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `lib/ai/seo-topics.ts` | Fix rotation + ~15 nouveaux sujets |
| `lib/ai/gemini.ts` | Réécriture prompt image + paramètre catégorie |
| `app/api/admin/blog/generate/route.ts` | Fetch `ai_prompt` + passer catégorie |
| `app/api/cron/generate-blog/route.ts` | Fetch `ai_prompt` + passer catégorie |
