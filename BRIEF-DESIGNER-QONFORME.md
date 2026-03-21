# Brief Designer — Qonforme.fr

**Document destiné à un designer pour la création du branding complet et de la landing page.**
**Date : 21 mars 2026**

---

## 1. LA PLATEFORME EN BREF

**Qonforme** est une application SaaS B2B de **facturation electronique** destinee aux **artisans, independants et TPE francaises**.

**Proposition de valeur unique :**
A partir de septembre 2026, la loi francaise impose la facturation electronique a toutes les entreprises. Qonforme genere automatiquement le fichier **Factur-X certifie EN 16931** (le format legal obligatoire — 47 champs techniques) et accompagne l'utilisateur pas-a-pas pour la transmission via Chorus Pro. L'utilisateur cree sa facture en moins de 3 minutes, sans jamais avoir a comprendre le jargon technique.

**Positionnement :** Simplicite absolue. L'outil est fait pour des artisans (plombiers, menuisiers, electriciens, auto-entrepreneurs) qui ne sont pas a l'aise avec la technologie. Chaque ecran doit etre comprehensible en 3 secondes.

**URL :** https://qonforme.fr
**Nom complet :** Qonforme — Facturation electronique simplifiee

---

## 2. CIBLE UTILISATEUR

### Persona principal
- **Metier :** Artisan, independant, auto-entrepreneur, gerant de TPE (< 10 salaries)
- **Age :** 30-55 ans
- **Secteurs :** Batiment, services a la personne, menuiserie, plomberie, electricite, consulting
- **Niveau tech :** Faible a moyen — utilise un smartphone et un ordinateur pour l'essentiel
- **Douleur principale :** La reglementation 2026 les oblige a passer au format electronique, mais ils ne comprennent pas comment faire et ont peur d'etre hors-la-loi
- **Motivation :** Etre en regle sans y passer des heures, ne pas risquer de penalites

### Persona secondaire
- **Comptables et experts-comptables** qui recommandent l'outil a leurs clients
- **Gerants de petites structures** (5-20 factures/mois) qui cherchent a automatiser

---

## 3. IDENTITE VISUELLE ACTUELLE

### 3.1 Palette de couleurs

#### Couleurs primaires
| Role | Light Mode | Dark Mode | Hex |
|------|-----------|-----------|-----|
| **Primaire (CTA, accents)** | Blue-600 | Blue-500 | `#2563EB` / `#3B82F6` |
| **Background** | Slate-50 | Navy profond | `#F8FAFC` / `#0B1628` |
| **Texte principal** | Slate-900 | Slate-200 | `#0F172A` / `#E2E8F0` |
| **Texte secondaire** | Slate-500 | Slate-400 | `#64748B` / `#94A3B8` |
| **Bordures** | Slate-200 | Navy clair | `#E2E8F0` / `#1E3A5F` |
| **Cards** | Blanc pur | Navy sombre | `#FFFFFF` / `#0F1E35` |

#### Couleurs semantiques
| Role | Hex | Usage |
|------|-----|-------|
| **Succes** | `#10B981` | Facture payee, badge conforme, validation |
| **Erreur** | `#EF4444` | Facture en retard, suppression, erreurs |
| **Warning** | `#D97706` | Avoir emis, attention requise |
| **Info** | `#2563EB` | Liens, elements interactifs |

#### Couleurs par type de document
| Document | Couleur accent | Hex |
|----------|---------------|-----|
| Factures | Bleu | `#2563EB` |
| Devis | Vert emeraude | `#059669` |
| Bons de commande | Indigo | `#4F46E5` |
| Avoirs | Orange | `#C2410C` |

#### Gradients
```
Landing background : linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)
Dashboard background : linear-gradient(250deg, #EFF6FF 0%, #DBEAFE 20%, #F0F9FF 45%, #F8FAFC 70%, #FFFFFF 100%)
OG images : linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)
CTA accent bar : linear-gradient(90deg, #2563EB, #7C3AED, #2563EB)
```

#### Effets decoratifs
- Blobs radiaux bleus semi-transparents en arriere-plan (`rgba(37,99,235,0.06)` a `rgba(37,99,235,0.13)`)
- Grille de points (`radial-gradient circle, rgba(37,99,235,0.08) 1px, transparent 1px`) — pas 32px
- Watermark "Q" geant en opacite 3% sur le footer et certaines pages

### 3.2 Typographie

| Role | Police | Poids | Usage |
|------|--------|-------|-------|
| **Corps de texte** | DM Sans | 300-700 | Tout le texte courant, labels, descriptions |
| **Titres / Display** | Bricolage Grotesque | 400-800 | Headlines landing, titres de section, "drop cap" blog |
| **Monospace / Nombres** | DM Mono | 300-500 | Montants, numeros de facture, SIREN, tableaux de chiffres |

**Fallbacks :** DM Sans → Inter → sans-serif ; DM Mono → JetBrains Mono → monospace

### 3.3 Logos existants

Les logos sont heberges sur Supabase CDN :

| Fichier | Description | Usage |
|---------|-------------|-------|
| `Logo long bleu.webp` | Logo horizontal, texte bleu sur fond transparent | Header light mode, landing |
| `Logo long simple.png` | Logo horizontal, texte blanc/clair | Footer (fond sombre), dark mode |
| `Logo bleu Qonforme PNG.webp` | Picto "Q" + texte "Qonforme" | Icon, favicon source |
| `Picto Q.webp` | Le "Q" seul, grande taille | Watermark background, OG images |

**Favicons disponibles :** 16x16, 32x32, 180x180 (apple-touch), 192x192, 512x512 (PWA maskable)

### 3.4 Theme color
- **Theme principal :** `#2563EB` (bleu)
- **Dark mode :** Supporte (toggle desktop uniquement — desactive sur mobile iOS pour raisons techniques)
- **Default :** Light mode

---

## 4. STRUCTURE DE LA LANDING PAGE

### 4.1 Architecture actuelle (sections dans l'ordre)

```
1. HEADER / NAVIGATION
   - Logo Qonforme
   - Liens : Fonctionnalites, Tarifs, Blog, Demo
   - CTAs : "Voir la demo" (secondary) + "Commencer" (primary)

2. HERO
   - Badge pulse : "Conforme reglementation 2026/2027"
   - Headline : "La facturation electronique devient obligatoire. Sois pret avant tout le monde."
   - Sous-titre explicatif (Factur-X EN 16931, accompagnement transmission)
   - CTAs : "Commencer maintenant" + "Essayer la demo"
   - Social proof : "500+ artisans utilisent Qonforme"
   - 3 badges reassurance : Acces immediat, Conforme 2026, Resiliable
   - Mockup dashboard (droite sur desktop) avec KPIs et factures recentes

3. COMMENT CA MARCHE (3 etapes)
   - Cree ton compte (5 min)
   - Cree ta facture (selectionne client + prestations)
   - Telecharge & transmets (Factur-X genere, guide Chorus Pro inclus)

4. ILS NOUS FONT CONFIANCE (logos partenaires)
   - Batimat, Qualibat, Artisans de France, CMA France, BTP Banque, Chorus Pro
   - Metriques : 500+ artisans, 10 000+ factures, 99.9% conformite

5. NOS CHIFFRES (4 KPIs)
   - 500+ entreprises accompagnees
   - 10 000+ factures conformes emises
   - < 3 min pour creer et envoyer
   - 99.9% taux de conformite

6. FEATURE — CREATION RAPIDE
   - Pilule : "CREATION RAPIDE"
   - Titre : "Une facture envoyee en moins de 3 minutes."
   - 3 sous-features : PDF Factur-X auto, Pret a transmettre, Conversion devis → facture
   - Mockup : formulaire de creation de facture

7. FEATURE — CONFORMITE & SUIVI
   - Pilule : "CONFORMITE & SUIVI"
   - Titre : "Toujours en regle, sans y penser."
   - 3 sous-features : Conforme 2026, Statuts temps reel, Archivage legal 10 ans
   - Mockup : timeline de transmission (4 etapes)

8. COMPARAISON (Avec vs Sans Qonforme)
   - 6 points negatifs (rouge) sans Qonforme
   - 6 points positifs (vert) avec Qonforme

9. TEMOIGNAGES
   - Marc D. — Plombier independant, Lyon (5 etoiles)
   - Sophie L. — Auto-entrepreneuse, Paris (5 etoiles)
   - Atelier Renard — Menuiserie, Bordeaux (5 etoiles)

10. TARIFS
    - Toggle Mensuel / Annuel (-16%)
    - Starter : 9 EUR/mois (10 factures/mois)
    - Pro : 19 EUR/mois (illimite) — badge "Populaire"
    - Features detaillees pour chaque plan

11. URGENCE
    - Countdown : "Septembre 2026 — dans moins de 6 mois"
    - Message : "Chaque mois sans agir, c'est un mois de retard"
    - CTA : "Devenir conforme maintenant"

12. FAQ (6 questions)
    - Facturation electronique obligatoire ?
    - Homologation Etat ?
    - Transmission automatique ?
    - Client sans SIREN ?
    - Resiliation ?
    - Fin d'abonnement ?

13. ALLER PLUS LOIN (maillage interne)
    - Blog & guides
    - Demo interactive
    - Tarifs

14. CONTACT
    - Email : contact@qonforme.fr
    - Formulaire (nom, email, sujet, message)
    - Reponse sous 24h

15. FOOTER
    - 4 colonnes : Marque, Produit, Legal, Contact
    - Badge "Conforme PPF / DGFiP"
    - Background navy #0F172A
```

### 4.2 Points d'amelioration identifies

- **Hero trop textuel** — besoin d'un visuel produit plus impactant (video demo 30s ou GIF anime)
- **Pas de temoignages reels** — les 3 actuels sont fictifs, il faut de vrais retours clients
- **Social proof faible** — pas de badges/certifications visibles (RGPD, securite, uptime)
- **Pas de free tier** — friction maximale a l'inscription (recommande : plan gratuit 3 factures/mois)

---

## 5. FONCTIONNALITES COMPLETES DE L'APPLICATION

### 5.1 Dashboard
- Salutation personnalisee (selon l'heure)
- 5 KPIs : CA du mois, factures emises, en attente, en retard, clients actifs
- Graphique revenus 12 mois
- Top clients par CA
- Factures recentes (tableau)
- Actions rapides : Nouvelle facture, Nouveau devis, Nouveau client, Nouveau bon de commande
- Modal d'onboarding au premier login

### 5.2 Factures
- **Liste** avec filtres par statut (Brouillon, Envoyee, En attente, En retard, Payee, Archivee)
- **Creation/Edition** : client, dates, lignes de produits/services, TVA multi-taux (20%, 10%, 5.5%, 2.1%, 0%), notes, conditions
- **Actions** : Telecharger PDF, Telecharger Factur-X XML, Imprimer, Envoyer par email, Relancer (J+30/J+45), Archiver
- **Avoirs** : Emission d'avoir total ou partiel depuis une facture (choix des lignes, motif)
- **Statuts** : Brouillon → Envoyee → En attente → Recue → Acceptee/Rejetee → Payee / En retard → Creditee

### 5.3 Devis
- Meme structure que les factures + date de validite (+30j par defaut)
- **Conversion devis → facture en 1 clic**
- Statuts : Brouillon → Envoye → Accepte / Rejete

### 5.4 Clients
- Annuaire avec recherche temps reel (nom, email, ville)
- Fiche client : nom, SIREN, email, adresse, TVA, notes
- Documents associes (factures, devis, bons de commande lies)
- Archivage soft

### 5.5 Catalogue produits
- Produits/services reutilisables avec prix HT, taux TVA, unite (heure, jour, forfait, piece, mois, km)
- Toggle actif/inactif
- Insertion rapide dans les documents

### 5.6 Bons de commande
- Structure similaire aux factures + date de livraison + reference
- Statuts : Brouillon → Envoye → Confirme / Annule

### 5.7 Avoirs (credit notes)
- Liste avec lien vers la facture d'origine
- Numerotation automatique AV-YYYY-NNN
- Banniere legale expliquant l'obligation

### 5.8 Parametres
- **Mon entreprise** : nom legal, SIREN, SIRET, TVA, adresse, IBAN, logo, site web, telephone, email
- **Preferences factures** : logo, format numerotation, couleur accent, mentions legales, conditions de paiement
- **Guide transmission PPF** : tutoriel 4 etapes (Chorus Pro, IOPOLE, 137 plateformes agreees)
- **Exports comptables** : Export FEC (Fichier des Ecritures Comptables — format DGFiP, 18 colonnes, UTF-8 BOM)
- **Abonnement** : plan actuel, usage, historique paiements, portail Stripe

### 5.9 Demo
- Version lecture seule avec donnees fictives de toutes les fonctionnalites
- Accessible sans inscription
- Sidebar de navigation complete

### 5.10 Blog
- Articles SEO generes par IA (Gemini) — 32 sujets en rotation
- Admin panel pour gestion, relecture, publication
- CTA signup en bas de chaque article
- Partage social (Twitter, LinkedIn, Facebook, email)

---

## 6. TARIFICATION

| | Starter | Pro |
|---|---------|-----|
| **Prix mensuel** | 9 EUR HT/mois | 19 EUR HT/mois |
| **Prix annuel** | 90 EUR HT/an (7.50 EUR/mois, -16%) | 190 EUR HT/an (15.83 EUR/mois, -16%) |
| **Factures** | 10/mois | Illimitees |
| **Devis & BdC** | Illimites | Illimites |
| **Factur-X EN 16931** | Oui | Oui |
| **Guide transmission** | Chorus Pro | Multi-plateforme |
| **Tableau de bord CA** | Non | Oui |
| **Relances auto** | Non | Oui (J+30/J+45) |
| **Support** | Email 48h | Email 24h prioritaire |

**Commun aux deux plans :** Avoirs, envoi email, recherche SIREN, catalogue produits, conversion devis → facture, archivage legal 10 ans.

---

## 7. MESSAGES CLES (POUR LE COPYWRITING)

### Piliers de communication
1. **Conformite sans effort** — "Factur-X certifie EN 16931 genere automatiquement"
2. **Rapidite** — "Une facture conforme en moins de 3 minutes"
3. **Urgence legale** — "Obligatoire des septembre 2026 — sois pret avant tout le monde"
4. **Confiance** — "500+ artisans, 10 000+ factures, 99.9% conformite"
5. **Simplicite de prix** — "A partir de 9 EUR/mois, sans engagement, resiliable a tout moment"
6. **Accompagnement** — "Guide pas-a-pas inclus, support reactif sous 24h"

### Ton de voix
- **Tutoiement** (tu/ton) — proximite avec l'artisan
- **Direct et rassurant** — pas de jargon technique, pas de condescendance
- **Urgence mesuree** — rappeler l'obligation legale sans panique
- **Preuves concretes** — chiffres, temoignages, badges conformite

### Mots-cles SEO principaux
- facturation electronique
- facture electronique obligatoire 2026
- Factur-X
- logiciel facturation artisan
- facturation conforme TPE
- Chorus Pro guide
- PPF (Plateforme Publique de Facturation)

---

## 8. ENVIRONNEMENT TECHNIQUE (pour le designer)

| Element | Detail |
|---------|--------|
| **Framework** | Next.js 14.2 (App Router) |
| **CSS** | Tailwind CSS 3 |
| **Animations** | Framer Motion (scroll-reveal, `once: true`) |
| **Breakpoints** | Mobile < 768px, Tablet 768-1024px, Desktop > 1024px |
| **Dark mode** | Supporte (class-based via next-themes) |
| **Responsive** | Mobile-first, bottom nav sur mobile, sidebar sur desktop |
| **iOS Safari** | Pas de backdrop-filter blur sur mobile (crash GPU) — fonds opaques uniquement |
| **Radius** | 0.5rem (8px) par defaut |
| **PWA** | Manifest present, icones maskable 192/512px |

---

## 9. LIVRABLES ATTENDUS DU DESIGNER

### Branding
- [ ] Logo principal (horizontal) — versions light/dark/monochrome
- [ ] Picto "Q" standalone — versions couleur/monochrome
- [ ] Favicon set complet (16, 32, 180, 192, 512)
- [ ] Palette de couleurs finalisee (primaire, secondaire, semantique, gradients)
- [ ] Typographie finalisee (ou validation des choix actuels)
- [ ] Guide de style / charte graphique

### Landing page
- [ ] Wireframes desktop + mobile
- [ ] Maquettes haute fidelite desktop + mobile (Figma)
- [ ] Mockups produit (dashboard, creation facture, timeline transmission)
- [ ] Illustrations/icones pour les sections features
- [ ] Design des cards tarifs
- [ ] Design de la section temoignages
- [ ] Design du footer

### Application (optionnel, a discuter)
- [ ] Design system composants (boutons, inputs, cards, badges, tableaux)
- [ ] Pages cles : dashboard, liste factures, detail facture, formulaire creation
- [ ] Mobile : bottom nav, cards, formulaires

---

## 10. REFERENCES & CONCURRENTS

### Concurrents directs (facturation FR)
- **Pennylane** — UX premium, cible comptables + entreprises
- **Henrri** (ex-Rivalis) — gratuit, cible TPE
- **Sellsy** — CRM + facturation, cible PME
- **Obat** — specifique batiment

### References design a explorer
- Interfaces SaaS epurees : Linear, Vercel, Notion
- Fintech : Stripe Dashboard, Mercury
- Outils artisans : simplifier l'UX au maximum

---

*Ce brief est genere a partir de l'analyse complete du code source de Qonforme.fr (37 571 lignes, 134 commits).*
*Pour toute question technique : contact@qonforme.fr*
