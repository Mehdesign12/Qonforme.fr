-- Affiliation : partenaires qui citent Qonforme, visites amenées par leurs liens
-- (?ref=code), inscrits et abonnés rattachés, commissions sur les abonnements payés.
--
-- Serveur seulement (clé service_role) : RLS activée sans politique, droits retirés
-- à anon et authenticated, comme les tables seo_*. Rejouable.
-- Sans cette migration, le site marche comme avant et ?ref= est ignoré.

CREATE TABLE IF NOT EXISTS affiliate_partners (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  site                   text NOT NULL DEFAULT '' CHECK (char_length(site) <= 255),
  code                   text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]{2,32}$'),
  contact_email          text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  commission_rate        numeric(5,2) NOT NULL DEFAULT 20 CHECK (commission_rate >= 0 AND commission_rate <= 50),
  commission_months      integer NOT NULL DEFAULT 12 CHECK (commission_months BETWEEN 1 AND 60),
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  notes                  text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  -- Lien privé de statistiques : seul le hachage SHA-256 du jeton est gardé
  stats_token_hash       text UNIQUE,
  stats_token_created_at timestamptz,
  stats_views            integer NOT NULL DEFAULT 0,
  stats_last_viewed_at   timestamptz,
  -- Recommandations de pages (OpenSEO + Search Console), gardées 30 jours
  recommendations        jsonb,
  recommendations_at     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Pages du partenaire : celles qui citent Qonforme (vérifiées chaque semaine)
-- et celles qu'on lui propose (recommandations retenues)
CREATE TABLE IF NOT EXISTS affiliate_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  url             text NOT NULL CHECK (char_length(url) BETWEEN 4 AND 2048),
  target_path     text CHECK (target_path IS NULL OR char_length(target_path) <= 512),
  status          text NOT NULL DEFAULT 'unchecked' CHECK (status IN ('proposed', 'unchecked', 'found', 'missing', 'error')),
  rel             text CHECK (rel IS NULL OR rel IN ('follow', 'nofollow', 'sponsored', 'ugc')),
  link_href       text CHECK (link_href IS NULL OR char_length(link_href) <= 2048),
  check_error     text CHECK (check_error IS NULL OR char_length(check_error) <= 300),
  last_checked_at timestamptz,
  last_found_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, url)
);
CREATE INDEX IF NOT EXISTS affiliate_pages_check_idx ON affiliate_pages (last_checked_at NULLS FIRST);

-- Visites amenées : ni adresse IP, ni identifiant, ni navigateur
CREATE TABLE IF NOT EXISTS affiliate_visits (
  id          bigserial PRIMARY KEY,
  partner_id  uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  path        text NOT NULL DEFAULT '/' CHECK (char_length(path) <= 512),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_visits_partner_idx ON affiliate_visits (partner_id, created_at DESC);

-- Un compte inscrit après un lien de partenaire (dernier lien suivi)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  code         text NOT NULL,
  landing_path text CHECK (landing_path IS NULL OR char_length(landing_path) <= 512),
  method       text CHECK (method IS NULL OR method IN ('email', 'google')),
  signed_up_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_referrals_partner_idx ON affiliate_referrals (partner_id, signed_up_at DESC);

-- Une ligne par facture Stripe payée d'un compte rattaché, dans la durée de commission.
-- earned : acquise (due 30 jours après le paiement, délai de la garantie) ;
-- paid_out : versée au partenaire ; void : abonnement remboursé.
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_invoice_id text NOT NULL UNIQUE,
  livemode          boolean NOT NULL DEFAULT true,
  plan              text,
  billing_period    text,
  amount_paid_cents integer NOT NULL CHECK (amount_paid_cents >= 0),
  rate              numeric(5,2) NOT NULL,
  commission_cents  integer NOT NULL CHECK (commission_cents >= 0),
  paid_at           timestamptz NOT NULL,
  state             text NOT NULL DEFAULT 'earned' CHECK (state IN ('earned', 'paid_out', 'void')),
  payout_at         timestamptz,
  voided_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_commissions_partner_idx ON affiliate_commissions (partner_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_commissions_user_idx ON affiliate_commissions (user_id);

ALTER TABLE affiliate_partners    ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_visits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['affiliate_partners', 'affiliate_pages', 'affiliate_visits', 'affiliate_referrals', 'affiliate_commissions'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', t);
  END LOOP;
  REVOKE ALL ON SEQUENCE affiliate_visits_id_seq FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  -- Rôles absents (base hors Supabase) : rien à retirer
  NULL;
END $$;
