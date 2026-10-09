-- Onglet SEO de l'admin (PLAN-SEO-INTERNE-2026-10.md) : remplace PushRank.
--
-- Tables lues et écrites par le serveur seul (clé service_role) : RLS activée,
-- aucune politique, comme les autres tables sensibles. Les fonctions SQL ne
-- s'exécutent qu'avec la clé service_role.
--
-- Rejouable. Tant qu'elle n'est pas appliquée, l'onglet SEO affiche « Cette
-- section s'active après la mise à jour de la base de données » et le reste du
-- site fonctionne comme avant (lib/supabase/schema-guard.ts).

-- ═════════════════════════════════════════════════════════════════════════
-- 1. Réglages et tâches planifiées
-- ═════════════════════════════════════════════════════════════════════════

-- Réglages de l'onglet, une ligne par écran (« brand », « strategy »,
-- « targeting », « articles », « geo », « reports », « pagespeed »…).
-- Valeurs par défaut dans lib/seo/settings.ts : une clé absente n'est pas une erreur.
CREATE TABLE IF NOT EXISTS seo_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- État des tâches de /api/cron/seo (lib/seo/cron.ts) : verrou, curseur de
-- reprise, dernier résultat.
CREATE TABLE IF NOT EXISTS seo_jobs (
  name        text        PRIMARY KEY,
  status      text        NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'ok', 'error')),
  started_at  timestamptz,
  finished_at timestamptz,
  last_ok_at  timestamptz,
  lock_until  timestamptz,
  cursor      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result      jsonb,
  error       text
);

-- ═════════════════════════════════════════════════════════════════════════
-- 2. Search Console (lib/seo/search-console/)
-- ═════════════════════════════════════════════════════════════════════════
-- device  : DESKTOP | MOBILE | TABLET (valeurs de Search Console)
-- country : code ISO 3166-1 alpha-3 en minuscules (« fra »)
-- page    : chemin de la page (« /modele »), sans le domaine
-- position: position moyenne de la ligne ; les agrégats la pondèrent par les impressions

CREATE TABLE IF NOT EXISTS seo_gsc_daily (
  date        date             NOT NULL,
  device      text             NOT NULL,
  country     text             NOT NULL,
  clicks      integer          NOT NULL DEFAULT 0,
  impressions integer          NOT NULL DEFAULT 0,
  position    double precision NOT NULL DEFAULT 0,
  synced_at   timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (date, device, country)
);

CREATE TABLE IF NOT EXISTS seo_gsc_pages (
  date        date             NOT NULL,
  page        text             NOT NULL,
  device      text             NOT NULL,
  country     text             NOT NULL,
  clicks      integer          NOT NULL DEFAULT 0,
  impressions integer          NOT NULL DEFAULT 0,
  position    double precision NOT NULL DEFAULT 0,
  synced_at   timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (date, page, device, country)
);

CREATE TABLE IF NOT EXISTS seo_gsc_queries (
  date        date             NOT NULL,
  query       text             NOT NULL,
  device      text             NOT NULL,
  country     text             NOT NULL,
  clicks      integer          NOT NULL DEFAULT 0,
  impressions integer          NOT NULL DEFAULT 0,
  position    double precision NOT NULL DEFAULT 0,
  synced_at   timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (date, query, device, country)
);

-- Couple requête × page, tous appareils et pays confondus : la page qui répond
-- à un mot-clé.
CREATE TABLE IF NOT EXISTS seo_gsc_query_pages (
  date        date             NOT NULL,
  query       text             NOT NULL,
  page        text             NOT NULL,
  clicks      integer          NOT NULL DEFAULT 0,
  impressions integer          NOT NULL DEFAULT 0,
  position    double precision NOT NULL DEFAULT 0,
  synced_at   timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (date, query, page)
);

CREATE INDEX IF NOT EXISTS seo_gsc_pages_page_idx        ON seo_gsc_pages (page, date);
CREATE INDEX IF NOT EXISTS seo_gsc_queries_query_idx     ON seo_gsc_queries (query, date);
CREATE INDEX IF NOT EXISTS seo_gsc_query_pages_query_idx ON seo_gsc_query_pages (query, date);

-- Agrégats sur une période (p_device, p_country : NULL = tous).
CREATE OR REPLACE FUNCTION seo_gsc_totals(p_from date, p_to date, p_device text DEFAULT NULL, p_country text DEFAULT NULL)
RETURNS TABLE (clicks bigint, impressions bigint, avg_position double precision)
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(d.clicks), 0)::bigint,
         COALESCE(SUM(d.impressions), 0)::bigint,
         CASE WHEN COALESCE(SUM(d.impressions), 0) = 0 THEN NULL
              ELSE SUM(d.position * d.impressions) / SUM(d.impressions) END
  FROM seo_gsc_daily d
  WHERE d.date BETWEEN p_from AND p_to
    AND (p_device IS NULL OR d.device = p_device)
    AND (p_country IS NULL OR d.country = p_country)
$$;

CREATE OR REPLACE FUNCTION seo_gsc_by_date(p_from date, p_to date, p_device text DEFAULT NULL, p_country text DEFAULT NULL)
RETURNS TABLE (date date, clicks bigint, impressions bigint, avg_position double precision)
LANGUAGE sql STABLE AS $$
  SELECT d.date,
         SUM(d.clicks)::bigint,
         SUM(d.impressions)::bigint,
         CASE WHEN SUM(d.impressions) = 0 THEN NULL
              ELSE SUM(d.position * d.impressions) / SUM(d.impressions) END
  FROM seo_gsc_daily d
  WHERE d.date BETWEEN p_from AND p_to
    AND (p_device IS NULL OR d.device = p_device)
    AND (p_country IS NULL OR d.country = p_country)
  GROUP BY d.date
  ORDER BY d.date
$$;

CREATE OR REPLACE FUNCTION seo_gsc_by_page(p_from date, p_to date, p_device text DEFAULT NULL, p_country text DEFAULT NULL)
RETURNS TABLE (page text, clicks bigint, impressions bigint, avg_position double precision)
LANGUAGE sql STABLE AS $$
  SELECT p.page,
         SUM(p.clicks)::bigint,
         SUM(p.impressions)::bigint,
         CASE WHEN SUM(p.impressions) = 0 THEN NULL
              ELSE SUM(p.position * p.impressions) / SUM(p.impressions) END
  FROM seo_gsc_pages p
  WHERE p.date BETWEEN p_from AND p_to
    AND (p_device IS NULL OR p.device = p_device)
    AND (p_country IS NULL OR p.country = p_country)
  GROUP BY p.page
  ORDER BY SUM(p.impressions) DESC, p.page
$$;

CREATE OR REPLACE FUNCTION seo_gsc_by_query(p_from date, p_to date, p_device text DEFAULT NULL, p_country text DEFAULT NULL)
RETURNS TABLE (query text, clicks bigint, impressions bigint, avg_position double precision)
LANGUAGE sql STABLE AS $$
  SELECT q.query,
         SUM(q.clicks)::bigint,
         SUM(q.impressions)::bigint,
         CASE WHEN SUM(q.impressions) = 0 THEN NULL
              ELSE SUM(q.position * q.impressions) / SUM(q.impressions) END
  FROM seo_gsc_queries q
  WHERE q.date BETWEEN p_from AND p_to
    AND (p_device IS NULL OR q.device = p_device)
    AND (p_country IS NULL OR q.country = p_country)
  GROUP BY q.query
  ORDER BY SUM(q.impressions) DESC, q.query
$$;

CREATE OR REPLACE FUNCTION seo_gsc_query_pages_agg(p_from date, p_to date)
RETURNS TABLE (query text, page text, clicks bigint, impressions bigint, avg_position double precision)
LANGUAGE sql STABLE AS $$
  SELECT qp.query,
         qp.page,
         SUM(qp.clicks)::bigint,
         SUM(qp.impressions)::bigint,
         CASE WHEN SUM(qp.impressions) = 0 THEN NULL
              ELSE SUM(qp.position * qp.impressions) / SUM(qp.impressions) END
  FROM seo_gsc_query_pages qp
  WHERE qp.date BETWEEN p_from AND p_to
  GROUP BY qp.query, qp.page
  ORDER BY qp.query, SUM(qp.impressions) DESC
$$;

-- Bornes des données enregistrées (premier et dernier jour).
CREATE OR REPLACE FUNCTION seo_gsc_bounds()
RETURNS TABLE (first_date date, last_date date)
LANGUAGE sql STABLE AS $$
  SELECT MIN(d.date), MAX(d.date) FROM seo_gsc_daily d
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 3. PageSpeed Insights (lib/seo/pagespeed/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_pagespeed (
  id                uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  path              text             NOT NULL,
  strategy          text             NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  measured_at       timestamptz      NOT NULL DEFAULT now(),
  source            text             NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'import')),
  note              text,
  performance_score smallint,        -- 0 à 100 (laboratoire)
  lcp_ms            integer,
  cls               double precision,
  tbt_ms            integer,
  fcp_ms            integer,
  si_ms             integer,
  unused_js_bytes   integer,
  field             jsonb,           -- données terrain (Chrome UX Report) quand elles existent
  error             text
);
CREATE INDEX IF NOT EXISTS seo_pagespeed_path_idx ON seo_pagespeed (path, strategy, measured_at DESC);

-- ═════════════════════════════════════════════════════════════════════════
-- 4. Audit du site : exploration du plan du site (lib/seo/audit/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_crawl_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  trigger     text        NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'manual')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pages_total integer     NOT NULL DEFAULT 0,
  pages_done  integer     NOT NULL DEFAULT 0,
  cursor      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  summary     jsonb,
  error       text
);
CREATE INDEX IF NOT EXISTS seo_crawl_runs_started_idx ON seo_crawl_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS seo_crawl_pages (
  run_id         uuid        NOT NULL REFERENCES seo_crawl_runs (id) ON DELETE CASCADE,
  path           text        NOT NULL,
  status_code    integer,
  redirect_to    text,
  title          text,
  description    text,
  h1_count       integer,
  h1             text,
  canonical      text,
  robots         text,
  noindex        boolean     NOT NULL DEFAULT false,
  internal_links text[]      NOT NULL DEFAULT '{}',
  word_count     integer,
  issues         text[]      NOT NULL DEFAULT '{}',
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  error          text,
  PRIMARY KEY (run_id, path)
);

-- ═════════════════════════════════════════════════════════════════════════
-- 5. Actions SEO : constats et suivi (lib/seo/actions/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_findings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule           text        NOT NULL,             -- règle de lib/seo/actions/rules.ts (« manual » : saisie ou import)
  path           text        NOT NULL,
  page_type      text,                             -- lib/seo/site.ts (pageTypeOf)
  title          text        NOT NULL,             -- « Page bien classée sans clic »
  explanation    text,                             -- « 122 impressions, 0 clic, position 6,2 »
  recommendation text,
  severity       text        NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  source         text        NOT NULL DEFAULT 'search_console' CHECK (source IN ('search_console', 'crawl', 'ai', 'import')),
  effort_minutes integer,
  metrics        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  suggestion     text,                             -- proposition rédigée par l'IA, à relire
  status         text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'ignored', 'resolved')),
  detected_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  done_at        timestamptz,
  ignored_at     timestamptz,
  resolved_at    timestamptz,
  verify_after   timestamptz,                      -- fait + 14 jours
  verification   jsonb,                            -- mesure avant / après
  history        jsonb       NOT NULL DEFAULT '[]'::jsonb
);
-- Un seul constat ouvert par règle et par page.
CREATE UNIQUE INDEX IF NOT EXISTS seo_findings_open_key ON seo_findings (rule, path) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS seo_findings_status_idx ON seo_findings (status, detected_at DESC);

-- ═════════════════════════════════════════════════════════════════════════
-- 6. Mots-clés (lib/seo/keywords/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_keywords (
  id                 uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword            text             NOT NULL UNIQUE,  -- en minuscules, espaces réduits (lib/seo/keywords)
  status             text             NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'targeted', 'covered', 'ignored')),
  intent             text             CHECK (intent IN ('informational', 'transactional', 'navigational', 'commercial')),
  source             text             NOT NULL DEFAULT 'manual' CHECK (source IN ('search_console', 'manual', 'suggestion', 'import')),
  target_path        text,
  notes              text,
  volume             integer,
  difficulty         smallint,
  cpc                numeric(8, 2),
  metrics_checked_at timestamptz,
  position           double precision,
  impressions        integer,
  clicks             integer,
  gsc_updated_at     timestamptz,
  created_at         timestamptz      NOT NULL DEFAULT now(),
  updated_at         timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_keywords_status_idx ON seo_keywords (status);

-- ═════════════════════════════════════════════════════════════════════════
-- 7. Articles : sujets, génération, publication planifiée (lib/seo/articles/)
-- ═════════════════════════════════════════════════════════════════════════
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS article_type   text;         -- howto | guide | news | faq
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS target_keyword text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at   timestamptz;  -- publication planifiée (brouillon jusque-là)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS review_status  text;         -- NULL | to_review | approved
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS audit_result   jsonb;        -- passages repérés par lib/blog-audit.ts
CREATE INDEX IF NOT EXISTS blog_posts_scheduled_idx ON blog_posts (scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS seo_topics (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  keyword         text,
  article_type    text        NOT NULL DEFAULT 'guide' CHECK (article_type IN ('howto', 'guide', 'news', 'faq')),
  angle           text,
  notes           text,
  source          text        NOT NULL DEFAULT 'manual' CHECK (source IN ('keyword', 'action', 'manual', 'pushrank', 'visibility')),
  keyword_id      uuid        REFERENCES seo_keywords (id) ON DELETE SET NULL,
  finding_id      uuid        REFERENCES seo_findings (id) ON DELETE SET NULL,
  geo_question_id uuid,
  status          text        NOT NULL DEFAULT 'unplanned' CHECK (status IN ('unplanned', 'planned', 'generating', 'drafted', 'published', 'failed', 'archived')),
  scheduled_at    timestamptz,
  publish_mode    text        NOT NULL DEFAULT 'draft' CHECK (publish_mode IN ('draft', 'after_check', 'direct')),
  post_id         uuid        REFERENCES blog_posts (id) ON DELETE SET NULL,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_topics_status_idx    ON seo_topics (status);
CREATE INDEX IF NOT EXISTS seo_topics_scheduled_idx ON seo_topics (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Rédaction en plusieurs passes (plan, rédaction, contrôle, correction, image),
-- reprise d'une passe à l'autre.
CREATE TABLE IF NOT EXISTS seo_article_jobs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   uuid        REFERENCES seo_topics (id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  step       text        NOT NULL DEFAULT 'plan',
  state      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  model      text,
  attempts   integer     NOT NULL DEFAULT 0,
  error      text,
  post_id    uuid        REFERENCES blog_posts (id) ON DELETE SET NULL,
  lock_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_article_jobs_status_idx ON seo_article_jobs (status, created_at);

-- ═════════════════════════════════════════════════════════════════════════
-- 8. Visibilité IA (lib/seo/geo/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_geo_questions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  position   integer     NOT NULL DEFAULT 0,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_geo_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text        NOT NULL CHECK (kind IN ('monthly', 'immediate', 'import')),
  status      text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  engines     text[]      NOT NULL DEFAULT '{}',
  repetitions smallint    NOT NULL DEFAULT 3,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  summary     jsonb,      -- taux par moteur et par domaine (lib/seo/geo)
  note        text
);
CREATE INDEX IF NOT EXISTS seo_geo_runs_created_idx ON seo_geo_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS seo_geo_answers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid        NOT NULL REFERENCES seo_geo_runs (id) ON DELETE CASCADE,
  question_id           uuid        REFERENCES seo_geo_questions (id) ON DELETE SET NULL,
  question              text        NOT NULL,  -- copie de la question au moment du relevé
  engine                text        NOT NULL,  -- gemini | chatgpt | perplexity | claude | google_ai_overview
  repetition            smallint    NOT NULL DEFAULT 1,
  status                text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  answer                text,
  sources               jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{ url, domain, title }]
  brand_mentioned       boolean,
  site_cited            boolean,
  competitors_mentioned text[]      NOT NULL DEFAULT '{}',
  competitors_cited     text[]      NOT NULL DEFAULT '{}',
  model                 text,
  attempts              smallint    NOT NULL DEFAULT 0,
  lock_until            timestamptz,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  done_at               timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS seo_geo_answers_key ON seo_geo_answers (run_id, question_id, engine, repetition);
CREATE INDEX IF NOT EXISTS seo_geo_answers_pending_idx ON seo_geo_answers (status, created_at) WHERE status IN ('pending', 'running');

-- ═════════════════════════════════════════════════════════════════════════
-- 9. Résumé hebdomadaire par email (lib/seo/reports/)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS seo_digests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text        NOT NULL UNIQUE,   -- « 2026-W41 » ; « preview-<horodatage> » pour un aperçu
  kind       text        NOT NULL DEFAULT 'weekly' CHECK (kind IN ('weekly', 'preview')),
  status     text        NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  subject    text,
  payload    jsonb,
  error      text,
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═════════════════════════════════════════════════════════════════════════
-- 10. Accès : serveur seul
-- ═════════════════════════════════════════════════════════════════════════
ALTER TABLE seo_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_queries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_query_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_pagespeed       ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_crawl_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_crawl_pages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_findings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_article_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_geo_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_geo_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_geo_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_digests         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION seo_gsc_totals(date, date, text, text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION seo_gsc_by_date(date, date, text, text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION seo_gsc_by_page(date, date, text, text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION seo_gsc_by_query(date, date, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION seo_gsc_query_pages_agg(date, date)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION seo_gsc_bounds()                         FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seo_gsc_totals(date, date, text, text)   TO service_role;
GRANT EXECUTE ON FUNCTION seo_gsc_by_date(date, date, text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION seo_gsc_by_page(date, date, text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION seo_gsc_by_query(date, date, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION seo_gsc_query_pages_agg(date, date)      TO service_role;
GRANT EXECUTE ON FUNCTION seo_gsc_bounds()                         TO service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- 11. Reprise de l'existant (PushRank et journal du dépôt), une seule fois
-- ═════════════════════════════════════════════════════════════════════════

-- Questions suivies dans les IA (relevé PushRank du 28 sept. 2026, plus deux proposées).
INSERT INTO seo_geo_questions (question, position)
SELECT q.question, q.position
FROM (VALUES
  ('Quel logiciel de devis et de facturation est le plus adapté aux artisans du bâtiment en France ?', 1),
  ('Comment gérer des devis et des factures pour plusieurs chantiers au quotidien avec un seul outil ?', 2),
  ('Peut-on faire des devis gratuits et illimités avec un logiciel de devis pour artisans du bâtiment ?', 3),
  ('Quelles sont les mentions obligatoires à inclure sur une facture d''artisan en France ?', 4),
  ('Comment éviter les erreurs de facturation grâce aux mentions obligatoires et aux modèles ?', 5),
  ('Comment automatiser l''envoi de relances pour les factures impayées ?', 6),
  ('Comment générer un devis en PDF prêt à envoyer à un client ?', 7),
  ('Comment créer un modèle de facture et le réutiliser pour chaque nouveau client ?', 8),
  ('Quelle plateforme agréée choisir pour la facture électronique quand on est artisan ?', 9),
  ('Quel taux de TVA appliquer sur des travaux de rénovation chez un particulier ?', 10)
) AS q (question, position)
WHERE NOT EXISTS (SELECT 1 FROM seo_geo_questions);

-- Relevé importé de PushRank (28 sept. 2026) : taux seulement, réponses non conservées.
INSERT INTO seo_geo_runs (kind, status, engines, repetitions, created_at, started_at, finished_at, summary, note)
SELECT 'import', 'done',
       ARRAY['chatgpt', 'claude', 'gemini', 'perplexity', 'google_ai_overview'], 1,
       '2026-09-28T12:00:00Z', '2026-09-28T12:00:00Z', '2026-09-28T12:00:00Z',
       '{
          "questions": 8,
          "engines": {
            "chatgpt":            { "mention_rate": 0, "citation_rate": 0, "mentions": 0, "citations": 0, "answers": 10 },
            "claude":             { "mention_rate": 0, "citation_rate": 0, "mentions": 0, "citations": 0, "answers": 10 },
            "gemini":             { "mention_rate": 0, "citation_rate": 0, "mentions": 0, "citations": 0, "answers": 10 },
            "perplexity":         { "mention_rate": 0, "citation_rate": 0, "mentions": 0, "citations": 0, "answers": 10 },
            "google_ai_overview": { "mention_rate": 0, "citation_rate": 0, "mentions": 0, "citations": 0, "answers": 10 }
          },
          "overall": { "mention_rate": 0, "citation_rate": 0 },
          "domains": {
            "qonforme.fr":      { "mention_rate": null, "citation_rate": 0 },
            "constructor.co":   { "mention_rate": null, "citation_rate": 0.10 },
            "tolteck.com":      { "mention_rate": null, "citation_rate": 0.06 },
            "mediabat.com":     { "mention_rate": null, "citation_rate": 0.04 },
            "btp.inprocess.ai": { "mention_rate": null, "citation_rate": 0 }
          }
        }'::jsonb,
       'Relevé importé de PushRank : taux seulement, mentions par domaine non mesurées.'
WHERE NOT EXISTS (SELECT 1 FROM seo_geo_runs WHERE kind = 'import');

-- Mots-clés déjà suivis dans PushRank et dont les valeurs sont connues (les autres
-- reviennent de Search Console à la première synchronisation).
INSERT INTO seo_keywords (keyword, status, intent, source, target_path, volume, difficulty, cpc)
VALUES
  ('devis modele',                            'covered',   'transactional', 'import', '/modele', NULL, 3,  3.11),
  ('modele devis',                            'covered',   'informational', 'import', '/modele', NULL, 0,  3.11),
  ('factures mentions obligatoires',          'covered',   'informational', 'import', '/guide/mentions-obligatoires-facture', 3600, 12, NULL),
  ('logiciel devis facturation',              'targeted',  'transactional', 'import', '/', 1600, NULL, NULL),
  ('modeles factures',                        'candidate', 'transactional', 'import', '/modele', NULL, 0,  2.78),
  ('modele facture',                          'covered',   'transactional', 'import', '/modele', NULL, 0,  2.78),
  ('comptabilité pour fleuriste',             'covered',   NULL,            'import', '/facturation/fleuriste', NULL, NULL, NULL),
  ('plateforme agréée e-facture',             'covered',   NULL,            'import', '/guide/plateforme-agreee', NULL, NULL, NULL),
  ('comment faire un devis artisan',          'covered',   NULL,            'import', '/guide/comment-faire-un-devis', NULL, NULL, NULL),
  ('taux de tva travaux',                     'covered',   NULL,            'import', '/guide/tva-travaux', NULL, NULL, NULL),
  ('logiciel facturation artisans',           'candidate', NULL,            'import', NULL, NULL, NULL, NULL),
  ('facture électronique bâtiment',           'candidate', NULL,            'import', '/guide/facture-electronique-2026', NULL, NULL, NULL),
  ('réforme 2027 facturation',                'candidate', NULL,            'import', NULL, NULL, NULL, NULL),
  ('relances automatiques factures',          'candidate', NULL,            'import', NULL, NULL, NULL, NULL),
  ('autoliquidation sous-traitance bâtiment', 'candidate', NULL,            'import', NULL, NULL, NULL, NULL)
ON CONFLICT (keyword) DO NOTHING;

-- Sujets d'articles proposés (à planifier : rien ne part sans décision).
INSERT INTO seo_topics (title, keyword, article_type, source, status)
SELECT t.title, t.keyword, t.article_type, 'keyword', 'unplanned'
FROM (VALUES
  ('Plateforme agréée : comment choisir en 2026', 'plateforme agréée e-facture', 'guide'),
  ('Relancer une facture impayée sans perdre le client', 'relances automatiques factures', 'howto'),
  ('Autoliquidation en sous-traitance : la mention à écrire', 'autoliquidation sous-traitance bâtiment', 'guide'),
  ('Réforme 2027 : ce qui change pour une TPE du bâtiment', 'réforme 2027 facturation', 'news'),
  ('Facture électronique : ce que l''artisan doit préparer', 'facture électronique bâtiment', 'guide')
) AS t (title, keyword, article_type)
WHERE NOT EXISTS (SELECT 1 FROM seo_topics);

-- Actions déjà faites (journal du dépôt, 4 et 5 oct. 2026).
INSERT INTO seo_findings (rule, path, page_type, title, severity, source, status, detected_at, last_seen_at, done_at, history)
SELECT 'manual', f.path, f.page_type, f.title, 'medium', 'import', 'done', f.done_at, f.done_at, f.done_at,
       jsonb_build_array(jsonb_build_object('at', f.done_at, 'event', 'done', 'note', 'Repris du journal des modifications'))
FROM (VALUES
  ('/',                      'accueil',  'Raccourcir les balises title de plus de 70 caractères', '2026-10-04T12:00:00Z'::timestamptz),
  ('/',                      'accueil',  'Réécrire les 13 descriptions Google mal calibrées',      '2026-10-04T12:00:00Z'::timestamptz),
  ('/',                      'accueil',  'Un seul H1 par page',                                     '2026-10-04T12:00:00Z'::timestamptz),
  ('/demo',                  'autre',    'Titre de /demo : tableau de bord de facturation',         '2026-10-04T12:00:00Z'::timestamptz),
  ('/plan-du-site',          'autre',    'Plan du site HTML lié dans le pied de page',              '2026-10-04T12:00:00Z'::timestamptz),
  ('/',                      'accueil',  'LCP mobile : accueil, guides, /facturation, /modele',     '2026-10-04T12:00:00Z'::timestamptz),
  ('/facturation/fleuriste', 'metier',   'Rafraîchir /facturation/fleuriste',                       '2026-10-04T12:00:00Z'::timestamptz),
  ('/modele/devis-travaux',  'modele',   'Modèle de devis travaux : nouveau titre et exemple chiffré', '2026-10-05T12:00:00Z'::timestamptz)
) AS f (path, page_type, title, done_at)
WHERE NOT EXISTS (SELECT 1 FROM seo_findings WHERE source = 'import');

-- ═════════════════════════════════════════════════════════════════════════
-- 12. Ajouts des modules (réservé : chaque module ajoute ici ses colonnes)
-- ═════════════════════════════════════════════════════════════════════════
