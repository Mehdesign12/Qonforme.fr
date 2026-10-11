-- Onglet SEO : tables fermées aux rôles publics (défense en profondeur).
--
-- Contrôle du 11/10/2026 après la migration 20261009_seo_admin.sql : avec la clé
-- publique (anon), les 17 tables seo_* répondaient 200 [] et non un refus. Seule
-- la RLS sans politique masquait les lignes ; les droits accordés par défaut par
-- Supabase aux rôles anon et authenticated restaient en place. Une politique trop
-- large ajoutée un jour, ou une RLS désactivée par erreur, aurait suffi à les
-- ouvrir au navigateur. Ces tables ne sont lues et écrites que par le serveur
-- (clé service_role, lib/seo/db.ts) : on retire tout droit aux rôles publics,
-- comme pour blog_posts.
--
-- Rejouable. Sans effet sur l'onglet SEO, qui passe par service_role.

REVOKE ALL ON TABLE
  seo_settings,
  seo_jobs,
  seo_gsc_daily,
  seo_gsc_pages,
  seo_gsc_queries,
  seo_gsc_query_pages,
  seo_pagespeed,
  seo_crawl_runs,
  seo_crawl_pages,
  seo_findings,
  seo_keywords,
  seo_topics,
  seo_article_jobs,
  seo_geo_questions,
  seo_geo_runs,
  seo_geo_answers,
  seo_digests
FROM anon, authenticated;
