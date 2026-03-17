-- Blog AI automation columns
-- Adds tracking columns for AI-generated blog posts

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS ai_generated    boolean DEFAULT false;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS ai_model        text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS ai_prompt       text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS ai_keywords     text[];
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS auto_publish    boolean DEFAULT false;
