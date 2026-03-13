-- Table pour les articles de blog gérés depuis l'espace admin
-- Lecture publique pour les articles publiés, écriture via service role uniquement

CREATE TABLE IF NOT EXISTS blog_posts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  excerpt      text,
  content      text NOT NULL DEFAULT '',  -- Markdown
  cover_url    text,
  is_published boolean DEFAULT false NOT NULL,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS blog_posts_slug_idx         ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx    ON blog_posts (is_published, published_at DESC);

-- RLS : lecture publique des articles publiés
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published posts" ON blog_posts
  FOR SELECT USING (is_published = true);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();
