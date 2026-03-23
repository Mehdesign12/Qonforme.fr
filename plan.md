# Plan — Refonte démo : dark mode, fonctionnalités, mobile, navigation

## Contexte
La démo (`/demo/*`) a plusieurs problèmes :
- Couleurs cassées en dark mode (hex hardcodés au lieu de `dark:` variants)
- Impossible de créer factures/devis sur mobile (et partiellement sur desktop)
- Pas de prévisualisation PDF, pas de pages détail
- Aucun bouton pour revenir à la landing page

---

## 1. Fix dark mode sur toutes les pages démo

**Problème** : Les couleurs de statut (badges, filtres, textes, backgrounds de cards) sont en hex hardcodé (`#F1F5F9`, `#0F172A`, etc.) — illisibles en mode sombre.

**Fichiers à corriger (12 fichiers)** :
- `app/demo/invoices/page.tsx` — badges statut + filtres + textes
- `app/demo/quotes/page.tsx` — badges statut + textes
- `app/demo/purchase-orders/page.tsx` — badges statut + textes
- `app/demo/credit-notes/page.tsx` — badges statut + textes
- `app/demo/clients/page.tsx` — cards clients + textes
- `app/demo/products/page.tsx` — tableau produits + textes
- `app/demo/settings/page.tsx` — cards paramètres
- `app/demo/settings/ppf/page.tsx` — contenu PPF
- `components/demo/DemoRecentInvoices.tsx` — badges statut
- `components/demo/DemoDashboardStats.tsx` — textes KPI
- `components/demo/DemoRevenueChart.tsx` — textes graphique
- `components/demo/DemoTopClients.tsx` — textes classement

**Approche** : Remplacer les styles hardcodés par des classes Tailwind avec variantes `dark:` (ex: `bg-[#F1F5F9] dark:bg-[#1E3A5F]`, `text-[#0F172A] dark:text-[#E2E8F0]`). Aligner sur les couleurs du vrai dashboard.

---

## 2. Bouton retour vers la landing

**Problème** : Aucun moyen de quitter la démo et revenir à l'accueil.

**Action** :
- `DemoSidebar.tsx` — Ajouter un lien "Retour à l'accueil" (icône Home, lien vers `/`) en haut ou en bas de la sidebar
- `DemoHeader.tsx` — Ajouter un lien visible sur mobile aussi
- `DemoMobileBottomNav` — Optionnel : remplacer un onglet ou ajouter dans le menu drawer

---

## 3. Pages détail mock (factures + devis)

**Problème** : Cliquer sur une facture/devis dans la liste ne mène nulle part. Pas de page détail.

**Action** :
- `app/demo/invoices/[id]/page.tsx` — Page détail facture mock (affiche données fictives, boutons PDF/envoyer/statut en UI-only avec toast "Créez un compte pour cette fonctionnalité")
- `app/demo/quotes/[id]/page.tsx` — Page détail devis mock (même pattern)
- Rendre les lignes cliquables dans les listes existantes (lien vers `/demo/invoices/{id}`)

---

## 4. Formulaire de création devis

**Problème** : Pas de formulaire devis en démo. Le lien "Nouveau devis" n'a pas de page.

**Action** :
- `app/demo/quotes/new/page.tsx` — Créer page avec `DemoQuoteForm`
- `components/demo/DemoQuoteForm.tsx` — Formulaire mock (même pattern que `DemoInvoiceForm` : clients fictifs, lignes, calcul TVA, boutons aperçu/envoyer en UI-only)

---

## 5. Prévisualisation PDF de test

**Problème** : Aucun moyen de voir un PDF dans la démo.

**Action** :
- Ajouter un PDF statique d'exemple dans `public/demo/` (ex: `exemple-facture.pdf`)
- Bouton "Voir un exemple PDF" sur la page détail facture mock → ouvre le PDF dans un nouvel onglet

---

## 6. Vérification mobile globale

**Action** : Passe finale sur toutes les pages corrigées :
- Formulaires scrollables et bien spacés
- Boutons assez grands pour le tactile (min 44px)
- Cards empilées verticalement sur mobile
- Pas de débordement horizontal
- Dark mode correct sur mobile aussi

---

## Ordre d'exécution

1. **Dark mode** (12 fichiers) — le plus visible, le plus impactant
2. **Bouton retour landing** — rapide, important UX
3. **Pages détail mock** (factures + devis) — navigation fonctionnelle
4. **Formulaire devis** — fonctionnalité manquante
5. **PDF de test** — aperçu visuel
6. **Passe mobile** — vérification finale responsive
