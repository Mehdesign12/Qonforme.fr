-- Ajouter la colonne onboarding_seen_at sur la table companies
-- Null = popup jamais vu, NOT NULL = popup déjà affiché
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS onboarding_seen_at TIMESTAMPTZ DEFAULT NULL;
