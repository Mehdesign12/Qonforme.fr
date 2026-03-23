-- Historique des générations Brand Studio avec métadonnées complètes
CREATE TABLE IF NOT EXISTS brand_studio_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  url TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  instructions TEXT,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_studio_generations_created
  ON brand_studio_generations (created_at DESC);

-- Valeur par défaut pour brand_guidelines dans app_settings
INSERT INTO app_settings (key, value)
VALUES ('brand_guidelines', '{
  "primary_color": "#2563EB",
  "secondary_color": "#0F172A",
  "accent_colors": ["#3B82F6", "#EFF6FF"],
  "mood": "Professional yet approachable. Modern, clean, trustworthy.",
  "target": "French artisans, craftsmen, small business owners.",
  "visual_identity": "Clean lines, blue gradients, warm human touches, French business aesthetic."
}')
ON CONFLICT (key) DO NOTHING;
