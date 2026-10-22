-- ============================================================
-- Discussion avec Christophe : bulle de contact, page Contact, boîte admin
-- ============================================================
-- Le code fonctionne sans cette migration : la bulle et la page Contact
-- retombent sur l'ancien envoi d'un email (support_messages). Idempotente.
--
-- Trois tables et un bucket, accessibles par le serveur seul (service_role) :
-- RLS activée sans politique, droits retirés à anon et authenticated.
-- Le visiteur rouvre sa conversation avec un lien dont seul le hachage SHA-256
-- est stocké (jamais le jeton). Aucune adresse IP en clair : seulement une
-- empreinte salée par le serveur, pour limiter les envois.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL CHECK (email = lower(email) AND char_length(email) BETWEEN 5 AND 254),
  name               TEXT CHECK (name IS NULL OR char_length(name) <= 120),
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source             TEXT NOT NULL DEFAULT 'bubble' CHECK (source IN ('bubble', 'contact_page', 'app')),
  subject            TEXT CHECK (subject IS NULL OR char_length(subject) <= 160),
  category           TEXT CHECK (category IS NULL OR category IN ('account', 'billing', 'problem', 'other')),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  admin_unread       BOOLEAN NOT NULL DEFAULT TRUE,
  origin_path        TEXT CHECK (origin_path IS NULL OR char_length(origin_path) <= 300),
  device             TEXT CHECK (device IS NULL OR char_length(device) <= 120),
  access_hash        TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_admin_reply_at TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_conversations_status_idx ON public.support_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_conversations_email_idx  ON public.support_conversations (email, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_conversations_user_idx   ON public.support_conversations (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender           TEXT NOT NULL CHECK (sender IN ('visitor', 'admin', 'note')),
  body             TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  ip_hash          TEXT,
  visitor_seen_at  TIMESTAMPTZ,
  emailed_at       TIMESTAMPTZ,
  email_error      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_chat_messages_conv_idx ON public.support_chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS support_chat_messages_rate_idx ON public.support_chat_messages (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_chat_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES public.support_chat_messages(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL UNIQUE,
  file_name        TEXT NOT NULL CHECK (char_length(file_name) <= 200),
  mime_type        TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes       INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_chat_attachments_msg_idx ON public.support_chat_attachments (message_id);

-- Réponses types de la boîte admin
CREATE TABLE IF NOT EXISTS public.support_canned_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL UNIQUE CHECK (char_length(title) BETWEEN 1 AND 80),
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.support_canned_replies (title, body, position) VALUES
  ('Ajouter son logo',
   'Pour ajouter votre logo, ouvrez Paramètres › Entreprise, puis importez votre fichier. Il apparaît ensuite sur tous vos devis, factures et bons de commande.',
   1),
  ('TVA des travaux',
   'Le taux dépend du logement et des travaux : 20 %, 10 % ou 5,5 %. Notre guide « TVA des travaux » détaille les cas et les exclusions : https://qonforme.fr/guide/tva-travaux',
   2),
  ('Corriger une facture envoyée',
   'Une facture envoyée ne se modifie pas : elle se corrige par un avoir, puis vous émettez une nouvelle facture. Depuis la fiche de la facture, utilisez « Créer un avoir ».',
   3)
ON CONFLICT (title) DO NOTHING;

-- Serveur seul : RLS sans politique, droits retirés
ALTER TABLE public.support_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_canned_replies   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_conversations    FROM anon, authenticated;
REVOKE ALL ON public.support_chat_messages    FROM anon, authenticated;
REVOKE ALL ON public.support_chat_attachments FROM anon, authenticated;
REVOKE ALL ON public.support_canned_replies   FROM anon, authenticated;

-- Bucket privé des pièces jointes : 5 Mo, images ou PDF, aucune politique
-- (lecture et écriture par le serveur seul, liens signés de courte durée)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('support-attachments', 'support-attachments', FALSE, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON TABLE public.support_conversations    IS 'Conversations de la bulle de contact et de la page Contact (réponses par email)';
COMMENT ON TABLE public.support_chat_messages    IS 'Messages d''une conversation : visiteur, réponse de l''équipe, note interne';
COMMENT ON TABLE public.support_chat_attachments IS 'Pièces jointes (images, PDF, 5 Mo) rangées dans le bucket privé support-attachments';
COMMENT ON TABLE public.support_canned_replies   IS 'Réponses types de la boîte de réception admin';
