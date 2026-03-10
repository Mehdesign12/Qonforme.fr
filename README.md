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
| Frontend | Next.js 15 (App Router) |
| Styles | Tailwind CSS + Base UI |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage) |
| Paiements | Stripe Billing *(non branché)* |
| Déploiement | Vercel |
| Transmission PPF | API REST Chorus Pro *(UI prête, logique à brancher)* |
| Format facture | Factur-X XML EN 16931 (générateur prêt) |
| Email | Resend |
| PDF | pdf-lib (génération server-side) |

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
- Relances automatiques (J+30, J+45) *(non implémenté)*
- Tableau de bord CA complet *(partiel)*
- Support email 24h

### Règles communes
- Essai gratuit **7 jours** sans carte bancaire
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
- [ ] **Mot de passe oublié / reset** ← *en cours*
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
- [ ] Transmission PPF/Chorus Pro *(UI prête, logique à brancher)*
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
- [x] Page PPF/Chorus Pro *(UI credentials prête, logique à brancher)*
- [ ] Notifications *(placeholder)*
- [ ] Billing / Abonnement *(placeholder)*

### ✅ Technique
- [x] Génération PDF factures, devis, BdC, avoirs (shared lib, logo, couleur, mentions)
- [x] Envoi email Resend (templates HTML, PDF joint, copie émetteur)
- [x] Générateur XML Factur-X EN 16931/EXTENDED *(prêt, non branché)*
- [x] Numérotation automatique robuste (séquentielle, par utilisateur/année)
- [x] Responsive mobile-first complet (toutes les pages)

---

## Roadmap — Ce qui reste à faire

### 🔴 Priorité 1 — Conversion & rétention (critique business)

| # | Quoi | Détail | Impact |
|---|------|--------|--------|
| P1-1 | **Stripe Billing** | Checkout, webhooks, gestion des plans, page billing | Sans ça = 0 revenu |
| P1-2 | **Mot de passe oublié** | Page request + page reset + email Resend | Bloquant UX ← *en cours* |
| P1-3 | **Email de bienvenue** | Envoyé après signup, avec guide démarrage | Réduit churn J1 |
| P1-4 | **Onboarding guidé** | 3 étapes : logo → 1er client → 1ère facture (progress bar) | 40-60% drop sans ça |
| P1-5 | **PPF/Chorus Pro branché** | Connecter la lib XML + API Chorus Pro aux routes d'envoi | Cœur de la promesse |

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

### Statuts factures (badges)
| Statut | Label FR | Fond | Texte |
|--------|----------|------|-------|
| `draft` | Brouillon | `#F1F5F9` | `#475569` |
| `sent` | Envoyée | `#DBEAFE` | `#1E40AF` |
| `pending` | En attente | `#FEF3C7` | `#92400E` |
| `overdue` | En retard | `#FEE2E2` | `#991B1B` |
| `paid` | Payée | `#D1FAE5` | `#065F46` |
| `rejected` | Rejetée | `#FEE2E2` | `#991B1B` |
| `accepted` | Acceptée | `#D1FAE5` | `#065F46` |
| `credited` | Avoir émis | `#F3E8FF` | `#6B21A8` |
| `archived` | Archivée | `#F1F5F9` | `#94A3B8` |

---

## Intégration PPF (Portail Public de Facturation)

### Flux prévu
```
1. Utilisateur clique "Envoyer la facture"
2. Qonforme génère le fichier Factur-X (PDF + XML CII EN 16931)
3. Transmission au PPF via API Chorus Pro (OAuth2 client credentials)
4. PPF valide et notifie le client destinataire
5. PPF renvoie un webhook avec le statut (acceptée / rejetée)
6. Qonforme met à jour le statut dans l'interface
7. Notification email envoyée à l'utilisateur
```

### État actuel
- Générateur XML Factur-X : ✅ prêt (`lib/facturx/xml.ts`)
- Générateur PDF : ✅ prêt (`lib/pdf/`)
- API Chorus Pro : ❌ non branchée (credentials UI prête dans settings/ppf)
- Webhooks retour statut : ❌ non implémentés

---

## Gestion des abonnements (Stripe)

### État actuel : ❌ Non implémenté
- Page landing pricing : ✅ affichée
- `lib/stripe/` : dossier créé, vide
- Page `/settings/billing` : placeholder

### À implémenter
```
Produits Stripe :
  "Qonforme Starter"  → 9€/mois ou 90€/an
  "Qonforme Pro"      → 19€/mois ou 190€/an

Webhooks à gérer :
  customer.subscription.created   → activer le plan
  customer.subscription.updated   → mettre à jour le plan
  customer.subscription.deleted   → accès lecture seule
  invoice.payment_failed          → notifier + bloquer après 3 échecs

Limites :
  Starter : bloquer création si invoices_this_month >= 10
  Pro     : aucune limite
  Trial   : 7 jours, sans CB, puis accès lecture seule
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
NEXT_PUBLIC_APP_URL=https://app.qonforme.fr
```

---

## Déploiement

- **Plateforme** : Vercel
- **Statut** : 🔧 En cours de développement
- **Repo GitHub** : [Mehdesign12/Qonforme.fr](https://github.com/Mehdesign12/Qonforme.fr)
- **Dernière mise à jour** : Mars 2026

---

*Document de référence — Qonforme v1.0*
