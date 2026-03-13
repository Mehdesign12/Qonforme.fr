-- Table pour stocker les messages de support (bug reports + contact)
-- Alimentée par /api/support/bug-report et /api/support/contact
-- Pas de RLS : accessible uniquement via service role (admin)

CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL CHECK (type IN ('bug_report', 'contact')),

  -- Bug report fields
  title       text,
  description text,
  page        text,

  -- Contact fields
  name        text,
  email       text,
  message     text,

  -- Status management
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),

  -- Optional : link to authenticated user
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Index pour les requêtes admin les plus fréquentes
CREATE INDEX IF NOT EXISTS support_messages_type_idx    ON support_messages (type);
CREATE INDEX IF NOT EXISTS support_messages_status_idx  ON support_messages (status);
CREATE INDEX IF NOT EXISTS support_messages_created_idx ON support_messages (created_at DESC);
