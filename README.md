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
- Qonforme **n'est pas une PDP** — elle transmet les factures au PPF (Chorus Pro) via API publique, sans agrément requis

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 (App Router) |
| Styles | Tailwind CSS + Shadcn/UI |
| État global | Redux Toolkit |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage) |
| Paiements | Stripe Billing |
| Déploiement | Vercel |
| Transmission PPF | API REST Chorus Pro (sandbox DGFiP) |
| Format facture | Factur-X (PDF/A-3 + XML) |
| Email | Resend |

---

## Plans tarifaires

### Plan Starter — 9 €/mois HT
- 10 factures par mois
- Création de devis
- Transmission automatique PPF
- Archivage légal 10 ans
- Support email 48h

### Plan Pro — 19 €/mois HT
- Factures illimitées
- Création de devis
- Transmission automatique PPF/PDP
- Archivage légal 10 ans
- Relances automatiques (J+30, J+45)
- Tableau de bord CA complet
- Support email 24h

### Règles communes
- Essai gratuit **7 jours** sans carte bancaire
- Option annuelle : 2 mois offerts (–16,7 %)
- Pas de plan gratuit permanent

---

## Fonctionnalités MVP

### P0 — Bloquant pour le lancement

#### Authentification & onboarding
- Inscription par email/mot de passe
- Connexion OAuth Google
- Onboarding en 2 étapes :
  - Étape 1 : Prénom, nom, email, mot de passe
  - Étape 2 : Raison sociale, SIREN (recherche auto API INSEE Sirene), adresse, numéro TVA, IBAN
- Middleware de protection des routes (utilisateur non connecté → redirigé vers /login)

#### Gestion des clients
- Créer / modifier / archiver un client
- Champs : nom, SIREN, email, adresse, ville, numéro TVA
- Recherche auto par SIREN via API INSEE (pré-remplissage)
- Historique des factures par client

#### Facturation
- Créer une facture avec :
  - Sélection client (recherche)
  - Lignes de prestation : description, quantité, prix HT, taux TVA (0 / 5,5 / 10 / 20 %)
  - Calcul automatique HT / TVA / TTC
  - Numérotation automatique séquentielle (ex : F-2025-001)
  - Date d'émission + date d'échéance
  - Notes / conditions de paiement
- Aperçu PDF avant envoi
- Envoi par email au client
- Transmission automatique au PPF en arrière-plan (format Factur-X)
- Statuts : `brouillon` → `envoyée` → `reçue` → `acceptée` / `rejetée`
- Retour de statut via webhook PPF

#### Archivage
- Stockage sécurisé des PDF + XML Factur-X (Supabase Storage)
- Durée : 10 ans minimum
- Téléchargement individuel par facture

#### Tableau de bord
- CA du mois en cours vs mois précédent
- Nombre de factures émises ce mois
- Montant total en attente de paiement
- Montant total en retard
- Liste des 5 dernières factures avec statut
- Bannière statut connexion PPF (connecté / déconnecté)

### P1 — Important mais pas bloquant

#### Devis
- Créer un devis (même structure qu'une facture)
- Conversion devis → facture en 1 clic
- Statuts devis : `brouillon` / `envoyé` / `accepté` / `refusé`

#### Relances automatiques (Plan Pro uniquement)
- Email automatique au client à J+30, J+45, J+60 après échéance si facture impayée
- Désactivable par facture

#### Notifications
- Email de confirmation après transmission PPF réussie
- Alerte email si facture rejetée par le PPF
- Notification dans l'interface pour les factures en retard

### Hors MVP (V2)
- Export FEC / connecteur expert-comptable
- Multi-utilisateurs / accès collaborateur
- Paiement en ligne intégré
- Connexion PDP agréée (Yooz, Quadient...)
- Application mobile
- Plan Expert pour cabinets comptables

---

## Structure des pages (routes Next.js)

```
/                        → Landing page (publique)
/login                   → Connexion
/signup                  → Inscription étape 1
/signup/company          → Inscription étape 2 (infos entreprise)

/dashboard               → Accueil (protégé)
/invoices                → Liste des factures (protégé)
/invoices/new            → Créer une facture (protégé)
/invoices/[id]           → Détail d'une facture (protégé)
/quotes                  → Liste des devis (protégé)
/quotes/new              → Créer un devis (protégé)
/clients                 → Liste des clients (protégé)
/clients/[id]            → Détail d'un client (protégé)
/settings                → Paramètres compte (protégé)
/settings/company        → Infos entreprise
/settings/invoices       → Préférences factures
/settings/ppf            → Connexion PPF/PDP
/settings/notifications  → Notifications
/settings/billing        → Abonnement & facturation
```

---

## Design & UI

### Principes
- Interface **mobile-first**, utilisable sur tous les navigateurs
- Simplicité radicale : l'artisan ne doit pas avoir à comprendre la réglementation
- Vocabulaire PPF/PDP/Factur-X **jamais visible** dans l'interface utilisateur
- Chaque action principale doit être accessible en **moins de 3 clics**

### Charte graphique
| Élément | Valeur |
|---------|--------|
| Police corps | DM Sans |
| Police montants | DM Mono |
| Couleur principale | `#2563EB` (bleu) |
| Couleur foncée | `#0F172A` |
| Fond | `#F8FAFC` |
| Bordures | `#E2E8F0` |
| Succès | `#10B981` |
| Erreur | `#EF4444` |
| Avertissement | `#D97706` |

### Statuts des factures (badges couleur)
| Statut | Label FR | Fond | Texte |
|--------|----------|------|-------|
| `draft` | Brouillon | `#F1F5F9` | `#475569` |
| `sent` | Envoyée | `#DBEAFE` | `#1E40AF` |
| `pending` | En attente | `#FEF3C7` | `#92400E` |
| `overdue` | En retard | `#FEE2E2` | `#991B1B` |
| `paid` | Payée | `#D1FAE5` | `#065F46` |
| `rejected` | Rejetée | `#FEE2E2` | `#991B1B` |
| `accepted` | Acceptée | `#D1FAE5` | `#065F46` |

---

## Intégration PPF (Portail Public de Facturation)

### Flux complet
```
1. Utilisateur clique "Envoyer la facture"
2. Qonforme génère le fichier Factur-X (PDF/A-3 + XML CII)
3. Qonforme ajoute toutes les mentions légales obligatoires
4. Transmission au PPF via API Chorus Pro
5. PPF valide et notifie le client destinataire
6. PPF renvoie un webhook avec le statut (acceptée / rejetée)
7. Qonforme met à jour le statut dans l'interface
8. Notification email envoyée à l'utilisateur
```

### Sandbox de développement
- URL sandbox : `https://sandbox.api.chorus-pro.gouv.fr`
- Documentation : `https://developer.chorus-pro.gouv.fr`
- Authentification : OAuth2 client credentials

### Mentions légales obligatoires sur chaque facture
- Numéro de facture séquentiel
- Date d'émission
- SIREN du vendeur + adresse complète
- Numéro TVA intracommunautaire (si assujetti)
- SIREN de l'acheteur (obligatoire en B2B)
- Désignation précise des prestations
- Montants HT, taux TVA, montant TVA, TTC
- Conditions de paiement et pénalités de retard

---

## Gestion des abonnements (Stripe)

### Produits Stripe
```
product: "Qonforme Starter"
  price: 9.00 EUR / month  (id: price_starter_monthly)
  price: 90.00 EUR / year  (id: price_starter_yearly)

product: "Qonforme Pro"
  price: 19.00 EUR / month  (id: price_pro_monthly)
  price: 190.00 EUR / year  (id: price_pro_yearly)
```

### Logique des limites
- Plan Starter : bloquer la création de facture si `invoices_this_month >= 10`
- Plan Pro : aucune limite
- Période d'essai : 7 jours sur les deux plans, sans carte bancaire
- À expiration de l'essai sans CB renseignée : accès lecture seule, création bloquée

### Webhooks Stripe à gérer
- `customer.subscription.created` → activer le plan
- `customer.subscription.updated` → mettre à jour le plan
- `customer.subscription.deleted` → repasser en accès limité
- `invoice.payment_failed` → notifier l'utilisateur, accès limité après 3 échecs

---

## Roadmap de développement

### Phase 0 — Setup ⚙️
- [ ] Initialisation Next.js 14 + Tailwind + Shadcn
- [ ] Configuration Supabase (projet, auth, storage)
- [ ] Configuration Vercel (déploiement continu)
- [ ] Variables d'environnement (Supabase, Stripe, Resend, PPF sandbox)
- [ ] Middleware auth (protection des routes)

### Phase 1 — Auth & Onboarding 🔐
- [ ] Pages `/login` et `/signup`
- [ ] OAuth Google via Supabase Auth
- [ ] Onboarding 2 étapes avec création du profil entreprise
- [ ] Redirection post-login vers `/dashboard`

### Phase 2 — Clients 👥
- [ ] Page `/clients` — liste + recherche
- [ ] Formulaire création/édition client
- [ ] Intégration API INSEE Sirene (recherche par SIREN)

### Phase 3 — Factures 🧾
- [ ] Page `/invoices` — liste avec filtres par statut
- [ ] Page `/invoices/new` — formulaire complet
- [ ] Calcul HT/TVA/TTC en temps réel
- [ ] Génération PDF (mentions légales incluses)
- [ ] Génération Factur-X (PDF + XML)
- [ ] Envoi email client (Resend)
- [ ] Transmission PPF sandbox
- [ ] Gestion webhook retour statut PPF

### Phase 4 — Dashboard 📊
- [ ] Page `/dashboard` avec stats en temps réel
- [ ] Bannière statut connexion PPF
- [ ] Liste des dernières factures

### Phase 5 — Abonnements 💳
- [ ] Intégration Stripe Billing
- [ ] Page `/settings/billing`
- [ ] Gestion des limites par plan
- [ ] Webhooks Stripe
- [ ] Page succès / échec paiement

### Phase 6 — Devis & Relances 📨
- [ ] Module devis (conversion → facture)
- [ ] Relances automatiques email (J+30 / J+45 — Plan Pro)
- [ ] Notifications in-app

### Phase 7 — Polishing & QA ✅
- [ ] Tests sur mobile (responsive)
- [ ] Gestion des erreurs (échec PPF, Stripe, email)
- [ ] Optimisation performances
- [ ] Tests de bout en bout (Playwright)

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
NEXT_PUBLIC_APP_URL=https://app.qonforme.fr
```

---

## Déploiement

- **Plateforme** : Vercel
- **Statut** : 🔧 En cours de développement
- **Repo GitHub** : [Mehdesign12/Qonforme.fr](https://github.com/Mehdesign12/Qonforme.fr)
- **Dernière mise à jour** : Mars 2026

---

*Document de référence MVP v1.0 — Qonforme*
