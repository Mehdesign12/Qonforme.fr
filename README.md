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
| 2026-06-15 | Fix indexation Google "Autre page avec balise canonique sélectionnée par l'utilisateur" : le domaine primaire Vercel était inversé (www.qonforme.fr servait 200 alors que tout le code déclare qonforme.fr comme canonique → boucle de signaux contradictoire pour Googlebot). Bascule Vercel : qonforme.fr → Production (200), www.qonforme.fr → redirect 308 vers qonforme.fr. Aucun changement de code | — (config Vercel : Settings → Domains) |
| 2026-07-02 | Audit SEO/GEO complet (voir CLAUDE.md) : les 780 pages pSEO géo (métier×ville), retirées du sitemap le 09/04 mais laissées crawlables sans noindex et orphelines de tout lien interne, identifiées comme cause probable du plafond d'indexation site-wide (signal "Explorée, actuellement non indexée" dans GSC). Passage en `noindex,follow` en attendant une refonte du contenu par ville | `app/facturation/[slug]/[ville]/page.tsx` |
| 2026-08-18 | Transformation en app iOS : PWA complète (service worker avec cache strictement non authentifié, 40 splash screens iOS, manifest enrichi + raccourcis, invite d'installation, bannière hors-ligne, mode plein écran) + coquille native Capacitor (config, plugins natifs, pont haptique/partage/browser, push APNs avec table `push_tokens` et route d'enregistrement). Aucun code existant supprimé — l'app native charge le même site. Doc : `IOS-APP.md` | `public/sw.js`, `public/manifest.json`, `public/splash/`, `components/pwa/`, `components/native/`, `lib/pwa/`, `lib/native/`, `capacitor.config.ts`, `app/api/native/push-token/`, `supabase/migrations/20260818_create_push_tokens.sql`, `app/layout.tsx`, `app/globals.css`, `next.config.mjs`, `IOS-APP.md` |
| 2026-08-18 | Fix point d'entrée app iOS : server.url pointait sur le domaine nu (landing marketing SEO) au lieu de /dashboard — le middleware sait déjà rediriger proprement (connecté → tableau de bord, non connecté → /login). Ajout `?source=native-app` pour distinguer ce trafic dans PostHog/GA, sur le modèle de `?source=pwa` | `capacitor.config.ts`, `IOS-APP.md` |
| 2026-08-18 | Fix critique app iOS : app entière éjectée vers Safari au lieu de rester dans la coquille native, dès la première redirection (middleware /dashboard → /login). Cause identifiée dans le code source Capacitor (WebViewDelegationHandler.swift) : la comparaison isApplicationNavigation fait un match de préfixe littéral sur server.url — un chemin dedans (/dashboard) faisait échouer toute redirection vers un autre chemin. server.url revient à la racine du domaine, le chemin de démarrage passe par le champ Capacitor dédié server.appStartPath, qui ne participe jamais à cette comparaison | `capacitor.config.ts`, `IOS-APP.md` |
| 2026-08-19 | Écran d'amorçage avant la demande d'autorisation push (au lieu d'un onboarding générique 3 écrans, écarté après discussion — l'audience principale de l'app est des clients existants, pas des découvreurs) : explique le bénéfice concret (alertes d'échéance/retard) avant la popup système iOS, montré une seule fois par appareil (Preferences), jamais reproposé après un "Plus tard" pour éviter de renvoyer la popup froide | `lib/native/push.ts`, `components/native/PushPrimingScreen.tsx`, `components/native/NativeAppInit.tsx` |
| 2026-08-19 | Onboarding de découverte App/Play Store (3 écrans, montré une fois par appareil avant toute connexion — public distinct de l'amorçage push ci-dessus) : même langage visuel que le dashboard réel (dégradé `--dashboard-bg`, halos radiaux, picto Q de la sidebar), écran de conversion final (créer un compte / déjà client), séquencé avant l'amorçage push existant (`NativeAppInit` attend `onboardingDone`), overlay maintenu jusqu'à navigation réelle vers `/signup`/`/login` pour éviter un flash de la mauvaise page | `lib/native/onboarding.ts`, `components/native/AppOnboardingCarousel.tsx`, `components/native/NativeAppInit.tsx`, `IOS-APP.md` |
| 2026-08-19 | Fix zoom automatique iOS au focus d'un champ (signalé pendant un test de création de compte dans l'app) : les 5 formulaires auth avaient un `font-size` sous le seuil 16px (`text-sm`/`text-[15px]`) qui déclenche le zoom natif iOS Safari/WKWebView ; corrigés en `text-base md:...`, + filet de sécurité CSS global (`@media max-width:767px`) pour tout champ présent ou futur | `app/globals.css`, `components/auth/SignupForm.tsx`, `components/auth/CompanyForm.tsx`, `components/auth/LoginForm.tsx`, `components/auth/ForgotPasswordForm.tsx`, `components/auth/ResetPasswordForm.tsx` |
| 2026-08-19 | Émetteur APNs côté serveur (dernière brique manquante des notifications push) : client HTTP/2 + JWT ES256 sans dépendance ajoutée (`node:http2`/`node:crypto`), connexion réutilisée pour tout un run de cron, repli automatique sandbox/production sur `BadDeviceToken`, purge des jetons qu'Apple signale invalides. Branché dans le cron de relances existant — une notification push accompagne désormais chaque relance email J+30/J+45. Fonctionne en dégradé (email seul) tant que la clé APNs n'est pas configurée. Test unitaire de la signature JWT (authentifiable avec la clé publique) | `lib/push/apns.ts`, `app/api/cron/send-reminders/route.ts`, `__tests__/apns-jwt.test.ts`, `.env.example`, `IOS-APP.md` |
| 2026-08-20 | Fonctionnalités natives pour renforcer le dossier de soumission App Store (règle 4.2 Minimum Functionality) : capture photo du logo entreprise (`capturePhoto()`, réutilise l'endpoint d'upload existant, `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` ajoutées), écran de confidentialité masquant les données financières dans le sélecteur d'apps iOS (fond opaque, pas de backdrop-filter), badge sur l'icône = nombre de factures en retard (via `aps.badge`, pas de plugin supplémentaire — remise à zéro à l'ouverture non implémentée, nécessiterait un plugin tiers) | `lib/native/camera.ts`, `components/settings/InvoiceSettingsForm.tsx`, `ios/App/App/Info.plist`, `components/native/PrivacyScreen.tsx`, `app/layout.tsx`, `app/api/cron/send-reminders/route.ts`, `IOS-APP.md` |
| 2026-08-31 | Audit complet de la plateforme (build local avec credentials factices, lint, 26 tests unitaires, smoke-test HTTP de toutes les routes publiques/protégées/admin/API, captures d'écran desktop+mobile) : 990/990 pages générées, tout est vert. Bug trouvé et corrigé : `/admin` et `/admin/health` affichaient silencieusement "0 utilisateurs" quand `listUsers()` (API Auth Admin Supabase, sous-système distinct de PostgREST) échouait, au lieu d'un état d'erreur comme les 3 autres checks de service — même piège que la règle middleware du CLAUDE.md, cette fois dans le panneau censé le détecter. `/admin/health` factorise maintenant cette erreur dans le bandeau global "Incident détecté" | `app/admin/(panel)/page.tsx`, `app/admin/(panel)/health/page.tsx` |
| 2026-08-31 | Revue de code des parcours métier (devis/factures/clients/PDF) demandée après l'audit ci-dessus, faute d'accès à un vrai backend pour tester en conditions réelles : 14 bugs confirmés par lecture directe du code puis corrigés, avec tests de non-régression pour les 2 plus critiques. **Numérotation** : les factures créées directement et celles issues d'une conversion de devis utilisaient deux compteurs jamais synchronisés (`MAX(invoice_number)` vs `companies.invoice_sequence`) → doublons quasi systématiques dès la première conversion ; les 4 types de documents (factures/devis/avoirs/bons de commande) triaient aussi leur numéro comme du TEXTE, cassant au 1000e document. Centralisé dans `lib/utils/document-numbering.ts` ; migration `UNIQUE(user_id, *_number)` écrite mais **non appliquée** (pas d'accès au Supabase réel de Qonforme depuis cette session). **Sécurité** : `logo_url` était fetch()é côté serveur sans validation à chaque PDF généré (SSRF) → `lib/utils/logo-url.ts` n'autorise plus que le bucket Storage du projet. **Intégrité facture** : `PATCH /api/invoices/[id]` sans garde de statut (facture envoyée/payée modifiable par appel direct) ; avoir partiel qui soldait à tort la facture entière. **UX/quota** : "Aperçu PDF" créait une vraie facture brouillon et consommait le quota Starter → nouvelle route `POST /api/invoices/preview-pdf` purement en mémoire. **Notables** : toggle "voir les inactifs" sur `/products` structurellement impossible à afficher, SIREN client sans clé de Luhn, recherche produit cassée par une virgule/parenthèse, "en retard" déclenché trop tôt (comparaison UTC), couleur hex courte mal interprétée, dates figées au chargement du module JS, polices PDF non subsettées | `lib/utils/document-numbering.ts`, `lib/utils/logo-url.ts`, `app/api/invoices/preview-pdf/route.ts`, `app/api/{invoices,quotes,purchase-orders}/route.ts`, `app/api/invoices/[id]/{route,credit/route}.ts`, `app/api/quotes/[id]/convert/route.ts`, `app/api/company/route.ts`, `app/api/products/route.ts`, `app/products/page.tsx`, `components/clients/NewClientForm.tsx`, `components/invoices/{InvoiceDetail,NewInvoiceForm}.tsx`, `components/quotes/NewQuoteForm.tsx`, `lib/pdf/*.ts`, `supabase/migrations/20260901_unique_document_numbers.sql`, `__tests__/{document-numbering,logo-url}.test.ts` |
| 2026-08-31 | Validation en conditions réelles des 14 correctifs ci-dessus, contre le vrai backend de production (compte de test clairement identifié `claude-audit-test-…@example.com`, `(A SUPPRIMER)` partout — non nettoyé, pas d'accès admin/Supabase réel depuis cette session pour le supprimer). Tout confirmé sur données réelles : numérotation devis→facture sans doublon, avoir partiel (statut inchangé tant que non soldé, sur-crédit rejeté), immutabilité facture non-brouillon, SSRF logo_url, recherche produit virgule/parenthèse, toggle produits inactifs, aperçu PDF (3 appels → 0 facture créée), PDF Factur-X 17,5 Ko (vs ~1 Mo avant subsetting), bon de commande. **Faille découverte en testant, non corrigée (choix explicite)** : la conversion devis→facture (et la création de clients/devis/produits/bons de commande) ne vérifie aucun abonnement actif, contrairement à la création directe de facture — un compte sans abonnement peut donc émettre des factures illimitées via cette voie | — (validation uniquement, aucun fichier modifié) |
| 2026-10-01 | Stratégie de croissance 90 jours (objectif 3-4 k€/mois) : analyse complète code, parcours d'achat, marketing, SEO, marché et concurrence. Constats majeurs : promesse « conforme » non tenue (aucun raccordement PA, Factur-X invalide : profil extended, pas de PDF/A-3, TVA franchise codée Z), faux avis et faux chiffres affichés (Trustpilot inexistant, `aggregateRating` fictif), tunnel « gratuit » qui impose le paiement avant toute valeur, aucun email lifecycle, mesure aveugle. Plan : assainir (sem. 1-2), devenir Solution compatible via API PA (sem. 2-6), niche artisans BTP B2B, vente directe + prescripteurs, panier moyen relevé. Aucun code modifié | `STRATEGIE-CROISSANCE-2026-10.md` |
| 2026-10-01 | Décisions stratégiques validées avec le fondateur, consignées dans un document vivant. Cible : les artisans du bâtiment qui choisissent leur premier logiciel (un cœur, trois profils), promesse « premier et dernier logiciel ». Aucune mention de concurrents, aucun démarchage, pas de logique de remplacement. Chiffres du marché sourcés (INSEE, Urssaf, SDES, CAPEB, France Num). Design : héros « Clair sobre » validé. Recommandation « devis gratuits, factures payantes » en attente de décision. Renvoi ajouté dans CLAUDE.md et bandeau dans la stratégie | `DECISIONS-STRATEGIQUES.md`, `STRATEGIE-CROISSANCE-2026-10.md`, `CLAUDE.md` |
| 2026-10-01 | Maquettes d'onboarding revues à la demande du fondateur (canevas de design, aucun code applicatif modifié) : accès libre au tableau de bord à tout moment (« Passer au tableau de bord » dans l'en-tête de chaque étape, « Explorer le tableau de bord » sur l'écran « Par quoi commencer ? », nouvelle planche du tableau de bord d'un compte neuf) ; suppression de toute promesse de contact humain (aide « un humain vous répond », appel de 10 minutes, carte et emails signés du fondateur, support téléphonique, mise en route en visio) ; écrans épurés, une action principale par écran ; icônes de la barre latérale en trait fin, sans pastille. Nouvelle règle de communication : ne jamais promettre de contact humain | `DECISIONS-STRATEGIQUES.md`, `CLAUDE.md` |
| 2026-10-01 | Logo personnalisé dans les maquettes Paramètres › Entreprise (compte actif et compte neuf) : zone de dépôt, logo réellement affiché une fois importé, remplacer/retirer, aperçu en direct sur un devis ; tuile « Ajouter votre logo » sur le tableau de bord du compte neuf. Inventaire de la refonte comparé au code en ligne (section 10 de `DECISIONS-STRATEGIQUES.md`) : statut existe / partiel / à construire de chaque apport et ordre suggéré. Constats dans le code, non corrigés ici : une facture relancée passe au statut `overdue` et sort des montants « en attente » et « en retard » du tableau de bord ; la FAQ tarifs affirme gérer l'autoliquidation, absente du code | `DECISIONS-STRATEGIQUES.md` |
| 2026-10-01 | Fix faille documents émis : un `PATCH { status: "draft" }` remettait une facture émise en brouillon (puis modifiable et supprimable). Liste blanche des changements de statut côté serveur pour factures, devis et bons de commande (`lib/utils/document-status.ts`) : jamais de retour au brouillon, `credited`/`cancelled` jamais posés à la main, contenu des devis et bons de commande figé hors brouillon (il ne l'était que dans l'interface), renvoi par email sans écraser un statut payé/accepté/crédité, relance refusée sur une facture brouillon/payée/créditée, conversion limitée aux devis envoyés ou acceptés, création toujours en brouillon. 23 tests. Cascade des documents et cahier des charges de la signature en ligne consignés (section 11 de `DECISIONS-STRATEGIQUES.md`), nouvelle règle dans `CLAUDE.md` | `lib/utils/document-status.ts`, `app/api/invoices/route.ts`, `app/api/invoices/[id]/{route,send/route,remind/route}.ts`, `app/api/quotes/[id]/{route,send/route,convert/route}.ts`, `app/api/purchase-orders/[id]/{route,send/route}.ts`, `__tests__/document-status.test.ts`, `DECISIONS-STRATEGIQUES.md`, `CLAUDE.md` |
| 2026-10-01 | Maquettes de la signature en ligne (canevas de design, version 17 ; aucun code applicatif) : pages client sur ordinateur et téléphone pour le devis d'un particulier (certification du taux réduit de TVA, information et demande de démarrage anticipé pendant les 14 jours de rétractation, signature tracée ou tapée) et le bon de commande d'un professionnel (fonction, numéro de commande client, code de vérification par email au-delà de 5 000 € TTC), refus avec motif, confirmation avec acompte, PDF signé et certificat ; planche des états du lien (signé, expiré, remplacé, désactivé, rétractation, lien introuvable) ; signature sur place sur le téléphone de l'artisan avec les règles du hors établissement (aucun paiement avant 7 jours) ; huit emails ; côté artisan, panneau « Signature en ligne » et fenêtre de partage ajoutés aux 12 fiches devis et 5 bons de commande, réglages dans Paramètres › Modèles. Mention « sous réserve de l'attestation du client » (supprimée en 2025) remplacée sur toutes les planches | `DECISIONS-STRATEGIQUES.md` |
| 2026-10-02 | Retrait de l'app iOS native, décidé avec le fondateur : un abonnement vendu à un artisan seul relève de l'achat intégré d'Apple (règle 3.1.3(c)), et l'autre voie (3.1.3(f)) interdit tout prix ou bouton d'achat dans l'app, donc le mur de paiement à la première facture. Supprimés : coquille Capacitor (`capacitor.config.ts`, `ios/`, `capacitor/`, `assets/`), `lib/native/`, `components/native/` (amorçage push, carrousel, écran de confidentialité), émetteur APNs et son branchement dans le cron de relances, route `/api/native/push-token`, capture photo du logo, dépendances `@capacitor/*`, variables `APNS_*`, `IOS-APP.md`. Conservé : la PWA (service worker, manifest, écrans de démarrage, invite d'installation). La table `push_tokens` n'est plus utilisée | `app/layout.tsx`, `app/api/cron/send-reminders/route.ts`, `components/layout/{Header,Sidebar}.tsx`, `components/pwa/InstallPrompt.tsx`, `components/settings/InvoiceSettingsForm.tsx`, `scripts/generate-pwa-assets.mjs`, `package.json`, `.env.example`, `CLAUDE.md` |
| 2026-10-02 | Abonnement refait pour « devis gratuits, factures payantes », grille validée : Essentiel 12 € HT/mois ou 120 € HT/an ; Artisan 24 € HT affiché « bientôt » et non vendu tant que ses fonctions manquent. Comptes gratuits : le middleware ne vérifie plus l'abonnement, plus d'étape « plan » à l'inscription, accès aux documents conservé après résiliation ou impayé (délai de grâce). Mur de paiement côté serveur à l'émission (`requireIssuingAccess` : envoi, sortie du brouillon, relance, cron des relances), fenêtre « Votre facture est prête », puis retour sur la facture après paiement (`?send=1`, chemin filtré par `safeNextPath`). PDF de brouillon et d'aperçu filigranés et sans XML, Factur-X refusé pour un brouillon, filigrane à l'écran et à l'impression. Paiement : carte et prélèvement SEPA, TVA 20 % par taux Stripe obligatoire, nom, adresse et SIREN de l'entreprise sur les factures Stripe, webhooks des prélèvements différés. Garantie 30 jours en libre-service (avoir Stripe, arrêt immédiat, une fois par compte). Bugs corrigés : réactivation après paiement jamais appliquée (`invoice.subscription` absent de l'API 2025), `redirect()` intercepté par un try/catch (page de retour, récupération d'abonnement), « Envoyer » depuis la page de modification qui ne partait pas par email. Faille fermée : la RLS laissait un utilisateur s'écrire un abonnement actif depuis son navigateur (migration à appliquer). Retirés : fausse note 4,8/5 (47 avis) des données structurées, promesses fausses de la page Tarifs. CGU article 4 réécrit. 22 tests | `lib/stripe/{access,plans,subscription,guarantee,recovery}.ts`, `app/api/stripe/{checkout,guarantee}/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/invoices/**`, `app/api/cron/send-reminders/route.ts`, `lib/supabase/middleware.ts`, `lib/pdf/invoice.ts`, `components/billing/{PricingSelector,PaywallDialog,BillingPageClient}.tsx`, `components/invoices/{InvoiceDetail,NewInvoiceForm}.tsx`, `app/{pricing,signup/plan,settings/billing}/**`, `app/layout.tsx`, `app/page.tsx`, `app/cgu/page.tsx`, `supabase/migrations/20261002_subscriptions_server_write_only.sql`, `__tests__/subscription-access.test.ts` |
| 2026-10-02 | Décisions consignées (section 12 de `DECISIONS-STRATEGIQUES.md`) : pas de Stripe Connect, les clients de l'artisan le paient par virement sur son IBAN ; pas d'app native ; grille appliquée à tous ; signature en ligne réservée à Essentiel et Artisan ; configuration Stripe et Vercel à faire. Canevas de design version 18 (75 planches) : page de règlement du client en virement seul (IBAN, BIC, montant, référence, déclaration du virement), plus aucune carte ni prélèvement côté client (relances, emails, réglages, notifications, acompte après signature, accueil), Tarifs avec la signature dans Essentiel, compte gratuit sans signature en ligne (devis en PDF avec lien de consultation, badge « Avec Essentiel »), alertes par email au lieu du téléphone | `DECISIONS-STRATEGIQUES.md`, `CLAUDE.md` |
| 2026-10-02 | Retrait des pages comparatifs, qui nommaient des concurrents (interdit dans tout contenu public, `DECISIONS-STRATEGIQUES.md` § 2) : `/comparatif` et ses 8 pages supprimées avec leurs données, redirection permanente (308) vers `/pricing` pour les liens déjà indexés, sorties du sitemap, du middleware et du service worker (version de cache passée à v2 pour vider les pages déjà gardées hors ligne), liens retirés du pied de page et du glossaire. Générateur d'articles du blog : 3 sujets « Qonforme vs … » supprimés, consigne qui interdit de nommer un autre logiciel ou d'inventer chiffres, avis et témoignages. 982 pages générées | `next.config.mjs`, `app/sitemap.ts`, `lib/supabase/middleware.ts`, `public/sw.js`, `components/layout/Footer.tsx`, `app/glossaire/page.tsx`, `lib/ai/seo-topics.ts`, `lib/ai/gemini.ts`, `DECISIONS-STRATEGIQUES.md` |
| 2026-10-02 | Refonte de l'accueil, héros « Clair sobre » validé : fond blanc, texte centré, boutons en pilule, vrai produit (captures des pages de démo, données d'exemple) dans un Mac et un iPhone dessinés en CSS, qui se redressent au défilement ; parcours « du premier devis au dernier paiement » avec écran fixe qui change en fondu (iPhone sur mobile), frise de la réforme qui se remplit, titres révélés mot à mot, effets de profondeur, bandeau des métiers du bâtiment. Contenu vrai uniquement : retirés les faux avis Trustpilot (4,8/5), faux chiffres, tableau comparatif, « Factur-X certifié », « homologué », urgence chiffrée, formulaire « réponse sous 24 h » ; la transmission par plateforme agréée est dite « en préparation », la formule Artisan « bientôt ». Titre provisoire « simple dès le premier devis » : « conforme de bout en bout » reviendra avec la transmission. FAQ honnête (et son JSON-LD), engagements (documents conservés, remboursé 30 jours, sans engagement), vouvoiement. Animations sûres sur iOS (opacité et transformations seulement, ni `backdrop-filter` ni `will-change`) ; « Réduire les animations » respecté sans rendu différent entre serveur et client (`MotionConfig reducedMotion="user"` + classe `.lp-motion`). Pied de page public corrigé (badge « Conforme PPF · DGFiP », horaires d'un support humain, tutoiement) ; titre, description, image de partage et données structurées du site ne promettent plus de transmission ni de Factur-X certifié. Photos d'artisans : emplacements prêts (`lib/landing/photos.ts`), générateur `scripts/generate-landing-photos.mjs` (clé OpenAI ou Gemini lue dans l'environnement) ; en attente d'une clé, Gemini refusant la génération d'images sans facturation activée | `app/page.tsx`, `components/landing/{LandingHero,devices,motion}.tsx`, `lib/landing/photos.ts`, `public/landing/ecrans/`, `scripts/generate-landing-photos.mjs`, `components/layout/Footer.tsx`, `app/layout.tsx`, `app/globals.css` |
| 2026-10-02 | Canevas de design, version 19 (aucun code applicatif) : accueil refait avec le tableau de bord dans un ordinateur et l'accueil mobile dans un téléphone (cadres en CSS, écrans rendus depuis les planches du canevas), photos d'illustration Pexels (bande chantier, trois profils, appel final), signature du devis sur téléphone dans « Du devis signé à l'argent sur le compte », appel final passé sur fond clair (plus de halo bleu), animations au défilement en CSS seul (`animation-timeline`), sans `backdrop-filter` ni `will-change`, désactivées par « Réduire les animations ». Planche agrandie, planches suivantes décalées d'autant. Sources et licence des photos consignées (section 6 de `DECISIONS-STRATEGIQUES.md`) | `DECISIONS-STRATEGIQUES.md` |
| 2026-10-02 | Canevas de design, version 20 (aucun code applicatif) : accueil enrichi à la demande du fondateur. Téléphone du héros aux bonnes proportions ; titres en deux voix (Bricolage Grotesque puis Instrument Serif italique en bleu) ; éléments flottants (notifications, puces) ; 9 nouvelles sections (bandeau des métiers, devis sur ordinateur, manifeste qui s'encre au défilement, mobile avec trois téléphones, « Payé à l'heure » avec page de règlement et scénario de relances, trésorerie, seconde bande photo, galerie des métiers en deux rangées, démarrage en trois étapes, aperçu des tarifs) ; 14 écrans rendus depuis les planches du canevas, 11 photos Pexels de plus. Revue en quatre angles par des agents, chaque point vérifié par un second agent : animations au défilement qui restaient figées (conteneurs `overflow:hidden` qui captent `view()`, remplacés par `overflow:clip`), éléments flottants qui cachaient des montants, îlot du téléphone sur l'en-tête des écrans, photos en double dans la galerie, signature en ligne suggérée dans l'offre gratuite, relance J+7 sur une facture pas encore échue, espaces insécables dans les montants, contrastes. « Mercredi 1er octobre » corrigé en « Jeudi » sur trois planches. Planche agrandie à 16 960 px, planches suivantes décalées d'autant | `DECISIONS-STRATEGIQUES.md` |
| 2026-10-02 | Design du canevas appliqué à tout le site en code. **Fondations** : jetons `--q-*` clair et sombre, kit `q-*` (`app/globals.css`), alias Tailwind `q-*`, Instrument Serif pour la seconde voix des titres, montants en DM Sans tabulaire et références en DM Mono, primitives restylées, variantes `data-open`/`data-closed` pour les animations Base UI. **Coque commune** à l'application et à la démo (`AppShellFrame`) : barre latérale blanche (entreprise, seuls écrans existants, encart honnête), barre supérieure flottante (fil d'Ariane, recherche ⌘K sur factures/devis/clients via `/api/search`, menu « Nouveau » avec raccourcis, cloche « À surveiller » via `/api/attention`, menu du compte), barre flottante du bas et feuilles « Créer » / « Plus » sur mobile, impression limitée au document. **Pages** (réelles et démo sur les mêmes vues, données de démo communes `lib/demo/data.ts`) : tableau de bord (« Facturé » et non « Encaissé » car `paid_at` n'est jamais écrit, période, « À faire », réforme, premiers pas), factures, devis, bons de commande, avoirs (listes à onglets, fiches avec aperçu papier), éditeur partagé des trois documents avec aperçu en direct, clients, catalogue, paramètres (miroirs démo complets), connexion et inscription, tarifs, accueil v20 avec 16 photos Pexels et captures refaites, en-tête et pied publics unifiés, outils, blog, guides, modèles, pages métiers, glossaire, pages légales. Rien pour ce qui n'est pas livré (chantiers, réception, trésorerie, situations, transmission, lien de paiement, signature en ligne). **Corrigé au passage** : devis d'un client sans email qui ne pouvait plus être marqué envoyé, `?client=` sans effet dans les formulaires, onglet « En retard » inaccessible par lien, rechargement de la page à la première visite par le service worker (saisie perdue), lecture d'abonnement en erreur affichée comme version gratuite, affirmations fausses (« logiciel certifié », Factur-X EN 16931 dans le pied des PDF et l'image de partage, « On répond sous 24h », tutoiement des emails), accents des contenus SEO. Revue adverse en quatre angles (22 défauts corrigés). Build 988/988, lint, 73 tests, 60 pages × 2 formats sans erreur ni débordement | `app/globals.css`, `tailwind.config.ts`, `components/app/kit.tsx`, `components/layout/`, `lib/demo/data.ts`, `components/{dashboard,invoices,quotes,documents,clients,products,credit-notes,purchase-orders,settings,auth,billing,landing,content,outils,blog,search}/`, `app/**`, `app/api/{search,attention}/`, `lib/pseo/`, `lib/pdf/invoice.ts`, `lib/email/templates/`, `components/pwa/ServiceWorkerRegister.tsx` |
| 2026-10-03 | Barèmes légaux des outils et contenus vérifiés sur les sources officielles et corrigés. **Pénalités de retard** (Code de commerce, art. L441-10) : le calcul appliquait un modèle inexistant (« BCE × 3 par défaut, BCE × 1 minimum », avec une BCE à 4 %). Désormais : sans taux prévu, taux de refinancement de la BCE + 10 points (2,40 % au 1er juillet 2026, soit 12,40 % au 2ᵉ semestre 2026) ; un taux prévu jamais sous 3 × le taux d'intérêt légal (2,75 % entre professionnels, arrêté du 26 juin 2026, soit 8,25 %), avec une alerte dans le calculateur. Valeurs du semestre centralisées dans `SEMESTRE_REFERENCE`, à mettre à jour chaque 1er janvier et 1er juillet. Générateur de conditions de paiement : options « BCE + 10 points » et « 3 × taux légal », texte qui ne confond plus taux légal et BCE. **Franchise de TVA** (CGI, art. 293 B) : 36 800 €/91 900 € remplacés par 37 500 €/85 000 € (majorés 41 250 €/93 500 €) dans 4 outils, guides, glossaire, modèles et pages métiers ; règle de dépassement corrigée (plus de tolérance d'une seconde année depuis le 1er mars 2025 ; TVA à la date du dépassement du seuil majoré, au 1er janvier suivant pour le seul seuil de base) ; activité mixte : dépasser un seuil fait sortir toute l'activité ; avocat : seuil propre de 50 000 € ; calculateur TVA qui donnait les plafonds micro comme seuils de TVA. **Micro-entreprise** : libéral non réglementé 25,6 % (décret n° 2025-943), plafonds 203 100 €/83 600 €, barème de l'impôt 2026 dans le simulateur de revenu net ; « à jour » retiré des métadonnées. **Facturer à l'étranger** : « article 283-1 » (qui vise un fournisseur non établi en France) remplacé par « Exonération de TVA, article 262 ter I du CGI » pour les biens et « Autoliquidation » pour les services. Sources citées en commentaire (Légifrance, BCE, BOFiP, service-public). 11 tests | `lib/outils/{penalites,franchise-tva,charges}.ts`, `app/outils/{calculateur-penalites-retard,generateur-conditions-paiement,simulateur-seuil-tva,simulateur-charges-auto-entrepreneur,simulateur-revenu-net,calculateur-tva}/`, `app/outils/page.tsx`, `lib/pseo/{guides,glossaire,modeles,metiers}.ts`, `__tests__/penalites.test.ts` |
| 2026-10-03 | Fix recherche d'entreprise au répertoire Sirene, constatée en production : par SIREN, seule la raison sociale revenait (jamais l'adresse) ; un entrepreneur individuel perdait son prénom (« BOUNEZOUR » au lieu de « OUASSIM BOUNEZOUR » : les prénoms sont à la racine de `uniteLegale`, pas dans la période) ; par SIRET, le nom revenait vide (`etablissement.uniteLegale` est à plat), si bien que la recherche d'un client par SIRET répondait « introuvable ». Désormais : prénom et nom ou dénomination, adresse du siège (second appel sur le SIRET du siège), entreprise fermée signalée (inscription, paramètres, fiche client), délai de 8 s, sans cache. Repli sur l'API Recherche d'entreprises de l'État (sans clé) quand l'INSEE est injoignable, refuse la clé ou n'est pas configurée ; un introuvable de l'INSEE reste un introuvable. 9 tests sur les formes de réponse de l'INSEE | `lib/utils/sirene.ts`, `types/index.ts`, `components/clients/{lookup.ts,ClientForm.tsx}`, `components/auth/CompanyForm.tsx`, `components/settings/CompanySettingsForm.tsx`, `__tests__/sirene.test.ts` |
| 2026-10-03 | Blog : repérage des articles qui citent une valeur obsolète ou une affirmation interdite (anciens seuils de franchise et plafonds micro, ancien calcul « BCE × 3 », article 283-1, ancien taux libéral, « certifié »/« homologué », avis invérifiables, « PDP ») dans une nouvelle page admin `/admin/blog/verification`, avec le passage et la valeur juste ; rien n'est modifié automatiquement. Un article généré qui en contient reste en brouillon. Le générateur reçoit des faits de référence construits depuis les constantes vérifiées des outils. Recherche Sirene : clé de contrôle vérifiée côté serveur, panne du répertoire distinguée d'un introuvable (503), fiche vide de l'annuaire traitée en introuvable | `lib/blog-audit.ts`, `app/admin/(panel)/blog/verification/page.tsx`, `components/admin/AdminSidebar.tsx`, `app/api/cron/generate-blog/route.ts`, `lib/ai/gemini.ts`, `lib/utils/sirene.ts`, `app/api/{sirene,outils/siret}/route.ts`, `components/auth/CompanyForm.tsx`, `components/settings/CompanySettingsForm.tsx`, `__tests__/{blog-audit,sirene}.test.ts` |
| 2026-10-03 | Factur-X des factures et avoirs refait : XML CII profil EN 16931 avec les règles françaises (cadre de facturation BT-23, SIREN schéma 0002, SIRET 0009, adresses électroniques BT-34/BT-49, ordre du schéma corrigé : l'ancien XML était invalide), TVA motivée par couple catégorie/taux (franchise : catégorie E + VATEX-FR-FRANCHISE, plus jamais Z ; autoliquidation BTP AE prête via `vat_treatment` sur une ligne, intracommunautaire K, export G), mentions de règlement entre professionnels AAB/PMD/PMT aussi imprimées sur le PDF et l'aperçu si l'entreprise ne les a pas, TVA par taux sur le PDF, avoirs 381 avec la facture d'origine, PDF/A-3b (XML associé, XMP Factur-X, profil sRGB, glyphes absents filtrés). Validé avec Mustang 2.26.0 (veraPDF, XSD Factur-X, schématrons CEN EN 16931 1.3.16 et AFNOR BR-FR 1.3.0), revalidé après fusion. Aucune migration. 32 tests | `lib/facturx/{xml,vat,mentions,records,pdfa,srgb-icc}.ts`, `lib/pdf/{invoice,credit-note}.ts`, `app/api/invoices/[id]/{pdf,send,facturx}/route.ts`, `app/api/credit-notes/[id]/{pdf,send}/route.ts`, `components/invoices/InvoicePaper.tsx`, `__tests__/facturx.test.ts` |
| 2026-10-03 | Numéro de facture attribué à l'émission : brouillons sans numéro (affichés « Brouillon »), numéro, statut et date du jour posés en une écriture conditionnelle, nouvel essai sur conflit, émission concurrente numérotée une seule fois (CGI ann. II art. 242 nonies A, BOFiP BOI-TVA-DECLA-30-20-20-10) ; email en échec après émission : facture émise, action « Renvoyer par email ». Bug `overdue` corrigé : une relance ne change plus le statut, retard calculé sur l'échéance à l'heure de Paris dans le tableau de bord, la cloche et le cron. Relances réglables (Paramètres › Relances : rappel J-1/3/5/7, relances J+7/15/30/45, aperçu de l'email) avec journal anti-doublon, relance des devis sans réponse (désactivée par défaut, jamais après la validité), emails au vouvoiement avec pénalités BCE + 10 points et indemnité de 40 € pour les professionnels. Sans la migration `20261003_invoice_number_at_issue_and_reminders.sql`, tout garde l'ancien fonctionnement (numéro à la création, J+30/J+45). Démo, 51 tests | `lib/utils/{document-numbering,paris-date}.ts`, `lib/reminders/`, `lib/email/templates/{reminder,quote-followup}.ts`, `app/api/cron/send-reminders/route.ts`, `app/api/invoices/**`, `app/api/{reminder-settings,dashboard,attention,search}/route.ts`, `components/settings/{ReminderSettingsForm,NotificationsView}.tsx`, `components/invoices/*`, `lib/facturx/records.ts`, `lib/demo/data.ts`, `supabase/migrations/20261003_invoice_number_at_issue_and_reminders.sql`, `__tests__/{invoice-number-at-issue,reminder-schedule,reminder-email}.test.ts` |
| 2026-10-03 | Lien de paiement par virement (DECISIONS § 12) : jeton de 256 bits dérivé d'un secret serveur, stocké haché, stable et désactivable, par facture émise ; page publique `/regler/<jeton>` (reste dû après avoirs, titulaire, IBAN, BIC, référence et montant à copier, PDF, QR code de virement SEPA EPC069-12 généré sans dépendance, « J'ai effectué le virement » qui prévient l'artisan par email ; une déclaration ouverte à la fois, 3 par 24 h ; noindex, sans Referer, jamais en cache, Meta Pixel et PostHog coupés) ; fiche facture (copier, désactiver, bandeau « Virement déclaré », jamais payée automatiquement), cloche « À surveiller », bouton dans l'email d'envoi et dans les relances manuelles et automatiques ; IBAN contrôlé (ISO 13616), titulaire et BIC dans Paramètres › Entreprise ; démo sur les mêmes composants. Masqué tant que la migration `20261003_payment_links.sql` n'est pas appliquée ; variable facultative `PAYMENT_LINK_SECRET` (à fixer une fois pour toutes). 44 tests | `lib/payment-link/`, `app/regler/[token]/page.tsx`, `app/api/regler/[token]/{declaration,pdf}/route.ts`, `app/api/invoices/[id]/{payment-link,send,remind}/route.ts`, `app/api/cron/send-reminders/route.ts`, `components/payment-link/`, `lib/demo/payment-link.ts`, `app/demo/regler/[id]/page.tsx`, `components/layout/DemoFrame.tsx`, `lib/email/templates/{invoice,transfer-declared}.ts`, `app/api/attention/route.ts`, `components/search/{model,demo}.ts`, `components/invoices/{InvoiceDetail,InvoiceDetailView}.tsx`, `components/settings/CompanySettingsForm.tsx`, `lib/supabase/middleware.ts`, `supabase/migrations/20261003_payment_links.sql`, `__tests__/payment-link-*.test.ts` |
| 2026-10-03 | Signature en ligne des devis et bons de commande (signature électronique simple, DECISIONS § 11 et § 12.4) : lien par document et par version (jeton de 256 bits stocké haché, copie chiffrée AES-256-GCM, expiration, désactivation, remplacement si le contenu change), entrée `/s/<jeton>` qui pose un cookie HttpOnly puis redirige (jeton jamais dans l'adresse), page publique `/signer` (noindex, sans Referer, hors cache du service worker) : document lu en entier, signature tracée ou tapée, fonction et n° de commande pour un professionnel, code par email au-delà de 5 000 € TTC (essais et envois limités), certification du taux réduit de TVA (règle du 1er mars 2025, CGI 279-0 bis), rétractation de 14 jours et démarrage anticipé pour un particulier (L221-18, L221-25), signature sur place (aucun paiement avant 7 jours, L221-10), refus avec motif, écrans d'état ; preuve (horodatage, IP, navigateur, SHA-256 du PDF et du contenu), devis accepté ou bon confirmé via document-status.ts, PDF signé avec page « Bon pour accord » en stockage privé ; emails (demande, code, confirmation avec formulaire de rétractation, notification à l'artisan) ; panneau artisan (partage, sur place, nouveau lien, désactivation, preuve), mur de paiement 402 (Essentiel), badge « Avec Essentiel », lien de signature ou de consultation dans l'envoi et dans la relance des devis, réglages dans Modèles de documents ; démo sur les mêmes composants (`/signer/demo/<numéro>`, code 123456). Masqué tant que la migration `20261003_document_signatures.sql` n'est pas appliquée ; variable facultative `SIGNATURE_LINK_SECRET`. 42 tests | `lib/signature/`, `app/s/[token]/`, `app/signer/`, `app/api/signature/`, `components/signature/`, `lib/email/templates/{signature,quote,purchase-order,quote-followup}.ts`, `app/api/cron/send-reminders/route.ts`, `lib/demo/signature.ts`, `components/quotes/QuoteDetailView.tsx`, `components/purchase-orders/PurchaseOrderDetailView.tsx`, `components/settings/InvoiceSettingsForm.tsx`, `components/billing/PaywallDialog.tsx`, `lib/supabase/middleware.ts`, `supabase/migrations/20261003_document_signatures.sql`, `__tests__/signature*.test.ts` |
| 2026-10-03 | Outils gratuits, corrections de l'audit des 12 outils : facture et devis avec un seul calcul en centimes pour l'aperçu et le PDF (9 € HT à 5,5 % = 9,50 € TTC), TVA ventilée par taux (CGI ann. II art. 242 nonies A, I-11°), PDF sur plusieurs pages (200 lignes au plus, aucune perdue), textes passés à la ligne, format français, polices sous-ensemblées (15-24 Ko au lieu de 565 Ko), étape Mentions (pénalités L441-10, indemnité D441-5, mention TVA, assurance : C. artisanat L132-1 ou C. assurances L243-2 pour la décennale, n° de TVA), virgule décimale, API en 400 explicite ; analyseur de montant commun (« 1.234,56 ») ; calculateur TVA où HT + TVA = TTC, taux du bâtiment ; SIRET : entreprise fermée, clé contrôlée avant l'appel, 503, n° de TVA « à confirmer sur VIES » ; vérificateurs de conformité et de mentions selon le profil, sans jamais afficher « Conforme » ; seuil de TVA avec l'année précédente et l'année de création (BOFiP § 130, 285-295) ; pénalités découpées par semestre avec l'historique vérifié 2025-2026 ; numéro de facture et escompte validés ; revenu net avec décote 2026 ; titres sans « \| Qonforme » en double ; lien mort ; avertissement du logo. 65 tests | `lib/outils/{decimal,montant,document,pdf-document,route-document,tva,franchise-tva,penalites,conformite,mentions-facture,numero-facture,revenu-net}.ts`, `app/api/outils/{facture,devis}/route.ts`, `app/outils/**`, `components/outils/{doc-generator,controls,kit}.tsx`, `components/layout/PublicNav.tsx`, titres des pages publiques, `__tests__/outils-*.test.ts` |
| 2026-10-03 | Accès du comptable en lecture seule (DECISIONS § 10) : Paramètres › Accès comptable (invitation par email au nom de Qonforme, jeton de 256 bits stocké haché valable 7 jours, renvoi, retrait immédiat, 5 accès au plus, journal horodaté des consultations et exports conservé un an), lien d'invitation par cookie HttpOnly (jeton jamais dans l'adresse), acceptation liée à l'adresse invitée, compte comptable gratuit sans entreprise, espace `/comptable` (dossiers ; factures émises sans brouillon, avoirs, factures fournisseurs si la réception existe ; totaux et TVA par taux ; FEC, ventes CSV protégées contre l'injection de formules, PDF en ZIP sans dépendance), lecture par service_role revérifiée à chaque requête, tables en RLS sans politique (serveur seul), export non journalisable refusé ; démo sur les mêmes composants. Ouvert à tous pour l'instant (constante `ACCOUNTANT_ACCESS_REQUIRES_PLAN`). Masqué tant que la migration `20261003_accountant_access.sql` n'est pas appliquée. 44 tests | `lib/accountant/`, `app/api/{accountant-access,comptable,invitation-comptable}/`, `app/comptable/`, `app/invitation-comptable/`, `app/settings/comptable/`, `app/demo/{comptable,settings/comptable}/`, `components/accountant/`, `lib/demo/accountant.ts`, `lib/email/templates/accountant-invitation.ts`, `lib/supabase/middleware.ts`, `app/dashboard/page.tsx`, `components/settings/{sections.ts,SettingsOverview.tsx,ExportsView.tsx}`, `components/layout/{nav.ts,DemoFrame.tsx}`, `components/auth/{LoginForm,SignupForm}.tsx`, `app/{login,signup}/page.tsx`, `supabase/migrations/20261003_accountant_access.sql`, `__tests__/accountant-*.test.ts` |
| 2026-10-03 | Espace admin refait au design de l'application : coque du kit (barre latérale « Admin » avec compteurs support et erreurs, barre supérieure flottante, barre du bas et feuille « Plus » sur mobile, où il n'y avait aucune navigation), 17 pages sur le kit `q-*` (thème sombre, listes empilées sur mobile, fenêtres de confirmation, états vides et « Données indisponibles »), graphiques en barres CSS, connexion admin dans le style des pages d'accès (noindex). Prospects et campagnes : bandeau « Démarchage désactivé par décision », confirmation avant extraction, enrichissement et lancement, rien supprimé ; les trois tâches planifiées de prospection ne font plus rien tant que `PROSPECTION_ENABLED` ne vaut pas « true ». Corrigé : recherche d'utilisateur par email, compteurs calculés sur la liste filtrée, panne affichée comme vide ou 404, heures en UTC, historique des tâches planifiées mal étiqueté (compte aussi les nouvelles relances), recherche de prospects cassée par une virgule, pastilles et formules mal libellées, suppression Brand Studio invisible au doigt, texte de résiliation faux, tutoiement, ref perdu par `Button` (avertissement React sur toutes les fenêtres), lecture d'un réglage admin en échec renvoyée comme vide, charte Brand Studio qui demandait des dégradés bleus refusés. Pixel Meta retiré des pages admin, signature et invitation comptable | `app/admin/**`, `components/admin/`, `components/ui/button.tsx`, `lib/outreach/enabled.ts`, `app/api/cron/{outreach-sequence,scraping-sirene,enrich-prospects}/route.ts`, `app/api/admin/settings/route.ts`, `app/layout.tsx`, `lib/ai/gemini.ts`, `.env.example` |
| 2026-10-03 | Réception des factures fournisseurs, prête pour une plateforme agréée (obligation depuis le 1er septembre 2026, CGI art. 289 bis, guide pratique DGFiP de juillet 2026) : boîte « Factures reçues » (liste à onglets, recherche, fiche avec parties, lignes, TVA, totaux, PDF d'origine), import avec aperçu d'un PDF Factur-X, d'un XML CII ou UBL 2.1, ou d'un PDF simple avec saisie minimale, toujours relu côté serveur ; contrôles bloquants (destinataire, doublon fournisseur + numéro + année, données indispensables) et avertissements (totaux, TVA) ; lecteur XML sans DOCTYPE ni entité externe, décompression bornée, 4 Mo au plus ; cycle de vie aux codes DGFiP 200-213 (liste blanche côté serveur, motifs de refus de l'annexe 7, historique horodaté), local tant qu'aucune plateforme n'est raccordée, ce que l'interface dit ; adaptateur de plateforme agréée « aucun » par défaut (`PA_PROVIDER`), webhook en 404 ; Paramètres › Facturation électronique réécrit ; pas de mur de paiement (obligation légale pour tous) ; démo sur les mêmes composants ; factures fournisseurs visibles dans l'espace comptable. Migration `20261003_received_invoices.sql` à appliquer. 36 tests | `lib/reception/`, `lib/pa/`, `app/api/received-invoices/`, `app/api/pa/webhook/`, `app/received-invoices/`, `app/demo/received-invoices/`, `components/reception/`, `lib/demo/reception.ts`, `components/settings/EInvoicingView.tsx`, `components/layout/nav.ts`, `components/dashboard/ReformCard.tsx`, `lib/supabase/middleware.ts`, `supabase/migrations/20261003_received_invoices.sql`, `__tests__/reception.test.ts`, `__tests__/fixtures/reception/` |
| 2026-10-03 | Mentions du bâtiment automatiques et catalogue par métier : profil légal dans Paramètres › Entreprise (métier, régime de TVA, micro/EI/société avec forme, capital et RCS, assurance décennale et RC pro : assureur, coordonnées, contrat, couverture ; métier et TVA à l'inscription, aperçu en direct), mentions générées sur devis, factures, bons de commande et avoirs (PDF, aperçus, éditeur, PDF signé ; EI R526-27, R123-237/238, art. 293 B, C. artisanat L132-1 / C. assurances L243-2) sans doublon avec les mentions libres, passées à la ligne au lieu d'être tronquées ; Factur-X sur le régime déclaré (repli sur « 293 B ») ; mentions figées à l'émission par le déclencheur `freeze_document_legal_snapshot` (`legal_snapshot`) ; import des prestations courantes de 11 métiers, TVA 10/5,5/20 % selon le chantier avec les exclusions de 2025, aucun prix inventé (« Prix à compléter ») ; démo. Migrations exécutées pour de vrai dans un Postgres embarqué (PGlite) imitant Supabase : les 7 migrations en attente passent, rejouables, dans n'importe quel ordre ; déclencheur, contrainte « facture émise = numéro », unicité, RLS et retrait des politiques d'abonnement vérifiés. `20260901_unique_document_numbers.sql` rendue rejouable. Migration `20261003_legal_profile_btp.sql` à appliquer. 46 tests | `lib/legal/`, `lib/catalogue/trades.ts`, `lib/pdf/*`, `lib/facturx/{xml,records}.ts`, `lib/signature/server.ts`, `components/settings/{LegalProfileCards,CompanySettingsForm,InvoiceSettingsForm,DocumentPreview}.tsx`, `components/products/{CatalogueView,TradeImportDialog,ProductCombobox}.tsx`, `components/documents/`, `components/{invoices,quotes,purchase-orders,credit-notes}/*`, `components/auth/CompanyForm.tsx`, `app/api/products/import/`, `app/api/{company,invoices,quotes,purchase-orders}/**`, `lib/demo/legal-profile.ts`, `supabase/migrations/{20261003_legal_profile_btp,20260901_unique_document_numbers}.sql`, `__tests__/{legal-mentions,trade-catalogue,legal-profile-server}.test.ts` |
| 2026-10-03 | Démarrage d'un compte neuf : écran « Par quoi voulez-vous commencer ? » (`/demarrer`, 4 choix + « Explorer le tableau de bord », renvoi unique depuis le tableau de bord d'un compte neuf, démo `/demo/demarrer`) ; devis d'essai envoyé à soi-même (PDF en mémoire filigrané « EXEMPLE », sans numéro, jamais enregistré dans les devis, 3 par 24 h) ; rappel « plus tard » (ce soir 19 h, demain 7 h 30, samedi 9 h, autre moment, heure de Paris, un seul en attente, annulable) ; séquence de 5 emails déclenchés par les actions (bienvenue, premier devis, relance à J+7, du devis à la facture, ce que change Essentiel), une fois chacun, arrêt dès l'action faite, au plus un email par 20 h en journée, seuls les comptes créés après la migration ; désinscription en un clic par lien signé, en-têtes List-Unsubscribe (RFC 8058) et réglage dans Paramètres › Relances (CPCE L34-5, CNIL). Nouveau cron `/api/cron/onboarding` (toutes les 15 min, à créer sur cron-job.org avec `CRON_SECRET`). Migration `20261003_onboarding_emails.sql` exécutée dans PGlite, à appliquer ; variable facultative `EMAIL_UNSUBSCRIBE_SECRET`. 66 tests | `lib/onboarding/`, `lib/email/templates/{onboarding,welcome}.ts`, `app/demarrer/`, `app/demo/demarrer/`, `app/desinscription/`, `app/api/{onboarding,emails/unsubscribe,cron/onboarding}/`, `components/onboarding/{StartScreen,UnsubscribeClient}.tsx`, `components/settings/{OnboardingEmailsCard,NotificationsView}.tsx`, `app/dashboard/page.tsx`, `app/api/auth/signup/route.ts`, `lib/pdf/quote.ts`, `lib/email/resend.ts`, `supabase/migrations/20261003_onboarding_emails.sql`, `__tests__/onboarding-*.test.ts` |
| 2026-10-03 | Formule Artisan : factures d'acompte (Factur-X 386, TVA exigible à l'encaissement, CGI 269-2), situations de travaux cumulées (globales ou par ligne, TVA cumulée par ligne, acomptes repris au prorata en lignes négatives, décompte final), facture de solde (cadre S4, acomptes en BG-3, devis en BT-12), un brouillon par devis, numéro à l'émission, conversion simple bloquée une fois la facturation par situations commencée ; retenue de garantie (loi 71-584 : 5 % au plus ou caution ; « À régler à l'échéance » sur PDF, fiche, emails, relances et page de règlement ; note ABU ; libération un an après la réception, lettre de demande) exclue des montants « à encaisser » et « en retard » du tableau de bord et de la cloche ; autoliquidation en sous-traitance (CGI 283-2 nonies, catégorie AE) dans l'éditeur ; chantiers (page réelle et démo : signé, facturé, encaissé hors retenue, reste à facturer, retenues, rattachement des documents, héritage du chantier) ; mur `requireArtisanAccess` (402 `ARTISAN_REQUIRED`, 503), formule vendue dès que ses deux prix Stripe sont configurés (lu au build), passage Essentiel → Artisan par le portail ; démo d'un chantier en sous-traitance complet. 7 factures types validées par Mustang, migrations passées dans PGlite, build 1 007/1 007, parcours du site compilé sans erreur. Migration `20261003_artisan_chantiers.sql` à appliquer ; prix Stripe Artisan à créer (`STRIPE_PRICE_ARTISAN_MONTHLY`, `STRIPE_PRICE_ARTISAN_YEARLY`). 52 tests | `lib/artisan/`, `components/artisan/`, `app/chantiers/`, `app/demo/chantiers/`, `app/api/{artisan,chantiers}/`, `lib/pdf/{invoice,quote,retention-request}.ts`, `lib/facturx/{xml,records,vat}.ts`, `components/{documents,invoices,billing,payment-link,dashboard}/*`, `components/quotes/QuoteDetailView.tsx`, `app/api/{invoices,quotes,stripe/checkout,cron/send-reminders,dashboard,attention}/**`, `lib/payment-link/`, `lib/stripe/plans.ts`, `next.config.mjs`, `lib/demo/{data,chantiers,payment-link}.ts`, `supabase/migrations/20261003_artisan_chantiers.sql`, `__tests__/artisan-*.test.ts` |
| 2026-10-24 | Outils gratuits (devis et facture en PDF) : mesure et conversion. Événement PostHog `tool_pdf_generated` à chaque téléchargement (type d'outil et nombre de lignes seulement : aucun contenu de document, aucune donnée personnelle) ; `identify` à l'inscription avec le seul identifiant du compte, pour relier le visiteur de l'outil au compte qu'il crée (PostHog est configuré en `identified_only`, l'identifiant anonyme de la visite est fusionné) ; message « Votre devis est prêt » / « Votre facture est prête » sous le bouton après le téléchargement, amené dans la zone visible sur mobile : il ne promet pas de retrouver le document (l'outil n'enregistre rien), ne parle ni de signature en ligne ni d'envoi de facture, et mène à `/signup?source=outil-devis-pdf` ou `outil-facture-pdf` pour l'attribution. Pied du PDF « Devis généré sur qonforme.fr » (le mot « gratuitement » retiré à la demande du fondateur) et propriété Creator du fichier = « Qonforme ». Vérifié dans un navigateur sur un build : PDF téléchargé et relu avec pdftotext, événements PostHog décodés, `$identify` fusionné avec la visite de l'outil. Piège pour les tests : posthog-js n'envoie rien depuis un navigateur automatisé (`navigator.webdriver`, marque HeadlessChrome des client hints), à masquer dans le scénario. 10 tests | `lib/analytics.ts`, `lib/outils/apres-pdf.ts`, `lib/outils/pdf-document.ts`, `components/outils/doc-generator.tsx`, `components/auth/SignupForm.tsx`, `__tests__/outils-apres-pdf.test.ts` |

---

---

## 🎯 Plan mots-clés — octobre 2026 (en cours)

> Validé avec le fondateur le 16/10/2026. Feuille de route, mots-clés retenus avec leur volume et cases à cocher : **`MOTS-CLES-COMPACTS-2026-10.md` § 0**. Preuves : même fichier, § 1 à 9.

- **Cible** : des requêtes précises qui ont de la recherche réelle et décrivent exactement l'offre : « exemple devis remplacement tableau électrique » (390/mois), « exemple devis auto entrepreneur » (480), « devis vierge à imprimer » (260), « logiciel plombier » (260), « logiciel devis {métier} »…
- **Cette semaine** : titres des 11 pages métier (« Logiciel de devis gratuit pour {métier} »), titre de l'exemple d'électricien, section « attestation TVA 10 % » du guide TVA, versions mail de la relance d'impayé.
- **Ensuite** : 7 pages d'exemple à créer (`/modele/devis-vierge`, `devis-auto-entrepreneur`, `devis-paysagiste`, `devis-peinture`, `devis-maconnerie`, `devis-plomberie`, `devis-placo`), puis le blog.
- **Accents** : orthographe correcte partout dans les textes ; adresses sans accents (règle dans `CLAUDE.md`, « Règles metadata par page »).

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
- [x] Route `/api/preview` (edge, ImageResponse 1000x600) — preview stylisé par type (facture/devis/avoir/relance) — supprimée le 02/10/2026 : aucune page ne l'appelait
- [x] Image preview affichée sur chaque page `/modele/[slug]` avec contenu dynamique
- [x] Impact : conversion + temps sur page amélioré

---

## 📊 Audit SEO Indexation — 09/04/2026

> Source : Google Search Console, rapport au 06/04/2026.

### État actuel
- **Pages indexées** : 59 / 963 connues (**6 % — critique**)
- **Pages non indexées** : 904

### Répartition des 904 pages non indexées

| Motif | Nombre | Analyse |
|-------|--------|---------|
| Détectée, actuellement non indexée | 847 | Pages ville x métier (780) + blog + comparatifs — Google refuse de les crawler |
| Autre page avec balise canonique correcte | 38 | À investiguer |
| Erreur liée à des redirections | 18 | Middleware corrigé (bypass Supabase pour routes publiques) |
| Page avec redirection | 1 | À investiguer |

### Diagnostic — Causes racines

1. **Pages ville x métier = thin content** — 780 pages quasi-identiques (même template, seuls la ville et la CCI changent). Google les considère comme spam programmatique.
2. **Crawl budget insuffisant** — Domaine jeune (59 pages indexées) qui publie 800+ pages d'un coup → Google n'alloue pas de budget crawl.
3. **Publication en masse** — L'apparition soudaine de centaines de pages est un signal négatif (perçu comme spam).
4. **Slugs blog avec hash** — Les suffixes auto-générés (`-dq3db`, `-1fyuv`) renforcent l'impression de contenu automatisé.

### Décision — Reculer pour mieux sauter

**Les 780 pages ville x métier sont contre-productives à ce stade.** Elles dégradent la confiance de Google envers le domaine et ralentissent l'indexation des pages de qualité.

### Plan d'action SEO (Avril 2026)

#### S1. Retirer les pages ville du sitemap ⚠️ PRIORITAIRE
- [ ] Retirer les entrées `METIERS x VILLES` du sitemap (`app/sitemap.ts`)
- [ ] Garder les pages en ligne (pas de 404) mais ne plus les soumettre à Google
- [ ] Impact : Google arrête de compter 780 pages thin contre le domaine

#### S2. Garder les 64 pages pSEO core
- [ ] Métiers (39), Guides (14), Modèles (11) → contenu unique, garder dans le sitemap
- [x] Comparatifs (8) → **retirés le 02/10/2026** (ils nommaient des concurrents), redirection 308 vers `/pricing`
- [ ] Glossaire (27) → contenu unique, garder

#### S3. Nettoyer les slugs blog
- [ ] Régénérer les slugs en format propre (sans suffixes hash)
- [ ] Redirection 301 des anciens slugs si déjà indexés

#### S4. Attendre l'indexation des pages core
- [ ] Objectif : 100+ pages indexées avant de réintroduire les pages géolocalisées
- [ ] Surveiller GSC chaque semaine

#### S5. Réintroduire les pages ville (plus tard)
- [ ] Seulement quand le domaine a 100+ pages indexées et des backlinks
- [ ] Avec du contenu vraiment unique par ville (stats INSEE, avis locaux, données économiques)
- [ ] Publication progressive (10-20 pages/semaine, pas 780 d'un coup)

---

## 🚀 Trafic organique — TODO list Phase 2 (Mars 2026)

> Axes d'amélioration identifiés le 27 mars 2026 pour augmenter le trafic organique au-delà du pSEO existant (64 pages).

### 🔴 Priorité HAUTE — Gros levier trafic

#### T1. Pages ville x métier (pSEO géolocalisé) — ⚠️ Suspendu (voir Audit SEO Indexation)
- [x] `lib/pseo/villes.ts` : 20 villes françaises (CCI, chambre des métiers)
- [x] `app/facturation/[slug]/[ville]/page.tsx` : URL `/facturation/plombier/paris`
- [x] Contenu : infos locales, features métier, FAQ, maillage inter-villes/inter-métiers
- [x] 39 métiers x 20 villes = **780 pages** avec JSON-LD (FAQPage + BreadcrumbList + LocalBusiness)
- [ ] ⚠️ **Retirées du sitemap** — Google les considère comme thin content (847 pages "Détectée, non indexée")
- [ ] À réintroduire quand le domaine a 100+ pages indexées, avec contenu unique par ville

#### T2. Pages comparatif "Qonforme vs X" — ❌ Retirées le 02/10/2026
> Retirées : nommer un concurrent dans un contenu public est interdit (`DECISIONS-STRATEGIQUES.md` § 2). Redirection 308 de `/comparatif` et `/comparatif/*` vers `/pricing`.

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

## 📱 App mobile — abandonnée au profit de la PWA (02/10/2026)

L'app native iOS (Capacitor) a été retirée du code. Le mobile passe par le site
responsive, installable sur l'écran d'accueil (PWA). Raison et règle : `CLAUDE.md`,
section « Pas d'app native ».

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
| 2026-10-19 | **Compte d'essai = mêmes écrans qu'en production, activité Stripe dans l'admin, « Remboursée », invite d'installation limitée au tableau de bord** (essais du fondateur, première passe sur ordinateur puis sur téléphone). **Mêmes écrans** : un compte d'essai ne voyait pas le bouton « Passer à Artisan » (les identifiants de prix d'essai ne sont pas lisibles dans le navigateur) ; la disponibilité de la formule est maintenant décidée côté serveur (`lib/stripe/availability.ts`, `artisanOnSaleFor`, selon le mode du compte) et transmise aux écrans (Tarifs, choix de formule, abonnement, mur de paiement par `/api/subscription/status`, avis Artisan) : même écran en essai et en production, seule la clé Stripe change. **Historique de facturation** : une facture remboursée par la garantie se lisait « Payée » ; `invoiceBadge` (`lib/stripe/invoice-status.ts`) affiche Remboursée, Remboursée en partie (« dont X € remboursés »), À régler, Impayée, Annulée. **Admin › Paiements** : encaissé, remboursé, net, abonnements actifs, résiliations programmées, paiements en échec sur 30 jours, 25 derniers paiements et remboursements émis (`lib/stripe/admin-activity.ts`, `components/admin/payments/ActivityPanels.tsx`), onglets Production / Essai (`?mode=test`), listes empilées sur téléphone, « Non configuré » ou « Données indisponibles » au lieu d'un écran vide. **Invite d'installation** (PWA) : sur téléphone elle recouvrait le contenu et le bandeau de cookies dès la première visite du site public et cachait le bouton d'enregistrement des formulaires ; le fondateur l'a ensuite fait **désactiver partout** (`INSTALL_PROMPT_ENABLED = false`, `lib/pwa/config.ts` ; l'application reste installable par le menu du navigateur ; une fois réactivée elle ne paraît que sur `/dashboard`, jamais avec `?bienvenue`). **Fiche client** : le sous-titre « Avec le SIREN… » n'est plus affiché sur l'onglet Particulier. `getUserStripeMode` rend `null` au lieu de lever une erreur. Aucune migration. 17 + 10 tests | `lib/stripe/{availability,invoice-status,admin-activity,test-users}.ts`, `components/billing/{useArtisanOnSale,PricingSelector,BillingPageClient,PaywallDialog}.ts(x)`, `components/artisan/ArtisanNotice.tsx`, `lib/artisan/access.ts`, `app/api/subscription/status/route.ts`, `app/{pricing,signup/plan,settings/billing}/page.tsx`, `app/admin/(panel)/payments/page.tsx`, `components/admin/payments/ActivityPanels.tsx`, `components/pwa/InstallPrompt.tsx`, `lib/pwa/config.ts`, `components/clients/ClientForm.tsx`, `__tests__/{stripe-activity,stripe-test-parity-ui,install-prompt}.test.ts` |
| 2026-10-19 | **Éditeur des pages légales : Diez Agency LLC, plus de « Qonforme SAS »** (demande du fondateur ; « Qonforme » n'est qu'une marque, DECISIONS § 14.1). Fiche unique `lib/legal/publisher.ts` (dénomination, forme : société à responsabilité limitée de droit américain constituée dans l'État du Wyoming, contacts, **adresse du siège et directeur de la publication à renseigner**, affichés dans les mentions légales seulement une fois remplis : jamais de texte « à compléter » en ligne). Mentions légales (éditeur, propriété intellectuelle, responsable du traitement, tableau Société / Contact), CGU (article 1 : « Qonforme » = la marque sous laquelle la LLC exploite et vend le Service ; propriété intellectuelle), politique de confidentialité (responsable du traitement, et le responsable est lui-même établi aux États-Unis dans la section Transferts), pied de page « © 2026 Qonforme, édité par Diez Agency LLC », page 404, `legalName` des données structurées ; dates de mise à jour au 19 octobre 2026. Non modifié, à valider avec l'expert-comptable ou un juriste : droit et tribunaux français (article 11 des CGU), représentant dans l'Union (RGPD art. 27), garanties du transfert vers la LLC. Aucune migration. 6 tests (dont un garde-fou : plus aucun « Qonforme SAS » dans `app`, `components` et `lib`) | `lib/legal/publisher.ts`, `app/{mentions-legales,cgu,confidentialite}/page.tsx`, `components/layout/Footer.tsx`, `app/not-found.tsx`, `app/layout.tsx`, `DECISIONS-STRATEGIQUES.md`, `PLAN-PLATEFORME-AGREEE-2026-10.md`, `__tests__/legal-publisher.test.ts` |
| 2026-10-19 | **Parcours d'achat testé sur téléphone, confirmation du remboursement visible** (demande du fondateur : refaire sur mobile tout ce qui a été fait sur ordinateur, captures à chaque étape). iPhone 14 (390 × 844) sur le site en ligne, compte d'essai, bac à sable : inscription, client, facture, mur de paiement, paiement Essentiel 24 € par carte d'essai (sans Link), facture émise, passage à Artisan par le portail (10,00 € au prorata), résiliation programmée, garantie de 30 jours (34 € remboursés, historique « Remboursée »), nouvel abonnement après remboursement : tout passe, rien ne bloque, aucun défilement horizontal (détail au § 14.6 de `DECISIONS-STRATEGIQUES.md`). Correctif : le bouton « Confirmer le remboursement » apparaissait sous la barre de navigation flottante, l'encadré se centre à l'écran à son ouverture (`GuaranteeCard`). Constat : l'envoi de la facture a échoué parce que Resend refuse les destinataires en `example.com` (test seulement). Mise en ligne des 7 commits précédents vérifiée (pages légales, « Remboursée », bouton Artisan en compte d'essai, invite d'installation absente). Aucune migration | `components/billing/BillingPageClient.tsx`, `DECISIONS-STRATEGIQUES.md` |
| 2026-10-19 | **Devis envoyé par email resté « Brouillon », cloche « À surveiller » en erreur 500** (constaté en envoyant un devis depuis le téléphone, compte d'essai, site en ligne). La table `quotes` n'a pas de colonne `sent_at` tant que la migration n'est pas appliquée : `POST /api/quotes/[id]/send` écrivait le statut et la date d'envoi en une seule mise à jour, qui échouait en bloc sans rien dire (l'email partait, le devis restait « Brouillon », donc ni conversion en facture ni relance de devis), et `GET /api/attention` demandait la colonne dans sa lecture (500, cloche vide). **Envoi** : le statut est écrit seul (`statusAfterSend`) ; s'il échoue, l'erreur est dite (502 « Le devis est parti par email, mais son statut n'a pas pu être mis à jour… »), jamais silencieuse ; la date d'envoi est écrite à part et sa colonne absente est tolérée (`isMissingSchemaError`). **Cloche** : lecture avec `sent_at`, repli sur la date d'émission si la colonne manque. Le code marche avec ET sans la migration `20261019_quotes_sent_at.sql` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS sent_at`), **à appliquer** ; sans elle, rien ne casse. 5 tests (4 échouent sans le correctif) | `app/api/quotes/[id]/send/route.ts`, `app/api/attention/route.ts`, `supabase/migrations/20261019_quotes_sent_at.sql`, `__tests__/quotes-sent-at.test.ts` |
| 2026-10-19 | **App mobile native rouverte sur plan, sans achat dans l'app** (demande « App Mobile », réponses du fondateur : iOS et Android, pas d'achat dans l'app, plan d'abord). Rien de codé. `PLAN-APP-MOBILE-2026-10.md` : voie 3.1.3(f) d'Apple (app gratuite compagnon d'un outil payant, aucun prix ni appel à l'action), produit dans l'app (compte gratuit = devis, clients, catalogue, brouillons ; à l'émission message sans prix à la place de `PaywallDialog`, le serveur refuse toujours en 402), règles des magasins vérifiées et non vérifiées (Apple UE depuis le 01/10/2026, Google Play), constat dans le code (**aucune suppression de compte** par l'utilisateur, surfaces de vente à masquer listées), architecture (Capacitor à la racine du domaine, jeton d'app dans le user-agent lu côté serveur, liste blanche de routes, aucun traceur), fonctions natives, 7 lots, risques, 7 décisions ouvertes (inscription dans l'app, texte du refus, sort des documents émis à la suppression de compte, coordonnées de la fiche UE, comptes développeur au nom de la LLC, notifications, identifiant). `DECISIONS-STRATEGIQUES.md` § 15 ; règle « Pas d'app native » de ce fichier mise à jour | `PLAN-APP-MOBILE-2026-10.md`, `DECISIONS-STRATEGIQUES.md`, `CLAUDE.md`, `README.md` |
| 2026-10-19 | **Emails du devis, de la facture, de l'avoir et du bon de commande refaits (piste « C · Éditorial », choisie par le fondateur sur le canevas https://claude.ai/artifact/4GQURsd4KfF746RVLdkc9m)**. Fond chaud, filet à la couleur de l'entreprise, titre en deux voix (« Votre devis, *prêt à signer.* »), total TTC en grand en DM Sans, bouton encre, notes sans encadré coloré, numéro du document en haut à droite ; tous les autres emails du modèle de base (relances, signature, mot de passe) prennent la nouvelle coque. **Polices hébergées sur le site** (`public/email-fonts/` : Bricolage Grotesque, Instrument Serif, DM Sans, DM Mono, licence SIL OFL), jamais chez Google (un lien Google Fonts enverrait l'IP du destinataire à chaque ouverture) ; elles ne s'affichent que dans Apple Mail et sur iPhone, repli Helvetica, Arial, Georgia ailleurs ; le middleware laisse passer `.woff` et `.woff2`. **Virement** : le bouton « Régler par virement » devient « Voir les coordonnées de virement » et le texte dit que le virement se fait depuis la banque : Qonforme ne propose aucun virement depuis l'application. Le lien « Propulsé par Qonforme » ne figure plus qu'au pied (il y en avait aussi un en haut). 5 tests | `lib/email/templates/{base,invoice,quote,credit-note,purchase-order}.ts`, `public/email-fonts/`, `middleware.ts`, `__tests__/{email-design,powered-by}.test.ts` |
| 2026-10-19 | **Modèle de mise en page choisi ignoré par les PDF, parcours devis → facture testé sur téléphone après les migrations** (demande du fondateur : envoyer une facture et un devis à son adresse, logo, modèle, conversion, captures). iPhone 14 sur le site en ligne, compte d'essai : logo ETC importé, couleur d'accent, client Gmail, facture envoyée, devis créé et envoyé, « Marquer comme envoyé » puis « Marquer accepté », « Convertir en facture » (brouillon F-2026-003), « Envoyer » : email parti (« Facture envoyée à … »), aucun débordement horizontal. Migrations `20261019_quotes_sent_at.sql` et `20261010_document_templates.sql` appliquées par le fondateur : la cloche répond 200 (500 avant), le choix des 5 modèles apparaît. **Défaut trouvé** : « Chantier » enregistré pour les 4 documents, mais le PDF restait en « Classique ». `selectCompanyWithProfile` (`lib/legal/db.ts`) enchaînait ses relectures dans un ordre fixe : si `legal_profile` manquait, il relisait l'entreprise sans aucune des deux colonnes, donc `document_templates` (pourtant présente) était perdue. Chaque colonne est maintenant essayée seule (modèles seuls, puis profil seul, puis ni l'un ni l'autre). La fausse base du test renvoie désormais seulement les colonnes demandées (comme PostgREST) ; 3 cas ajoutés (un seul échoue sans le correctif). **Constaté en ligne, non corrigé (migrations pas appliquées)** : `legal_profile` absente (`20261003_legal_profile_btp.sql` : mentions du bâtiment automatiques, assurance, métier) ; Relances en ancien fonctionnement J+30/J+45 et numéro de facture attribué à la création alors que l'écran Paramètres dit « à l'envoi » (`20261003_invoice_number_at_issue_and_reminders.sql`). Aucune migration nouvelle | `lib/legal/db.ts`, `__tests__/legal-profile-server.test.ts` |
| 2026-10-19 | **Migrations du 03/10 appliquées en production par le fondateur et vérifiées sur téléphone** (`20261003_legal_profile_btp.sql`, `20261003_invoice_number_at_issue_and_reminders.sql`). iPhone 14 sur le site en ligne, compte d'essai. **Mentions du bâtiment** : les sections « Activité et statut » et « Assurance professionnelle » apparaissent ; profil enregistré (électricien, entrepreneur individuel, TVA facturée, n° de TVA calculé, décennale d'exemple) ; le PDF affiche « entrepreneur individuel (EI) » et l'assurance décennale (assureur, adresse, contrat, couverture) ; mentions **figées à l'émission** (`legal_snapshot` posé par le déclencheur) : après un changement d'assureur, F-2026-004 garde l'ancien, et F-2026-003, émise avant la migration, n'a pas reçu les mentions. **Numéro à l'émission** : un nouveau brouillon s'affiche « Brouillon » sans numéro (liste, fiche, PDF filigrané), la fenêtre d'envoi dit « numéro attribué à l'envoi », la facture reçoit F-2026-004 à l'envoi (email parti à l'adresse du fondateur). **Relances** : `/api/relances` n'est plus en `legacy`, page Relances et réglages disponibles (rappel J-3, relances J+7, J+30, J+45 et relance des devis à 7 jours enregistrés et relus), aperçu de l'email. Aucun défilement horizontal. **À savoir** : le n° de TVA, l'adresse et le SIREN de l'émetteur ne sont pas figés (seuls le nom, les mentions libres et le profil légal le sont) : le PDF d'une facture déjà émise montre le n° de TVA saisi après coup. Aucun code modifié | — (vérification en production) |
| 2026-10-19 | **Logo mal placé dans Paramètres › Entreprise : il passait par-dessus le texte et les boutons « Remplacer » / « Retirer »** (capture du fondateur sur téléphone). Cause : l'aperçu du logo était une image `max-h-full max-w-full` dans un `grid` de 80 px à ligne automatique ; dans ce cas la hauteur maximale en pourcentage ne borne rien et l'image reprend sa taille réelle (un logo carré de 480 px : 204 × 204 px à l'écran, son bas 84 px sous le haut des boutons). Corrigé dans `LogoField` : boîte de taille fixe (`block h-20 overflow-hidden`), image à `size-full object-contain`. Mesuré au navigateur sur la page démo (même formulaire) avec le même logo : avant 204 × 204 px débordant, après 204 × 64 px dans sa boîte, à 360, 390 et 768 px, sans défilement horizontal. **Même défaut corrigé sur la page de règlement du client** (`PaymentPage`, vignette du logo de 72 × 48 px, où un grand logo était rogné au lieu de tenir). 3 tests (2 échouent sans le correctif). Aucune migration | `components/settings/LogoField.tsx`, `components/payment-link/PaymentPage.tsx`, `__tests__/logo-field.test.ts` |
| 2026-10-19 | **Réactivité de l'inscription et de la navigation, brouillon, glisser pour fermer** (retours du fondateur sur téléphone). **Brouillon** : fermer la fenêtre « Bienvenue » enregistre ce qui est saisi (entreprise complète ou choisie → enregistrée ; incomplète → `signup_draft` du compte, y compris saisie à la main ; prénom modifié), la tuile « Terminer votre inscription » reprend où l'on en était (« Vos saisies sont gardées »). **Étapes optimistes** : l'étape suivante s'affiche tout de suite, l'enregistrement part en arrière-plan (file série) ; en cas d'échec on revient à l'étape avec le message et la saisie gardée en brouillon. **Glisser pour fermer** : `SheetGrip` (`lib/ui/sheet-drag.ts`) sur toutes les feuilles du bas, transformation seule, vitesse et distance, retour élastique, refus de fermeture géré, « Réduire les animations » respecté. **Tuile locale** : « Reprendre » rouvre la fenêtre sans navigation serveur, chunk préchargé au repos. **Navigation** : les 12 sections de l'application passent dans le groupe de routes `app/(app)/` avec une seule coque persistante (`app/(app)/layout.tsx`, plus relue à chaque changement de section), `loading.tsx` avec squelettes (`PageSkeleton`, `DashboardSkeleton`), barre de progression dès le toucher d'un lien interne (`NavigationProgress`, transformation et opacité seulement). Conséquence : une page qui change l'identité affichée dans la coque doit appeler `router.refresh()` (fait pour les réglages de l'entreprise et l'inscription). **Mesure** : Vercel Speed Insights (sans cookie) ajouté pour suivre l'INP réel. Recherche Sirene : câblage relu, non vérifiable en direct depuis la session (réseau fermé), à essayer dans l'application (nom, SIREN, SIRET). Aucune migration. Build 239/239 avec identifiants factices, tsc, lint, 2 287 tests | `lib/onboarding/inscription.ts`, `app/api/onboarding/inscription/route.ts`, `components/onboarding/`, `components/dashboard/`, `lib/ui/sheet-drag.ts`, `components/ui/sheet-grip.tsx`, `app/(app)/`, `components/app/PageSkeleton.tsx`, `components/layout/{AppShell,NavigationProgress}.tsx`, `components/settings/CompanySettingsForm.tsx`, `app/layout.tsx`, `app/globals.css`, `__tests__/{inscription,inscription-draft-ui,sheet-drag,navigation-progress}.test.ts` |
| 2026-10-20 | **Vente en production : carte bancaire seulement, pas de prélèvement SEPA** (décision du fondateur : l'activer demande à Stripe des vérifications d'identité qu'il ne veut pas faire). Constat avant l'ouverture : la production n'avait dans Vercel aucun des 4 prix (paiement « momentanément indisponible » pour un compte ordinaire), et le webhook de production pointait sur l'adresse en `www` (redirection 308 que Stripe ne suit pas) en n'écoutant que 5 événements sur 7 (corrigé par le fondateur dans Stripe) ; les 4 prix de production sont créés (Essentiel 24 €/mois et 240 €/an, Artisan 34 €/mois et 340 €/an), à ajouter dans Vercel une fois les réglages Stripe finis (Link, nom public et libellé de relevé, image de marque, portail client). **Code** : `SEPA_DEBIT_ENABLED = false` dans `lib/stripe/plans.ts` ; `SUBSCRIPTION_PAYMENT_METHODS` pour le Checkout (une session qui réclamerait `sepa_debit` sans qu'il soit activé échouerait pour tous les clients) et `PAYMENT_METHODS_TEXT` pour la page Tarifs et sa FAQ (donc son JSON-LD), la page de paiement, le choix de formule et l'article 4.2 des CGU (daté du 20 octobre 2026). Mêmes écrans en essai et en production. Décision consignée au § 14.7 de `DECISIONS-STRATEGIQUES.md`, avec la note : le projet Vercel est au plan Hobby (usage non commercial), à passer en Pro avant d'encaisser. Aucune migration. 3 tests | `lib/stripe/plans.ts`, `app/api/stripe/checkout/route.ts`, `app/pricing/page.tsx`, `app/pricing/checkout/CheckoutPageClient.tsx`, `components/billing/PricingSelector.tsx`, `app/cgu/page.tsx`, `DECISIONS-STRATEGIQUES.md`, `CLAUDE.md`, `__tests__/stripe-payment-methods.test.ts` |
| 2026-10-19 | **Connexion et inscription avec Google** (demande du fondateur). Bouton « Continuer avec Google » / « S’inscrire avec Google » au-dessus du formulaire par email sur `/login` et `/signup` (`components/auth/GoogleButton.tsx`, « G » aux couleurs de la charte Google, choix du compte à chaque fois, ni flou ni `will-change`), Supabase OAuth en flux PKCE. Retour par `/api/auth/callback` : échange du code, `next` filtré par `safeNextPath`, refus ou échec = `/login?error=oauth` avec message. **Compte Google tout juste créé** (`lib/auth/oauth.ts`, moins de 2 minutes, fournisseur Google, pas encore marqué) : métadonnées d'une inscription en deux champs (`signup_wizard`, `signup_provider`, prénom et nom de Google, variante `?ab=` filtrée), entrée dans la séquence de démarrage, email de bienvenue, puis tableau de bord avec la fenêtre « Bienvenue » (`?bienvenue=1`) ; une panne de ces écritures ne bloque jamais la connexion. Un compte existant ne reçoit rien (Supabase relie l'identité Google au compte du même email vérifié). Politique de confidentialité : Google LLC ajouté aux sous-traitants. **À régler hors code avant que le bouton marche** : projet Google Cloud (écran de consentement, identifiant client OAuth « Application Web » avec l'URI de redirection `https://<projet>.supabase.co/auth/v1/callback`), fournisseur Google activé dans Supabase (Authentication › Providers › Google, identifiant et secret), `https://qonforme.fr/api/auth/callback` dans Authentication › URL Configuration › Redirect URLs. Aucune migration, aucune variable Vercel. 9 tests | `lib/auth/oauth.ts`, `components/auth/{GoogleButton,LoginForm,SignupForm}.tsx`, `app/api/auth/callback/route.ts`, `app/confidentialite/page.tsx`, `__tests__/oauth-google.test.ts` |
| 2026-10-19 | **Page de connexion : « Dernière utilisation » ; tableau de bord : tuile « Reprendre » recadrée, encart « Version gratuite » épuré** (retours du fondateur sur captures). **Dernière utilisation** : une pastille posée sur le bord du bouton « Continuer avec Google » ou « Se connecter » rappelle la méthode utilisée la dernière fois sur l'appareil (`lib/auth/last-used.ts`, stockage local seulement, valeur relue sans confiance, rien d'envoyé ni de cookie ; posée à la connexion par email, à l'inscription par email et au clic sur Google, effacée si Google échoue au départ). **Tuile « Terminer votre inscription »** : la ligne « Étape 1 sur 3 · Reprendre » dépassait de la carte ; elle passe à la ligne si besoin, barres de progression plus courtes, « Reprendre » jamais coupé. **Encart du bas de la barre latérale** (compte gratuit) : icône et description retirées, restent « Version gratuite » et « Voir les formules ». Aucune migration. 3 tests | `lib/auth/last-used.ts`, `components/auth/{GoogleButton,LoginForm,SignupForm}.tsx`, `components/dashboard/GettingStarted.tsx`, `components/layout/Sidebar.tsx`, `__tests__/last-used.test.ts` |\n
| 2026-10-20 | **Tableau de bord d'un compte neuf : salutation selon l'heure, plus de couleur, « Reprendre » à gauche** (retours du fondateur sur capture). **Salutation** : « Bonjour, *Prénom* 👋 » de 5 h à 17 h 59 et « Bonsoir, *Prénom* 🌙 » de 18 h à 4 h 59, à l'heure de Paris (`greetingFor`, `hourInParis` dans `components/dashboard/model.ts`), prénom en seconde voix (serif italique bleu), sans prénom la salutation seule ; emoji demandé par le fondateur, décoratif (`aria-hidden`). **Couleur** : icônes des tuiles « Pour commencer » en bleu d'accent (toujours au trait fin, sans fond), tuile « Terminer votre inscription » sur le lavis bleu. **Tuile d'inscription** : barres et « Étape 1 sur 3 » sur une ligne, « Reprendre → » seul sur la ligne du dessous, aligné à gauche. Aucune migration. 3 tests | `components/dashboard/{model.ts,GettingStarted.tsx}`, `__tests__/dashboard-greeting.test.ts` |\n
| 2026-10-20 | **Barre d'actions des devis, factures et bons de commande sur téléphone : piste B** (choisie par le fondateur sur le canevas https://claude.ai/artifact/MaeBCAy9sh2RP3Kss4AtiJ). La barre « Brouillon / Envoyer » au-dessus de la navigation disparaît (182 px → 68 px) : dans l'éditeur, le « + » central de la barre du bas devient « Envoyer » en goutte (`components/layout/MorphButton.tsx`, animation validée sur le canevas : ressorts sur largeur et hauteur calculés image par image, case de 132 px fixe donc onglets immobiles ; ni filtre « goo », ni `backdrop-filter`, ni `will-change` ; bascule immédiate avec « Réduire les animations »). Total TTC, HT et TVA et bouton « Enregistrer le brouillon » passent en tête du formulaire. Pas d'enregistrement automatique (non codé) : le brouillon reste enregistré à la demande. Le bouton écoute `lib/ui/editor-action.ts`, alimenté par `DocumentEditor` (réel et démo, mêmes composants). Aucune migration | `lib/ui/editor-action.ts`, `components/documents/DocumentEditor.tsx`, `components/layout/Sidebar.tsx`, `app/globals.css`, `__tests__/editor-action.test.ts` |
| 2026-10-20 | **Téléchargement du PDF d'un devis : « Failed to load PDF document »** (capture du fondateur). Le générateur est sain (devis testé avec les 5 modèles, avec et sans profil légal : PDF valides, rendus par PDFium) ; la cause exacte côté navigateur n'a pas pu être reproduite depuis la session. Durcissement : helper `downloadPdf` (`lib/utils/download-pdf.ts`) qui contrôle la signature `%PDF-` avant d'enregistrer (une page de connexion renvoyée en 200 ou une erreur ne devient plus un faux fichier : message clair), et ne libère l'adresse du blob qu'après 60 s (la libérer aussitôt casse le téléchargement sur certains navigateurs) ; utilisé pour devis, bons de commande, avoirs et factures ; routes PDF : octets exacts (`new Uint8Array(buffer)` au lieu de `buffer.buffer`, qui peut exposer tout le tampon partagé). **Signature en ligne invisible** : la fiche devis n'affiche le panneau que si les tables de la migration `20261003_document_signatures.sql` existent (sinon elle garde « Accord du client » sur papier) : **migrations `20261003_document_signatures.sql` puis `20261010_signature_withdrawal_deposit_reminder.sql` à appliquer en production**. 3 tests | `lib/utils/download-pdf.ts`, `app/(app)/{quotes,purchase-orders,credit-notes}/[id]/page.tsx`, `components/invoices/InvoiceDetail.tsx`, `app/api/{quotes,invoices,purchase-orders,credit-notes}/**/pdf/route.ts`, `__tests__/download-pdf.test.ts` |
| 2026-10-20 | **Barre du bas mobile : onglets rapprochés du « + »** (capture du fondateur : la case de 132 px réservée à « Envoyer » écartait les icônes même sans éditeur). La case du bouton central (`MorphButton`) mesure 68 px avec le « + » ; elle passe à 132 px dès que « Envoyer » apparaît et ne se resserre que 0,9 s après le retour au « + », une fois la goutte rétractée (largeur seulement, immédiat avec « Réduire les animations »). Aucune migration | `components/layout/MorphButton.tsx` |
| 2026-10-20 | **Trous dans les listes des articles générés, 3 à 4 photos bien réparties** (demande du fondateur, d'après une capture de l'éditeur : puces vides dans « Comment faire un devis d'électricien » ; une seule photo, tout en bas). **Trous** : cause dans le moteur Markdown du blog (`lib/markdown.ts`), qui n'isolait ni les listes, ni les titres, ni les citations, ni les filets collés au texte sans ligne vide (typique d'un modèle : « **Tableau** » puis les puces sur les lignes suivantes) : la liste restait prise dans le paragraphe, avec un saut de ligne entre chaque puce, ce que l'éditeur lisait comme des puces vides ; chaque bloc est désormais isolé par une ligne vide avant et après (le Markdown bien écrit ne change pas, 4 tests). Trois couches : le **moteur** (aussi pour les articles déjà publiés, à l'affichage, sans toucher à la base), l'**éditeur** (ouvrir l'article ne l'enregistre jamais : `onUpdate` partait avant `onCreate`, avec un `baseline` périmé, et envoyait un texte normalisé à l'ouverture ; garde `created`), et le **générateur** (`separateBlocks` dans `normalizeContent`, `lib/seo/articles/check.ts` : listes, titres collés réparés avant l'enregistrement, fences et lignes de continuation indentées intactes ; consigne d'écriture : une ligne vide avant et après chaque titre et chaque liste, jamais de puce vide). **Photos** (`lib/seo/articles/images.ts` refait) : l'ancienne règle n'admettait que les sections « H2 » qui commencent par un paragraphe, or les articles de Claude commencent leurs « H2 » par des « H3 » : il ne restait qu'une place, la dernière. Nouveau planificateur par position : 3 photos dès 1 125 mots, 4 dès 1 575 (une par tranche de 450 mots, au moins 2 dès 600 mots, jamais sous 600, plafond des Préférences 1 à 6 respecté), placées à 1/5, 2/5, 3/5 et 4/5 du développement, au moins 250 mots entre deux, 150 mots de texte avant la première (la couverture est juste au-dessus) et 120 après la dernière (jamais collée à la FAQ), toujours après un paragraphe (de préférence le premier d'une sous-partie, jamais sous un titre, jamais après une phrase qui annonce une liste « … : »), ni dans l'introduction, la FAQ, la conclusion ni les sources ; moins de photos plutôt que deux côte à côte. Défaut corrigé au passage : un plafond de 1 photo en donnait 2. Les photos ne concernent que les articles générés **après** ce correctif ; un article déjà publié garde ses images. Non essayé avec de vraies clés (Claude et Gemini simulés). Aucune migration. 14 tests ajoutés ou réécrits | `lib/markdown.ts`, `components/admin/blog/editor/RichEditor.tsx`, `lib/seo/articles/{check,images,generate,prompt}.ts`, `lib/seo/settings-schema.ts`, `components/admin/seo/articles/PreferencesForm.tsx`, `__tests__/{markdown-media,blog-editor-ui,seo-articles-check,seo-article-images,seo-articles-generate}.test.ts` |
| 2026-10-20 | **Abonnement activé : fenêtre de confirmation (ordinateur) et feuille du bas (téléphone), plus de page dédiée** (canevas https://claude.ai/artifact/SH4UeCi5GQwxofzc7buHHr, cartes 6 et 8 à 10, choisi par le fondateur). Après le paiement, la page de retour redirige vers la page d'origine avec `?abonnement=1` (`?abonnement=envoi` quand une facture attendait son envoi : remplace `send=1`, `lib/stripe/activation.ts`) ; `ActivationDialog` (monté dans la coque de l'application, jamais dans la démo) lit le paramètre une fois puis le retire de l'adresse. **Activation en cours** : si la formule n'est pas encore active, étapes (paiement confirmé, ouverture de la formule, reçu), interrogation de `/api/subscription/status` toutes les 2,5 s (plus lente après 2 minutes, avec « Nous écrire »), bascule toute seule sur la confirmation. **Confirmation** : formule, prix, prochain paiement, fonctions de la formule, remboursement sous 30 jours ; « Envoyer ma première facture » ouvre l'envoi quand une facture attendait. Fenêtre au-dessus de 768 px, feuille du bas avec `SheetGrip` en dessous, ni flou ni `will-change`. **Email de confirmation** (`lib/email/templates/subscription-activated.ts`, coque éditoriale) envoyé une seule fois à la première activation, depuis le webhook Stripe ou la page de retour (`upsertSubscription` rend `firstActivation`) ; un échec d'envoi n'empêche jamais l'activation. Non montré : les 4 derniers chiffres de la carte, la signature en ligne (« à venir » dans `plans.ts`). Course rare possible entre webhook et page de retour (deux emails). Aucune migration. Non essayé dans un navigateur. 4 tests | `lib/stripe/{activation,activation-email,subscription}.ts`, `components/billing/ActivationDialog.tsx`, `components/layout/AppShell.tsx`, `app/pricing/{return/page.tsx,checkout/CheckoutPageClient.tsx}`, `app/api/subscription/status/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/email/templates/subscription-activated.ts`, `__tests__/subscription-activation.test.ts` |
| 2026-10-20 | **Connexion et inscription : photo retirée sur téléphone seulement, Google en bas** (canevas https://claude.ai/artifact/TNYb138Em1K17Hi45rcGue, rangée « À CODER », validée par le fondateur ; une première version avait remplacé aussi le desktop par une carte centrée, corrigée dans la foulée). **Ordinateur (≥ 1024 px)** : design d'avant, formulaire à gauche et photo avec texte à droite. **Téléphone et tablette (< 1024 px)** : plus de bande photo, le contenu dans une carte blanche sur fond clair (`AuthLayout mobileCard`, option réservée à ces deux pages ; mot de passe oublié et nouveau mot de passe inchangés). **Google sous le formulaire** (après « ou »), connexion et inscription, partout. **Inscription** : titre « On commence *quand vous voulez.* » / « Créez votre compte en quelques secondes. » (plus de mention de formule) ; « En créant un compte… » (`SignupLegal`) tout en bas, sur tous les écrans, aussi pour l'invitation d'un comptable. Description et image de partage de `/signup` parlent encore de la formule. Non vérifié dans un navigateur. Aucune migration | `components/auth/{AuthLayout,LoginForm,SignupForm}.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` |
| 2026-10-22 | **Planning de rendez-vous, notes et rappels, scan de documents** (demande du fondateur ; maquettes https://claude.ai/artifact/FaP3EXrYR2PDUNLR1YRy7i). Ouverts à tous les comptes, gratuits compris. **Planning** (`/planning`, « Planning et notes ») : semaine et agenda, rendez-vous de trois types (visite, chantier, livraison) rattachés à un client ou un chantier, heure de Paris, rappel par email réglable ; démo miroir. **Notes et rappels** par client et par chantier (tâches avec échéance, matin ou veille, en retard), tuiles « Aujourd'hui » et « À faire » du tableau de bord. **Rappels par email** (`lib/planning/reminders.ts`, tâche réservée avant l'envoi, libérée si l'envoi échoue, jamais pour un rappel de plus de 24 h) lancés par `/api/cron/planning` et par `/api/cron/onboarding` (toutes les 15 minutes : rien à créer si la tâche onboarding tourne déjà). **Scan** (`/documents`, bouton S) : appareil photo, recadrage, rotation, filtres (couleur, noir et blanc, original), plusieurs pages, classement (type, fournisseur, numéro, date, montant, client, chantier), export PDF, stockage privé `scanned-documents` (URL signées 1 h) ; aucune reconnaissance de texte ni détection automatique des bords annoncées. **Appairage du téléphone** : QR code affiché sur l'ordinateur, jeton de 256 bits stocké haché, cookie HttpOnly de 15 minutes, 20 documents au plus, le téléphone ne peut qu'envoyer et supprimer ses propres envois, révocable ; sans la migration, le scan par connexion reste possible. **Quotas** (`SCAN_QUOTAS`, `lib/stripe/plans.ts`) : 50 documents et 200 Mo en gratuit, 2 000 documents et 5 Go avec Essentiel ou Artisan ; un dépassement bloque seulement l'ajout. **Tarifs, abonnement, CGU art. 4.1, FAQ et emails** : planning, notes et scan ne sont plus « à venir » (`SHARED_UPCOMING` supprimé, `FREE_FEATURES` étendu, ligne « Espace de scan » du comparatif, `scanQuotaText`). Non fait, remis à plus tard : email de confirmation au client pour un rendez-vous. Migrations à appliquer (toutes quatre appliquées par le fondateur) : `20261021_planning_appointments.sql`, `20261021_work_notes.sql`, `20261021_scanned_documents.sql`, `20261022_scan_pairings.sql` ; sans elles, rien ne casse. Premier essai sur un vrai téléphone avec le stockage de production à faire. 2 498 tests | `lib/planning/`, `app/api/{appointments,notes,scan}/`, `app/api/cron/{planning,onboarding}/route.ts`, `components/planning/`, `components/scan/`, `app/(app)/{planning,documents}/`, `app/{scan,scan-telephone}/`, `app/demo/{planning,documents}/`, `lib/scan/`, `lib/demo/{planning,notes,scan}.ts`, `lib/stripe/plans.ts`, `components/billing/{PricingSelector,PlanComparison,BillingPageClient}.tsx`, `app/pricing/page.tsx`, `app/cgu/page.tsx`, `lib/email/templates/planning-reminder.ts`, `supabase/migrations/2026102{1,2}_*.sql`, `__tests__/{planning-*,scan-*}.test.ts` |
| 2026-10-22 | **Espace de contact : bulle « Christophe », page /contact, boîte de réception admin** (demande du fondateur ; canevas https://claude.ai/artifact/LF9xRxjVfTPHBrMxmuNSH1). Bulle sur les pages publiques (grande 6 s sur ordinateur puis ronde ; **bouton rond de 56 px** sur téléphone, la languette ayant été refusée après essai sur iPhone), feuille pleine hauteur, page `/contact` (formulaire, catégories, pièces jointes images/PDF : 3 fichiers et **4 Mo au total** à cause de la limite de 4,5 Mo des fonctions Vercel), visiteur non connecté = email obligatoire, réponses **par email seulement** sous « Christophe de Qonforme » (aucun délai promis), lien « Ouvrir la conversation » (jeton HMAC recalculable, stocké haché, cookie HttpOnly 30 jours), anti-spam (champ piège, 12 messages/heure/IP salée-hachée, 5 conversations/email/jour), sans traceur. Scan : fenêtre rendue dans `document.body` (la barre du bas ne le recouvre plus). **Admin › Support** : onglets « Conversations » / « Signalements », liste filtrable (ouvertes, en attente, résolues), fiche (fil complet, notes internes, pièces jointes à lien signé 1 h, réponses types, renvoi d'un email non parti, résoudre/rouvrir, panneau visiteur), badge de la barre latérale = signalements + conversations non lues. Migration `20261023_support_chat.sql` appliquée ; sans elle, 503 « pas activée » et repli sur l'ancien envoi. Non fait : bouton dans l'application (le « Nous écrire » du menu garde l'ancienne fenêtre), réponses du visiteur par email directement dans l'admin (Resend inbound). 2 540 tests | `supabase/migrations/20261023_support_chat.sql`, `lib/support-chat/`, `app/api/support/chat/`, `app/api/admin/support/chat/[id]/route.ts`, `app/contact/`, `components/support/`, `components/admin/{ChatThread,SupportTabs}.tsx`, `app/admin/(panel)/support/chat/`, `app/admin/(panel)/layout.tsx`, `lib/email/templates/support-chat.ts`, `components/scan/ScanFlow.tsx`, `__tests__/support-chat.test.ts` |
| 2026-10-23 | **Bouton de contact dans l'application (ordinateur seulement), icône au trait, champs date/heure qui débordaient sur iPhone** (retours du fondateur sur captures). Bouton rond de la bulle monté aussi dans l'application et la démo (`chatSurface` rend « app » : tableau de bord, factures, devis, clients, catalogue, planning, documents…), **ordinateur seulement**, sans libellé déployé à l'arrivée (au survol seulement), messages marqués « Application » dans l'admin ; pictogramme `ChatGlyph` en bulle vide au trait (trois points), partout. **Défilement horizontal** des fenêtres « Nouveau rendez-vous » et du classement d'un scan sur iPhone : les champs `date` et `heure` natifs gardaient leur largeur propre ; règle globale `.q-input[type=date|time]` (apparence retirée, `min-width: 0`, `max-width: 100%`) et libellés `min-width: 0`. Non vérifié sur un vrai iPhone. Aucune migration | `lib/support-chat/surface.ts`, `components/support/SupportChat.tsx`, `app/globals.css`, `__tests__/support-chat.test.ts`, `CLAUDE.md` |
| 2026-10-23 | **Bulle de contact : ronde dans l'application, animations fluides** (retours du fondateur sur capture). Dans l'application elle ne s'agrandit plus jamais ; sur les pages publiques elle est grande 6 s puis ronde, grande au survol, et au clavier seulement (le focus laissé par un clic la gardait grande). Bulle redessinée : largeur animée (60 → 304 px, courbe douce de 500 ms) avec avatar et texte en fondu, hauteur fixe ; panneau qui reste monté pendant sa fermeture : glissement du bas sur téléphone, fondu et léger zoom depuis la bulle sur ordinateur, fond qui se fond ; « Réduire les animations » respecté, ni `backdrop-filter` ni `will-change`. Non vérifié dans un navigateur. Aucune migration | `components/support/SupportChat.tsx` |
| 2026-10-23 | **Navigation regroupée (maquette « version A », rail mobile « B », validés par le fondateur sur canevas https://claude.ai/artifact/SBKUqA66WtY2JNeSAhVrKx)**. **Ordinateur** : barre latérale en groupes (Accueil, Ventes, Chantier, Carnet, Pilotage) ; Ventes = chaîne devis → bon de commande (« facultatif ») → facture sur un trait, Avoirs en sous-entrée ; « Signaler un problème » et « Se déconnecter » ne sont plus dans la barre latérale (ils sont dans le menu du compte de l'en-tête). **Mobile** : barre du bas Accueil · Ventes · « + » · Planning · Plus (« Ventes » actif sur tout le parcours des documents de vente), rail des ventes en tête des listes devis, bons de commande, factures et avoirs (`SalesRail`, monté dans la coque, démo comprise), feuille « Plus » regroupée (Chantier, Carnet, Pilotage, Compte). Rien ne change côté création : le menu « Nouveau » et le « + » créent toujours un devis, une facture directe ou un bon de commande, la chaîne n'est qu'une navigation. **Pas encore fait** : compteurs dans le rail, lignes compactes (initiales) des listes mobiles. Aucune migration. 4 tests | `components/layout/{nav.ts,Sidebar.tsx,SalesRail.tsx,AppShell.tsx,CommandPalette.tsx}`, `__tests__/sales-nav.test.ts` |
| 2026-10-23 | **Finitions de la navigation mobile** (suite de la ligne du même jour). **Compteurs du rail des ventes** : pastille de nombre de documents par type (devis, bons de commande, factures hors archives, avoirs), lue par `GET /api/sales-counts` (comptes en tête, tolère l'absence de la colonne d'archivage, un total illisible n'affiche aucun chiffre), totaux de la démo passés par `DemoFrame`. **Lignes compactes** des listes mobiles de devis, bons de commande, factures et avoirs (`components/app/DocRow.tsx` : initiales, client, référence, montant, statut, prochaine action en bleu : « Convertir en facture » sur un devis accepté non facturé, « Terminer et envoyer » sur un brouillon de facture, « Relancer » sur une facture en retard) ; les lignes d'accès « Bons de commande » et « Avoirs » du bas des listes mobiles sont retirées (le rail les remplace). **Chaîne du document** sur la fiche d'un devis, téléphone seulement (`components/documents/DocumentChain.tsx`) : devis, bon de commande facultatif en pointillé, facture ; ne dit que ce que les données savent (pas d'acompte ni de solde : le devis ne porte pas cette information). Pas de bouton « Créer la facture de solde » : il demanderait les situations du chantier. Aucune migration. 8 tests | `app/api/sales-counts/route.ts`, `components/layout/{SalesRail,AppShell,DemoFrame}.tsx`, `components/app/DocRow.tsx`, `components/documents/DocumentChain.tsx`, `components/{quotes/QuoteListView,quotes/QuoteDetailView,invoices/InvoiceList,purchase-orders/PurchaseOrderListView,credit-notes/CreditNoteListView}.tsx`, `__tests__/sales-nav.test.ts` |
| 2026-10-23 | **Éditeur d'articles : l'IA corrige les passages refusés, place les mots-clés, et les mesures du mot-clé principal sont réelles** (demande du fondateur, d'après trois captures de l'éditeur). **Passage refusé par le contrôle** (bannière rouge) : chaque passage a « Aller au passage » (l'éditeur le sélectionne et le montre, en mode visuel comme en Markdown ; pour un titre Google, une description ou une adresse, le champ est mis en évidence) et « Corriger avec l'IA » (`POST /api/admin/blog/assist`, action `resolve` : le modèle ne réécrit que ce passage, avec le problème et la précision du contrôle, « À écrire : … » compris ; proposition à côté de l'extrait refusé, avertissements, **rien n'est remplacé sans « Remplacer dans le texte »**, une seule étape d'annulation) ; « Corrigé » quand l'extrait n'est plus nulle part (`lib/blog-editor/passages.ts`, `IssueItem`). **Mot-clé à placer avec l'IA** (`POST /api/admin/blog/integrate-keyword`, `lib/seo/articles/integrate.ts`) : « Intégrer avec l'IA » sur chaque mot-clé secondaire « Absent » (2 passages du développement au plus) ; sous les lignes à corriger du score : « Mettre le mot-clé dans l'introduction », « … dans un sous-titre », « Placer le mot-clé dans le texte », « Proposer un titre / une description / une adresse avec le mot-clé » (propositions Google déjà là, déclenchées depuis la ligne). Le serveur choisit les passages (développement seulement, ni FAQ, ni conclusion, ni passage qui nomme un concurrent), le modèle répond en JSON, chaque réécriture est contrôlée (mot-clé tel quel, longueur, liens, chiffres, concurrents) et montrée en avant / après avec les mots changés surlignés (`KeywordFitDialog`, cases à cocher, « Autres passages »). **Proposition IA** : chaque idée se met en « mot-clé principal » ou s'ajoute aux « secondaires » (liste gardée sur l'appareil par article, jointe aux propositions de titre) ; la pastille de difficulté est partagée (`difficulty.tsx`). **Mot-clé principal tapé à la main** : la phrase tapée est la première option (Entrée la valide, plus la première suggestion), le bouton « Utiliser » et « Pas encore validé » restent quand la liste se ferme, le risque de concurrence de l'ancien mot-clé n'est plus montré pendant la saisie ; la carte d'un mot-clé libre dit qu'il n'a **aucune mesure** et propose « Mesurer avec Google et DataForSEO » (`POST /api/admin/blog/keyword-check` : saisie semi-automatique de Google, DataForSEO, mesures du suivi reprises sans nouvel appel payant, raison écrite quand une donnée manque : clé absente, panne, phrase trop rare, concurrent nommé) puis « Suivre ce mot-clé ». OpenSEO est un outil de la session, pas du site : les mesures du site viennent de DataForSEO (clés `DATAFORSEO_LOGIN` et `DATAFORSEO_PASSWORD` dans Vercel). **Non essayé avec de vraies clés** (modèles et DataForSEO simulés). Nouvelle règle dans `CLAUDE.md` (une réécriture par l'IA ne remplace jamais le texte sans clic). Aucune migration. 88 tests ajoutés | `lib/blog-editor/{passages,word-diff,assist}.ts`, `lib/seo/articles/{integrate,editor-types,onpage,images,check}.ts`, `app/api/admin/blog/{assist,integrate-keyword,keyword-check}/route.ts`, `components/admin/BlogEditor.tsx`, `components/admin/blog/shell/{IssueItem,parts,SideCards,hooks}.ts(x)`, `components/admin/blog/editor/RichEditor.tsx`, `components/admin/blog/seo/{KeywordFitDialog,KeywordCheck,KeywordPicker,SecondaryKeywords,SeoScore,difficulty}.tsx`, `components/admin/seo/ideas/IdeasDialog.tsx`, `__tests__/{blog-editor-passages,seo-integrate,seo-keyword-check,seo-editor-panels,seo-editor-routes,seo-ideas-ui,blog-editor-coque,blog-editor-ui}.test.ts`, `CLAUDE.md` |
| 2026-10-23 | **Éditeur d'articles : le contrôle ne bloque plus l'admin, « Publier quand même »** (demande du fondateur, d'après une capture : « Retenu par le contrôle à l'heure prévue » incompris et publication bloquée). Le bandeau jaune dit maintenant ce qui s'est passé (« Pas publié automatiquement : à l'heure prévue, le contrôle automatique a gardé cet article en brouillon : … Ce n'est qu'une vérification, vous gardez la main ») et propose **« Voir les passages »** (relance le contrôle : les passages s'affichent avec « Aller au passage » et « Corriger avec l'IA ») et **« Publier quand même »** (fenêtre de confirmation, puis mise en ligne immédiate). Le bandeau rouge « Publication refusée par le contrôle » a le même bouton. Serveur : `publishNow(…, { force })` (`lib/seo/articles/publish.ts`), `force_publish` sur `PATCH /api/admin/blog/[id]`, `force` sur `PATCH /api/admin/seo/articles/posts/[id]` ; le contrôle automatique (publication à l'heure prévue, génération) reste inchangé et retient toujours l'article : seul un clic de l'admin le passe. Ce qui est tapé et pas enregistré part avant la mise en ligne. Le bouton « Publier quand même » est aussi dans la fenêtre d'un article du calendrier et dans la fenêtre « Publier cet article maintenant ? » de la liste des articles (après un refus du contrôle). Aucune migration. 1 test ajouté | `lib/seo/articles/{publish,input}.ts`, `app/api/admin/blog/[id]/route.ts`, `app/api/admin/seo/articles/posts/[id]/route.ts`, `components/admin/BlogEditor.tsx`, `components/admin/blog/shell/parts.tsx`, `__tests__/seo-articles-generate.test.ts` |
| 2026-10-23 | **Bouton « Envoyer ma première facture » après le paiement : il ne faisait rien** (constaté en direct lors du test complet du 23/10, compte d'essai). Cause : la fenêtre « Abonnement activé » (`ActivationDialog`) ajoute `?send=1` à la fiche de la facture où l'artisan se trouve déjà, mais `InvoiceDetail` ne lisait ce paramètre qu'au chargement de la page (effet sur `[invoice?.id]` et `window.location`) : le changement d'adresse sans rechargement n'était jamais vu, la fenêtre d'envoi ne s'ouvrait pas. **Correctif** : la fiche surveille `?send=1` avec `useSearchParams` (`SEND_PARAM`, `wantsSendAfterPayment`), ouvre la fenêtre d'envoi, puis nettoie l'adresse ; la décision est une fonction pure (`sendAfterPaymentOutcome`, `lib/stripe/activation.ts`) : `open` pour un brouillon dont le client a un email, sinon un message au lieu du silence (« Ajoutez l'adresse email du client… » ou « Cette facture n'est plus un brouillon… »). Aucun changement aux paiements, à l'API ni à la démo (pas de paiement dans la démo). 9 tests : la fiche est rendue avec ses dépendances simulées, le paramètre arrive sur une fiche déjà affichée (échoue sur l'ancien code), au chargement, client sans email, facture déjà émise, sans paramètre ; plus 4 sur la fonction de décision. Build de production, tsc, lint, 2 538 tests. Aucune migration | `components/invoices/InvoiceDetail.tsx`, `lib/stripe/activation.ts`, `__tests__/{invoice-send-after-payment,subscription-activation}.test.ts` |
| 2026-10-24 | **Page « Logiciel de gestion bâtiment et devis » (SEO et GEO)** (demande du fondateur). Nouvelle adresse `/logiciel-gestion-batiment` pour le mot-clé « logiciel de gestion bâtiment » : aucune page ne le visait (Search Console du 21/07 au 21/10/2026 : aucune requête « gestion » sur une page produit), donc aucune concurrence avec l'accueil ni avec les pages métier « Logiciel de devis gratuit pour … ». **À savoir** : le site a encore très peu d'autorité (pages métier entre les positions 45 et 70) et ce mot-clé est disputé ; on attend des requêtes plus précises et des citations dans les réponses des assistants IA, pas un trafic rapide. **Contenu** : définition en une phrase dès le chapeau, bloc « L'essentiel » en liste de faits (pour qui, ce qu'il fait, ce qu'il coûte, où l'utiliser, ce qu'il ne fait pas), « Qu'est-ce qu'un logiciel de gestion du bâtiment ? », huit fonctions livrées, parcours « du premier devis au dernier paiement », 11 métiers, tarifs, limites écrites, FAQ de huit questions (critères de choix, gratuité, téléphone, acomptes, auto-entrepreneur, correction par avoir, facturation électronique), fil d'Ariane, JSON-LD WebPage, BreadcrumbList et FAQPage égal au texte affiché (aucun schéma du layout dupliqué). **Honnêteté** : prix, fonctions et « à venir » lus dans `lib/stripe/plans.ts` ; les fonctions de la formule Artisan ne sont décrites comme disponibles que si `PLANS.pro.available` (sinon « bientôt disponible ») ; « gratuit » ne vise que les devis ; ni concurrent, ni « certifié », ni signature en ligne, ni promesse de raccordement à une plateforme agréée. **Enregistrée** dans le plan du site (date vraie), le middleware et le service worker (listes alignées), le pied de page, le plan du site HTML, le catalogue de l'éditeur d'articles et les liens automatiques du blog. Reste au fondateur : demander l'indexation de l'adresse dans la Search Console, puis suivre les positions 2 à 4 semaines. Non fait : lien depuis l'accueil, fichier `llms.txt`. Aucune migration. 14 tests ajoutés | `app/logiciel-gestion-batiment/page.tsx`, `app/sitemap.ts`, `app/plan-du-site/page.tsx`, `lib/supabase/middleware.ts`, `public/sw.js`, `components/layout/Footer.tsx`, `lib/seo/links/catalog.ts`, `lib/blog-autolink.ts`, `__tests__/logiciel-gestion-batiment.test.ts` |
