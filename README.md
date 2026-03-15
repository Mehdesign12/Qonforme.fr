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
| Frontend | Next.js 15 (App Router) |
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
- Relances automatiques (J+30, J+45) *(à venir)*
- Tableau de bord CA 12 mois *(à venir)*
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
- [ ] Historique factures par client (affichage dans la fiche)
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
- [ ] Relances automatiques J+30/J+45 *(promis Plan Pro)*

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
- [ ] Graphique CA mensuel sur 12 mois *(promis Plan Pro)*
- [ ] Taux de recouvrement
- [ ] Top 5 clients par CA

### ✅ Paramètres
- [x] Infos entreprise (nom, SIREN, SIRET, TVA, adresse, email, IBAN, logo)
- [x] Préférences factures (couleur accent, logo, mention légale, préfixe numérotation)
- [x] Page PPF/Chorus Pro — guide 4 étapes complet (`/settings/ppf`)
- [ ] Notifications *(placeholder)*
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
| P1-3 | **Email de bienvenue** | Envoyé après signup, avec guide démarrage | Réduit churn J1 |
| P1-4 | **Onboarding guidé** | 3 étapes : logo → 1er client → 1ère facture (progress bar) | 40-60% drop sans ça |

### 🟠 Priorité 2 — Valeur perçue & différenciation

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P2-1 | **Relances automatiques** | Cron J+30/J+45, email au client, log dans la facture | Promis Plan Pro |
| P2-2 | **Dashboard CA étendu** | Graphique 12 mois, taux recouvrement, top clients | Promis Plan Pro |
| P2-3 | **Export comptable** | CSV transactions + FEC (Format d'Échanges Comptables) | Besoin N°1 des TPE |
| P2-4 | **Notifications email** | Facture vue / acceptée / retard — via webhook PPF | Promis dans settings |
| P2-5 | **Page de paiement publique** | Lien Stripe sur la facture, paiement en ligne client | Réduit délai paiement |
| P2-6 | **Historique par client** | Liste factures / devis / BdC dans la fiche client | UX attendue |

### 🟡 Priorité 3 — Finition & polish

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P3-1 | **Pagination** | Listes factures, devis, clients (cursor-based) | Perf > 50 entrées |
| P3-2 | **Modals de confirmation** | Remplacer `window.confirm()` par modal custom | Polish UX |
| P3-3 | **Empty states avec CTA** | Illustration + bouton créer sur listes vides | Conversion |
| P3-4 | **Aperçu PDF inline** | Modale prévisualisation avant envoi | Réassurance |
| P3-5 | **Favicon + meta OG** | Image de marque, partage social | Branding |
| P3-6 | **CGU / Mentions légales** | Pages `/cgu` et `/mentions-legales` | Légalement requis |
| P3-7 | **Page 404 custom** | Page not found avec retour accueil | UX |
| P3-8 | **Connexion OAuth Google** | Via Supabase Auth | Friction signup |

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
/settings/notifications    → Notifications (placeholder)
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

---

*Document de référence — Qonforme v1.0*
