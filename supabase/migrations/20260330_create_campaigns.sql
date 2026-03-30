-- ============================================================
-- Table campaigns : campagnes d'outreach B2B
-- ============================================================

CREATE TABLE public.campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT        NOT NULL,
  type            TEXT        NOT NULL
                  CHECK (type IN ('alerte_reglementaire','invitation_demo','offre_lancement','custom')),
  metier_cible    TEXT,                     -- slug métier ou null (tous)
  departements    TEXT[],                   -- départements ciblés ou null (tous)
  template_id     TEXT        NOT NULL,     -- 'alerte-reglementaire' | 'invitation-demo' | 'offre-lancement'
  statut          TEXT        DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon','planifiee','en_cours','terminee','pausee')),
  total_envois    INTEGER     DEFAULT 0,
  total_ouverts   INTEGER     DEFAULT 0,
  total_clics     INTEGER     DEFAULT 0,
  total_desabo    INTEGER     DEFAULT 0,
  total_convertis INTEGER     DEFAULT 0,
  date_envoi      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX campaigns_statut_idx     ON public.campaigns (statut);
CREATE INDEX campaigns_created_at_idx ON public.campaigns (created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at_trigger
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();


-- ============================================================
-- Table campaign_sends : suivi individuel de chaque envoi
-- ============================================================

CREATE TABLE public.campaign_sends (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  prospect_id     UUID        NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  template_step   INTEGER     DEFAULT 1,   -- 1 = alerte, 2 = démo, 3 = offre
  statut          TEXT        DEFAULT 'envoye'
                  CHECK (statut IN ('envoye','ouvert','clique','desabonne','bounce','erreur')),
  date_envoi      TIMESTAMPTZ DEFAULT NOW(),
  date_ouverture  TIMESTAMPTZ,
  date_clic       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX campaign_sends_campaign_idx  ON public.campaign_sends (campaign_id);
CREATE INDEX campaign_sends_prospect_idx  ON public.campaign_sends (prospect_id);
CREATE INDEX campaign_sends_statut_idx    ON public.campaign_sends (statut);
CREATE INDEX campaign_sends_step_idx      ON public.campaign_sends (template_step);
CREATE INDEX campaign_sends_date_idx      ON public.campaign_sends (date_envoi DESC);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

-- Contrainte unique : un prospect ne reçoit qu'un seul email par étape par campagne
CREATE UNIQUE INDEX campaign_sends_unique_step
  ON public.campaign_sends (campaign_id, prospect_id, template_step);
