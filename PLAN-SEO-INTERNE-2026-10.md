# Onglet SEO de l'admin — remplacer PushRank (analyse et plan, 07/10/2026)

> Décision du fondateur (07/10/2026) : reproduire dans l'espace admin de Qonforme ce que PushRank apporte (onglet « SEO » et ses sous-onglets),
> puis résilier l'abonnement PushRank. Ordre voulu : plan consigné → design sur un canevas → validation du design et des fonctionnalités → code.
> Canevas de design : https://claude.ai/artifact/4UtSAdhRw8xFW1BTLmGypz (29 planches, à valider).
> Document vivant : à mettre à jour à chaque lot livré.
> 09/10/2026 : le fondateur abandonne PushRank ; le webhook (route, code, test, variable) est supprimé. Les articles déjà reçus restent publiés
> et les colonnes de la migration 20261006 restent (la page article et le plan du site les lisent).
> 10/10/2026 : **onglet SEO livré (lots 1 à 4)**, en code, sur le design validé. Il s'active quand la migration `20261009_seo_admin.sql` est appliquée
> dans Supabase ; chaque source de données s'allume avec sa variable dans Vercel (§ 5). Une seule tâche planifiée : `GET /api/cron/seo` toutes les 15 minutes.

## 1. Constat

### Ce que le fondateur utilise vraiment de PushRank (relevé du 07/10/2026)
- Compte **en période d'essai** (quotas 5 articles, 30 actions, 4 réanalyses ; 10 crédits IA) : la date de fin n'est pas visible par l'API, elle est dans PushRank › Paramètres › Facturation.
- **Utilisé** : lecture de Search Console (instantanés sur 28 jours, résumé), liste d'actions (151 constats : 45 de l'exploration du site, 21 recommandations IA, 13 de Search Console), 63 mots-clés suivis, profil d'entreprise et contexte éditorial, réception d'articles par le webhook CMS.
- **Jamais utilisé** : plan de contenu, génération d'articles par PushRank, publication planifiée, réanalyse de page.
- **Rien d'irremplaçable chez PushRank** : ses données de recherche viennent de Google. Après un export (mots-clés, statuts d'actions, profil), la résiliation ne perd rien.
- Correction d'une première analyse : les volumes de recherche ne sont pas vides chez PushRank (volume cumulé de 2 788 pour 63 mots-clés). Sans source payante, l'onglet n'aurait pas cette colonne.

### Ce que l'admin avait déjà
Blog (liste, édition), générateur Gemini (74 sujets en rotation, cron quotidien, interrupteur de publication automatique), contrôle des articles (10 règles, `lib/blog-audit.ts`),
réception des articles PushRank (webhook), statistiques PostHog, santé du système, historique des tâches planifiées (`cron_logs`), réglages (`app_settings`).
**Manquait** : aucune connexion à Search Console (seulement la balise de vérification), aucune exploration du site, aucune liste de mots-clés, aucun plan de contenu, aucun suivi de la visibilité dans les IA.

## 2. Équivalences et sources de données

| PushRank | À construire dans l'admin | Source | Remplaçable |
|---|---|---|---|
| Performance, résumé | Page Performance : clics, impressions, CTR, position par page et requête, comparaison de périodes ; résumé hebdomadaire par Gemini | API Search Console (gratuite, compte de service, 25 000 lignes par requête) | Oui |
| Mots-clés | Table de mots-clés alimentée par les requêtes réelles, statut, page cible ; volumes selon décision | Search Console ; volumes : DataForSEO (environ 60 $ le million de mots-clés) | Oui, volumes payants |
| Actions SEO | Exploration du sitemap + règles (page gagnante, en baisse, bien classée sans clic) | Notre site + Search Console | Oui |
| Ré-analyse de page | Vitesse mobile (LCP) et contrôles de la page | API PageSpeed (gratuite avec clé, environ 25 000 requêtes par jour) | En partie |
| Plan de contenu, articles | Calendrier, sujets, préférences, génération pilotée par les paramètres | Blog + Gemini | Risque de qualité (voir § 5) |
| Visibilité IA | Suivi par moteur, voir § 3 | API des moteurs | Possible |
| Backlinks | — | Index payant | Non |
| Maillage, Google Business Profile | — (grisés chez PushRank lui-même, sans objet) | — | Hors périmètre |

Historique : l'API Search Console permet de reprendre 16 mois dès le premier lancement (PushRank n'en montre que 28 jours). Les données sont enregistrées chaque jour.

## 3. Suivi de la visibilité dans les IA (GEO)

**Principe** (celui de PushRank : 10 questions × 5 moteurs, relevé mensuel) : une table de questions ; pour chaque moteur, appel de son API avec la recherche web activée (sans elle, la réponse ne reflète pas le web) ;
détection de la **mention** (marque nommée dans le texte) et de la **citation** (domaine dans les sources) pour qonforme.fr et les concurrents ; stockage de la réponse complète, des sources et des scores ;
relevé mensuel + « Analyse immédiate ». Chaque question est lancée **3 fois** par moteur (réponses non déterministes) : on affiche un taux, lu comme une tendance.

| Moteur | Comment | Sources récupérées | Coût relevé (sources tierces, à confirmer sur les pages officielles) |
|---|---|---|---|
| Gemini | API avec « Grounding with Google Search » (clé déjà présente) | Oui, liens de redirection Google à suivre pour connaître le site | environ 5 000 requêtes gratuites par mois, puis 14 $ le millier |
| ChatGPT | API OpenAI, outil `web_search` | Oui (annotations `url_citation`) | 10 $ ou 25 $ le millier d'appels selon le modèle |
| Claude | API Anthropic, outil de recherche web | Oui | 10 $ le millier de recherches, plus les jetons |
| Perplexity | API Sonar | Oui | 5 à 12 $ le millier de requêtes, plus les jetons |
| Aperçu IA Google | Aucune API officielle : service de lecture des pages de résultats (DataForSEO) | Oui | quelques centimes par requête (prix exact à confirmer) |

Ordre recommandé : Gemini (gratuit) et ChatGPT (le plus grand public), puis Perplexity, Claude et l'Aperçu IA. Un relevé de 10 questions sur 4 moteurs fait 40 appels : environ 2 € au plus (calcul à vérifier à l'usage).
**Limites** : l'API n'est pas l'application grand public ; l'Aperçu IA de Google n'est pas Gemini ; le premier relevé sera à 0 % (238 impressions en 28 jours). L'intérêt immédiat est la **carte des sources citées** pour nos questions.
**Concurrents** (tolteck.com, constructor.co, btp.inprocess.ai, mediabat.com) : usage interne uniquement, jamais transmis au générateur d'articles ni publiés (règle de `CLAUDE.md`) ; un test le vérifiera.
Le site est déjà ouvert aux robots des IA (`app/robots.ts` autorise tout) ; pas de `llms.txt` (utilité non démontrée, pas prioritaire).

## 4. L'onglet, écran par écran (d'après les captures PushRank du fondateur)

Groupe « SEO » dans la barre latérale de l'admin (entre « Suivi » et « Contenu ») : **Vue d'ensemble · Performance · Actions SEO · Mots-clés · Articles · Visibilité IA · Paramètres**.
Sur téléphone, le groupe se trouve dans la feuille « Plus » et un sélecteur de rubriques défile sous le titre.

- **Vue d'ensemble** : 4 indicateurs (clics, impressions, taux de clic, position) avec comparaison, courbe sur 28 jours, priorités, raccourcis « Lancer l'analyse » et « Générer un article ».
- **Performance** : Recherche Google (pages, requêtes) · PageSpeed Insights · Audit du site.
- **Actions SEO** : pages à améliorer (constats), détail d'un constat, marquer fait, vérifier le résultat à 14 jours, historique des 24 actions faites.
- **Mots-clés** : 63 mots-clés suivis, statuts (candidat, ciblé, couvert, ignoré), page cible, volumes, délai avant la prochaine recherche (2 novembre).
- **Articles** : Calendrier · Articles · Sujets · Préférences ; fenêtre « Générer un article ».
- **Visibilité IA** : score par moteur, comparaison aux concurrents (interne), questions suivies, détail d'une question, « Gérer le suivi ».
- **Paramètres** : Contexte de marque (avec « Preuves ») · Stratégie SEO · Ciblage · Connexions (Search Console, PageSpeed, moteurs IA, volumes ; le webhook PushRank a été retiré le 09/10/2026) · Rapports (résumé hebdomadaire, facultatif).
- Ce qu'on ne reprend pas : quotas d'essai, crédits IA, formule payante, Maillage, Google Business Profile, Backlinks, mascotte et fonds dégradés.

## 5. Lots de construction

| Lot | Contenu | Prérequis côté fondateur |
|---|---|---|
| 0 | Accès Google et comptes d'API ; correctifs du plan du site et du titre répété (faits le 09/10/2026, § 7) | Compte de service Google Cloud (Search Console + PageSpeed), ajouté comme utilisateur de la propriété `sc-domain:qonforme.fr` ; variables dans Vercel ; comptes d'API selon décision 1 et 2 |
| 1 | Paramètres, Vue d'ensemble, Performance (Recherche Google, PageSpeed) ; synchronisation quotidienne de Search Console avec reprise de 16 mois | **Livré le 10/10/2026.** Migration SQL ; `GOOGLE_SERVICE_ACCOUNT_JSON` (Search Console), `PAGESPEED_API_KEY` |
| 2 | Mots-clés, Actions SEO, Audit du site (exploration du sitemap par paquets) | **Livré le 10/10/2026.** Migration SQL ; `DATAFORSEO_LOGIN` et `DATAFORSEO_PASSWORD` pour les volumes (facultatif) |
| 3 | Articles : calendrier, sujets, préférences, génération pilotée par les paramètres, publication planifiée | **Livré le 10/10/2026.** Migration SQL ; `ANTHROPIC_API_KEY` (rédaction ; sans elle, Gemini rédige) ; l'ancien générateur s'arrête dès la migration appliquée |
| 4 | Visibilité IA | **Livré le 10/10/2026.** Migration SQL ; `GEMINI_API_KEY` (déjà là), `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` et `ANTHROPIC_API_KEY` selon les moteurs voulus |
| 5 | Résiliation de PushRank : export, retrait de la route du webhook et de `PUSHRANK_WEBHOOK_SECRET`, déconnexion du CMS | **Code retiré le 09/10/2026** (décision du fondateur : PushRank abandonné). Reste côté fondateur : supprimer la variable dans Vercel, déconnecter le CMS et résilier chez PushRank |

Chaque lot ajoute des tables en RLS sans politique (lecture et écriture par le serveur seul, comme les autres tables sensibles) et des tâches planifiées sur cron-job.org (`CRON_SECRET`).
Contraintes de `CLAUDE.md` à respecter : kit `q-*`, aucun `backdrop-filter` ni `will-change` sur téléphone, champs à 16 px, pages admin derrière `isAdminAuthenticated`, aucune affirmation invérifiable, aucun concurrent dans un contenu public.

### Point de vigilance : la rédaction automatique
Le générateur actuel est un appel unique à Gemini : 35 articles publiés sur 62 étaient signalés par le contrôle, avec des doublons. Si la rédaction automatique est conservée : modèle plus fort, plusieurs passes (plan, rédaction, contrôle, correction),
sources officielles dans la consigne, **toujours un brouillon relu**. L'autre voie : les guides vérifiés rédigés sur sources officielles (plus lente, plus sûre). Les deux peuvent coexister.

## 6. Décisions en attente (avec recommandation)

1. **Moteurs IA au départ** : Gemini et ChatGPT, puis Perplexity et Claude.
2. **Volumes de recherche et Aperçu IA Google** : un seul compte DataForSEO pour les deux (oui).
3. **Résumé hebdomadaire par email** : facultatif (écran Paramètres › Rapports).
4. **Rédaction automatique d'articles** : brouillon à relire, jamais de publication directe sans contrôle.

## 6 bis. Choix des IA du blog (09/10/2026)
Analyse des benchmarks en ligne (rédaction, français, fiabilité, prix, images), chiffres clés revérifiés : `ANALYSE-IA-BLOG-2026-10.md`.
- **Texte, par passe** : plan et contrôle par Gemini 3.8 Flash (meilleur respect des consignes mesuré, autre famille que l'auteur), rédaction par
  Claude Opus 5.5 (dans le premier groupe des quatre classements d'écriture, le moins de tournures toutes faites). Environ 1,3 $ par mois pour 8 articles
  (1,5 à 1,8 $ en 2027). Repli : Gemini 3.8 Flash pour les trois passes si la clé Anthropic manque.
- **Images** : Nano Banana 2.1 (remplaçant désigné par Google, 0,05 $ l'image en 2K), repli sur Gemini 3.1 Flash Image ; GPT Image 2 en secours possible
  (meilleur sur les portraits, clé OpenAI) après un essai sur 10 scènes de chantier.
- **Le risque principal reste factuel**, quel que soit le modèle : faits de référence vérifiés dans chaque consigne, relecture par une autre famille de
  modèles, contrôle `lib/blog-audit.ts` et brouillon à relire.

## 7. Défauts constatés sur l'article PushRank du 07/10 (corrigés le 09/10/2026)
- Absent du plan du site : `app/sitemap.ts` était mis en cache (environ 28 h). Corrigé : recalcul horaire et `revalidateBlog()` (`lib/blog-revalidate.ts`)
  après chaque publication, modification ou suppression d'article (admin du blog, générateurs).
- Titre répété : le contenu commençait par le titre que la page affiche déjà. Corrigé à l'affichage pour tous les articles (`stripLeadingTitle`
  dans `lib/blog-utils.ts`), y compris cet article reçu avant le correctif.

## 8. Sources
- Anthropic, recherche web : https://simonwillison.net/2025/May/7/anthropic-api-search
- OpenAI, outil de recherche web : https://developers.openai.com/docs/guides/tools-web-search
- Gemini, tarifs : https://ai.google.dev/gemini-api/docs/pricing ; sources du grounding : https://developers.googleblog.com/en/gemini-api-and-ai-studio-now-offer-grounding-with-google-search/
- Perplexity, tarifs : https://docs.perplexity.ai/guides/pricing
- DataForSEO : https://dataforseo.com/keyword-planner-api · https://dataforseo.com/update/ai-overview-in-google-serp-api · https://dataforseo.com/pricing/serp/serp-api
- Search Console, 25 000 lignes par requête : https://searchengineland.com/google-search-console-search-analytics-api-now-gives-you-25000-rows-per-request-302015
- PageSpeed, quotas : https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api/rate-limits
