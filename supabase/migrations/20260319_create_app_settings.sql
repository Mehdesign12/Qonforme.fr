-- Table clé-valeur pour les settings admin (contrôlables depuis le panel)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valeur par défaut pour blog_auto_publish
INSERT INTO app_settings (key, value)
VALUES ('blog_auto_publish', 'true')
ON CONFLICT (key) DO NOTHING;
