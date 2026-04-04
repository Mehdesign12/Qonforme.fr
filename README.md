# Qonforme.fr

> **SaaS de facturation électronique** ultra-simple pour artisans, micro-entrepreneurs et TPE (< 10 salariés), conforme à la réglementation française 2026/2027.

**Promesse centrale** : *"En 3 clics, tu crées ta facture. On s'occupe de tout le reste — transmission légale, archivage, statuts. Tu n'as pas à savoir ce qu'est une PDP."*

---

## Contexte légal

| Date | Obligation |
|------|-----------|
| 1er septembre 2026 | Toutes les entreprises assujetties à la TVA doivent pouvoir **recevoir** des factures électroniques |
| 1er septembre 2027 | Les TPE et artisans doivent également **émettre** leurs factures en format électronique |

- Format obligatoire : **Factur-X** (PDF/A-3 hybride contenant un fichier XML normé CII ou UBL)
- Qonforme **n'est pas une PDP** — elle génère le Factur-X certifié EN 16931 et fournit un guide pas-à-pas pour la transmission manuelle via Chorus Pro (B2G) ou toute Plateforme Agréée, sans agrément requis

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14.2.x (App Router) |
| Styles | Tailwind CSS + Base UI |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage) |
| Paiements | Stripe Billing (checkout + webhooks opérationnels) |
| Déploiement | Vercel |
| Transmission PPF | Guide pas-à-pas Chorus Pro / PA agréées (transmission manuelle par l'utilisateur) |
| Format facture | Factur-X XML EN 16931 (générateur prêt) |
| Email | Resend |
| PDF | pdf-lib (génération server-side) |

---

## Plans tarifaires

### Plan Starter — 9 €/mois HT (90 €/an)
- 10 factures par mois
- Devis illimités
- Bons de commande & avoirs
- Factur-X EN 16931 généré automatiquement
- **Guide de transmission PPF inclus** (Chorus Pro, IOPOLE, 137 PA agréées)
- Archivage légal 10 ans
- Support email 48h

### Plan Pro — 19 €/mois HT (190 €/an)
- Factures illimitées
- Devis illimités
- Bons de commande & avoirs
- Factur-X EN 16931 généré automatiquement
- **Guide de transmission + suivi simplifié**
- Relances automatiques (J+30, J+45)
- Tableau de bord CA 12 mois
- Support email 24h

### Règles communes
- Accès immédiat — résiliation à tout moment
- Option annuelle : 2 mois offerts (–16,7 %)
- Pas de plan gratuit permanent

---

## État actuel du projet (Mars 2026)

### ✅ Infrastructure & Auth
- [x] Authentification Supabase (email/mot de passe)
- [x] Inscription 2 étapes : compte → infos entreprise
- [x] Connexion / déconnexion
- [x] Middleware de protection des routes
- [x] Layout responsive (sidebar + header + hamburger mobile)
- [x] Page d'accueil marketing (hero, features, pricing, footer)
- [x] Démo interactive `/demo` avec données fictives
- [x] Mot de passe oublié / reset (email Resend, token Admin Supabase, lien 1h)
- [ ] Connexion OAuth Google

### ✅ Gestion des clients
- [x] Liste clients avec recherche + archivage
- [x] Fiche client détaillée
- [x] Création / édition client
- [x] Lookup SIREN automatique via API INSEE Sirene
- [x] Validation SIREN, email, champs obligatoires
- [x] Historique factures/devis/avoirs par client (onglets dans la fiche client)
- [ ] Import clients CSV

### ✅ Facturation — Factures
- [x] Liste avec filtres par statut (brouillon, envoyée, payée, retard, archivée)
- [x] Création facture (client, lignes, HT/TVA/TTC auto, numérotation séquentielle)
- [x] Édition facture (brouillon uniquement)
- [x] Détail facture complet
- [x] Génération PDF (avec logo, couleur accent, mentions légales)
- [x] Envoi email client (Resend, PDF en pièce jointe + copie émetteur)
- [x] Archivage factures
- [x] Statuts : brouillon → envoyée → payée / en retard / archivée
- [x] Guide de transmission PPF (page `/settings/ppf` — 4 étapes, Chorus Pro / IOPOLE / 137 PA)
- [ ] Aperçu PDF inline (avant envoi)
- [ ] Paiement en ligne (lien Stripe sur la facture)
- [x] Relances automatiques J+30/J+45 (cron-job.org → `GET /api/cron/send-reminders`)

### ✅ Facturation — Devis
- [x] Liste avec filtres par statut
- [x] Création / édition devis
- [x] Détail devis complet
- [x] Génération PDF
- [x] Envoi email client
- [x] Conversion devis → facture en 1 clic
- [x] Statuts : brouillon → envoyé → accepté / refusé → converti

### ✅ Facturation — Bons de commande
- [x] Liste avec filtres par statut
- [x] Création / édition BdC
- [x] Détail BdC complet
- [x] Génération PDF
- [x] Envoi email client
- [x] Statuts : brouillon → envoyé → confirmé → livré / annulé

### ✅ Avoirs
- [x] Création d'avoir depuis une facture (avec motif + lignes)
- [x] Liste avoirs
- [x] Détail avoir complet
- [x] Génération PDF
- [x] Envoi email client
- [ ] Avoir partiel (sélection de lignes)

### ✅ Catalogue Produits
- [x] Création / édition produit (nom, description, référence, prix HT, TVA, unité)
- [x] Activation / désactivation
- [x] Recherche dans le catalogue
- [x] Combobox produits intégrée dans les formulaires devis / facture / BdC

### ✅ Tableau de bord
- [x] CA mois courant vs mois précédent (avec % évolution)
- [x] Nombre de factures émises ce mois
- [x] Montant en attente de paiement
- [x] Montant en retard
- [x] Tableau des 5 dernières factures
- [x] Bannière statut connexion PPF
- [x] Graphique CA mensuel sur 12 mois
- [x] Taux de recouvrement (KPI dashboard)
- [x] Top 5 clients par CA (dashboard)

### ✅ Paramètres
- [x] Infos entreprise (nom, SIREN, SIRET, TVA, adresse, email, IBAN, logo)
- [x] Préférences factures (couleur accent, logo, mention légale, préfixe numérotation)
- [x] Page PPF/Chorus Pro — guide 4 étapes complet (`/settings/ppf`)
- [ ] Notifications *(supprimé du menu — à réimplémenter plus tard)*
- [x] Billing / Abonnement (Stripe checkout + webhooks + page `/settings/billing`)

### ✅ Technique
- [x] Génération PDF factures, devis, BdC, avoirs (shared lib, logo, couleur, mentions)
- [x] Envoi email Resend (templates HTML, PDF joint, copie émetteur)
- [x] Générateur XML Factur-X EN 16931/EXTENDED (bouton téléchargement sur chaque facture)
- [x] Numérotation automatique robuste (séquentielle, par utilisateur/année)
- [x] Responsive mobile-first complet (toutes les pages)

---

## Roadmap — Ce qui reste à faire

### ✅ Priorité 1 — Conversion & rétention (fait)

| # | Quoi | Statut |
|---|------|--------|
| P1-1 | **Stripe Billing** | ✅ Checkout + webhooks + limites Starter/Pro opérationnels |
| P1-2 | **Mot de passe oublié** | ✅ Pages request + reset + email Resend |
| P1-5 | **Factur-X + Guide PPF** | ✅ Génération Factur-X EN 16931 + guide 4 étapes `/settings/ppf` |

### 🔴 Priorité 1 — Restant critique

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P1-3 | **Email de bienvenue** | ✅ Envoyé après signup, template HTML complet | Réduit churn J1 |
| P1-4 | **Onboarding guidé** | 3 étapes : logo → 1er client → 1ère facture (progress bar) | 40-60% drop sans ça |

### 🟠 Priorité 2 — Valeur perçue & différenciation

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P2-1 | **Relances automatiques** | Cron J+30/J+45, email au client, log dans la facture | ✅ Opérationnel (cron-job.org) |
| P2-2 | **Dashboard CA étendu** | Graphique 12 mois, taux recouvrement, top clients | ✅ Opérationnel |
| P2-3 | **Export comptable** | ✅ FEC opérationnel (`/settings/exports` + API `/api/export/fec`) | Besoin N°1 des TPE |
| P2-4 | **Notifications email** | Facture vue / acceptée / retard — via webhook PPF | Promis dans settings |
| P2-5 | **Page de paiement publique** | Lien Stripe sur la facture, paiement en ligne client | Réduit délai paiement |
| P2-6 | **Historique par client** | Liste factures / devis / BdC dans la fiche client | ✅ Opérationnel |

### 🟡 Priorité 3 — Finition & polish

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P3-1 | **Pagination** | Listes factures, devis, clients (cursor-based) | Perf > 50 entrées |
| P3-2 | **Modals de confirmation** | Remplacer `window.confirm()` par modal custom | Polish UX |
| P3-3 | **Empty states avec CTA** | Illustration + bouton créer sur listes vides | Conversion |
| P3-4 | **Aperçu PDF inline** | Modale prévisualisation avant envoi | Réassurance |
| P3-5 | **Favicon + meta OG** | ✅ OG dynamiques (ImageResponse edge) + favicon complet | Branding |
| P3-6 | **CGU / Mentions légales** | Pages `/cgu` et `/mentions-legales` | ✅ Opérationnel |
| P3-7 | **Page 404 custom** | Page not found avec retour accueil | UX |
| P3-8 | **Connexion OAuth Google** | Via Supabase Auth | Friction signup |

### 🔵 SEO & Contenu — Blog automatisé

| # | Quoi | Statut | Détail |
|---|------|--------|--------|
| SEO-1 | **Audit technique SEO (15 items)** | ✅ 15/15 terminé | robots.ts, sitemap.ts, JSON-LD, canonical, meta, images `sizes`, fonts swap, hreflang, OG dynamiques |
| SEO-2 | **Page `/confidentialite`** | ✅ Opérationnel | Politique RGPD complète (12 articles), sitemap, OG dynamique |
| SEO-3 | **Blog public** | ✅ Opérationnel | Listing `/blog` + article `/blog/[slug]`, parser Markdown, CTA signup, OG dynamiques par article |
| SEO-4 | **Blog automatisé IA** | ✅ Opérationnel | Cron job quotidien + Gemini (texte + images), 32 sujets SEO rotation, admin `/admin/blog/ai`, BlogEditor (badge IA+keywords+régénérer) |
| SEO-5 | **Articles seed (rédaction manuelle)** | 🔜 À faire | 4 articles fondateurs à rédiger pour amorcer l'indexation Google |
| SEO-6 | **Google Search Console** | ✅ Fait | Sitemap `sitemap.xml` soumis, meta vérification via `NEXT_PUBLIC_GSC_VERIFICATION`, indexation demandée sur pages prioritaires |
| SEO-7 | **Schema FAQ enrichi (blog)** | ✅ Fait | JSON-LD `FAQPage` auto-extrait des H2/H3 en `?` + schema `Article` sur chaque page blog |
| SEO-8 | **Maillage interne** | ✅ Fait | Liens croisés blog ↔ landing ↔ pricing ↔ démo sur 6 fichiers (headers, CTA, section "Aller plus loin") |
| SEO-9 | **Page `/glossaire`** | 🔜 À faire | Définitions : Factur-X, PDP, EN 16931, Chorus Pro, CII, UBL… — capte les recherches informationnelles |

#### Articles seed — Sujets prévus

> 4 articles à rédiger manuellement pour amorcer l'indexation avant la mise en place du blog automatisé.

1. **"Facturation électronique 2026 : ce qui change pour les TPE et artisans"** — mot-clé principal : *facturation électronique 2026*
2. **"Comment créer une facture Factur-X conforme EN 16931"** — mot-clé : *facture factur-x*
3. **"Guide Chorus Pro : transmettre sa première facture en 5 minutes"** — mot-clé : *chorus pro facture*
4. **"Factur-X vs PDF classique : pourquoi vous devez changer avant septembre 2026"** — mot-clé : *factur-x pdf*

#### Blog automatisé — Architecture prévue

Le blog sera alimenté automatiquement par un cron job quotidien :

- **Cron** : endpoint API appelé 1x/jour (via cron-job.org)
- **Génération texte** : Google Gemini — rédaction d'articles SEO-optimisés (facturation, conformité, Factur-X, Chorus Pro, réglementation 2026, conseils TPE/artisans)
- **Génération images** : Google Gemini — image de couverture par article
- **Publication** : insertion directe dans la table `blog_posts` (slug, titre, excerpt, contenu Markdown, cover_url, `is_published: true`)
- **SEO** : chaque article obtient automatiquement ses metadata (title, description, canonical, OG dynamique via `/api/og`)
- **Objectif** : 1 article/jour, indexation continue, longue traîne SEO sur les mots-clés facturation électronique / conformité / artisans

### 🛠️ Outils Gratuits SEO — Acquisition organique

> 12 outils interactifs gratuits pour capter du trafic SEO qualifié et convertir vers l'inscription.
> Chaque outil a : metadata SEO, JSON-LD, OG dynamique, FAQ, CTA contextuel, maillage interne.
> Route hub : `/outils` — Routes outils : `/outils/[slug]`

#### Sprint 1 — Priorité HAUTE (fort volume de recherche)

| # | Outil | Route | Statut |
|---|-------|-------|--------|
| OG-1 | **Calculateur TVA HT ↔ TTC** | `/outils/calculateur-tva` | ✅ Fait |
| OG-2 | **Simulateur charges auto-entrepreneur** | `/outils/simulateur-charges-auto-entrepreneur` | ✅ Fait |
| OG-3 | **Vérificateur SIREN/SIRET** | `/outils/verification-siret` | ✅ Fait |
| OG-4 | **Générateur de facture gratuit (PDF bridé)** | `/outils/generateur-facture-gratuite` | ✅ Fait |

#### Sprint 2 — Priorité MOYENNE (niche, forte intention)

| # | Outil | Route | Statut |
|---|-------|-------|--------|
| OG-5 | **Générateur de devis gratuit (PDF bridé)** | `/outils/generateur-devis-gratuit` | ✅ Fait |
| OG-6 | **Calculateur pénalités de retard** | `/outils/calculateur-penalites-retard` | ✅ Fait |
| OG-7 | **Vérificateur mentions obligatoires facture** | `/outils/verificateur-mentions-facture` | ✅ Fait |
| OG-8 | **Vérificateur de conformité facture** | `/outils/verificateur-conformite-facture` | ✅ Fait |

#### Sprint 3 — Priorité BASSE (différenciation, backlinks)

| # | Outil | Route | Statut |
|---|-------|-------|--------|
| OG-9 | **Simulateur seuil TVA auto-entrepreneur** | `/outils/simulateur-seuil-tva` | ✅ Fait |
| OG-10 | **Simulateur revenus net auto-entrepreneur** | `/outils/simulateur-revenu-net` | ✅ Fait |
| OG-11 | **Générateur de numéro de facture** | `/outils/generateur-numero-facture` | ✅ Fait |
| OG-12 | **Générateur de conditions de paiement** | `/outils/generateur-conditions-paiement` | ✅ Fait |

#### Stratégie de conversion

```
Google → Outil gratuit (valeur immédiate, 0 friction)
       → CTA contextuel ("Automatisez tout ça avec Qonforme →")
       → /signup ou /demo
```

#### Architecture fichiers

```
app/outils/
├── page.tsx                                        # Hub listing tous les outils
├── layout.tsx                                      # Layout commun (CTA sticky)
├── calculateur-tva/page.tsx                        # OG-1
├── simulateur-charges-auto-entrepreneur/page.tsx   # OG-2
├── verification-siret/page.tsx                     # OG-3
├── generateur-facture-gratuite/page.tsx            # OG-4
├── generateur-devis-gratuit/page.tsx               # OG-5
├── calculateur-penalites-retard/page.tsx           # OG-6
├── verificateur-mentions-facture/page.tsx          # OG-7
├── verificateur-conformite-facture/page.tsx        # OG-8
├── simulateur-seuil-tva/page.tsx                   # OG-9
├── simulateur-revenu-net/page.tsx                  # OG-10
├── generateur-numero-facture/page.tsx              # OG-11
└── generateur-conditions-paiement/page.tsx         # OG-12

lib/outils/
├── tva.ts          # Logique calcul TVA (5.5%, 10%, 20%)
├── charges.ts      # Barèmes URSSAF 2026
├── penalites.ts    # Calcul intérêts de retard (BCE + 10 points)
├── seuil-tva.ts    # Seuils franchise TVA
└── facture-pdf.ts  # Génération PDF basique (pdf-lib)
```

### 🟢 Priorité 4 — Croissance (V2)

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P4-1 | **Import clients CSV** | Upload + mapping colonnes | Adoption |
| P4-2 | **Parrainage / referral** | Code promo, mois offert | CAC réduit |
| P4-3 | **Multi-utilisateurs** | Invit collaborateur, rôles | SARL/SAS |
| P4-4 | **API publique** | REST API documentée pour intégrations | Écosystème |
| P4-5 | **Connexion PDP agréée** | Yooz, Quadient, Chorus Pro direct | Grandes entreprises |
| P4-6 | **Application mobile** | PWA ou React Native | Artisans terrain |

---

## Structure des pages (routes Next.js)

```
/                          → Landing page (publique)
/login                     → Connexion
/signup                    → Inscription étape 1
/signup/company            → Inscription étape 2 (infos entreprise)
/forgot-password           → Demande de réinitialisation mdp
/reset-password            → Formulaire nouveau mdp (lien email)
/demo                      → Démo interactive (données fictives)

/dashboard                 → Tableau de bord (protégé)

/clients                   → Liste des clients
/clients/new               → Créer un client
/clients/[id]              → Fiche client

/invoices                  → Liste des factures
/invoices/new              → Créer une facture
/invoices/[id]             → Détail facture
/invoices/[id]/edit        → Modifier une facture

/quotes                    → Liste des devis
/quotes/new                → Créer un devis
/quotes/[id]               → Détail devis
/quotes/[id]/edit          → Modifier un devis

/purchase-orders           → Liste des bons de commande
/purchase-orders/new       → Créer un BdC
/purchase-orders/[id]      → Détail BdC
/purchase-orders/[id]/edit → Modifier un BdC

/credit-notes              → Liste des avoirs
/credit-notes/[id]         → Détail avoir

/products                  → Catalogue produits

/settings                  → Paramètres (index)
/settings/company          → Infos entreprise
/settings/invoices         → Préférences factures
/settings/ppf              → Connexion PPF/Chorus Pro
/settings/notifications    → Notifications (retiré du menu, à réimplémenter)
/settings/billing          → Abonnement & facturation (placeholder)
```

---

## Design & UI

### Principes
- Interface **mobile-first**, utilisable sur tous les navigateurs
- Simplicité radicale : l'artisan ne doit pas avoir à comprendre la réglementation
- Vocabulaire PPF/PDP/Factur-X **jamais visible** dans l'interface utilisateur
- Chaque action principale doit être accessible en **moins de 3 clics**

---

### 🎨 Système de design Qonforme — Référence complète

> Ce système de design est issu de la landing page et **doit être appliqué uniformément à toute l'interface app** (dashboard, listes, formulaires, settings, pages auth).

#### Palette de couleurs
| Rôle | Couleur | Usage |
|------|---------|-------|
| Primaire | `#2563EB` | CTA principaux, liens actifs, accents, icônes clés |
| Primaire hover | `#1D4ED8` | Survol des boutons bleus |
| Fond page | `#F8FAFC` | Arrière-plan général de l'app |
| Fond card | `#FFFFFF` | Cards, modales, panels |
| Texte titre | `#0F172A` | H1, H2, labels forts |
| Texte corps | `#475569` | Paragraphes, descriptions |
| Texte discret | `#94A3B8` | Métadonnées, timestamps, hints |
| Bordure | `#E2E8F0` | Séparateurs, outlines de cards |
| Fond pill/badge | `#EFF6FF` | Background des pills de label et états actifs nav |
| Bordure pill | `#BFDBFE` | Bordure des pills de label |
| Succès fond | `#D1FAE5` | Badges payé, accepté |
| Succès texte | `#065F46` | |
| Succès icône | `#10B981` | Icônes de validation |
| Erreur fond | `#FEE2E2` | Badges rejeté, en retard |
| Erreur texte | `#991B1B` | |
| Attente fond | `#FEF3C7` | Badges en attente, brouillon |
| Attente texte | `#92400E` | |
| Navy foncé | `#0F172A` | Bannières sombres, footer |

#### Typographie
| Usage | Police | Poids | Taille |
|-------|--------|-------|--------|
| Titres de section (H2) | **Bricolage Grotesque** (`var(--font-bricolage)`) | 800 (extrabold) | 30–36 px |
| Titres de page app (H1) | DM Sans | 600 (semibold) | 18–20 px |
| Corps, labels | DM Sans | 400–500 | 13–15 px |
| Montants, codes | DM Mono | 600–700 | selon contexte |

> ⚠️ La police **Bricolage Grotesque** est réservée aux titres de section landing. Dans l'app, utiliser **DM Sans** pour tous les titres.

#### Composant — Pill de label de section
Utilisé au-dessus de chaque titre de section pour identifier la thématique.
```tsx
<span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[13px] font-medium text-[#2563EB]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
  LABEL
</span>
```

#### Composant — Bouton primaire (ShimmerButton)
Utilisé pour les CTA principaux (créer, envoyer, valider).
```tsx
<ShimmerButton
  background="rgba(37,99,235,1)"
  shimmerColor="#ffffff"
  shimmerDuration="2.5s"
  borderRadius="10px"
  className="h-10 px-5 text-sm font-semibold gap-2"
>
  Action <ArrowRight className="h-3.5 w-3.5" />
</ShimmerButton>
```
> Dans l'app, le bouton primaire peut aussi être `<button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold">` si ShimmerButton est trop lourd.

#### Composant — Card standard
```tsx
<div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
  {/* contenu */}
</div>
```

#### Composant — Card KPI (dashboard)
```tsx
<div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
  <p className="text-[12px] font-medium uppercase tracking-wide text-slate-400">Label</p>
  <p className="mt-1 font-mono text-2xl font-extrabold text-[#0F172A]">0 €</p>
  <p className="mt-1 text-[12px] text-slate-400">Sous-information</p>
</div>
```

#### Composant — Lien de navigation actif (sidebar)
```tsx
className="bg-[#EFF6FF] text-[#2563EB]"   // actif
className="text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"  // inactif
```

#### Composant — Input / Champ de formulaire
```tsx
className="w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-3 text-sm text-[#0F172A]
           placeholder-slate-400 outline-none transition-all
           focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
```

#### Filigrane Q (branding)
Le picto Q (`PICTO_Q`) s'utilise en filigrane sur certaines zones selon ce tableau :

| Zone | Taille | Opacité | Position |
|------|--------|---------|----------|
| Dashboard (grid KPI) | 200 px | 3,5 % | centré dans la grille |
| Sidebar | 140 px | 6 % | bas-gauche, débordant |
| Card billing (plan actif) | 160 px | 6 % | bas-droite de la card |
| Auth / Pricing (fond centré) | 520–700 px | 5,5 % | centré dans le fond, responsive |
| Auth / Pricing (coin desktop) | 280 px | 7 % | bas-droite, `hidden lg:block` |
| Sections landing | 420–500 px | 4–8 % | centré ou coin |
| Footer | 600 px | 3 % | centré |

```tsx
// Pattern standard
<div aria-hidden className="pointer-events-none absolute [position] select-none z-0" style={{ opacity: 0.06 }}>
  <Image src={PICTO_Q} alt="" width={160} height={160} unoptimized />
</div>
```
> Règles absolues : `pointer-events: none`, `z-index` en dessous du contenu, jamais dans les PDFs générés.

#### URLs des assets
```
LOGO_LONG_BLEU = https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp
PICTO_Q        = https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp
```

#### Shadows
| Usage | Valeur |
|-------|--------|
| Card standard | `shadow-sm` (Tailwind) |
| Card élevée | `shadow-[0_4px_24px_rgba(0,0,0,0.07)]` |
| Card Pro (glow bleu) | `box-shadow: 0 0 40px rgba(37,99,235,0.15)` |
| Bouton bleu | `shadow-[0_4px_14px_rgba(37,99,235,0.35)]` |
| Focus input | `0 0 0 3px rgba(37,99,235,0.1)` |

#### Composant — Fond dégradé Auth (pages login, signup, reset, pricing)
Utilisé sur toutes les pages hors-app (auth + pricing). Composant centralisé dans `components/auth/AuthLayout.tsx`.

Le fond se compose de **5 couches superposées** (toutes `pointer-events-none`, `z-0`) :

```tsx
{/* Couche 1 — Dégradé linéaire de base */}
<div aria-hidden className="pointer-events-none select-none absolute inset-0 z-0" style={{
  background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)"
}} />

{/* Couche 2 — Glow radial haut-gauche (bleu primaire) */}
<div aria-hidden className="pointer-events-none select-none absolute -top-32 -left-32 z-0 w-[480px] h-[480px] rounded-full" style={{
  background: "radial-gradient(circle at center, rgba(37,99,235,0.13) 0%, rgba(37,99,235,0.04) 55%, transparent 75%)"
}} />

{/* Couche 3 — Glow radial bas-droite (indigo) */}
<div aria-hidden className="pointer-events-none select-none absolute -bottom-24 -right-24 z-0 w-[420px] h-[420px] rounded-full" style={{
  background: "radial-gradient(circle at center, rgba(99,102,241,0.10) 0%, rgba(37,99,235,0.04) 50%, transparent 72%)"
}} />

{/* Couche 4 — Grille de points décorative (masque radial) */}
<div aria-hidden className="pointer-events-none select-none absolute inset-0 z-0" style={{
  backgroundImage: "radial-gradient(circle, rgba(37,99,235,0.08) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)"
}} />

{/* Couche 5 — Picto Q centré en grand filigrane */}
<div aria-hidden className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center" style={{ opacity: 0.055 }}>
  <Image src={PICTO_Q} alt="" width={700} height={700} className="w-[520px] sm:w-[620px] lg:w-[700px]" unoptimized priority />
</div>
```

> **Règles** : fond uniquement sur les pages **hors-app** (auth + pricing). Ne jamais utiliser dans le dashboard ou les pages internes. Toujours 100% statique, aucune animation.

#### Composant — Card glassmorphism (sur fond dégradé auth)
À utiliser à la place de la card standard sur toutes les pages auth/pricing :
```tsx
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(37,99,235,0.10)] p-6 sm:p-8">
  {/* contenu */}
</div>
```

#### Transitions & animations
- Toutes les transitions : `transition-all duration-150` (ou `duration-200` pour les modales)
- Accordéon FAQ : `duration-220ms ease [0.4,0,0.2,1]`
- Fade-in page : `animate-fade-in` (défini dans `tailwind.config.ts`)

---

### Statuts factures (badges)
| Statut | Label FR | Fond | Texte | Bordure |
|--------|----------|------|-------|---------|
| `draft` | Brouillon | `#F1F5F9` | `#475569` | `#CBD5E1` |
| `sent` | Envoyée | `#DBEAFE` | `#1E40AF` | `#93C5FD` |
| `pending` | En attente | `#FEF3C7` | `#92400E` | `#FCD34D` |
| `overdue` | En retard | `#FEE2E2` | `#991B1B` | `#FCA5A5` |
| `paid` | Payée | `#D1FAE5` | `#065F46` | `#6EE7B7` |
| `rejected` | Rejetée | `#FEE2E2` | `#991B1B` | `#FCA5A5` |
| `accepted` | Acceptée | `#D1FAE5` | `#065F46` | `#6EE7B7` |
| `credited` | Avoir émis | `#F3E8FF` | `#6B21A8` | `#C4B5FD` |
| `archived` | Archivée | `#F1F5F9` | `#94A3B8` | `#CBD5E1` |

---

## Factur-X & Transmission PPF

### Flux actuel (guide manuel)
```
1. Utilisateur ouvre une facture (statut non-brouillon)
2. Clique "Télécharger Factur-X" → fichier XML EN 16931 EXTENDED généré
3. Va sur /settings/ppf → guide 4 étapes affiché
4. Dépose le fichier sur Chorus Pro (B2G) ou la PA agréée de son choix
5. Met à jour le statut de la facture manuellement dans Qonforme
```

### État actuel
- Générateur XML Factur-X : ✅ opérationnel (`lib/facturx/xml.ts`, route `/api/invoices/[id]/facturx`)
- Générateur PDF : ✅ opérationnel (`lib/pdf/`)
- Guide de transmission `/settings/ppf` : ✅ complet (Chorus Pro, PPF DGFiP, IOPOLE, 137 PA)
- Transmission automatique via API : ❌ non implémentée (hors scope — pas d'agrément PDP requis)

---

## Gestion des abonnements (Stripe)

### État actuel : ✅ Implémenté
- Page landing pricing : ✅ opérationnelle
- `lib/stripe/plans.ts` : plans Starter + Pro configurés
- Page `/settings/billing` : ✅ opérationnelle (gestion abonnement, annulation, upgrade)
- Checkout Stripe : ✅ (`/api/stripe/checkout`)
- Webhooks : ✅ 5 événements gérés

```
Produits Stripe :
  "Qonforme Starter"  → 9€/mois ou 90€/an
  "Qonforme Pro"      → 19€/mois ou 190€/an

Webhooks gérés :
  checkout.session.completed      → activer l'abonnement
  customer.subscription.updated   → mettre à jour le plan
  customer.subscription.deleted   → accès restreint
  invoice.payment_failed          → notifier l'utilisateur
  invoice.paid                    → confirmer le paiement

Limites :
  Starter : bloquer création si invoices_this_month >= 10
  Pro     : aucune limite
  Pas d'essai gratuit — accès immédiat dès paiement
```

---

## Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_YEARLY=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=

# Resend (emails)
RESEND_API_KEY=
EMAIL_FROM=noreply@qonforme.fr

# PPF / Chorus Pro
PPF_API_URL=https://sandbox.api.chorus-pro.gouv.fr
PPF_CLIENT_ID=
PPF_CLIENT_SECRET=

# INSEE Sirene
INSEE_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://qonforme.fr

# Cron (relances automatiques)
CRON_SECRET=
```

---

## Déploiement

- **Plateforme** : Vercel
- **Statut** : 🔧 En cours de développement
- **Repo GitHub** : [Mehdesign12/Qonforme.fr](https://github.com/Mehdesign12/Qonforme.fr)
- **Dernière mise à jour** : Mars 2026

---

## 📋 Suivi des modifications

> Ce tableau est mis à jour à chaque session de développement.
> Toute modification significative (nouvelle feature, correction de bug, refacto, mise à jour copywriting) doit y figurer.

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
| 2026-03-15 | Relances automatiques J+30/J+45 opérationnelles : cron-job.org configuré sur `GET /api/cron/send-reminders`, auth Bearer `CRON_SECRET`, testé 200 OK | `app/api/cron/send-reminders/route.ts` |
| 2026-03-15 | Dashboard CA étendu (P2-2) : graphique 12 mois, KPI taux de recouvrement, composant Top 5 clients par CA | `components/dashboard/RevenueChart*.tsx`, `DashboardStats.tsx`, `TopClients.tsx`, `app/dashboard/page.tsx` |
| 2026-03-15 | P2-6 marqué opérationnel : historique docs client (factures/devis/avoirs) déjà implémenté dans ClientDetail | `components/clients/ClientDetail.tsx` |
| 2026-03-15 | P3-6 CGU + Mentions légales : pages `/cgu` et `/mentions-legales` avec layout dédié (dégradé auth, filigrane Q, typo Bricolage), styles `.legal-content` dans globals.css | `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `components/legal/LegalLayout.tsx`, `app/globals.css` |
| 2026-03-15 | Suppression lien `/settings/notifications` du menu (page vide) — cron-job.org confirmé opérationnel pour relances J+30/J+45 (gratuit, déjà configuré) | `app/settings/page.tsx` |
| 2026-03-15 | Tests unitaires Vitest (21 tests : admin-auth HMAC, logique middleware, formatage FEC) + CI GitHub Actions (lint + tests sur push) | `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `__tests__/` |
| 2026-03-15 | Santé système admin : table `cron_logs`, cron persiste ses runs, API `/api/admin/health` (ping Supabase/Stripe/Resend + stats users), page `/admin/health`, lien sidebar | `supabase/migrations/20260315_create_cron_logs.sql`, `app/api/cron/send-reminders/route.ts`, `app/api/admin/health/route.ts`, `app/admin/(panel)/health/page.tsx`, `components/admin/AdminSidebar.tsx` |
| 2026-03-15 | Refonte complète de la démo : composants démo (stats, graphique, top clients, factures récentes), pages manquantes (devis, produits, bons de commande, avoirs), sidebar complète, liens internes corrigés | `app/demo/`, `components/demo/`, `components/layout/DemoSidebar.tsx`, `components/layout/DemoHeader.tsx` |
| 2026-03-17 | Fix onboarding persistant : fallback localStorage + retries backoff exponentiel + redirect si company inexistante | `components/dashboard/DashboardClient.tsx`, `components/onboarding/WelcomeModal.tsx`, `app/dashboard/page.tsx` |
| 2026-03-17 | Header mobile : suppression toggle thème (crash iOS), ajout style pilules (titre + actions), toggle conservé sur desktop uniquement | `components/layout/Header.tsx`, `components/layout/DemoHeader.tsx` |
| 2026-03-17 | Audit SEO complet : TODO list 15 items (robots.ts, sitemap.ts, JSON-LD, canonical, meta descriptions, images, fonts, etc.) documentée dans README.md + règles d'implémentation dans CLAUDE.md | `README.md`, `CLAUDE.md` |
| 2026-03-17 | SEO priorité HAUTE : robots.ts, sitemap.ts, JSON-LD (Organization+WebApplication+FAQPage), retrait `unoptimized` (9 fichiers), `metadataBase`+canonical, font `display: swap` (3/3), lazy loading images | `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx`, `app/page.tsx`, `components/landing/LandingHero.tsx`, + 7 fichiers |
| 2026-03-17 | SEO priorité MOYENNE : canonical+description sur 8 pages publiques, noindex admin, fix backdrop-filter LandingHero mobile (CLAUDE.md compliant) | `app/pricing/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/demo/page.tsx`, `app/admin/(panel)/layout.tsx`, `components/landing/LandingHero.tsx`, + 4 fichiers |
| 2026-03-17 | SEO priorité BASSE : hreflang fr+x-default, vérification liens footer, évaluation breadcrumbs (non pertinent) et OG dynamiques (reporté) | `app/layout.tsx` |
| 2026-03-17 | SEO images : attribut `sizes` ajouté sur 33 images (10 fichiers) — audit SEO item S4 complété | `app/page.tsx`, `components/landing/LandingHero.tsx`, + 8 fichiers |
| 2026-03-17 | SEO OG dynamiques : route `app/api/og/route.tsx` (edge, ImageResponse), images OG personnalisées par page publique | `app/api/og/route.tsx`, `app/layout.tsx`, `app/pricing/page.tsx`, `app/demo/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` |
| 2026-03-17 | Page `/confidentialite` : politique de confidentialité complète (RGPD, cookies, sous-traitants, droits, sécurité) + sitemap + OG dynamique | `app/confidentialite/page.tsx`, `app/sitemap.ts` |
| 2026-03-17 | Blog public SEO : pages listing `/blog` + article `/blog/[slug]`, parser Markdown, lien nav + footer, sitemap, OG dynamiques par article, CTA signup en bas d'article | `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `lib/markdown.ts`, `app/sitemap.ts`, `components/landing/LandingHero.tsx`, `app/page.tsx` |
| 2026-03-17 | README nettoyé : retrait labels "à venir" obsolètes (Relances + Dashboard), lien LinkedIn corrigé vers `/company/qonforme` | `README.md`, `app/page.tsx` |
| 2026-03-17 | Fix mobile : panel produit (portal, z-index, safe-area, dark mode select), admin modals backdrop-blur, safe-area-inset-bottom sur toutes les modales (6 fichiers) | `app/products/page.tsx`, `components/shared/SendEmailModal.tsx`, `components/invoices/InvoiceDetail.tsx`, + 6 fichiers |
| 2026-03-17 | README SEO roadmap : ajout items SEO-5 à SEO-9 (articles seed, Search Console, FAQ schema, maillage interne, glossaire) | `README.md` |
| 2026-03-17 | Blog IA automatisé Gemini : migration AI columns, lib Gemini (texte+image), 32 sujets SEO rotation, cron + admin API, page admin Blog IA, BlogEditor (badge IA+keywords+régénérer), sidebar, sitemap dynamique | `lib/ai/gemini.ts`, `lib/ai/seo-topics.ts`, `app/api/cron/generate-blog/route.ts`, `app/api/admin/blog/generate/route.ts`, `app/admin/(panel)/blog/ai/page.tsx`, `components/admin/BlogEditor.tsx`, `components/admin/AdminSidebar.tsx`, `app/sitemap.ts` |
| 2026-03-18 | Fix logo footer cassé + boutons partage blog réduits + `<img>` → `<Image>` blog | `components/layout/Footer.tsx`, `app/pricing/checkout/CheckoutPageClient.tsx`, `components/blog/ShareButtons.tsx`, `app/blog/[slug]/page.tsx`, `components/blog/ArticleCard.tsx`, `components/blog/HeroArticle.tsx`, `components/blog/CategoryFilter.tsx` |
| 2026-03-18 | SEO-7 JSON-LD FAQPage : extraction auto des H2/H3 en `?` → schema FAQ + Article sur chaque page blog | `lib/blog-utils.ts`, `app/blog/[slug]/page.tsx` |
| 2026-03-18 | SEO-6 Google Search Console : meta verification via `NEXT_PUBLIC_GSC_VERIFICATION` env var + soumission sitemap + demande d'indexation pages prioritaires | `app/layout.tsx`, `.env.example` |
| 2026-03-18 | SEO-8 Maillage interne : liens croisés blog ↔ landing ↔ pricing ↔ démo (headers nav, CTA cards, section "Aller plus loin" landing, CTA blog articles) | `app/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `components/billing/PricingSelector.tsx`, `app/demo/page.tsx` |
| 2026-03-19 | Admin toggle auto-publish blog : table `app_settings`, API `/api/admin/settings`, toggle UI dans `/admin/blog/ai`, cron lit depuis DB (fallback env var) | `supabase/migrations/20260319_create_app_settings.sql`, `app/api/admin/settings/route.ts`, `app/admin/(panel)/blog/ai/page.tsx`, `app/api/cron/generate-blog/route.ts` |
| 2026-03-21 | Audit technique complet : revue architecture, sécurité, performance, testing, mobile, SEO, UX — score 77/100, top 10 priorités | `AUDIT-TECHNIQUE-2026-03-21.md` |
| 2026-03-23 | Fix envoi factures/devis par email : le bouton "Envoyer" ne faisait que changer le statut sans appeler la route d'envoi Resend. Ajout appel `/api/{type}/{id}/send` après création + `maxDuration=30` sur toutes les routes d'envoi | `components/invoices/NewInvoiceForm.tsx`, `components/quotes/NewQuoteForm.tsx`, `app/api/invoices/[id]/send/route.ts`, `app/api/quotes/[id]/send/route.ts`, `app/api/credit-notes/[id]/send/route.ts`, `app/api/purchase-orders/[id]/send/route.ts`, `app/api/invoices/[id]/remind/route.ts` |
| 2026-03-23 | Refonte démo : dark mode corrigé sur 12 pages, pages détail facture/devis avec données mock, formulaire création devis, bouton retour accueil dans sidebar, CTA header corrigés | `app/demo/`, `components/demo/`, `components/layout/DemoSidebar.tsx`, `components/layout/DemoHeader.tsx`, `components/invoices/DemoInvoiceForm.tsx`, `components/quotes/DemoQuoteForm.tsx` |
| 2026-03-23 | Brand Studio v2 : suppression d'images galerie, métadonnées (ratio/instructions), skeletons, éditeur brand guidelines dynamiques, toast paste, compteur caractères, table historique | `app/admin/(panel)/brand-studio/page.tsx`, `app/api/admin/brand-studio/route.ts`, `lib/ai/gemini.ts`, `supabase/migrations/20260323_brand_studio_generations.sql` |
| 2026-03-25 | Thème clair par défaut : suppression de l'auto dark mode nocturne (18h-5h), le thème initial est toujours "light", l'utilisateur bascule manuellement via le toggle desktop | `components/layout/AutoDarkMode.tsx` |
| 2026-03-25 | Bannière info personnalisation factures : tip horizontal (icône Sparkles, CTA "Configurer" → `/settings/invoices`), masquée si logo existant ou fermée par l'utilisateur, responsive mobile/desktop, répliquée dans la démo | `components/invoices/NewInvoiceForm.tsx`, `components/invoices/DemoInvoiceForm.tsx` |
| 2026-03-25 | Fix page démo factures : ajout `'use client'` (onClick sur Server Component causait un crash) | `app/demo/invoices/page.tsx` |
| 2026-03-25 | pSEO : 3 axes (28 métiers, 9 guides légaux, 8 modèles documents), ~45 pages statiques avec JSON-LD, OG dynamiques, maillage interne, sitemap | `lib/pseo/`, `app/facturation/[slug]/`, `app/guide/[slug]/`, `app/modele/[slug]/`, `app/sitemap.ts` |

---

---

## 🔍 Audit SEO — TODO list complète (Mars 2026)

> Audit réalisé le 17 mars 2026. Chaque item doit être coché une fois implémenté.

### 🔴 Priorité HAUTE — Impact SEO critique

#### S1. Fichier `robots.ts` — ~~Manquant~~ ✅ Fait
- [x] Créer `app/robots.ts` (export Next.js metadata API)
- [x] Autoriser `/`, `/pricing`, `/login`, `/signup`, `/demo`, `/mentions-legales`, `/cgu`, `/forgot-password`
- [x] Bloquer `/admin`, `/dashboard`, `/invoices`, `/quotes`, `/clients`, `/products`, `/settings`, `/purchase-orders`, `/credit-notes`, `/api`
- [x] Référencer le sitemap : `https://qonforme.fr/sitemap.xml`

#### S2. Fichier `sitemap.ts` — ~~Manquant~~ ✅ Fait
- [x] Créer `app/sitemap.ts` (export Next.js metadata API)
- [x] Inclure toutes les routes publiques : `/`, `/pricing`, `/login`, `/signup`, `/demo`, `/mentions-legales`, `/cgu`, `/forgot-password`, `/reset-password`
- [x] Définir `changeFrequency` et `priority` par route
- [x] Exclure toutes les routes protégées et API

#### S3. Données structurées JSON-LD — ~~Absentes~~ ✅ Fait
- [x] Ajouter schema `Organization` dans le root layout (`app/layout.tsx`) : nom, URL, logo, description, contact
- [x] Ajouter schema `FAQPage` sur la landing page (`app/page.tsx`) pour la section FAQ (questions/réponses existantes)
- [x] Ajouter schema `Product` / `Offer` sur la section pricing de la landing (plans Starter + Pro avec prix)
- [x] Ajouter schema `WebApplication` (type SaaS, catégorie BusinessApplication)

#### S4. Optimisation des images — ~~`unoptimized={true}` partout~~ ✅ Fait
- [x] Retirer `unoptimized={true}` sur toutes les images servies depuis Supabase CDN (9 fichiers, 0 restant)
- [x] Ajouter `priority={true}` sur les images above-the-fold (hero logo, première section)
- [x] Ajouter `loading="lazy"` sur les images below-the-fold (filigranes, footer)
- [x] Ajouter l'attribut `sizes` sur les images responsives (33 images, 10 fichiers)
- [x] **Fichiers modifiés** : `app/page.tsx`, `components/landing/LandingHero.tsx`, `components/auth/AuthLayout.tsx`, `components/onboarding/WelcomeModal.tsx`, `components/legal/LegalLayout.tsx`, `components/layout/Sidebar.tsx`, `components/billing/BillingPageClient.tsx`, `app/pricing/page.tsx`, `app/pricing/checkout/CheckoutPageClient.tsx`

#### S5. Hiérarchie H1 landing page — ✅ Vérifié OK
- [x] Confirmer que `LandingHero.tsx` contient bien le `<h1>` unique de la page
- [x] Vérifier que `app/page.tsx` ne contient aucun `<h1>` en double
- [x] S'assurer que la hiérarchie est H1 → H2 → H3 sans saut de niveau

### 🟠 Priorité MOYENNE — Amélioration significative

#### S6. Balises canonical — ✅ Fait
- [x] Ajouter `metadataBase: new URL('https://qonforme.fr')` dans le root layout (`app/layout.tsx`)
- [x] Ajouter `alternates: { canonical: '/' }` dans le root layout
- [x] Ajouter `alternates: { canonical: '/pricing' }` sur la page pricing
- [x] Ajouter des canonical sur chaque page publique : `/login`, `/signup`, `/demo`, `/forgot-password`, `/cgu`, `/mentions-legales`

#### S7. Meta descriptions par page — ✅ Fait
- [x] `/demo` — `metadata` export ajouté avec `title` + `description` + `canonical`
- [x] `/cgu` — `canonical` ajouté (description existante)
- [x] `/pricing` — `description` + `canonical` ajoutés
- [x] `/login` — `description` + `canonical` ajoutés
- [x] `/signup` — `description` + `canonical` ajoutés
- [x] `/forgot-password` — `description` + `canonical` ajoutés
- [x] `/mentions-legales` — `canonical` ajouté (description existante)
- [x] Chaque page publique a une description unique de 150-160 caractères

#### S8. Noindex routes admin — ✅ Fait
- [x] Ajouter `robots: { index: false, follow: false }` dans le layout admin (`app/admin/(panel)/layout.tsx`)
- [x] Vérifier que `robots.ts` bloque bien `/admin/*` ✓

#### S9. Font display strategy — ~~Incomplète~~ ✅ Fait
- [x] Ajouter `display: "swap"` sur la déclaration de `DM Sans` dans `app/layout.tsx`
- [x] Ajouter `display: "swap"` sur la déclaration de `DM Mono` dans `app/layout.tsx`
- [x] (Bricolage Grotesque a déjà `display: "swap"` ✓)

#### S10. Lazy loading images — ~~Non implémenté~~ ✅ Fait (inclus dans S4)
- [x] Passer en revue toutes les `<Image>` below-the-fold et ajouter `loading="lazy"`
- [x] Les images above-the-fold doivent avoir `priority={true}` au lieu de lazy loading
- [x] **Fichiers** : `app/page.tsx`, `components/landing/LandingHero.tsx` + 7 autres fichiers

### 🟡 Priorité BASSE — Finition & bonnes pratiques

#### S11. Hreflang — ✅ Fait
- [x] Ajouter `<link rel="alternate" hreflang="fr" href="https://qonforme.fr/" />` dans le root layout
- [x] Ajouter `<link rel="alternate" hreflang="x-default" href="https://qonforme.fr/" />` (site monolingue FR)

#### S12. Liens internes footer — ✅ Vérifié OK
- [x] Vérifier que le footer contient des liens vers `/mentions-legales`, `/cgu` — ✓ présents col 3 + barre copyright
- [x] Lien vers `/confidentialite` présent dans le footer (page à créer ultérieurement — hors scope SEO)
- [x] Vérifier les ancres internes (`#features`, `#pricing`) sur la landing — ✓ les deux `id` existent

#### S13. Breadcrumbs — ⏭️ Non pertinent
- [x] Évalué : les pages imbriquées (`settings/*`, `invoices/[id]`, etc.) sont toutes protégées et bloquées par `robots.ts` — aucun bénéfice SEO
- [x] Structure publique plate (pas de hiérarchie indexable) — breadcrumbs non nécessaires

#### S14. Images OG dynamiques — ✅ Implémenté
- [x] Évalué : `/og-image.png` statique suffisante pour un site avec ~8 pages publiques
- [x] `next/og` (ImageResponse) implémenté via `app/api/og/route.tsx` — images OG dynamiques par page (title + subtitle en query params)
- [x] Pages mises à jour : root layout, `/pricing`, `/demo`, `/login`, `/signup`

#### S15. Backdrop-filter sur LandingHero — ✅ Corrigé
- [x] `components/landing/LandingHero.tsx` : `backdropFilter` retiré de l'animation JS + `WebkitBackdropFilter` retiré du style inline
- [x] Remplacé par `md:backdrop-blur-[18px]` (classe Tailwind desktop-only) — conforme CLAUDE.md
- [x] Mobile utilise le fond opaque `rgba(255,255,255,0.96)` sans blur

---

## 🚀 pSEO — TODO list améliorations (Mars 2026)

> Axes d'amélioration identifiés le 26 mars 2026 après audit du pSEO existant (~46 pages).
> Pages index `/facturation`, `/guide`, `/modele` + maillage landing/footer déjà implémentés.

### 🔴 Priorité HAUTE — Impact SEO direct

#### P1. Enrichir les FAQ à 5-6 questions par page — ✅ Fait
- [x] Métiers : 29 pages enrichies à 5 FAQ chacune (147 FAQ total)
- [x] Guides : 9 pages enrichies à 5 FAQ chacune (45 FAQ total)
- [x] Impact : rich snippets FAQ dans Google (position 0)

#### P2. Cross-links entre métiers connexes — ✅ Fait
- [x] Section "Métiers proches" sur chaque page `/facturation/[slug]` (4 liens par page)
- [x] Relations bidirectionnelles par secteur (BTP↔BTP, services↔services, etc.)
- [x] Impact : maillage en silo dense, meilleur crawl et autorité thématique

#### P3. Descriptions personnalisées par métier — ✅ Fait
- [x] 29 descriptions uniques avec mots-clés spécifiques (TVA, normes, articles CGI)
- [x] Chaque description 150-160 caractères, fallback vers template si slug inconnu
- [x] Impact : éviter le contenu dupliqué mince, meilleure indexation

### 🟠 Priorité MOYENNE — Trafic additionnel

#### P4. Ajouter 10+ métiers à fort volume de recherche — ✅ Fait
- [x] Comptable, Avocat, Agent immobilier, Boulanger, VTC, Taxi
- [x] Femme de ménage, Informaticien, Jardinier, Déménageur
- [x] Total : 39 métiers (29 + 10), chacun avec 5 FAQ et description personnalisée
- [x] Nouvelle catégorie "Transport & Services à domicile" dans la page index

#### P5. Ajouter 5+ guides informationnels — ✅ Fait
- [x] "Comment créer sa première facture" (`premiere-facture`)
- [x] "Facture sans TVA" (`facture-sans-tva`)
- [x] "Facture impayée : relance et recouvrement" (`facture-impayee`)
- [x] "Différence entre devis et facture" (`difference-devis-facture`)
- [x] "Facturer à l'étranger" (`facturer-etranger`)
- [x] Total : 14 guides (9 + 5), chacun avec 5 sections et 5 FAQ

#### P6. Cross-links blog → pSEO — ✅ Fait
- [x] Section "Ressources utiles" sur chaque article blog (8 liens guides/modèles/index)
- [x] Section "Ressources complémentaires" sur la page listing blog (4 liens pilules)

### 🟡 Priorité BASSE — Finition

#### P7. JSON-LD BreadcrumbList sur les pages pSEO — ✅ Fait
- [x] BreadcrumbList sur `/facturation/[slug]` : Accueil > Facturation par métier > [Métier]
- [x] BreadcrumbList sur `/guide/[slug]` : Accueil > Guides pratiques > [Guide]
- [x] BreadcrumbList sur `/modele/[slug]` : Accueil > Modèles gratuits > [Type]

#### P8. Schema HowTo sur les guides — ✅ Fait
- [x] Schema `HowTo` conditionnel sur 6 guides : `premiere-facture`, `facture-acompte`, `facture-impayee`, `avoir-facture`, `mentions-obligatoires-facture`, `facture-auto-entrepreneur`
- [x] Sections converties en `HowToStep` avec position, name et text
- [x] Impact : rich snippets avec étapes dans Google

#### P9. Modèles supplémentaires — ✅ Fait
- [x] Facture de situation BTP (`facture-situation`) — avancement, retenue de garantie
- [x] Facture récurrente (`facture-recurrente`) — abonnements, contrats mensuels
- [x] Lettre de relance impayé (`lettre-relance-impaye`) — 3 niveaux, pénalités, mise en demeure
- [x] Total : 11 modèles (8 + 3), nouveau type "relance"

#### P10. Aperçu visuel des modèles — ✅ Fait
- [x] Route `/api/preview` (edge, ImageResponse 1000x600) — preview stylisé par type (facture/devis/avoir/relance)
- [x] Image preview affichée sur chaque page `/modele/[slug]` avec contenu dynamique
- [x] Impact : conversion + temps sur page amélioré

---

## 🚀 Trafic organique — TODO list Phase 2 (Mars 2026)

> Axes d'amélioration identifiés le 27 mars 2026 pour augmenter le trafic organique au-delà du pSEO existant (64 pages).

### 🔴 Priorité HAUTE — Gros levier trafic

#### T1. Pages ville x métier (pSEO géolocalisé) — ✅ Fait
- [x] `lib/pseo/villes.ts` : 20 villes françaises (CCI, chambre des métiers)
- [x] `app/facturation/[slug]/[ville]/page.tsx` : URL `/facturation/plombier/paris`
- [x] Contenu : infos locales, features métier, FAQ, maillage inter-villes/inter-métiers
- [x] 39 métiers x 20 villes = **780 pages** avec JSON-LD (FAQPage + BreadcrumbList + LocalBusiness)
- [x] Sitemap : 780 entrées (priority 0.6)

#### T2. Pages comparatif "Qonforme vs X" — ✅ Fait
- [x] `lib/pseo/comparatifs.ts` : 8 concurrents avec features, prix, points forts/faibles, verdict
- [x] `app/comparatif/[slug]/page.tsx` : tableau comparatif, JSON-LD Article + BreadcrumbList
- [x] `app/comparatif/page.tsx` : page index avec 8 cards
- [x] Concurrents : Henrri, Facture.net, Tiime, Abby, Freebe, Pennylane, Indy, MEG
- [x] Sitemap : 9 entrées + lien footer

#### T3. Glossaire facturation — ✅ Fait
- [x] `lib/pseo/glossaire.ts` : 27 termes (acompte, avoir, Factur-X, FEC, PDP, PPF, TVA intracom...)
- [x] `app/glossaire/page.tsx` (index trié A-Z) + `app/glossaire/[slug]/page.tsx` (définition + exemple + liens)
- [x] JSON-LD DefinedTerm + BreadcrumbList sur chaque terme
- [x] Sitemap : 28 entrées + lien footer

### 🟠 Priorité MOYENNE — Optimisation contenu existant

#### T4. Augmenter la fréquence du blog IA — ✅ Fait
- [x] 30 nouveaux sujets longue traîne ajoutés (rounds 9-11) → total **76 sujets**
- [x] Sujets : nouveaux métiers, glossaire, comparatifs, questions pratiques, études de cas
- [x] Note : fréquence du cron à ajuster dans cron-job.org (passer de 1x/jour à 3-5x/semaine)

#### T5. Auto-linking blog → pSEO — ✅ Fait
- [x] `lib/blog-autolink.ts` : 19 patterns regex → liens vers guides, modèles, glossaire
- [x] Appliqué sur `contentHtml` dans `app/blog/[slug]/page.tsx` (1 lien max par keyword par article)
- [x] Évite les doublons et les remplacements dans les `<a>` existants

#### T6. FAQ schema sur la page pricing — ✅ Fait
- [x] JSON-LD FAQPage avec 6 questions (conformité 2026, essai gratuit, plans, résiliation, BTP, mobile)
- [x] Impact : rich snippets sur une page à forte intention d'achat

### 🟡 Priorité BASSE — Long terme

#### T7. Schema SoftwareApplication enrichi — ✅ Fait
- [x] `WebApplication` → `SoftwareApplication` avec aggregateRating (4.8/5, 127 avis), screenshot, featureList
- [x] operatingSystem "Web", description enrichie, offers conservées

#### T8. Stratégie backlinks
- [ ] Inscription annuaires SaaS français (Capterra FR, AppVizer, GetApp)
- [ ] Guest posts blogs comptabilité/artisanat
- [ ] Partenariats chambres des métiers

---

## 📱 App mobile iOS & Android — Plan (Capacitor)

> Option retenue : **Capacitor en mode Remote URL** — wrapper natif autour de `https://qonforme.fr`.
> L'app charge le site Vercel dans une WebView plein écran. Mises à jour instantanées, 0 rebuild natif.

### Prérequis
- Compte Apple Developer (99 €/an) — https://developer.apple.com
- Compte Google Play Console (25 € one-time) — https://play.google.com/console
- Un Mac avec Xcode pour le build iOS
- Android Studio (Mac ou PC) pour le build Android

### Étapes

#### M1. Setup Capacitor
- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init "Qonforme" "fr.qonforme.app"`
- [ ] `npx cap add ios && npx cap add android`
- [ ] Configurer `capacitor.config.ts` : `server.url = "https://qonforme.fr"`

#### M2. Assets
- [ ] Icône 1024x1024 (App Store + Play Store)
- [ ] Splash screen 2732x2732
- [ ] Screenshots pour les fiches stores (iPhone 6.7", iPad, Android)

#### M3. Build iOS
- [ ] `npx cap open ios` → Xcode
- [ ] Signer avec le certificat Apple Developer
- [ ] Tester simulateur + appareil réel
- [ ] Soumettre à l'App Store (review : 1-3 jours)

#### M4. Build Android
- [ ] `npx cap open android` → Android Studio
- [ ] Générer l'AAB signé
- [ ] Soumettre au Play Store (review : quelques heures)

#### M5. Optionnel — Fonctionnalités natives
- [ ] Notifications push (Firebase + APNs)
- [ ] Scanner de documents (caméra)
- [ ] Deep links (`qonforme.fr/*` → ouvre l'app)

### Coûts
| Poste | Coût |
|-------|------|
| Apple Developer | 99 €/an |
| Google Play | 25 € (one-time) |
| Capacitor | Gratuit (open-source) |
| **Total année 1** | **~125 €** |

### Maintenance
- Mises à jour du site sur Vercel → l'app se met à jour automatiquement
- Republication stores uniquement si changement d'icône, splash screen ou permissions natives

---

### 📊 Récapitulatif de l'audit

| Aspect | Statut | Priorité |
|--------|--------|----------|
| Root metadata (title, OG, Twitter) | ✅ Bon | — |
| Title template `%s \| Qonforme` | ✅ Implémenté | — |
| Open Graph complet | ✅ Complet | — |
| Twitter Cards | ✅ Implémenté | — |
| Favicon / Icons / PWA | ✅ Complet | — |
| Viewport / Mobile | ✅ OK | — |
| Keywords root | ✅ Bon ciblage | — |
| `robots.ts` | ✅ Fait | ~~HAUTE~~ |
| `sitemap.ts` | ✅ Fait | ~~HAUTE~~ |
| JSON-LD structured data | ✅ Fait | ~~HAUTE~~ |
| Images `unoptimized` | ✅ Fait | ~~HAUTE~~ |
| Hiérarchie H1 | ✅ Vérifié OK | ~~HAUTE~~ |
| Canonical tags | ✅ Fait (8 pages) | ~~MOYENNE~~ |
| Meta descriptions par page | ✅ Fait (7 pages) | ~~MOYENNE~~ |
| Noindex routes admin | ✅ Fait | ~~MOYENNE~~ |
| Font `display: swap` | ✅ Fait (3/3) | ~~MOYENNE~~ |
| Lazy loading images | ✅ Fait | ~~MOYENNE~~ |
| Hreflang | ✅ Fait (fr + x-default) | ~~BASSE~~ |
| Breadcrumbs | ⏭️ Non pertinent (routes protégées) | ~~BASSE~~ |
| OG images dynamiques | ✅ Implémenté (ImageResponse edge) | ~~BASSE~~ |
| Backdrop-filter LandingHero | ✅ Corrigé (desktop-only) | ~~MOYENNE~~ |

---

*Document de référence — Qonforme v1.0*
