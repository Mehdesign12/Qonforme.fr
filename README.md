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
| 2026-10-04 | Recommandations de PushRank appliquées (outil SEO relié par MCP, Search Console du 04/09 au 01/10 : 1 clic pour 176 affichages). **/modele** (122 affichages, 3ᵉ sur « devis modele », aucun clic) : titre « Modèle de devis et de facture gratuit, prêt à remplir », boutons vers les générateurs en haut de page, devis en tête de liste, mentions d'un devis, questions fréquentes et JSON-LD FAQPage. **/demo** : titre « tableau de bord de facturation », un seul h1 (coque partagée : h1 unique dans `DashboardBody`, titre visible de `PageHeader` en h2), liens vers l'inscription et les modèles. **Descriptions** réécrites entre 120 et 155 caractères (13 pages signalées, pages légales, glossaire) ; **titles** sous 70 caractères (`lib/seo/meta.ts`, blog et glossaire) ; **plan du site HTML** `/plan-du-site` lié dans le pied de page (sitemap, middleware, service worker), Blog rangé dans « Ressources » ; **/facturation/fleuriste** (page en baisse) : titre, description, question sur la comptabilité, sans prétendre la tenir. **LCP mobile** (Lighthouse, mobile simulé, build local) : accueil 6,0 → 3,2 s, /facturation 6,0 → 2,6 s, /modele 5,3 → 2,7 s, guides 4,1-4,3 → 2,7 s, /demo 5,0 → 3,4 s ; JavaScript inutilisé 148 → 69 Ko (213 → 90 Ko sur /demo) : replay Sentry chargé après l'affichage et jamais sur les pages de contenu (`SentryReplay`), posthog-js chargé seulement si sa clé est dans le build (elle n'est pas dans le build en ligne), client Supabase chargé au clic de déconnexion, recherche ⌘K chargée à sa première ouverture, `bundleSizeOptimizations` de Sentry, DM Mono plus préchargée, premières photos de /facturation prioritaires. **Corrigé au passage** : l'image `<noscript>` du pixel Meta était préchargée par React dans le `<head>` de chaque page, donc envoyée à Meta même avec JavaScript, y compris sur les pages de règlement et de signature que le pixel doit éviter. Non appliqué : « page gagnante » /facturation/demenageur/dijon (pages métier × ville en noindex par décision), « Blog absent du pied de page » (faux positif, le lien y était). 11 tests | `app/modele/page.tsx`, `app/demo/page.tsx`, `app/plan-du-site/page.tsx`, `lib/seo/meta.ts`, `app/{blog,glossaire}/[slug]/page.tsx`, `lib/pseo/{metiers,guides,modeles}.ts`, `app/{facturation,guide,outils,glossaire,mentions-legales,cgu,confidentialite}/page.tsx`, `app/outils/*/layout.tsx`, `components/dashboard/DashboardBody.tsx`, `components/app/kit.tsx`, `components/layout/{Header,Footer}.tsx`, `components/layout/useLogout.ts`, `components/shared/{PostHogProvider,SentryReplay}.tsx`, `sentry.client.config.ts`, `next.config.mjs`, `app/layout.tsx`, `app/sitemap.ts`, `lib/supabase/middleware.ts`, `public/sw.js`, `__tests__/seo-meta.test.ts` |
| 2026-10-04 | Mots-clés PushRank travaillés. **Liste** : 10 mots-clés ignorés (phrases recopiées de l'accueil, hors cible, « conforme 2026 »), 11 marqués couverts par /modele et les générateurs, priorités relevées sur « factures mentions obligatoires » (3 600 recherches/mois, difficulté 12), « plateforme agréée », « logiciel devis facturation » (1 600/mois) ; 32 mots-clés ajoutés (artisans du bâtiment, intention « je démarre », plateforme agréée, TVA travaux, autoliquidation, situations ; aucun concurrent). **Guide « Mentions obligatoires d'une facture »** refait sur service-public.gouv.fr F31808 (mise à jour du 11/08/2026) et les textes cités : encadré « L'essentiel », vendeur (EI R526-27, RCS), client (n° de TVA au-delà de 150 € HT), numérotation, lignes, TVA (293 B, autoliquidation, certification du taux réduit depuis le 01/03/2025), paiement (BCE + 10 points, 3 × taux légal, 40 €), assurance de l'artisan (L132-1, attestation décennale L243-2), 4 nouvelles mentions de la réforme (2026 GE/ETI, 2027 PME/TPE/micro), sanctions (15 € par mention plafonnée au quart, CGI 1737 ; 75 000/375 000 €, L441-16) ; réponses fausses corrigées (récidive à 75 000 €, PDF par email sans la réforme) ; schéma HowTo retiré (ce n'est pas une suite d'étapes). **Nouveau guide « Plateforme agréée »** sur la fiche DGFiP (septembre 2025) et impots.gouv.fr (16/01/2026) : rôle, ex-PDP, solution compatible et PPF, calendrier (loi n° 2023-1322, art. 91), effet pour un artisan, comment choisir, état réel de Qonforme (raccordement en préparation, pas encore « solution compatible »). Modèle de guide enrichi (titre SEO distinct du h1, « L'essentiel », listes, sources officielles, date de vérification, liens propres, `dateModified`). Titre de l'accueil « Logiciel de devis et facturation pour artisans du bâtiment » ; guide facture électronique titré 2026-2027 ; maillage : pied de page, accueil, glossaire (PDP, PPF, facture électronique, e-reporting), /modele, liens automatiques du blog (« plateforme agréée », « PDP »). 1 009 pages, 120 pages publiques vérifiées (un h1, title ≤ 70, description 120-155), 2 tests ajoutés | `lib/pseo/guides.ts`, `app/guide/[slug]/page.tsx`, `lib/pseo/glossaire.ts`, `lib/blog-autolink.ts`, `app/layout.tsx`, `app/page.tsx`, `app/modele/page.tsx`, `components/layout/Footer.tsx`, `__tests__/seo-meta.test.ts` |
| 2026-10-04 | Pages « je démarre » pour les mots-clés PushRank. **Guide « Mentions obligatoires d'un devis »** (`/guide/mentions-obligatoires-devis`) vérifié sur service-public.gouv.fr F31144 et les textes : identité (EI, RCS), lieu des travaux, décompte en quantité et en prix, taux horaire TTC, frais de déplacement, HT/TTC et TVA par ligne, validité (aucune durée légale), devis gratuit ou payant, délai d'exécution chez un particulier (C. conso L111-1), assurance (C. artisanat L132-1, attestation décennale L243-2), certification du taux réduit depuis le 01/03/2025, autoliquidation en sous-traitance, déchets du chantier sur les devis de construction, rénovation et démolition (C. environnement L541-21-2-3, D541-45-1, décret n° 2020-1817), « Bon pour accord », rétractation de 14 jours (L221-18), amende de 3 000/15 000 €. **Guide « Devis obligatoire »** refait et distingué du précédent : l'ancien seuil de 150 € était faux (supprimé par l'arrêté du 24 janvier 2017, en vigueur le 01/04/2017), sanction du défaut de décennale corrigée. **Section « S'installer à son compte »** : page d'accueil `/devenir-a-son-compte` et 9 pages métier (plombier, électricien, maçon, peintre, carreleur, menuisier, couvreur, plaquiste, chauffagiste) vérifiées sur les fiches officielles de chaque métier : qualification (CAP, BP ou titre RNCP, ou 3 ans attestés par la CMA ; 7 500 € d'amende), statut, immatriculation (guichet des formalités), décennale et RC pro (défaut : 6 mois et 75 000 €), TVA, premiers devis ; règles propres à chaque métier (Consuel, IRVE au-delà de 3,7 kW, certificat de conformité gaz, attestation de capacité pour les fluides frigorigènes, RGE, ravalement en secteur protégé, échafaudage sur la voie publique…) et questions propres, chiffres repris des constantes vérifiées des outils (plafond micro, cotisations, franchise de TVA), JSON-LD Article + FAQPage + BreadcrumbList, date de vérification. Maillage : pages « Facturation pour … », pied de page, plan du site, liens automatiques du blog, sitemap, middleware et service worker. Typographie : `fr()` garde les montants et pourcentages insécables sur toutes les pages de contenu. 131 pages publiques vérifiées (un h1, title ≤ 70, description 120-155), 176 liens internes en 200, 5 tests ajoutés | `lib/pseo/{guides,installation}.ts`, `app/devenir-a-son-compte/`, `app/facturation/[slug]/page.tsx`, `app/guide/[slug]/page.tsx`, `components/content/text.ts`, `components/layout/Footer.tsx`, `app/plan-du-site/page.tsx`, `app/sitemap.ts`, `lib/supabase/middleware.ts`, `public/sw.js`, `lib/blog-autolink.ts`, `__tests__/seo-meta.test.ts` |
| 2026-10-04 | Guide « Comment faire un devis d'artisan » (`/guide/comment-faire-un-devis`, mot-clé PushRank « comment faire un devis artisan ») : 8 étapes (visite et métré, description sans ambiguïté, chiffrage ligne par ligne, TVA par ligne, validité, délai et acompte, mentions, envoi et relance, signature et avenant), encadré « L'essentiel », règles vérifiées sur service-public.gouv.fr F31144 et les textes (taux horaire TTC et décompte du temps, arrêté du 24 janvier 2017 ; prix libres, C. com. L410-2 ; somme versée d'avance présumée arrhes face à un particulier ; aucun paiement avant 7 jours hors établissement sauf dépannage urgent demandé, C. conso L221-10 ; rétractation L221-18 ; signature électronique, C. civ. 1366-1367 ; certification du taux réduit, déchets de chantier, autoliquidation), JSON-LD Article + FAQPage + HowTo. **Exemple de devis chiffré** (champ `exemple` des guides, `components/content/ExempleDevis.tsx`) : prix fictifs annoncés comme tels, totaux et acompte calculés en centimes par le même code que les générateurs gratuits (`lib/pseo/exemple-devis.ts`), tableau qui passe en une colonne sur mobile. **Ancien seuil de 150 € corrigé partout** (le devis est dû dès le premier euro depuis le 01/04/2017) : pages métier plombier, maçon, serrurier, paysagiste, informaticien (article L111-3 mal cité retiré, obligation non affirmée faute de certitude sur l'annexe de l'arrêté), jardinier (services à la personne : dès 100 € TTC par mois), glossaire « Devis », guide « Devis ou facture ? » (et sa mention manuscrite périmée), FAQ du générateur de devis ; règle `devis-seuil-150` dans la vérification des articles du blog et fait de référence pour le générateur d'articles. **Liens automatiques du blog** : ne s'insèrent plus jamais dans un attribut de balise (`alt`, `title`), « faire / rédiger / chiffrer un devis » relié au guide. Maillage : guides du devis, /modele, modèles de devis, générateur, glossaire, pages « Devenir … à son compte ». 132 pages publiques vérifiées, 110 liens internes en 200, 9 tests ajoutés | `lib/pseo/{guides,exemple-devis,metiers,glossaire}.ts`, `components/content/ExempleDevis.tsx`, `app/guide/[slug]/page.tsx`, `app/modele/{page,[slug]/page}.tsx`, `app/outils/generateur-devis-gratuit/page.tsx`, `app/devenir-a-son-compte/`, `lib/blog-autolink.ts`, `lib/blog-audit.ts`, `lib/ai/gemini.ts`, `__tests__/{seo-meta,blog-audit,blog-autolink}.test.ts` |
| 2026-10-05 | Analyse concurrentielle interne de Costructor, présenté par le fondateur comme le seul concurrent sérieux (ne jamais le nommer en public) : offre et grille relevées sur son site (tableau des tarifs ligne par ligne), société, IA, chiffrage, facturation électronique (raccordé à Pennylane et Super PDP, émission et réception gratuites), partenariat officiel CAPEB du 27/08/2026 et une quarantaine de pages de prescripteurs. Comparaison fonction par fonction avec le code de Qonforme, coût annuel pour trois profils d'artisan (Qonforme moins cher dès les relances et le FEC : 120 € contre 300 € HT par an), points faibles, recommandations (raccorder Super PDP via `lib/pa`, appliquer les migrations en attente, prescripteurs restés libres, devis dicté sans prix inventé, vrais avis, un collaborateur en Artisan) et 4 décisions pour le fondateur. À vérifier : région réelle de la base Supabase contre « eu-west-3, Paris » dans la politique de confidentialité. Aucun code modifié | `ANALYSE-CONCURRENT-COSTRUCTOR-2026-10.md` |
| 2026-10-05 | Travail PushRank du jour. **Nouveau guide « TVA des travaux : 20 %, 10 % ou 5,5 % »** (`/guide/tva-travaux`) vérifié sur le CGI (279-0 bis, 278-0 bis A), le BOFiP (BOI-TVA-LIQ-30-20-90-20, actualité du 22/10/2025) et la loi de finances pour 2025 (art. 32 et 41) : logement de plus de deux ans, rénovation énergétique sous critères de performance, exclusions (chaudière gaz ou fioul depuis le 01/03/2025, espaces verts, nettoyage, électroménager même encastré, chauffage collectif, ascenseur, sauna et hammam, climatisation, fourniture sans pose, immeuble rendu neuf ou surface + 10 %), main-d'œuvre à 10 % quand le client achète le matériel, certification du client sur le devis ou la facture, sous-traitance et franchise. **« Première facture » refait en « Comment faire une facture d'artisan »** (même adresse) d'après service-public F23208 et F31808 : facture dès la fin des travaux ou récapitulative mensuelle, obligatoire chez un particulier au-delà de 25 € TTC, numérotation, mentions, acomptes déduits, délais entre professionnels (L441-10), double papier, conservation 10 ans ; le délai de facturation « de 15 jours » qui n'existe pas est retiré (aussi du modèle de facture auto-entrepreneur). **Exemples chiffrés** étendus aux factures (acompte déduit, reste à payer) et aux devis à plusieurs taux (TVA ventilée par taux), toujours calculés par le code des générateurs ; **modèle de devis travaux** retitré « Modèle de devis artisan gratuit et exemple de devis travaux » (requêtes « modele devis artisan », « devis exemple », « devis matériaux » déjà envoyées par Google), exemple de pose de carrelage avec matériaux et déchets, mention périmée « Devis reçu avant l'exécution des travaux » remplacée par « Bon pour accord », titres des modèles passés par `fitTitle`. **Page /guide** renforcée (recommandation PushRank « page gagnante ») : titre « Guides de facturation pour les artisans du bâtiment », section « Pour commencer », date de vérification sur chaque guide, liens vers l'installation et le modèle de devis travaux. Liens : accueil, guides du devis et de la facture, pages « Devenir … à son compte », liens automatiques du blog (« faire une facture », « taux de TVA des travaux », « TVA à 10 % »). **PushRank** : profil d'entreprise (cible artisans du bâtiment, 8 règles : aucun concurrent, ni certifié ni plateforme agréée, aucun contact humain, aucun avis invérifiable, sources officielles, vouvoiement et dates de la réforme, offre exacte, « plateforme agréée » et jamais « PDP »), contexte éditorial (seules les fonctions sûrement en ligne), mots-clés couverts ou écartés. 133 pages publiques vérifiées, 113 liens internes en 200, 12 tests ajoutés | `lib/pseo/{guides,modeles,exemple-devis}.ts`, `components/content/ExempleDevis.tsx`, `app/guide/page.tsx`, `app/modele/[slug]/page.tsx`, `app/page.tsx`, `app/devenir-a-son-compte/`, `lib/blog-autolink.ts`, `__tests__/{seo-meta,blog-autolink}.test.ts` |
| 2026-10-06 | Webhook CMS de PushRank (contrat « 2026-07 », référence OpenAPI fournie par le fondateur) : route `POST /api/pushrank/webhook` (publique dans le middleware comme le webhook Stripe), signature HMAC-SHA256 vérifiée sur le corps brut (« horodatage.corps », comparaison en temps constant, requêtes de plus de 5 minutes refusées), version de contrat inconnue refusée, test de connexion en 200 sans rien enregistrer ; `create` rend `{ id, url }` et enregistre la clé `X-PushRank-Idempotency-Key` sur l'article (index unique) : un renvoi rend le même article, jamais un second ; `update` remplace l'article à la même adresse, `unpublish` et `delete` le repassent en brouillon sans le supprimer ; seuls les articles venus de PushRank sont modifiables ; codes conformes à la politique de nouvel essai (4xx définitif, 503 passager : base injoignable, secret absent, migration non appliquée). **Publication directe** (décision du fondateur, articles déjà relus sur PushRank), sauf valeur périmée ou affirmation interdite repérée par `lib/blog-audit.ts` (« PDP » seulement signalé) : brouillon avec `held_reason`. Contenu HTML converti en Markdown du blog par liste blanche (titres, paragraphes, listes, liens http(s), gras, italique, code, citations, tableaux) avec texte échappé : ni script, ni attribut, ni lien `javascript:` ne passe, alors que le moteur Markdown laisse passer le HTML brut ; images du corps retirées ; couverture téléchargée et re-hébergée dans `blog-covers` (jamais liée chez PushRank, échec non bloquant). Page article : titre et description SEO de PushRank, directives `robots` respectées, article « noindex » sorti du sitemap ; lecture des nouvelles colonnes sans casser le blog avant la migration ; sommaire et FAQ du blog avec entités décodées (`lib/html-entities.ts`). Migration `20261006_pushrank_webhook.sql` exécutée deux fois dans PGlite, **à appliquer** (le connecteur Supabase de la session n'accède pas au projet de Qonforme) ; variable `PUSHRANK_WEBHOOK_SECRET` à créer dans Vercel. Requêtes signées testées sur le build local (200, 401, 400, 503). 14 tests | `app/api/pushrank/webhook/route.ts`, `lib/pushrank/{webhook,html-to-markdown,cover}.ts`, `lib/html-entities.ts`, `lib/markdown.ts`, `lib/blog-utils.ts`, `app/blog/[slug]/page.tsx`, `app/sitemap.ts`, `lib/supabase/middleware.ts`, `.env.example`, `supabase/migrations/20261006_pushrank_webhook.sql`, `__tests__/pushrank-webhook.test.ts` |
| 2026-10-06 | Maquette « Inscription en deux champs » (canevas de design https://claude.ai/artifact/Hx6VAhriKyAMhHjPLb3Tph, aucun code applicatif), à la demande du fondateur : `/signup` réduit à l'email et au mot de passe (prénom, nom et confirmation retirés, consentement CPCE inchangé), photo d'artisan à droite (électricien par défaut, menuisier ou plaquiste au choix) avec titre « Vos devis entre deux chantiers, *pas le dimanche soir.* » et cartes produit déjà validées sur l'accueil ; arrivée directe sur le tableau de bord, fenêtre en trois étapes : entreprise (recherche par nom, SIREN ou SIRET dans le répertoire Sirene, forme juridique et entreprises fermées affichées, saisie à la main si introuvable ou sans SIREN), métier présélectionné d'après le code APE et régime de TVA (n° de TVA seulement si la TVA est facturée, type de chantier pour préremplir le catalogue), prénom ; puis « Par quoi voulez-vous commencer ? » dans la fenêtre. « Passer au tableau de bord » à chaque étape, tuile « Terminer votre inscription » à la place de « Compléter votre entreprise ». Téléphone en feuille du bas pleine hauteur, sans flou. Revue par trois relecteurs (règles, friction, faisabilité). À coder si validé : API d'inscription sans nom, redirections `/signup/company` et `/demarrer` du tableau de bord, recherche Sirene par nom (API Recherche d'entreprises), email de bienvenue sans prénom, envoi bloqué sans SIREN, miroir démo. Constaté, non corrigé : le devis d'essai ignore la franchise déclarée dans le profil légal (`trial-quote` ne lit que `legal_notice`) | — (canevas de design) |
| 2026-10-06 | Inscription en deux champs codée (maquette validée par le fondateur, canevas https://claude.ai/artifact/Hx6VAhriKyAMhHjPLb3Tph). **/signup** : adresse email et mot de passe seulement (plus de prénom, nom ni confirmation ; « Afficher » atteignable au clavier), photo d'artisan pleine hauteur à droite avec titre en deux voix, trois engagements et deux cartes d'exemple, bande photo et « Se connecter » en haut sur téléphone ; `POST /api/auth/signup` : noms facultatifs, `user_metadata.signup_wizard`, messages Supabase traduits (l'email déjà inscrit renvoyait un 400 en anglais), plus de « Contactez le support » ; email de bienvenue sans prénom. **Fenêtre « Bienvenue »** sur le tableau de bord (`InscriptionDialog`, plus de renvoi vers `/signup/company` ni `/demarrer`) : entreprise (recherche par nom, SIREN ou SIRET, `GET /api/sirene/search` sur l'API Recherche d'entreprises, forme juridique et code APE, fermées grisées, saisie à la main si introuvable ou sans SIREN), métier présélectionné d'après le code APE et régime de TVA (n° de TVA calculé « à vérifier » seulement si la TVA est facturée, catalogue prérempli selon le chantier), prénom (prérempli pour un entrepreneur individuel), puis les quatre choix de départ ; « Passer au tableau de bord » et Échap à chaque étape, tuile « Terminer votre inscription » qui reprend à l'étape restante ; feuille pleine hauteur sans flou sur téléphone, pied collant ; `PATCH /api/onboarding/inscription` n'écrit que les champs de l'étape (jamais `invoice_sequence`), SIREN « » si absent. **Envoi bloqué sans identité de l'émetteur** (`lib/legal/issuer.ts`, 409 `COMPANY_REQUIRED`, avant le mur de paiement) : envoi des devis, factures et bons de commande, sortie du brouillon, liens de signature ; présence d'un SIREN de 9 chiffres seulement, pour ne bloquer aucun compte existant. Logo centré en haut du tableau de bord d'un compte neuf sur téléphone, pastille « Gratuit » retirée à côté du logo (maquette). **Corrigé au passage** : le devis d'essai ignorait la franchise de TVA du profil légal (20 % au lieu de « TVA non applicable »). Démo : `/demo/bienvenue` sur les mêmes composants. Aucune migration. Build 1 023/1 023, lint, 800+ tests, parcours vérifié au navigateur (ordinateur et téléphone) | `app/signup/page.tsx`, `components/auth/{SignupForm,SignupPhotoPanel,AuthLayout,fields}.tsx`, `lib/auth/signup-input.ts`, `app/api/auth/signup/route.ts`, `lib/email/templates/welcome.ts`, `lib/utils/sirene.ts`, `lib/legal/{from-sirene,issuer}.ts`, `app/api/sirene/search/`, `lib/onboarding/inscription.ts`, `app/api/onboarding/inscription/`, `components/onboarding/{InscriptionDialog.tsx,inscription/}`, `components/dashboard/{DashboardClient,GettingStarted,BrandLogo,model,data,demo-data}.ts(x)`, `app/dashboard/page.tsx`, `app/demarrer/page.tsx`, `app/api/auth/callback/route.ts`, `app/api/{quotes,invoices,purchase-orders}/[id]/**`, `app/api/signature/[type]/[id]/route.ts`, `lib/onboarding/trial-quote.ts`, `components/layout/{Sidebar,DemoFrame,nav,shell}.ts(x)`, `app/demo/bienvenue/`, `__tests__/{signup-api,welcome-email,sirene-search,from-sirene,inscription,issuer-identity,inscription-dialog}.test.ts` |
| 2026-10-07 | Analyse et plan pour remplacer PushRank par un onglet « SEO » dans l'espace admin (décision du fondateur ; résiliation de PushRank ensuite) : relevé de ce qui est vraiment utilisé (compte en essai ; Search Console, actions, 63 mots-clés, profil ; jamais le plan de contenu ni la génération d'articles), équivalences et sources de données (Search Console, PageSpeed, exploration du sitemap, volumes DataForSEO, API des moteurs IA), méthode de suivi de la visibilité dans les IA (10 questions × moteurs avec recherche web, mentions et citations, 3 répétitions, concurrents en usage interne seulement, coûts relevés), 6 lots, 4 décisions en attente, correction d'une première analyse (les volumes de PushRank existent). Défauts constatés sur l'article PushRank du 07/10 : absent du plan du site (cache d'environ 28 h) et titre répété en H2, à corriger au lot 0. Canevas de design de l'onglet (29 planches, à valider avant tout code) : https://claude.ai/artifact/4UtSAdhRw8xFW1BTLmGypz. Aucun code applicatif modifié | `PLAN-SEO-INTERNE-2026-10.md`, `CLAUDE.md`, `README.md` |
| 2026-10-09 | Abandon de PushRank (décision du fondateur) : webhook CMS supprimé (route `/api/pushrank/webhook`, `lib/pushrank/`, test, entrée du middleware, variable `PUSHRANK_WEBHOOK_SECRET`, connexion de l'onglet SEO) ; un appel de PushRank reçoit désormais une page introuvable. Conservés : les articles déjà reçus (toujours publiés, source « PushRank ») et les colonnes de la migration 20261006 (titre et description SEO, directives d'indexation), lues par la page article et le plan du site. Correctifs : plan du site recalculé toutes les heures et aussitôt après chaque publication ou modification d'article (`lib/blog-revalidate.ts`, aussi depuis l'admin du blog et l'ancien générateur) ; premier titre identique au titre de l'article retiré à l'affichage pour tous les articles (`stripLeadingTitle` dans `lib/blog-utils.ts`), y compris l'article PushRank du 07/10 reçu avant le correctif ; admin du blog : titre et description pour Google modifiables, date de publication conservée quand on réenregistre un article publié (elle passait à la date du jour). Reste au fondateur : supprimer la variable dans Vercel, déconnecter le CMS et résilier chez PushRank | `app/api/pushrank/` (supprimé), `lib/pushrank/` (supprimé), `lib/supabase/middleware.ts`, `lib/seo/connections.ts`, `lib/blog-revalidate.ts`, `lib/blog-utils.ts`, `app/blog/[slug]/page.tsx`, `components/admin/BlogEditor.tsx`, `app/sitemap.ts`, `app/api/admin/blog/**`, `app/api/cron/generate-blog/route.ts`, `.env.example`, `PLAN-SEO-INTERNE-2026-10.md` |
| 2026-10-10 | Onglet « SEO » de l'espace admin livré en code (lots 1 à 4 de `PLAN-SEO-INTERNE-2026-10.md`, canevas validé https://claude.ai/artifact/4UtSAdhRw8xFW1BTLmGypz), à la place de PushRank. **Socle** : migration `20261009_seo_admin.sql` (17 tables `seo_*` en RLS sans politique, service_role seul ; 6 fonctions d'agrégation Search Console réservées à service_role, `search_path` fixé ; reprise de l'existant : 10 questions IA et leur relevé du 28/09, 15 mots-clés, 5 sujets, 8 actions faites, mesures PageSpeed du 04/10 ; colonnes de contrôle sur `blog_posts`, table fermée à la clé publique (le blog la lit côté serveur)), réglages par section (`seo_settings`, zod), compte de service Google signé sans dépendance, une seule tâche planifiée `GET /api/cron/seo` toutes les 15 min (réponse 202 immédiate puis travail poursuivi, verrous `seo_jobs`, journal `cron_logs` « seo:… », erreurs masquées avant enregistrement, secret comparé en temps constant). **Vue d'ensemble**. **Performance** : Search Console (16 mois repris, mise à jour quotidienne, période, appareil, pays, pages et requêtes), PageSpeed (pages suivies, avant/après, mesure hebdomadaire, clé en en-tête), Audit du site (exploration du plan du site, qonforme.fr seulement, title, description, H1, canonique, liens cassés, noindex vérifié). **Actions SEO** : constats de l'exploration et de Search Console (page gagnante, en baisse, bien classée sans clic), résolus seulement quand leur règle est réévaluée (ou page retirée du plan du site), proposition par Gemini, mesure à 14 jours. **Mots-clés** : tirés des requêtes réelles, volumes, difficulté, CPC et intention par DataForSEO (facultatif, une analyse par 30 jours), sujet d'article sans doublon, jamais pour un mot-clé qui nomme un concurrent. **Articles** : calendrier, liste, sujets, préférences ; rédaction en passes (plan et contrôle factuel par Gemini 3.8 Flash, rédaction par Claude avec repli sur Gemini, couverture Nano Banana 2.1 avec repli), faits de référence communs avec l'ancien générateur (`lib/ai/reference-facts.ts`), concurrents jamais dans une consigne, publication brouillon / après contrôle / directe décidée côté serveur avec les problèmes du relecteur gardés jusqu'à l'heure prévue, « Publier maintenant » et l'éditeur du blog refusés en 409 tant qu'un problème bloquant reste, une rédaction active par sujet, plafond de passes, ancien générateur arrêté dès la migration appliquée. **Visibilité IA** : questions × moteurs (Gemini, ChatGPT, Perplexity, Claude, Aperçu IA par DataForSEO) avec recherche web et 3 répétitions, mentions (liens retirés) et citations réellement citées, concurrents en usage interne, relevé mensuel et analyse immédiate arrêtable, délai compté comme un essai. **Paramètres** : marque (preuves en http(s)), stratégie, ciblage (pays tapés en toutes lettres, portée régionale), connexions (« Clé présente » tant qu'aucun test n'a réussi), rapports (résumé hebdomadaire par email, 3 essais par semaine). Blog : liens internes automatiques selon la préférence, liens Markdown limités à http(s), chemins et ancres, données structurées échappées. Relecture adverse de chaque module (correction, design, sécurité, tests) puis corrections, revue de sécurité finale. Migration rejouée deux fois dans PGlite, build 1 039/1 039, lint, 1 296 tests, 17 écrans contrôlés au navigateur sur ordinateur et téléphone (base injoignable, pas à jour, vide). Migration `20261009_seo_admin.sql` **à appliquer** ; variables Vercel et tâche cron-job.org à créer | `supabase/migrations/20261009_seo_admin.sql`, `lib/seo/`, `app/admin/(panel)/seo/`, `app/api/admin/seo/`, `app/api/cron/seo/route.ts`, `components/admin/seo/`, `lib/email/templates/seo-digest.ts`, `lib/ai/{reference-facts,gemini}.ts`, `lib/markdown.ts`, `app/blog/[slug]/page.tsx`, `app/api/admin/blog/[id]/route.ts`, `app/api/cron/generate-blog/route.ts`, `components/admin/nav.ts`, `PLAN-SEO-INTERNE-2026-10.md`, `__tests__/seo-*.test.ts` |
| 2026-10-10 | **Trésorerie** refaite sur la base à jour, après la restauration de `main` (mes deux fusions du matin, parties d'une copie ancienne, l'avaient cassé — voir la ligne « Restaure main » ci-dessus) : page `/tresorerie` dans le menu Pilotage (barre latérale, feuille « Plus » et palette ⌘K via `nav.ts`), au kit de l'application (`PageHeader`, `Kpi`, `Panel`, `q-table`). Encaissements (factures émises ouvertes, avoirs et retenue de garantie déduits, comme le tableau de bord) **et décaissements** (factures reçues à payer, litiges exclus, échéance par défaut à 30 jours, art. L441-10) semaine par semaine sur 30/60/90 jours, retards à part, solde prévu, échéancier filtrable ; dates de Paris (`lib/utils/paris-date`) ; sorties masquées proprement tant que la migration des factures reçues n'est pas appliquée (`isReceptionUnavailable`). Palette validée (clair et sombre). Démo miroir sur les données de `lib/demo` (mêmes chiffres que les autres écrans). Aucune migration | `lib/treasury/`, `app/api/tresorerie/`, `components/treasury/TreasuryView.tsx`, `app/tresorerie/`, `app/demo/tresorerie/`, `lib/demo/treasury.ts`, `components/layout/nav.ts`, `lib/supabase/middleware.ts`, `app/robots.ts`, `DECISIONS-STRATEGIQUES.md`, `__tests__/treasury-forecast.test.ts` |
| 2026-10-10 | **Signature en ligne complétée** (DECISIONS § 11). **Rétractation en ligne** d'un particulier, dans le délai de 14 jours (L221-18, L221-19) : carte « Changer d'avis » sur la page du client et bouton dans l'email de confirmation (lien par le jeton, qui rouvre la page sur n'importe quel appareil ; avant, « Revoir le document » ne marchait que sur l'appareil de la signature), formulaire court avec confirmation explicite, accusé de réception sur support durable (L221-21), artisan prévenu (remboursement sous 14 jours, L221-24 ; avoir si une facture existe), devis « Rétracté » (`withdrawn`, jamais posé à la main, rangé avec les refusés) ou bon de commande « Annulé », PDF signé conservé. **Acompte après signature** : réglage « Acompte demandé à la signature » (aucun, 10 à 50 %, rappel L214-1 sur les arrhes), montant, taux et référence figés sur le lien, annoncé avant la signature ; à distance (ou client professionnel) : bénéficiaire, IBAN, BIC, montant, référence à copier et QR code SEPA tout de suite, aussi dans l'email ; signé sur place chez un particulier : rien avant 7 jours, demande envoyée par le cron à J+8, sauf réparation urgente demandée par le client (case dédiée, L221-10 4° et L221-28 8°) ; pas de page de paiement (décision du fondateur). **Relance avant expiration** : réglage (activée par défaut, 1 à 7 jours avant), une seule par lien, réservée en base avant l'envoi, jamais pour un lien de moins de 2 jours ni le même jour qu'une relance de devis, comptes avec formule seulement ; prévue ou envoyée affichée dans le panneau. Le cron des relances lance ces deux tâches (`lib/signature/jobs.ts`). Démo miroir (`/signer/demo/d-2026-026` signé par un particulier, `/signer/demo/retracte`, acompte de 30 %). Migration `20261010_signature_withdrawal_deposit_reminder.sql` exécutée deux fois dans PGlite, **à appliquer** après celle du 03/10 ; sans elle, tout reste comme avant. Build 1 041/1 041, lint, 24 tests, parcours vérifiés au navigateur | `lib/signature/{rules,deposit,settings,jobs,public,server,view,types,signed-pdf}.ts`, `app/api/signature/**`, `app/s/[token]/route.ts`, `app/signer/[id]/page.tsx`, `components/signature/{AfterSignature,PublicSignView,SignaturePanel,SignatureSettingsCard,demo-api}.tsx`, `lib/email/templates/signature.ts`, `app/api/cron/send-reminders/route.ts`, `components/quotes/{QuoteListHelpers,QuoteListView,QuoteDetailView}.tsx`, `components/app/kit.tsx`, `lib/utils/{document-status,invoice}.ts`, `types/index.ts`, `lib/demo/signature.ts`, `supabase/migrations/20261010_signature_withdrawal_deposit_reminder.sql`, `__tests__/signature-extras.test.ts` |
| 2026-10-10 | Suite de l'inventaire (DECISIONS § 10). **Encaissé** : « Marquer comme payée » demande la date du paiement (le virement déclaré par le client donne la sienne), `paid_at` écrit au passage à « payée » et effacé au retour (`lib/utils/payment-date.ts`, contrôles : pas dans le futur, pas plus de 60 jours avant la facture), encaissé de la période affiché sous « À encaisser » au tableau de bord (et sur mobile), paiements datés seulement : une facture payée sans date n'est comptée nulle part ; repli si la colonne manque. **Page Relances** `/relances` (menu Pilotage, démo `/demo/relances`) : file des 14 prochains jours rejouée jour par jour avec le planificateur du cron (`lib/reminders/queue.ts`, mêmes réglages, même journal, même écart de 3 jours), factures relancées jusqu'au bout et toujours impayées, documents sans adresse email, historique de 30 jours, bandeaux « relances en pause sans formule », « désactivées » et ancien fonctionnement J+30/J+45. **Lien « Propulsé par Qonforme »** cliquable avec provenance (`?source=email-facture`, `pdf-devis`…) dans tous les emails envoyés aux clients et le pied des 4 PDF (annotation PDF/A imprimable ; Factur-X d'une facture et d'un avoir revalidés avec Mustang 2.26.0 : PDF/A-3, XSD, schématrons, tout valide). **Suivi d'ouverture** : devis, consultations de leur page en ligne dans la colonne « Suite » ; factures, ouvertures de la page de règlement comptées par le navigateur (`/api/regler/[token]/view`, une par 10 minutes, sans IP ni navigateur) et affichées dans le panneau Paiement. Migrations `20261010_invoice_paid_at.sql` et `20261010_payment_link_views.sql` **à appliquer** ; sans elles, rien ne casse. Démo miroir, build 1 043/1 043, lint, 17 tests | `lib/utils/{payment-date,powered-by}.ts`, `app/api/invoices/[id]/route.ts`, `components/invoices/InvoiceDetail.tsx`, `components/dashboard/{model,data,demo-data,DashboardStats}.ts(x)`, `lib/reminders/queue.ts`, `app/api/relances/`, `components/reminders/RemindersView.tsx`, `app/relances/`, `app/demo/relances/`, `lib/demo/{reminders,payment-link}.ts`, `components/layout/nav.ts`, `lib/supabase/middleware.ts`, `app/robots.ts`, `lib/email/templates/*.ts`, `lib/pdf/{link,invoice,quote,credit-note,purchase-order}.ts`, `components/quotes/{QuoteListHelpers,QuoteListView}.tsx`, `app/{quotes,demo/quotes}/page.tsx`, `lib/payment-link/{server,types}.ts`, `app/api/regler/[token]/view/`, `app/regler/[token]/page.tsx`, `components/payment-link/{PaymentLinkPanel,ViewBeacon}.tsx`, `supabase/migrations/20261010_{invoice_paid_at,payment_link_views}.sql`, `__tests__/{payment-date,reminders-queue,powered-by,document-views}.test.ts` |
| 2026-10-10 | **Liste des factures : actions groupées et vues enregistrées** (DECISIONS § 10). Cases à cocher sur ordinateur (tout sélectionner, sélection vidée au changement d'onglet ou de recherche), barre « N factures sélectionnées · total » : PDF en ZIP (`POST /api/invoices/bulk-pdf`, 50 au plus, PDF identiques au téléchargement à l'unité, Factur-X ou filigrane brouillon, noms uniques par `createZip`), export CSV de la sélection fait dans le navigateur (format des exports comptables, formules neutralisées), archiver ou désarchiver ; rien qui émette, relance ou change un statut. Vues enregistrées : onglet et recherche sous un nom, 8 au plus, sur l'appareil (stockage local relu sans lui faire confiance). Démo miroir (inscription proposée pour le ZIP et l'archivage, CSV et vues réels). Aucune migration. 4 tests | `components/invoices/InvoiceList.tsx`, `lib/export/invoice-list.ts`, `app/api/invoices/bulk-pdf/route.ts`, `app/invoices/page.tsx`, `app/demo/invoices/page.tsx`, `__tests__/invoice-list-tools.test.ts` |
| 2026-10-10 | **Modèles de documents** (DECISIONS § 10) : 5 habillages des PDF dans Paramètres › Modèles de documents, réels et démo sur le même composant (`DocumentTemplatesCard`) : Classique (rendu d'avant, flux de contenu identiques octet pour octet), Chantier (bandeau sombre, total sur fond sombre), Moderne (parties teintées, total à la couleur de l'entreprise), Épuré (noir et blanc, économe en encre), Prestige (double filet, total encadré) ; le même pour tous les documents ou un par document, enregistré à chaque choix, exemple PDF de chaque modèle (devis filigrané « EXEMPLE », facture « APERÇU », données fictives). Seul l'habillage change (`lib/pdf/theme.ts`) : mentions, montants et XML Factur-X identiques, couleurs sRGB sans transparence ; 8 factures et avoirs (4 modèles) validés par Mustang (PDF/A-3, XSD, schématrons). Lecture tolérante (`selectCompanyWithProfile`) : sans la colonne, Classique pour tous ; aussi dans le cron des relances et l'espace comptable. Les aperçus à l'écran gardent la mise en page Classique. Migration `20261010_document_templates.sql` à appliquer. 3 tests | `lib/pdf/{theme,invoice,quote,credit-note,purchase-order}.ts`, `lib/legal/db.ts`, `app/api/document-templates/`, `components/settings/{DocumentTemplatesCard,InvoiceSettingsForm}.tsx`, `app/api/cron/send-reminders/route.ts`, `lib/accountant/exports.ts`, `supabase/migrations/20261010_document_templates.sql`, `__tests__/document-templates.test.ts` |
| 2026-10-11 | Contrôle en production après la migration `20261009_seo_admin.sql` appliquée par le fondateur (lecture seule, clé publique du site) : 202 adresses du plan du site en 200, blog et articles complets (lus côté serveur), `blog_posts` refusée à la clé publique (42501), 17 tables `seo_*` présentes sans aucune ligne visible, fonctions `seo_gsc_*` refusées. Défense en profondeur ajoutée : migration `20261011_seo_revoke_public_roles.sql` qui retire aussi les droits par défaut d'`anon` et `authenticated` sur les tables `seo_*` (seule la RLS les protégeait), testée dans PGlite avec les droits par défaut de Supabase, rejouable. Comportement du premier passage de `/api/cron/seo` relu : aucun article ni email sans action de l'admin ; seul le relevé mensuel de visibilité IA part tout seul (Gemini et ChatGPT si leurs clés sont là, environ 0,6 $) ; à faire avant la tâche cron-job.org : `PAGESPEED_API_KEY` et le compte de service ajouté à Search Console | `supabase/migrations/20261011_seo_revoke_public_roles.sql` |
| 2026-10-15 | **Nettoyage de l'ancien pSEO large pour se concentrer sur le bâtiment** (décision du fondateur). Constat (Search Console reliée à OpenSEO, 15/10) : sur 14 pages indexables inspectées, 12 sont « inconnues de Google » ; seules 20 pages affichées en 3 mois (5 clics), dont 3 clics sur des pages ville en noindex ; aucun lien entrant détecté ; résultats « modèle devis gratuit » dominés par des modèles Word/Excel à télécharger. **Supprimé** : 28 pages métier hors bâtiment (auto-entrepreneur, consultant, développeur freelance, graphiste, photographe, formateur, coach, community manager, traducteur, coiffeur, esthéticienne, architecte d'intérieur, traiteur, fleuriste, ostéopathe, kinésithérapeute, infirmier libéral, diététicien, comptable, avocat, agent immobilier, boulanger, VTC, femme de ménage, informaticien, jardinier, déménageur, taxi), la route `/facturation/[slug]/[ville]` et `lib/pseo/villes.ts` (780 pages en noindex, jamais dans le plan du site), le code mort des catégories service et santé. Restent 11 métiers : plombier, électricien, maçon, peintre, carreleur, menuisier, couvreur, plaquiste, chauffagiste, serrurier, paysagiste. Hub `/facturation` limité au bâtiment (titre et description réécrits), hub `/outils` « pour artisans du bâtiment ». Les pages supprimées répondent 404 ; tout est récupérable dans l'historique du code (dernier commit avant la suppression : `2549982`) ; la réintroduction de pages ville n'a de sens qu'avec des liens entrants et du contenu local unique. Plan du site : 202 → 174 adresses avec ce changement, 169 une fois les 5 articles de blog hors sujet supprimés (SQL fourni au fondateur, à lancer dans Supabase). 235 pages générées (1 043 avant). Aucune migration. Tests, lint et build verts | `lib/pseo/metiers.ts`, `lib/pseo/villes.ts` (supprimé), `app/facturation/[slug]/[ville]/` (supprimé), `app/facturation/page.tsx`, `app/outils/page.tsx`, `app/sitemap.ts`, `app/plan-du-site/page.tsx`, `components/content/metier.tsx` |
| 2026-10-15 | **Blog : corrections et suppressions de données** (SQL fourni au fondateur, à lancer dans Supabase ; je n'ai pas accès à la base de production, vérifié : le site utilise le projet `lxnowrmyyaylvnognifu`, absent des trois projets visibles depuis la session). 5 articles hors bâtiment supprimés (agent immobilier, avocat, femme de ménage, TVA boulangerie, VTC ; lancé le 15/10). Correctif `20261015_corriger_articles_blog.sql` (un seul bloc) pour 18 articles : anciens seuils de franchise de TVA et plafonds micro, seuil de devis de 150 € supprimé le 01/04/2017, promesses de « certifié », « essai gratuit » qui n'existe pas ; vérification des 23 passages requis, sauvegarde dans `blog_posts_sauvegarde_20261015` (RLS, fermée à l'API), correction tout ou rien, refus d'une seconde exécution ; testé dans PGlite sur le texte réel des articles en ligne. **Constat non corrigé, décision en attente** : 4 paires d'articles « électricien » quasi identiques (11 articles sur le même sujet), un faux « témoignage » de plombier (`temoignage-comment-un-plombier-…`), 9 articles qui exigent encore l'attestation du client pour la TVA réduite (remplacée par une mention sur le devis depuis le 01/03/2025), « PDP » dans 35 articles. Pages métier hors bâtiment et pages ville : en ligne depuis le 15/10 (404) | `supabase/one-off/` |
| 2026-10-15 | **Blog : suppression d'un faux témoignage et de 3 doublons** (SQL fourni au fondateur, à lancer dans Supabase avant le correctif des articles ; testé dans PGlite, tout ou rien, refusé si un article manque). Supprimés : `temoignage-comment-un-plombier-…-i5akb` (« Jean, plombier artisan depuis 15 ans », personnage inventé présenté comme un vrai retour d'expérience, contraire à la règle « aucun faux avis ») et les secondes copies à 97-98 % de 3 articles « électricien » (`…-sb1zk`, `…-hyotq`, `…-n6hgk`). Conservés : 2 articles de même titre mais de texte différent (3 % de phrases communes) et les 3 articles déjà vus par Google. Le correctif des articles passe de 18 à 15 articles (49 règles, 19 passages requis). Restent à décider : le titre « Fixer ses prix d'artisan en 2024 » (année passée), le personnage fictif « Marc » dans 7 guides, l'attestation du client pour la TVA réduite dans 9 articles | `supabase/one-off/` |
| 2026-10-15 | **Fichiers de devis à télécharger, exemple d'électricien, calculateurs de chantier** (suite de l'analyse des positions d'un concurrent avec OpenSEO et la Search Console, interne : ne jamais le nommer en public). Constat : `/modele` est la page la mieux classée du site (4,5ᵉ sur « devis modele », 6,5ᵉ sur « modele devis », aucun clic) alors que `/modele/devis-travaux` est vers la 51ᵉ ; tous les résultats qui devancent cette requête proposent un fichier Word, Excel ou PDF. **Modèle de devis vierge** en Word (.docx), Excel (.xlsx : total de chaque ligne, TVA par taux 20/10/5,5 % et autre taux, TTC, acompte et reste calculés par formules) et PDF à imprimer, écrits sans dépendance (`lib/modeles/` ; `createZip(…, { folders: true })` garde les dossiers que Word et Excel exigent), mentions reprises du guide « Mentions obligatoires d'un devis » (assurance, déchets, certification du taux réduit, franchise 293 B, autoliquidation 283-2 nonies), servis par `GET /api/outils/modeles/[nom].[format]` (contenu fixe, mis en cache par le réseau, hors service worker), carte de téléchargement sur `/modele` et `/modele/devis-travaux`, titres « … à télécharger : Word, Excel, PDF » (la page `/modele` n'est pas déplacée : c'est elle que Google classe). **Nouvelle page `/modele/devis-electricien`** : exemple chiffré (tableau électrique et prises, 1 627,00 € HT, 1 789,70 € TTC, calculés par le code des générateurs) et ses trois fichiers, construits à partir du même objet que la page (ils ne peuvent pas se contredire), liens depuis `/facturation/electricien`, `/devenir-a-son-compte/electricien`, le guide « Comment faire un devis » et le blog. **Outils `/outils/calculateur-beton`** (volume d'une dalle ou de poteaux, marge de perte, ciment en sacs de 35 kg, sable, gravillons, eau ; quantités annoncées indicatives) **et `/outils/calculateur-pente`** (pourcentage, degrés, 1 pour n, dénivelé, longueur inclinée), formules testées, hub `/outils` à 14 outils, liens depuis les pages maçon, couvreur et paysagiste. Fichiers Word et Excel ouverts et convertis par LibreOffice (Writer et Calc) pour contrôle visuel ; 1 390 tests. **Sitemap** (accord du fondateur) : les deux calculateurs ajoutés à la liste d'outils, `/login` et `/forgot-password` retirés (pages de connexion sans valeur de recherche, accessibles et non marquées noindex), `lastmod` vrais : les 104 pages statiques portaient toutes la date du jour, ce que Google finit par ignorer ; désormais l'article ou sa mise à jour pour le blog (et le hub du blog = l'article visible le plus récent), la date de vérification pour les guides, une date réelle tirée de ce suivi pour une courte liste de pages (`MAJ` dans `app/sitemap.ts`, à compléter quand une page change), et **aucune date** pour les autres, plutôt qu'une date fausse ; 9 tests (`__tests__/sitemap.test.ts`). Aucune migration | `lib/modeles/`, `lib/accountant/zip.ts`, `app/api/outils/modeles/[fichier]/route.ts`, `components/content/TelechargerModele.tsx`, `app/modele/page.tsx`, `app/modele/[slug]/page.tsx`, `lib/pseo/modeles.ts`, `lib/outils/chantier.ts`, `app/outils/calculateur-{beton,pente}/`, `app/outils/page.tsx`, `app/facturation/[slug]/page.tsx`, `app/devenir-a-son-compte/[slug]/page.tsx`, `lib/pseo/guides.ts`, `lib/blog-autolink.ts`, `app/sitemap.ts`, `__tests__/{modele-devis,outils-chantier,sitemap}.test.ts` |
| 2026-10-15 | **Ancre du lien « Modèles gratuits » du pied de page** (audit des balises de la session : 166 pages, titres ≤ 70 caractères, un H1, canonique, données structurées et liens entrants tous conformes ; écarts relevés : ancre générique, mot « devis » absent des titres des pages métier, 14 descriptions de blog trop courtes, concurrence entre articles). À la demande du fondateur, seule l'ancre est changée : « Modèles gratuits » devient « **Modèle de devis gratuit** » (même adresse `/modele`, la page que Google classe déjà 4,5ᵉ sur « devis modele »), soit 166 liens internes avec le mot-clé. Autres libellés « Modèles gratuits » (titre de section de l'accueil, cartes du blog et de la démo, puces des hubs glossaire, facturation et guides) laissés tels quels. Reste proposé et non fait : titres « Logiciel de devis et de facturation pour … » des 11 pages métier, trois descriptions (devis travaux, béton, pente), calculateurs et exemple d'électricien dans le pied de page et le menu, blog (descriptions, doublons, carte mot-clé → page) | `components/layout/Footer.tsx` |
| 2026-10-16 | **Analyse des mots-clés compacts** (requêtes de bas de funnel, avant toute modification des articles du blog) : les 200 mots-clés du concurrent (130 calculateurs, 44 articles d'information, 24 sur sa page d'accueil) n'en contenaient presque aucun ; la structure de son site (une page « logiciel » et un « exemple de devis » par métier) et la Search Console montrent deux familles : « exemple de devis [métier] » (50 à 390 recherches par mois, difficulté 0, résultats faibles) et « logiciel devis [métier] » (petits volumes, coût par clic de 8 à 36 €, déjà associé à `/facturation/macon` par Google). 28 requêtes notées (intention, business, gagnabilité lue sur 20 pages de résultats Google, demande mesurée sur 206 mots-clés), requêtes écartées par la porte d'honnêteté (factures « gratuites », signature, plateforme agréée et formule Artisan pas encore en vente, application des stores, concurrents nommés), top 10, fiches des pages maçon, paysagiste et des titres des pages métier, conséquences pour les articles du blog (fusion des articles par métier dans les futures pages d'exemple). Aucun code modifié ; 123 crédits OpenSEO utilisés | `MOTS-CLES-COMPACTS-2026-10.md` |
| 2026-10-16 | **Mots exacts des chercheurs** (suite de l'analyse des mots-clés compacts, avant toute modification des articles) : l'audit Reddit et Facebook d'une ancienne session est introuvable (sessions, artefacts, dépôt) et Reddit refuse l'accès aux outils d'Anthropic ; à la place, 2 146 suggestions de la saisie semi-automatique de Google (403 requêtes de départ) et 109 formulations exactes mesurées. Constats : l'ouvrage avant le métier (« devis de maçonnerie »), le chantier précis (« exemple devis remplacement tableau électrique » : 390/mois, exactement l'exemple déjà en ligne), le fichier (« pdf », « devis vierge à imprimer » 260/mois), « auto-entrepreneur » (« exemple devis auto entrepreneur » 480/mois), « logiciel devis » + ouvrage + « gratuit », « relance facture impayée mail », « attestation TVA 10 % » encore cherchée alors qu'elle n'existe plus. Avis publics d'artisans et baromètre ARTISANTE de la CAPEB (2023) pour le vocabulaire des textes. Carte, ordre de travail et fiches mis à jour (titres des pages métier « Logiciel de devis gratuit pour {métier} », pages `/modele/devis-vierge`, `/modele/devis-auto-entrepreneur`). Aucun code modifié ; 27 crédits OpenSEO (17 restants) | `MOTS-CLES-COMPACTS-2026-10.md` |
| 2026-10-16 | **Plan mots-clés noté avant tout changement** (validé avec le fondateur) : § 0 de `MOTS-CLES-COMPACTS-2026-10.md` (règles d'écriture, 19 mots-clés exacts avec leur volume, page et état, ordre de travail à cocher : 4 corrections de pages existantes, 7 pages d'exemple à créer, indexation, mesure, puis le blog), section « Plan mots-clés — octobre 2026 » du README, règle des accents dans les règles metadata de `CLAUDE.md` (orthographe correcte dans les textes, adresses sans accents, Google rapproche les deux formes). Skill expert-seo mis à jour hors du dépôt (accents, mots exacts des chercheurs par la saisie semi-automatique, coûts OpenSEO, script de collecte) et remis au fondateur en fichier `.skill`. Aucun code applicatif modifié | `MOTS-CLES-COMPACTS-2026-10.md`, `README.md`, `CLAUDE.md` |
| 2026-10-16 | **Premier lot du plan mots-clés et correctifs du layout** (validé par le fondateur ; `MOTS-CLES-COMPACTS-2026-10.md` § 0). **Layout racine** : les deux liens hreflang fixes, qui disaient sur chaque page que sa version française était l'accueil, retirés ; le canonical « / » n'est plus déclaré dans le layout, où il était hérité par toute page sans canonical (les sous-pages de la démo se présentaient à Google comme l'accueil, avec son titre) : il vit dans `app/page.tsx` ; sous-pages de `/demo` en `noindex, follow` (aucune affichée dans la Search Console en 16 mois), `/demo` reste indexée. **11 pages métier** : title « Logiciel de devis gratuit pour {métier} », H1 « Logiciel de devis et facture pour {métier} », introduction propre qui nomme l'ouvrage (« Faites vos devis de maçonnerie gratuitement et sans limite, puis vos factures avec Essentiel. ») au lieu de la copie de la description, descriptions réécrites ; réponses TVA fausses corrigées : chauffagiste (chaudière gaz ou fioul à 20 % depuis le 01/03/2025, et non 5,5 %), paysagiste (espaces verts exclus des taux réduits, BOI-TVA-LIQ-30-20-90-30 ; allée, clôtures et terrasse à 10 %, annexe BOI-ANNX-000208 ; petits travaux de jardinage en services à la personne à 20 %, servicesalapersonne.gouv.fr ; crédit d'impôt sous conditions, plafond de 5 000 €). **`/modele/devis-electricien`** : title « Exemple de devis électricité : remplacement de tableau », H1 « Exemple de devis d'électricien : remplacement du tableau électrique », second exemple chiffré (rénovation électrique d'une maison de 100 m², calculé par le code des générateurs), version auto-entrepreneur. **`/modele/lettre-relance-impaye`** (la page n'avait aucun texte) : title « Modèle de relance de facture impayée : mail et lettre », 3 mails et la lettre de mise en demeure à copier (bouton Copier), taux des pénalités tirés de `lib/outils/penalites.ts`, client professionnel (pénalités, 40 €) distingué du particulier (intérêt au taux légal, C. civ. art. 1231-6). **`/guide/tva-travaux`** : section et question « Attestation TVA 10 % (attestation simplifiée) : remplacée par une mention en 2025 », vérifiées sur le BOFiP du 09/09/2026 : obligation supprimée par la loi de finances pour 2025 (sauf travaux en cours au 16/02/2025), formulaires 1301-SD et 1300-SD encore admis, modèles officiels de mention sur devis et sur facture (BOI-LETTRE-000280) repris dans `lib/legal/certification-tva.ts`. L'ancienne mention « travaux non exclus du taux réduit », qui faisait certifier au client des exclusions, et la date du 1er mars 2025 pour la certification, remplacées partout : guides, installation, modèles, devis téléchargeable Word, Excel et PDF. **Accueil** : H1 « La facturation des artisans du bâtiment, … » (le title et la description disaient déjà « artisans ») ; **/blog** : title « Blog : devis, factures et TVA pour artisans du bâtiment », description sans « TPE ». Plan du site : dates des pages modifiées. Build 238/238 ; 105 adresses du plan du site local explorées (200, canonical sur elles-mêmes, aucun hreflang, un H1, title ≤ 70, description 120-160) ; sous-pages de la démo en noindex vérifiées ; captures ordinateur et téléphone sans débordement ; lint ; 11 tests ajoutés | `app/layout.tsx`, `app/page.tsx`, `app/demo/{layout,page}.tsx`, `lib/pseo/{metiers,modeles,guides,installation}.ts`, `lib/legal/certification-tva.ts`, `lib/modeles/devis.ts`, `app/facturation/[slug]/page.tsx`, `app/modele/[slug]/page.tsx`, `components/content/{ExempleDevis,TextesModele}.tsx`, `components/landing/LandingHero.tsx`, `app/blog/page.tsx`, `app/api/og/route.tsx`, `app/sitemap.ts`, `MOTS-CLES-COMPACTS-2026-10.md`, `__tests__/{seo-plan-2026-10-16,sitemap,seo-meta,modele-devis}.test.ts` |
| 2026-10-16 | **Calendrier, éditeur d'articles « façon Word », référencement et images Gemini** (demande du fondateur, validée point par point). **Calendrier** : un article ouvre sa fenêtre (couverture, statut, date de Paris, adresse à copier ; performances Search Console sur 28 jours ou depuis la publication, courbe jour par jour ; mot-clé principal avec volume, difficulté et position ; requêtes réelles qui affichent l'article ; score et points à revoir ; Modifier, Voir sur le site, Publier maintenant, Repasser en brouillon, Replanifier), aussi depuis la liste des articles ; « + » sur aujourd'hui et les jours à venir (Écrire un article programmé ce jour, Planifier un sujet, Générer avec l'IA, avertissement si le jour est déjà pris, « Ajouter un article cette semaine » dans l'agenda du téléphone). **Éditeur** (`/admin/blog/new`, `/admin/blog/<id>`) : feuille unique (couverture, titre, chapeau, texte) et colonne Publication, Score SEO, Mot-clé principal, Résultat Google, Adresse, Mots-clés secondaires, Plan de l'article ; onglets sur téléphone ; éditeur visuel Tiptap (titres, gras, italique, listes, citation, liens internes cherchés parmi les pages du site, tableaux, images, séparateur, raccourcis, collage nettoyé depuis Word ou Google Docs, mode Markdown, surlignage des mots-clés, assistant sur une sélection : reformuler, raccourcir, développer, simplifier, corriger, intégrer le mot-clé, sans chiffre ni lien ajouté) ; le Markdown reste le format enregistré et ouvrir un article ne le réécrit jamais (nouvelle règle dans `CLAUDE.md`) ; brouillon local, alerte de sortie, Ctrl+S, programmation à la date et à l'heure de Paris (`?programmer=` depuis le calendrier). **Référencement** : mot-clé choisi dans l'onglet Mots-clés ou le plan du 16/10, avec alertes de concurrence entre pages ; 3 propositions Gemini contrôlées (longueur, affirmations interdites, concurrents) pour le titre Google, la description, l'adresse et l'extrait ; aperçu Google ordinateur et téléphone ; compteurs ; liste de contrôle en direct (`lib/seo/articles/onpage.ts`, accents compris) ; mots-clés secondaires présents ou absents du texte. **Images** : couverture affichée en vrai, studio Gemini (description modifiable, styles, formats, historique) et import contrôlé (signature du fichier, 5 Mo, métadonnées et position GPS retirées par sharp, 1 600 px), texte alternatif branché sur le blog public, images et tableaux du texte rendus par le moteur du blog (images du stockage du blog seulement), mention « Illustration générée par IA ». **Plan mots-clés** : les 21 mots-clés du 16/10 ajoutables à l'onglet Mots-clés (« Ajouter au suivi »). **Corrigé au passage** : aucune ombre sur les fenêtres, menus et popovers de tout le site (`shadow-[var(…)]` ne produit qu'une couleur en Tailwind 3 ; 34 fichiers, nouvelle règle dans `CLAUDE.md`) ; article lié à un sujet « Brouillon » et programmé, qui restait « À relire » ; contrôle de publication étendu au titre Google, au texte alternatif et aux articles écrits à la main ; page publique rafraîchie après chaque modification ; libellé « Repris de PushRank » devenu « Importé » ; texte complet des articles plus envoyé au navigateur sur `/blog` ; sharp déclaré en dépendance. Revue adverse en quatre angles (25 constats, 19 confirmés par deux contradicteurs et corrigés), parcours vérifiés au navigateur sur un faux Supabase. Aucune migration. Tiptap 3.31.4 ajouté (admin seulement). 1 868 tests | `components/admin/BlogEditor.tsx`, `components/admin/blog/`, `lib/blog-editor/`, `lib/blog-images/`, `lib/seo/articles/{onpage,details,suggest,secondary,editor-input,editor-types,publish-time,publish,data}.ts`, `lib/seo/search-console/page.ts`, `lib/seo/keywords/plan.ts`, `app/api/admin/blog/**`, `app/api/admin/seo/{articles/posts/[id],keywords/plan}/`, `components/admin/seo/articles/{ArticleDetailsDialog,CalendarView,ArticleList,TopicDialogs,GenerateDialog,pills}.tsx`, `components/admin/seo/keywords/PlanImportCard.tsx`, `lib/markdown.ts`, `app/blog/**`, `components/blog/`, `app/globals.css`, `components/ui/{dialog,dropdown-menu,sheet}.tsx`, `CLAUDE.md`, `__tests__/{blog-editor-*,blog-images*,markdown-media,seo-onpage,seo-article-details*,seo-editor-*,seo-suggest,seo-secondary}.test.ts` |
| 2026-10-17 | **Génération d'articles : Gemini indisponible (503)**. Constat : le 503 vient de Google (modèle surchargé : un identifiant inconnu donnerait une 404), mais trois essais en une dizaine de secondes échouaient tous pendant une surcharge qui dure une minute, la rédaction passait « Échec » et le message promettait encore « Nouvel essai au prochain passage ». **Appel Gemini** (`geminiCall`, `lib/seo/articles/models.ts`) : 429, 500, 502, 503 et 504 sont rejoués deux fois après 2 s puis 6 s (« Retry-After » respecté, borné à 10 s), tant qu'il reste 15 s au moins dans le budget de la passe ; un délai dépassé n'est jamais rejoué ; vaut aussi pour la couverture par `generateContent`, la suggestion de titres et l'assistant de l'éditeur. **Modèle de repli** (`fallback` de `TEXT_MODELS`) : si le fournisseur reste indisponible, la même consigne part à Claude Sonnet 5.5 (Gemini 3.8 Flash, Claude Opus 5.5) ou à Gemini 3.8 Flash (Claude Sonnet 5.5, Haiku 5.5), seulement si sa clé est présente et seulement pour une panne du fournisseur (jamais pour un refus, une réponse vide ou coupée, un délai dépassé) ; l'écran le dit (« Plan par Claude Sonnet 5.5 au lieu de Gemini 3.8 Flash : Gemini indisponible (503). »), le modèle réellement utilisé est gardé pour l'état et les coûts, et si le repli échoue aussi c'est l'erreur d'origine qui est rendue. **Message** : après trois essais, il ne promet plus de nouvel essai (« Plusieurs essais ont échoué : « Réessayer » relance la rédaction… »). À savoir : « au prochain passage » suppose la tâche `GET /api/cron/seo` créée sur cron-job.org (toutes les 15 minutes), sinon seule la boucle de l'écran réessaie. Aucune migration. 13 tests | `lib/seo/articles/{models,model-registry,generate}.ts`, `__tests__/seo-articles-{models,generate}.test.ts` |
| 2026-10-17 | **Claude en principal pour la rédaction, Gemini en secours seulement** (demande du fondateur). Réglages par défaut : plan et contrôle par Claude Sonnet 5.5 (avant : Gemini 3.8 Flash), rédaction par Claude Opus 5.5 ; un réglage déjà enregistré dans Articles › Préférences garde son choix. Chaîne de repli du registre (`textFallbackChain`) : Opus → Sonnet → Gemini 3.8 Flash, Sonnet → Gemini, Haiku → Gemini, Gemini → Sonnet ; `generateText` l'essaie dans l'ordre, pour une panne du fournisseur seulement, avec le temps qui reste. **Clé `ANTHROPIC_API_KEY` pas encore ajoutée** : au lieu d'échouer, chaque passe tourne sur Gemini 3.8 Flash et l'écran le dit (« Rédaction par Gemini 3.8 Flash au lieu de Claude Opus 5.5 : Clé ANTHROPIC_API_KEY absente. ») ; elle repasse sur Claude dès que la clé est dans Vercel et le site redéployé. Le contrôle factuel est désormais fait par la même famille que la rédaction : choisir Gemini 3.8 Flash dans Préférences › Contrôle rend un second regard indépendant. Aucune migration. 6 tests | `lib/seo/articles/{model-registry,models,generate,data}.ts`, `lib/seo/settings-schema.ts`, `__tests__/seo-articles-{models,generate,routes}.test.ts` |
| 2026-10-17 | **Erreur 429 de Google : la vraie raison, et plus de nouvel essai inutile** (le message « Gemini indisponible (429) » vu à la génération d'une couverture). Constat : un 429 est `RESOURCE_EXHAUSTED` (quota ou limite de débit de la clé, pas une panne) ; le message affiché venait du modèle de repli (Nano Banana 2) après l'échec de Nano Banana 2.1, et le code jetait la raison donnée par Google. **Lecture de l'erreur** (`readGoogleLimit`, `googleLimitError`, `lib/seo/articles/models.ts`) : quota à zéro pour la clé (« limit: 0 », palier gratuit), quota journalier, ou limite par minute avec la pause conseillée (`RetryInfo.retryDelay`). **Plus de nouvel essai inutile** : un quota à zéro, journalier ou à remettre dans plus de 10 s n'est plus rejoué (les 2 s et 6 s d'attente ne pouvaient pas aboutir) ; une limite par minute attend la pause demandée par Google. Nouveau type d'erreur `quota` (non réessayable, mais un quota épuisé chez un fournisseur laisse le repli sur l'autre : Gemini → Claude pour le texte). **Image** : quand Nano Banana 2.1 et son repli échouent tous les deux, l'erreur donne la raison de chacun au lieu de celle du seul repli ; la fenêtre de l'éditeur affiche le message sans « Réessayez » (code `quota`), ainsi que l'assistant de réécriture et les propositions de titre. Aucune migration. 10 tests | `lib/seo/articles/models.ts`, `app/api/admin/blog/{images/generate,assist,suggest}/route.ts`, `__tests__/{seo-articles-models,blog-images}.test.ts` |
| 2026-10-17 | **Titres et mots-clés qui parlent comme le client final** (lot 1 de la demande du fondateur, d'après les captures de l'éditeur). Constat : l'article « Comment facturer un chantier » portait le mot-clé « logiciel devis facturation » (une recherche d'achat de logiciel) : 4 points « à corriger » au score, et les propositions de titre le plaçaient en préfixe (« Logiciel devis facturation : … ») parce que la consigne imposait « le mot-clé au début » quel que soit le type d'article. **Langage de la recherche** (`lib/seo/articles/search-language.ts`) : forme d'un mot-clé (question, achat, modèle), type d'article déduit quand il n'est pas enregistré (« comment » = how-to, autre question = FAQ, règle datée = actualité), consignes de titre par type (how-to : « Comment » en premier puis le verbe et l'objet ; FAQ : la question telle qu'on la pose ; actualité ; guide), jamais un mot-clé générique en préfixe. Les propositions de titre (éditeur) et le plan de rédaction des articles générés reçoivent ces règles ; le type d'article part avec la demande (enregistré, sinon déduit). Un titre qui commence par le mot-clé d'achat suivi de deux-points est refusé pour un how-to, une FAQ ou une actualité ; les titres qui parlent comme la recherche passent en premier. **Liste de contrôle** : nouvelle ligne « Mot-clé adapté à l'article » (recherche d'achat de logiciel sur un « comment faire », une FAQ ou une actualité), aussi dans la fenêtre de l'article du calendrier. **« Gratuit »** (décision du fondateur : permis pour les factures quand c'est vrai) : règle commune aux consignes de titres, de descriptions et de rédaction : devis, générateur de devis et de facture en ligne et modèles sont gratuits ; l'envoi des factures, les relances et le FEC restent dans Essentiel ; un titre « facturer gratuitement avec Qonforme » est refusé. Aucune migration. 14 tests | `lib/seo/articles/{search-language,suggest,prompt,onpage,details,editor-types}.ts`, `app/api/admin/blog/suggest/route.ts`, `components/admin/BlogEditor.tsx`, `components/admin/blog/shell/model.ts`, `__tests__/seo-search-language.test.ts` |
| 2026-10-17 | **Couvertures Qonforme dessinées par le code, images en WebP, métadonnées propres, photos Gemini plus réalistes** (lot 2 de la demande du fondateur ; piste « A · Clair sobre » choisie sur le canevas https://claude.ai/artifact/1mZMKJLgGUPmeqpaqPGxt3, photos Gemini gardées pour l'intérieur des articles). **Couverture** (`lib/blog-images/cover/`) : fond blanc, logo en haut, titre au centre en deux voix (Bricolage Grotesque en gras, fin du titre en Instrument Serif italique bleu, coupée au « : », à la virgule ou aux derniers mots), huit icônes Lucide au trait fin dont deux en bleu, choisies d'après le sujet (un des 11 métiers, ou papiers : devis, facture, TVA, relance, paiement, signature, mentions, règles ; sinon le chantier), même titre = même image ; ni dégradé ni halo. Titre coupé avec les largeurs réelles des polices (`scripts/generate-cover-assets.mjs` embarque polices SIL OFL, logo et largeurs en base64), taille la plus grande qui tient (100 à 52 px, 4 lignes, 5 en petits caractères), titre démesuré raccourci aux mots entiers ; rendu par le moteur d'images de Next (`next/og`, Node) puis WebP. Lancée par le bouton **« Créer la couverture »** (et « Recréer ») du champ de couverture de l'éditeur (`POST /api/admin/blog/images/cover`, 422 si le titre ou le mot-clé nomme un concurrent) et à la rédaction des articles générés (plus aucun appel à Gemini, plus de coût ni de clé pour la couverture ; échec = article sans couverture, comme avant). Texte alternatif = le titre (il n'était plus le même pour tous : « Artisan du bâtiment au travail sur un chantier »), nom du fichier = le mot-clé, image de partage de l'article quand c'est une couverture Qonforme (zone de titre centrale, pas rognée à 1,91 pour 1). **WebP partout** : toute image du blog (importée, générée, couverture) sort en WebP (qualité 82, 90 pour une couverture), 1 600 px au plus ; les couvertures des articles générés étaient jusqu'ici enregistrées telles que le modèle les renvoyait, sans sharp. **Métadonnées** (`lib/blog-images/metadata.ts`) : tout est retiré puis seul ce que Qonforme produit est écrit (XMP : titre, description, mots-clés, auteur, droits, crédit, origine IPTC ; EXIF en ASCII) ; photo Gemini = `trainedAlgorithmicMedia`, couverture dessinée = `digitalArt` ; jamais de faux appareil photo ni de lieu ; image importée : aucune mention d'auteur. Google lit auteur, crédit et copyright ; aucun usage des mots-clés intégrés n'est documenté : les leviers sont le nom du fichier, le texte alternatif et le texte autour. **Photos Gemini** : consigne de photographe (reportage, optique et lumière disponible, prise sur le vif, outils usés, grain léger), mains et outils plausibles, rien de « stock photo » ni de rendu 3D, scènes de métier plus précises, deux puces de style (« Sur le vif », « Lumière d'une fenêtre ») ; le mot-clé part avec la demande (nom du fichier, métadonnées) ; non essayée depuis cette session (pas de clé Gemini) : à juger sur pièces. Préférences : « Images » (couverture sans coût, modèle d'image pour les photos). Vérifié sur le build : couverture créée en 1,8 s par la vraie route. Aucune migration. 20 + 14 tests | `lib/blog-images/{cover/,metadata,trades,server,policy,prompt}.ts`, `scripts/generate-cover-assets.mjs`, `app/api/admin/blog/images/{cover,generate}/route.ts`, `components/admin/blog/CoverField.tsx`, `components/admin/seo/articles/PreferencesForm.tsx`, `lib/seo/articles/{generate,prompt}.ts`, `app/blog/[slug]/page.tsx`, `CLAUDE.md`, `__tests__/{blog-cover,blog-images,blog-images-ui,seo-articles-generate,seo-articles-screens,seo-articles-prompt}.test.ts` |
| 2026-10-17 | **Proposition IA : des mots-clés exacts et des sujets vérifiés** (lot 3 de la demande du fondateur). Bouton « Proposition IA » dans la fenêtre « Générer un article », sur l'écran Sujets et, dans l'éditeur, sous « Mot-clé principal » (« Proposer un mot-clé exact »). Le modèle du plan (Claude Sonnet 5.5 par défaut, repli Gemini) pense comme l'artisan qui tape sa recherche, avec la méthode des mots-clés compacts (`MOTS-CLES-COMPACTS-2026-10.md` § 0 et § 9) : cinq situations (je me lance, je gagne du temps, je me fais payer, je veux être en règle, je chiffre un chantier), un métier au choix, un angle libre ; il propose le double des idées demandées (10 par défaut, 15 au plus), chacune avec la requête exacte, le titre de l'article, le type, le moment (comprendre, faire, choisir) et ce que la personne veut. **Rien n'est montré sans contrôle** : concurrents et marque refusés, valeurs périmées et affirmations interdites refusées (« PDP » seulement signalé), accents rétablis, doublons retirés, titre qui passe le contrôle des titres (sinon la requête sert de titre), « gratuit » à côté de facturation signalé ; la phrase est cherchée dans la **saisie semi-automatique de Google** (point d'accès non officiel : « Vu dans Google » et prolongations réelles ; une panne donne « Non vérifié », jamais une erreur) et mesurée par **DataForSEO** si ses identifiants sont là (volume, difficulté, CPC en dollars US, intention) ; rapprochement avec les articles, sujets, mots-clés suivis et requêtes de Search Console (page déjà bien placée : mieux vaut l'améliorer que doubler l'article) ; score de 0 à 100 (existence 35, volume 30, facilité 15, moment 12, moins les doublons et les avertissements). Aucun concurrent n'entre dans la consigne (l'existant qui en nomme un est filtré avant). **Adoption** (`POST /api/admin/seo/ideas/adopt`) : mot-clé suivi (source « suggestion », mesures, note datée) et, au choix, sujet « à planifier » (un sujet ouvert est rendu au lieu d'un doublon ; mot-clé ignoré : 409) ; « Suivre seulement » ; dans l'éditeur, « Utiliser pour cet article » pose le mot-clé principal et le cible ; dans « Générer un article », le sujet créé est aussitôt choisi. Fenêtre : formulaire replié en une ligne après la recherche, chargement, erreur avec « Réessayer », réponse tardive d'une recherche abandonnée ignorée ; ordinateur, téléphone, clair et sombre contrôlés au navigateur. Aucune migration. 73 tests | `lib/seo/ideas/{types,prompt,rank,autocomplete,run,adopt}.ts`, `app/api/admin/seo/ideas/{route,adopt/route}.ts`, `components/admin/seo/ideas/IdeasDialog.tsx`, `components/admin/seo/articles/{GenerateDialog,TopicsView}.tsx`, `components/admin/blog/seo/KeywordPicker.tsx`, `components/admin/blog/shell/SideCards.tsx`, `components/admin/BlogEditor.tsx`, `lib/blog-images/trades.ts`, `__tests__/{seo-ideas-pure,seo-ideas-run,seo-ideas-ui}.test.ts` |
| 2026-10-17 | **Maillage interne automatique, photos dans les articles générés, image manuelle qui lit le passage** (lots 4 à 6 de la demande du fondateur). **Liens internes** (`lib/seo/links/`) : moteur pur, sans modèle ni coût, qui pose les liens sur des expressions du texte (recherche sans accents ni casse, position retrouvée dans le texte d'origine) vers les guides, modèles, outils, pages métier, glossaire et autres articles publiés (catalogue `lib/seo/links/catalog.ts`, expressions choisies à la main puis tirées des mots-clés des pages), une seule fois par page, au plus deux par paragraphe et à 100 caractères d'écart, jamais dans un titre, un lien, une image ou du code, jamais vers l'article lui-même ni vers une page qui lui fait concurrence sur son mot-clé ; objectif selon la longueur (`linkGoal` : 2 à 4 pour 900 mots, jusqu'à 8 au-delà), bloc « Pour aller plus loin » en dernier recours. **À la rédaction** : le rédacteur reçoit la liste des pages qu'il peut lier (adresses vraies seulement), une passe « Maillage » retire les adresses inventées puis complète jusqu'à l'objectif ; préférence « Maillage interne automatique ». **Dans l'éditeur** : carte « Maillage interne » (nombre, objectif, « Ajouter les liens internes », liste des liens ajoutés, « Annuler », Ctrl+Z, bloc « Pour aller plus loin »), route `POST /api/admin/blog/auto-links`, texte changé pendant la recherche : rien n'est posé, score SEO aligné sur l'objectif. **Page publique** : les articles plus anciens sont complétés à l'affichage par le même moteur (liens internes dans le même onglet). **Photos du texte** (`lib/seo/articles/images.ts`) d'après les recommandations (Google Search Central, Yoast, Ahrefs, Backlinko, HubSpot) : une photo par tranche de 400 mots (aucune sous 600 mots), au plus 4 par défaut (préférence « Photos dans le texte », 0 à 6), uniquement dans les sections de développement (ni introduction, ni FAQ, ni conclusion, ni section déjà illustrée), réparties sur l'article (première section libre quand il y a de la place), juste après le premier paragraphe de la section, jamais entre le titre et son texte ; une passe « Photos » par image (lecture du paragraphe par le modèle du plan, création par le modèle d'image, WebP, métadonnées de Qonforme, rangée sous `editor/ia/` : « Illustration générée par IA » sur la page), une photo qui échoue est notée et passée, clé absente ou quota épuisé : photos abandonnées d'un coup, l'article sort quand même. **Studio d'images de l'éditeur** : bouton « Illustrer » dans le menu du texte sélectionné et bouton Image de la barre d'outils : le passage (sélection, ou paragraphe du curseur) part à `POST /api/admin/blog/images/describe` ; sujet repéré, scène « Ce que montre l'image », puces de style cochées et texte alternatif sont prêts avant de cliquer sur « Générer » (carte « Sujet repéré », « Relire le passage », écrire dans le champ arrête la lecture et garde le texte, sans modèle la scène vient des mots du passage et la carte le dit) ; la photo s'insère après le bloc du passage (après le premier paragraphe pour un titre) au lieu de remplacer le texte sélectionné. Lecture du passage partagée (`lib/blog-images/describe.ts`), concurrents jamais dans la consigne. Aucune migration. **Non essayé avec de vraies clés** : la création d'images (Google) et la lecture par Claude sont testées avec des modèles simulés, pas depuis cette session ; ordinateur, téléphone, clair et sombre contrôlés au navigateur sur un faux Supabase avec des réponses du modèle simulées. 140 tests ajoutés | `lib/seo/links/`, `lib/seo/articles/{generate,images,prompt,onpage,editor-types,data}.ts`, `lib/blog-images/{passage,describe}.ts`, `lib/seo/settings-schema.ts`, `lib/markdown.ts`, `lib/blog-autolink.ts`, `app/blog/[slug]/page.tsx`, `app/api/admin/blog/{auto-links,link-targets,images/describe}/`, `components/admin/BlogEditor.tsx`, `components/admin/blog/{seo/useAutoLinks.ts,shell/SideCards.tsx,editor/{RichEditor,SelectionMenu,extensions,passage}.ts(x),images/{ImageStudioDialog,useImageStudio}.tsx}`, `components/admin/seo/articles/{JobProgress,PreferencesForm,GenerateDialog,TopicDialogs,TopicsView,CalendarView,job-runner}.ts(x)`, `__tests__/{seo-links,seo-links-ui,seo-article-images,blog-images-passage,seo-articles-generate,blog-images-ui,blog-editor-ui}.test.ts` |
| 2026-10-17 | **Icônes des couvertures reprises sur l'accueil, icônes des outils gratuits sans fond** (demande du fondateur). **Accueil** : nouveau décor `Doodles` (`components/landing/Doodles.tsx`) : les pictogrammes Lucide au trait fin des couvertures d'articles (trait de 2,4 px quelle que soit la taille, `absoluteStrokeWidth`, un ou deux en bleu plein, les autres en bleu pâle, légèrement inclinés) autour des titres du héros (6 icônes) et de 11 sections : réforme, profils, devis, manifeste, métiers, étapes, « Tout ce qu'il faut », tarifs, engagements, FAQ, ressources ; cinq cadres selon le titre (à gauche, à gauche sur une seule ligne, centré, texte centré, héros), icônes de chaque section dans `DOODLES` (`app/page.tsx`). Purement décoratif : `aria-hidden`, aucun clic, statique, ni `backdrop-filter` ni `will-change` (règle iOS), jeton `--q-accent` (thème sombre compris) ; affiché à partir de 1 100 px (héros 1 280 px, titres centrés 1 180 px) pour ne jamais toucher le texte ; rien sur téléphone et tablette. **Outils gratuits** : le fond (tuile `bg-q-wash`) des icônes supprimé, l'icône seule en bleu au trait fin : méga-menu de l'en-tête (ordinateur et mobile), cartes du hub `/outils`, pastille de l'en-tête des outils. Vérifié au navigateur (1 024 à 1 920 px, clair et sombre, aucun débordement horizontal), tsc, lint, 2 100 tests. Aucune migration | `components/landing/Doodles.tsx`, `app/page.tsx`, `components/landing/LandingHero.tsx`, `components/layout/PublicNav.tsx`, `components/outils/{kit,OutilsHero}.tsx` |
| 2026-10-17 | **Barre de lecture dans l'en-tête, iPhone sans capture rognée, icônes sans fond partout, pictogrammes de marque dans toutes les interfaces** (demande du fondateur). **Barre de lecture** : retirée du haut de la page, elle remplit le bord bas de la pilule de l'en-tête public (`PublicNav`), découpée par ses arrondis, sur toutes les pages publiques, ordinateur et téléphone ; pilotée en JavaScript (une mise à jour par image, transformation seule) car iOS ne connaît `animation-timeline` que depuis Safari 26. **Maquettes d'iPhone** : la capture était décalée sous l'îlot et rognée de 43 points en bas (barre d'onglets coupée par les coins). Écran d'iPhone 15 (393 × 852), captures mobiles refaites avec les zones sûres simulées (59 et 34 points : la page se place sous l'îlot et au-dessus de l'indicateur d'accueil), barre d'état, îlot et indicateur d'accueil dessinés en SVG dans ces zones (`PhoneChrome`, aussi sur le héros mobile) ; captures ordinateur refaites pour que le Mac et l'iPhone montrent les mêmes chiffres ; habillage de démo masqué ; script `scripts/capture-landing-screens.mjs` ; nouvelles adresses (`public/landing/ecrans/v2/`), l'optimisation d'images de Vercel gardant une image tant que son adresse ne change pas. « Marquer accepté » ne passe plus sur deux lignes dans la barre d'actions mobile du devis (colonnes 3/2). **Icônes sans fond** dans tout le site, l'application, la démo et l'admin (près de 90 emplacements : notifications de l'accueil, « Inclus », « Engagements », bouton « Voir la démo », cartes et puces des pages de contenu, pied de page, « À faire » du tableau de bord, cloche, palette ⌘K, menu « Nouveau », feuille « Plus », frises de suivi en icônes au trait, listes, paramètres, admin, pages d'accès) : classe `.q-glyph` ; boutons, avatars, numéros, pastilles de texte et contrôles inchangés. **Pictogrammes de marque** (`components/brand/`) : `Doodles` étendu aux en-têtes des pages de contenu (icônes choisies d'après le sujet par `pictosFor`, même règle que les couvertures), des outils (icône de l'outil et outils du bâtiment), des tarifs, de la 404 et des pages d'accès ; `PictoCluster` (icône du sujet entre un casque et un mètre) dans tous les états vides (`EmptyState`, 128 emplacements), le mur de paiement, les écrans de confirmation (mot de passe, paiement, invitation comptable), les pages légales, le blog vide et l'import de factures. Pas de décor sur les pages de règlement et de signature (clients de l'artisan). Nouvelle règle dans `CLAUDE.md`. Vérifié au navigateur (390 à 1 920 px, clair et sombre), tsc, lint, 2 100 tests, build. Aucune migration | `components/layout/PublicNav.tsx`, `components/landing/{devices,LandingHero,ui}.tsx`, `components/brand/{Doodles,PictoCluster,pictos}.ts(x)`, `scripts/capture-landing-screens.mjs`, `public/landing/ecrans/v2/`, `app/globals.css`, `app/page.tsx`, `components/app/kit.tsx`, `components/content/ui.tsx`, `components/outils/OutilsHero.tsx`, `components/auth/AuthLayout.tsx`, `components/legal/LegalLayout.tsx`, `app/{pricing/page,not-found,blog/page}.tsx`, `components/billing/PaywallDialog.tsx`, `components/dashboard/TodoCard.tsx`, `components/layout/{NotificationsButton,CommandPalette,Sidebar,Header,SupportModals}.tsx`, `components/quotes/QuoteDetailView.tsx`, une cinquantaine de vues (icônes sans fond) |
| 2026-10-17 | **Plus d'éléments flottants, connexion en photo, carrousels animés, apparitions au défilement dans les deux sens, appels à l'action** (demande du fondateur). **Éléments flottants supprimés partout** : notifications du héros, des bandes photo, de « Payé à l'heure » et de l'appel final, puces autour de l'ordinateur du devis, carte « Mentions obligatoires » de l'appel final des pages de contenu, cartes d'exemple sur la photo de l'inscription ; `Floater`, `Chip` et l'ondulation `lp-bob` retirés. **Connexion** (et mot de passe oublié ou nouveau) : les cartes « À votre retour » remplacées par le panneau photo de l'inscription (`AuthPhotoPanel`, menuisier à l'établi, « Vos devis vous attendent, là où vous les avez laissés. », trois engagements vrais), bande photo et « Créer un compte » en haut sur téléphone. **Carrousels** (`components/landing/carousels.tsx`) : les trois téléphones fixes de « Le chantier dans une main » deviennent un carrousel (téléphone actif au centre, voisins en retrait, onglets Accueil, Devis, Facture, Factures avec barre de progression) ; l'ordinateur du devis montre le devis, la facture puis le suivi (iPhone sur téléphone, flèches) ; défilement automatique toutes les 5,5 s, pause hors de l'écran, au survol, au clavier et par un bouton Pause, glisser au doigt, rien d'automatique avec « Réduire les animations ». **Apparitions au défilement** (`components/motion/ScrollReveal.tsx`, attribut `data-reveal`) : à la descente comme à la remontée (l'élément vient du côté d'où il entre et se cache une fois sorti de l'écran), dans tous les navigateurs (les anciennes animations `view()` ne rejouaient pas en remontant et n'existaient pas sur Safari avant 26) ; titres, cartes, étapes, filets qui se tracent, maquette qui se redresse, manifeste dont les mots s'encrent à tour de rôle ; pages de contenu, outils et blog (titres de section, cartes, questions, appels à l'action ; jamais le texte courant) ; rien de caché sans JavaScript, à l'arrivée ou avec « Réduire les animations ». **Appels à l'action** : après les profils, le devis (« Voir un devis dans la démo »), le téléphone, « Payé à l'heure », les étapes, « Tout ce qu'il faut », la FAQ et la réforme (guide de la facture électronique) ; `InlineCta` dans les guides, modèles, pages métier, glossaire, installation et articles du blog. **Blog** : barre de lecture propre à l'article supprimée, seule celle de l'en-tête reste. Vérifié au navigateur (390 à 1 440 px, clair et sombre, défilement aller et retour, lecture, pause, onglets et glisser des carrousels), tsc, lint, 2 100 tests, build. Aucune migration | `components/landing/{carousels,ui,LandingHero,StorySection}.tsx`, `components/motion/ScrollReveal.tsx`, `components/auth/{AuthPhotoPanel.tsx,photos.ts}`, `components/auth/{AuthBenefits,SignupPhotoPanel}.tsx` (supprimés), `app/{login,signup,forgot-password,reset-password}/page.tsx`, `app/page.tsx`, `app/globals.css`, `components/content/ui.tsx`, `components/outils/kit.tsx`, `app/outils/page.tsx`, `components/blog/{ArticleView,ArticleCard,CategoryFilter}.tsx`, `components/blog/ReadingProgressBar.tsx` (supprimé), `components/layout/PublicNav.tsx`, `app/{guide,modele,facturation,glossaire,devenir-a-son-compte}/[slug]/page.tsx`, `CLAUDE.md` |
| 2026-10-17 | **« Trois étapes » refaites en scènes animées, branding discret sur les articles du blog** (demande du fondateur : les trois petites maquettes fixes n'étaient « pas qualitatives »). **Section « Trois étapes, et votre premier devis est parti »** (`components/landing/steps-showcase.tsx`, à la place de `mini-ui.tsx`, supprimé) : une fenêtre d'application qui joue les trois premiers gestes, sélecteur d'étapes à gauche (barre de progression, flèches du clavier) ; **1. Votre SIREN** : le numéro se tape chiffre à chiffre, le pointeur rejoint « Rechercher » et clique, l'entreprise revient (« Trouvée », adresse, n° de TVA) et les trois champs repris s'allument ; **2. Vos prestations** : les lignes du catalogue arrivent une à une (unité, prix, TVA par ligne), le pointeur clique « Ajouter une prestation », une quatrième ligne s'ouvre en hauteur et le compteur passe à 4 ; **3. Votre premier devis** : les lignes s'ajoutent, le total TTC se calcule (4 024,30 €), le pointeur clique « Envoyer par email », le brouillon devient « Envoyé » et la confirmation apparaît. Données d'exemple de la démo, annoncées « Données d'exemple » dans la barre de la fenêtre et passées par la page serveur (le composant client n'embarque pas la démo). Défilement automatique toutes les 7,6 s (barre de l'onglet), scène rejouée à chaque activation et à chaque retour à l'écran, pause hors de l'écran, au survol, au clavier et par le bouton Pause de la barre de la fenêtre ; « Réduire les animations », rendu serveur et absence de JavaScript : chaque scène est montrée terminée, sans lecture automatique ; opacité, `translate` et `scale` seulement, ni `backdrop-filter` ni `will-change`, rien d'infini. Hooks et barre de progression partagés avec les carrousels (`carousels.tsx` : `useCarousel`, `Progress`, `PlayPause` exportés, durée réglable). **Blog** : les articles portent maintenant le décor de marque, très discret (`Doodles layout="article"`, `opacity-60`, grand écran seulement, de chaque côté du titre, au-dessus du partage et du sommaire) avec les pictogrammes de la couverture (`pictosFor(titre, mot-clé)`). Vérifié au navigateur (390 et 1 440 px, clair et sombre, lecture, rejeu au retour, pause, réduction des animations, sans JavaScript), tsc, lint, 3 tests ajoutés (`__tests__/steps-showcase.test.ts`), build. Aucune migration | `components/landing/{steps-showcase,carousels}.tsx`, `components/landing/mini-ui.tsx` (supprimé), `app/page.tsx`, `components/brand/Doodles.tsx`, `components/blog/ArticleView.tsx`, `__tests__/steps-showcase.test.ts`, `CLAUDE.md` |
| 2026-10-17 | **Logo « Solution compatible – Facturation électronique » (DGFiP) sur l'accueil** (demande du fondateur, qui déclare le label obtenu ; question posée avant d'agir parce que le dépôt disait « pas encore solution compatible »). Logotype fourni par le fondateur, **copié tel quel** (`public/brand/solution-compatible-facturation-electronique.webp`, 329 × 153 px, fond blanc et zone de protection inclus) ; composant unique `components/brand/SolutionCompatible.tsx` qui applique la charte DGFiP (30/07/2025, lue en entier) : jamais déformé, ni ombre ni effet, cartouche d'au moins 12 px donc 192 px de large au minimum, mention « Solution compatible facturation électronique » dans le logotype et son texte alternatif, interrupteur `SOLUTION_COMPATIBLE` pour tout retirer d'un coup si l'État retire le label. **Sept emplacements** : héros (sous les trois engagements), carte « Où en est Qonforme » de la section réforme, tarifs, bandeau « Prêt pour la facturation électronique » sous les engagements (`SolutionCompatibleNote`), réponse « Qonforme est-il une plateforme agréée ? » de la FAQ (visible quand la question est ouverte), appel final, pied de page (donc toutes les pages publiques). **Textes mis d'accord** : réponse de la FAQ et 3ᵉ ligne de « Où en est Qonforme » (« en préparation » retiré), guide « Plateforme agréée » (« n'est pas encore solution compatible » retiré). **Décision consignée** : `DECISIONS-STRATEGIQUES.md` § 13 (règles de la charte, emplacements, preuve du raccordement à noter, liste des textes qui disent encore « en préparation », application, pages d'outils, guides et consignes des générateurs d'articles : à relire avec ce que couvre le raccordement) et levée de l'interdit « solution compatible » dans `PLAN-PLATEFORME-AGREEE-2026-10.md` (« conforme » et « certifié » restent interdits). Vérifié au navigateur (1 440 et 390 px, clair et sombre), tsc, lint, tests, build. Aucune migration | `public/brand/solution-compatible-facturation-electronique.webp`, `components/brand/SolutionCompatible.tsx`, `components/landing/LandingHero.tsx`, `app/page.tsx`, `components/layout/Footer.tsx`, `lib/pseo/guides.ts`, `DECISIONS-STRATEGIQUES.md`, `PLAN-PLATEFORME-AGREEE-2026-10.md`, `CLAUDE.md` |
| 2026-10-17 | **Variante B de l'accueil sur `/design`, pour un test A/B** (demande du fondateur : « une version Qonforme pareil » que la page d'accueil de son principal concurrent, avec les animations). **Analyse** interne (`ANALYSE-LANDING-CONCURRENT-2026-10.md`, le concurrent n'y est nommé qu'en interne) : page relevée le 17/10 (HTML, feuille de style, script, captures ; le site limite le débit), 17 sections inventoriées, appels à l'action, réassurance (presque toute invérifiable : chiffres d'utilisateurs, « certifié conforme », « eIDAS », pourcentages de gains), design et animations (un seul moment animé : la signature d'un devis au clic), SEO et technique, transposition section par section, hypothèses et indicateurs du test, répartition du trafic à faire plus tard (réécriture par le middleware avec un cookie). **Page** (`app/design/page.tsx`, `components/design/`) : même structure et même rythme, au langage de Qonforme, contenu vrai seulement. Héros en deux colonnes (photo en arche, rien posé dessus ; le label « Solution compatible » à la place de la note Google) ; bandeau facture électronique ; métiers à la place des logos de presse ; bandeau bleu ; quatre chiffres de l'offre lus dans `lib/stripe` et `lib/catalogue` (0 € pour les devis, 12 € HT, 30 jours, 11 métiers) à la place des chiffres d'utilisateurs, comptés à l'entrée (`CountUp`) ; cinq blocs de fonctions alternés avec de vraies captures d'ordinateur et de téléphone et des lignes en pointillés (devis, facturation, relances, tableau de bord, catalogue ; nouvelles captures de la démo `catalogue`, `relances`, `mobile-relances`, argument [noms] du script de captures) ; « Gagnez du temps » en faits (0 ressaisie, 3 étapes, 0 relance à écrire) ; « Du devis accepté à la facture envoyée » à la place de la signature électronique, qui n'est pas encore vendue : le vrai parcours joué à l'entrée (« Convertir en facture », facture en brouillon à relire, « Envoyer par email », facture envoyée, ✓ tracé et étincelles une seule fois, « Rejouer »), aucun numéro de facture inventé, rien qui dépende d'une migration non confirmée (numérotation « à la suite », pas « à l'envoi ») ; carrousel des métiers en défilement natif (flèches qui gardent le focus, pagination, carte calée au clavier) ; garanties ; engagements des CGU en mosaïque à la place des avis ; trois étapes animées à la place de la vidéo ; appel final marine ; FAQ sans JSON-LD. **Mesure du test** : les boutons de la page et de l'en-tête (nouvelle prop `links` de `PublicNav`) mènent à `/signup?ab=design` ; le formulaire transmet la variante, filtrée par liste blanche (`LANDING_VARIANTS`) et enregistrée dans `user_metadata.landing_variant` du compte, sans cookie ; un visiteur qui quitte `/design` avant de s'inscrire n'est pas compté. Bandeau facture électronique et FAQ alignés sur l'accueil : « solution compatible », raccordée à une plateforme agréée, sans laisser croire que l'émission de 2027 est disponible (elle reste « à venir » dans `lib/stripe/plans.ts`). Canonical vers « / » (recommandation de Google pour une variante de test), hors plan du site, publique dans le middleware et le service worker. Mouvement : opacité, translate, scale et trait du ✓ seulement, ni backdrop-filter ni will-change ni boucle, état final sans JavaScript et avec « Réduire les animations ». Cadrage `sides-short` des pictogrammes de marque. Construction par quatre agents sur une spécification écrite, revue adverse en quatre angles (honnêteté, iOS et mouvement, accessibilité et responsive, code) avec contradicteur par constat : 14 défauts confirmés (dont un bloquant, la date de 2027) corrigés, puis contre-vérifiés ; nouvelle capture `mobile-catalogue`. Vérifié au navigateur (390 et 1 440 px, clair et sombre). Aucune migration | `app/design/page.tsx`, `components/design/`, `components/brand/Doodles.tsx`, `components/landing/devices.tsx`, `public/landing/ecrans/v2/{catalogue,relances,mobile-relances,mobile-catalogue}.webp`, `scripts/capture-landing-screens.mjs`, `app/globals.css`, `lib/supabase/middleware.ts`, `public/sw.js`, `components/layout/{PublicNav,PublicHeader}.tsx`, `components/auth/SignupForm.tsx`, `lib/auth/signup-input.ts`, `__tests__/signup-api.test.ts`, `ANALYSE-LANDING-CONCURRENT-2026-10.md` |
| 2026-10-17 | **Accueil remplacé par l'ancienne variante B** (décision du fondateur après la comparaison des deux pages ; l'ancien accueil est dans l'historique git, commit `a78a9cd`). `app/page.tsx` reprend la page de `/design`, ses composants passent de `components/design/` à `components/home/` (`HomeHero`, `HomeFaq` à la place de `DesignHero`, `DesignFaq`). **`/design`** : redirection permanente (308) vers `/`, retirée du middleware et du service worker. **SEO** : title, description et canonical inchangés (layout et `app/page.tsx`) ; nouveau H1 « Le logiciel des artisans du bâtiment *pour vos devis et factures.* » (plus proche de la requête visée que l'ancien) ; **JSON-LD FAQPage** bâti sur les 7 questions affichées (`FAQ_ITEMS` de `components/home/Closing.tsx`, plus de doublon avec l'ancienne FAQ) ; **bloc « Pour aller plus loin »** (`components/home/Resources.tsx` : les 11 métiers, 7 guides, 5 modèles dont l'exemple d'électricien, 4 outils) pour garder le maillage interne de l'accueil ; plan du site : accueil daté du 17/10. **Liens** : « Produit » (en-tête) et « Fonctionnalités » (pied de page) mènent à `#devis` ; « Tarifs » à `/pricing` (plus de section tarifs sur l'accueil, l'inscription étant gratuite) ; boutons d'inscription vers `/signup` sans marque (la prop `links` de `PublicNav` ajoutée pour le test est retirée ; `?ab=<nom>` reste possible : `LANDING_VARIANTS` dans `lib/auth/signup-input.ts`). **Supprimés** : `components/landing/LandingHero.tsx`, `StorySection.tsx` ; restent inutilisés mais en place `PhoneCarousel`, `ScreenCarousel` (`carousels.tsx`) et `PhotoBand` (`ui.tsx`). **Mesure** (Lighthouse mobile simulé, build local, 3 passages chacun, ancien accueil contre nouvelle page) : SEO 100 et 100, accessibilité 97 et 100, poids 683 Ko et 683 Ko, LCP médian 3,8 s et 4,2 s, TBT 337 ms et 488 ms, performance médiane 76 et 72 : écarts dans le bruit d'un bac à sable partagé, même profil de scripts (le pixel Meta pèse autant dans les deux) ; à confirmer sur le site en ligne. Vérifié : 96 liens internes de l'accueil en 200, redirection `/design` en 308, 238 pages générées, 2 111 tests, lint. À faire par le fondateur : demander la réindexation de `/` dans la Search Console, puis suivre les positions et les clics 2 à 4 semaines. Revue adverse en trois angles (SEO et liens, régressions, rendu), 25 relecteurs : trois défauts réels corrigés (« 0 ressaisie » qui débordait de sa carte à 320 px, espaces insécables du bloc Ressources, emplacements du label périmés au § 13 de DECISIONS) ; le reste (code mort conservé exprès, contenu moins riche que l'ancien accueil sur la réception du 1er septembre 2026, lastmod) est un arbitrage, pas un défaut. Aucune migration | `app/page.tsx`, `components/home/`, `components/layout/{PublicNav,PublicHeader,Footer}.tsx`, `next.config.mjs`, `lib/supabase/middleware.ts`, `public/sw.js`, `app/sitemap.ts`, `components/landing/{LandingHero,StorySection}.tsx` (supprimés), `DECISIONS-STRATEGIQUES.md`, `__tests__/{home,sitemap,seo-plan-2026-10-16}.test.ts` |
| 2026-10-18 | **Pictogrammes de marque sur le héros et les bandeaux bleus, carte photo des métiers qui suit la souris** (demande du fondateur : héros « trop blanc », bandeaux bleus à animer, métiers à faire voir comme des liens). **Héros** : pictogrammes essayés puis refusés par le fondateur ; le héros reprend à la place le fond en lignes pointillées de la section « Créez vos devis » (`GridLines`). **Bandeaux bleus** : ton clair `tone="light"` (blanc, sujet à .9, reste à .34) sur le bandeau « aussi simple » (`band`), le bandeau de l'animation du devis (`band-split`) et l'appel final marine (`frame`). Positions réglées avec un contrôle automatique de chevauchement (texte, boutons, label, arche du héros) de 1 100 à 2 560 px, thèmes clair et sombre. **Rangée des métiers** (`components/home/TradesStrip.tsx`, calculs purs dans `trades-demo.ts`) : au survol à la souris (souris fine seulement), une carte avec la photo du métier et « Voir la page » suit le pointeur avec un léger retard et passe de l'autre côté près des bords ; quand la rangée entre à l'écran, une souris de démonstration passe très lentement (6,4 s) sur « Électriciens » et la carte la suit, rejouée à chaque retour tant que le visiteur n'a pas survolé un métier ; rien au doigt, rien d'automatique avec « Réduire les animations » (même activé en cours de route), arrêt au premier appui, quand la rangée sort de l'écran ou passe sous l'en-tête fixe, jamais lancée quand la rangée n'est pas encore révélée ; au clavier, la carte se pose sous le lien qui a le focus, le suit au défilement (et se cache s'il sort de l'écran), Échap la ferme ; photos de la galerie des métiers chargées à l'approche de la rangée ; ni `backdrop-filter` ni `will-change`. Exception à la règle « aucun élément flottant » consignée dans `CLAUDE.md`. Revue adverse (3 relecteurs, 15 agents, un contradicteur par constat) : 8 constats confirmés et corrigés (focus clavier : carte posée sur une position périmée pendant l'apparition du lien, figée au défilement, mauvais métier après un passage de la souris, pas de fermeture par Échap ; transition d'échelle inerte avec Tailwind 3 ; démonstration lancée alors que les liens n'étaient pas encore révélés ; tests qui ne gardaient presque rien du moteur). Build 238/238, 2 157 tests (46 pour la rangée : trajectoire, placement, moteur, clavier, Échap, tactile, nettoyage au démontage). Aucune migration | `components/brand/Doodles.tsx`, `components/home/{HomeHero,Bands,ConvertBand,Closing,TradesStrip}.tsx`, `components/home/trades-demo.ts`, `CLAUDE.md`, `__tests__/trades-strip.test.ts` |
| 2026-10-18 | **Héros mobile plus compact** (demande du fondateur : tout tenait mal dans la première vue, face à un concurrent) : pastille « Nouveau » sur une ligne (texte court), titre à 31-38 px, coches resserrées en 15 px, un seul bouton (la démo reste dans le menu), marges réduites ; ordinateur inchangé. | `components/home/{HomeHero,kit}.tsx` |
| 2026-10-18 | **Plan marketing** (demande « Marketing Qonforme ») : relevé des chiffres lisibles (Search Console via OpenSEO du 17/09 au 15/10 : environ 450 affichages et 3 à 4 clics pour tout le site ; GA4, Vercel Analytics, Stripe et la base de production hors de portée de la session, donc aucun chiffre d'inscriptions ni d'abonnés), constat du suivi (seul le pixel Meta mesure ; `?source=` des liens « Propulsé par Qonforme » n'est pas enregistré à l'inscription, seul `?ab=` l'est ; aucun programme de prescripteurs ni de parrainage dans le code). **Objectif recalé** : le calcul de `DECISIONS-STRATEGIQUES.md` § 5 (185 abonnés à 19 €) date d'avant la grille du 02/10 ; à environ 11 € HT de panier, 3 500 €/mois demandent environ 320 abonnés et 4 000 inscriptions (hypothèse de 8 %), atteints vers août 2027 à la montée prévue. **Canaux classés par coût plafond** (environ 5 € par inscrit) : Google Ads sur « logiciel devis … » écarté (80 à 360 € par inscrit), prescripteurs rémunérés au résultat, boucle produit, vidéos courtes et réponses en communautés, référencement, test Meta borné à 300 € seulement une fois le suivi en place. Calendrier de 13 semaines, seuils de décision, 7 décisions pour le fondateur, textes prêts à l'emploi (accroches, page partenaires, 6 scripts vidéo, réponses types). Aucun code modifié | `PLAN-MARKETING-2026-10.md`, `CLAUDE.md`, `README.md` |
| 2026-10-18 | **Bandeau de cookies et pixel Meta chargé après accord** (demande du fondateur, suite au contrôle du pixel). Constat, vérifié sur le site en ligne avec un navigateur : le pixel Meta (`1280812480690943`) envoyait un `PageView` et posait `_fbp` dès la première visite, sans bandeau, alors que `/confidentialite` § 8 et `/mentions-legales` § 5 affirmaient « aucun cookie publicitaire, ni Facebook Pixel ». **Code** : `lib/consent.ts` (choix « accepté » ou « refusé » gardé six mois dans le navigateur, relu sans confiance, pages exclues), `CookieBanner` (petit : 58 px de haut sur ordinateur, 108 px sur téléphone ; verre `.q-float`, deux boutons de même taille, fondu après 600 ms, rien au rendu serveur, au-dessus de la barre basse mobile, rouvert par « Gérer les cookies » du pied de page et de la politique, Échap, atteignable au clavier), `TrackingLoader` et `lib/meta-pixel.ts` (le pixel ne se charge qu'après accord ; **un `PageView` par page, y compris en navigation sans rechargement** : il n'en partait qu'un au chargement ; retrait de l'accord : `consent revoke` et cookies effacés ; cookies de l'ancien pixel effacés pour qui n'a pas accepté), `trackEvent` muet sans accord, PostHog chargé lui aussi seulement après accord. Retirés du layout : le script inline et l'image `<noscript>` de suivi. **Textes** : politique de confidentialité réécrite (§ 8 : nécessaires / soumis à l'accord / sans cookie ; Meta partenaire publicitaire en responsabilité conjointe ; base légale du consentement ; durées ; transferts ; retrait du consentement), mentions légales § 5, nouvelle règle dans `CLAUDE.md`. Vérifié au navigateur sur le site local (ordinateur et téléphone, clair et sombre, requêtes vers Meta bloquées) : aucune requête ni cookie avant le choix, pixel chargé après « Accepter », coupé après un retrait, aucun bandeau sur `/regler`, `/signer`, `/admin`. 27 tests, tsc, lint, 2 184 tests. Aucune migration. **À vérifier dans Meta Events Manager** : « mise en correspondance avancée automatique » désactivée (non contrôlable depuis le code : elle enverrait des e-mails hachés) | `lib/consent.ts`, `lib/meta-pixel.ts`, `lib/bottom-nav-routes.ts`, `components/consent/`, `components/shared/PostHogProvider.tsx`, `components/layout/Footer.tsx`, `components/pwa/InstallPrompt.tsx`, `app/layout.tsx`, `app/confidentialite/page.tsx`, `app/mentions-legales/page.tsx`, `__tests__/cookie-{consent,banner}.test.ts`, `PLAN-MARKETING-2026-10.md`, `CLAUDE.md` |
| 2026-10-18 | **Orientation réseaux sociaux consignée** (discussion avec le fondateur, à reprendre plus tard ; `PLAN-MARKETING-2026-10.md` § 8). Retenu : **YouTube** en socle (un tuto long toutes les deux semaines, plus 2 ou 3 extraits verticaux), **Facebook** en relais (mêmes vidéos, guides et exemples chiffrés plutôt que les articles du blog, groupes), **LinkedIn** en présence minimale (page entreprise, pas de profil du fondateur, pas d'articles soignés : les comptables recommandent mais ne s'inscrivent pas). Vidéos **sans visage, en motion graphic** construites en code (16:9 et 9:16), scripts tirés des guides vérifiés avec source et date à l'écran, jamais de sujet technique de chantier ni de comparatif ; titres en deux couches (miniature = accroche, titre = mot-clé et promesse), 6 pistes dont « Fini l'attestation de TVA à faire signer » proposée pour l'essai ; vidéos intégrées au site par image cliquable (cookies et vitesse). Décision « qui est à l'image » tranchée (personne), voix à décider. Constaté : Zernio relié mais aucun réseau social connecté. Aucun code modifié | `PLAN-MARKETING-2026-10.md`, `CLAUDE.md`, `README.md` |
| 2026-10-19 | **Nouvelle grille, deux modes Stripe, TVA reportée** (décisions du fondateur, DECISIONS § 14). **Prix** : Essentiel 24 €/mois ou 240 €/an, Artisan 34 € ou 340 € (avant : 12/24 € HT), partout par `lib/stripe/plans.ts` ; le prix affiché est le prix payé. **TVA** : la LLC (Diez Agency LLC, Wyoming, vendeur réel ; « Qonforme » n'est qu'une marque) n'est pas inscrite à la TVA ; le fondateur ouvre la vente quand même sans TVA, sous sa responsabilité, son comptable devant trouver une solution. Réglage `VAT_COLLECTED = false` : aucun taux ajouté (`STRIPE_TAX_RATE_ID` n'est plus lu), aucune mention HT/TTC (Tarifs, paiement, abonnement, mur de paiement, emails, accueil, CGU art. 4, données structurées) ; à `true` : prix hors taxes, Stripe Tax, numéro de TVA demandé. **Mode essai** : un bac à sable Stripe (clés, prix et webhook `_TEST`) pour des **comptes d'essai** cochés dans Admin › Paiements (nouvelle page : état des variables, comptes d'essai, « Supprimer les abonnements d'essai ») ; tous les autres comptes restent en production (aucun interrupteur général). `lib/stripe/mode.ts` (client par mode), `test-users.ts`, `test-accounts.ts`, `webhook-verify.ts` (un seul webhook, deux clés de signature, mode incohérent refusé) ; sûreté : mode illisible = paiement refusé (503), un abonnement d'essai ne vaut pas « déjà abonné » en production, clé publique transmise par la page de paiement, mode d'un abonnement mémorisé (`livemode`). 7 appels à Stripe adaptés (paiement, portail, garantie, webhook, page de retour, abonnement, routes admin) ; `lib/stripe/client.ts` supprimé. Migration `20261019_stripe_test_mode.sql` rejouée deux fois dans PGlite (droits refusés à anon et authenticated, cascade, purge) : **à appliquer** ; sans elle tout reste en production comme avant. **Reste à faire avant la vente en production** (DECISIONS § 14.4) : prix et webhook de production (adresse sans `www`, 7 événements), portail, mentions légales au nom de la LLC. Build de production, tsc, lint, 2 209 tests (25 ajoutés, dont une mutation de `VAT_COLLECTED` qui les fait échouer) | `lib/stripe/{plans,mode,test-users,test-accounts,webhook-verify,subscription,guarantee,recovery}.ts`, `app/api/stripe/{checkout,portal,guarantee}/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/admin/stripe-test-accounts/`, `app/admin/(panel)/payments/`, `components/admin/payments/`, `components/admin/nav.ts`, `app/pricing/{page,checkout/*,return/page}.tsx`, `app/settings/billing/page.tsx`, `components/billing/*`, `lib/email/templates/{welcome,onboarding}.ts`, `app/cgu/page.tsx`, `app/layout.tsx`, `supabase/migrations/20261019_stripe_test_mode.sql`, `DECISIONS-STRATEGIQUES.md`, `.env.example`, `__tests__/stripe-modes.test.ts` |
| 2026-10-19 | **Sources dans les articles : constat et liens vers un faux domaine** (question du fondateur « met-on des sources, et quel impact SEO ? », analyse avec le skill expert-seo). **Constat** sur les 62 articles en ligne (lecture de la page publique, pas de la base) : le générateur demande des sources officielles par défaut (`officialSources`, liens `.gouv.fr` et `service-public.fr` seulement, adresses vérifiées sur le nom de domaine mais pas sur l'existence de la page) ; en ligne, 2 articles sur 62 en citent ; aucun `dateModified` dans les données structurées. **Défaut grave** : **10 articles** (écrits par l'ancien générateur) lient `qonforme.com`, un autre site (logiciel mexicain de gestion de la qualité, en espagnol), pour le bouton « Essayez Qonforme… » ; l'un d'eux mène à `/essai-gratuit` (404). Le nouveau générateur ne peut pas les produire (`isAllowedLink` n'admet que qonforme.fr et les sites officiels). **Correction** : SQL `supabase/one-off/20261019_corriger_liens_qonforme_com.sql` (sauvegarde, `/signup` à la place, tout ou rien, rejouable, essayé dans PGlite) **à lancer dans Supabase** ; en attendant, la page publique réécrit ces liens vers `/signup` (`lib/blog-brand-links.ts`, branché dans `app/blog/[slug]/page.tsx`) ; nouvelle règle `domaine-qonforme` dans `lib/blog-audit.ts` (page `/admin/blog/verification`, un article généré qui en contient reste en brouillon). **Précision sur l'offre** : le fondateur confirme l'« essai gratuit » = le compte Devis à 0 € pour toujours, sans carte bancaire (page Tarifs) ; le texte des liens (« Essayez Qonforme gratuitement ») est donc gardé, seule l'adresse change ; ne jamais écrire de durée d'essai (« 7 jours ») ni « facturation gratuite » (`FREE_RULE`). Reste proposé et non fait : vérification HTTP des liens `.gouv.fr` à la rédaction, ajout de sources aux articles TVA, devis et facture électronique, `dateModified` dans les données structurées. Aucune migration. 5 tests | `lib/blog-brand-links.ts`, `lib/blog-audit.ts`, `app/blog/[slug]/page.tsx`, `supabase/one-off/{20261019_corriger_liens_qonforme_com.sql,README.md}`, `__tests__/blog-brand-links.test.ts` |

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
