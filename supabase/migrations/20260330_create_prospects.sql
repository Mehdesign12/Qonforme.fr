-- ============================================================
-- Table prospects : base de données B2B extraite via API Sirene
-- ============================================================

CREATE TABLE public.prospects (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  siren             TEXT        NOT NULL,
  siret             TEXT        UNIQUE NOT NULL,
  nom_entreprise    TEXT        NOT NULL,
  nom_dirigeant     TEXT,
  activite          TEXT,                     -- libellé activité (ex: "Travaux de plomberie")
  code_naf          TEXT        NOT NULL,     -- ex: "43.22A"
  metier_qonforme   TEXT,                     -- slug métier pSEO (ex: "plombier")
  adresse           TEXT,
  code_postal       TEXT,
  ville             TEXT,
  departement       TEXT,                     -- code département (ex: "75", "13")
  region            TEXT,
  date_creation     DATE,                     -- date création entreprise
  tranche_effectif  TEXT,                     -- code tranche Sirene (ex: "00", "01")
  site_web          TEXT,
  email             TEXT,
  telephone         TEXT,
  email_source      TEXT,                     -- 'sirene' | 'scraping' | 'dropcontact' | 'hunter'
  email_verified    BOOLEAN     DEFAULT false,
  statut            TEXT        DEFAULT 'nouveau'
                    CHECK (statut IN ('nouveau','contacte','relance_1','relance_2','converti','desabonne')),
  campagne_id       TEXT,
  date_scrape       TIMESTAMPTZ DEFAULT NOW(),
  date_enrichment   TIMESTAMPTZ,
  date_contact      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX prospects_code_naf_idx       ON public.prospects (code_naf);
CREATE INDEX prospects_departement_idx    ON public.prospects (departement);
CREATE INDEX prospects_metier_idx         ON public.prospects (metier_qonforme);
CREATE INDEX prospects_statut_idx         ON public.prospects (statut);
CREATE INDEX prospects_email_verified_idx ON public.prospects (email_verified);
CREATE INDEX prospects_created_at_idx     ON public.prospects (created_at DESC);
CREATE INDEX prospects_email_idx          ON public.prospects (email) WHERE email IS NOT NULL;

-- RLS : accès uniquement via service_role (admin)
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at_trigger
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION update_prospects_updated_at();


-- ============================================================
-- Table scraping_runs : suivi des exécutions d'extraction
-- ============================================================

CREATE TABLE public.scraping_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  type            TEXT        NOT NULL
                  CHECK (type IN ('sirene','email_scrape','enrichment')),
  metier          TEXT,                       -- slug métier traité
  code_naf        TEXT,                       -- code NAF traité
  total_found     INTEGER     DEFAULT 0,
  total_inserted  INTEGER     DEFAULT 0,
  total_skipped   INTEGER     DEFAULT 0,
  error_message   TEXT,
  duration_ms     INTEGER,
  status          TEXT        DEFAULT 'running'
                  CHECK (status IN ('running','completed','error'))
);

CREATE INDEX scraping_runs_created_at_idx ON public.scraping_runs (created_at DESC);
CREATE INDEX scraping_runs_type_idx       ON public.scraping_runs (type);
CREATE INDEX scraping_runs_metier_idx     ON public.scraping_runs (metier);

-- RLS : accès uniquement via service_role (admin)
ALTER TABLE public.scraping_runs ENABLE ROW LEVEL SECURITY;
