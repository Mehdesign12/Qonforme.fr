-- Articles reçus de PushRank par webhook (app/api/pushrank/webhook/route.ts)
--
-- source               : « pushrank » pour ces articles ; seuls ceux-là peuvent être
--                        modifiés ou retirés par le webhook.
-- external_create_key  : clé X-PushRank-Idempotency-Key de l'événement de création.
--                        Unique : un renvoi du même événement rend le même article.
-- seo_title, seo_description : balises <title> et description fournies par PushRank.
-- cover_alt            : texte alternatif de la couverture.
-- cover_source_url     : URL d'origine de la couverture, pour ne la re-télécharger
--                        que si elle change.
-- robots               : directives d'indexation ({ index, follow, noSnippet, noArchive }).
-- held_reason          : pourquoi l'article est resté en brouillon (contrôle du blog).
--
-- Rejouable. Tant qu'elle n'est pas appliquée, le webhook répond 503
-- « migration_pending » (PushRank réessaie) et le blog fonctionne comme avant.

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS source              text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS external_create_key text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_title           text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_description     text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_alt           text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_source_url    text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS robots              jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS held_reason         text;

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_external_create_key_key ON blog_posts (external_create_key);
CREATE INDEX IF NOT EXISTS blog_posts_source_idx ON blog_posts (source);
