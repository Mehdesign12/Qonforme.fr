-- Journal des emails envoyés à chaque compte (Admin › Utilisateurs, section « Emails »).
--
-- Une ligne par email parti vers le titulaire d'un compte : démarrage, reprise,
-- envoi à la main depuis l'admin, rappel « plus tard ». Les emails envoyés aux
-- clients de l'artisan (devis, factures) n'y sont pas.
--
-- Suivi : remis, rejeté, signalé comme indésirable (webhook Resend) ; clics
-- par nos propres liens de retour (/api/emails/c). Aucun pixel d'ouverture
-- (décision du 10/11/2026) : la colonne opened_at reste vide tant que le
-- suivi des ouvertures n'est pas activé chez Resend.
--
-- Écrit et lu par le serveur seul (service_role) : RLS activée sans politique,
-- droits retirés à anon et authenticated. Copies gardées 12 mois (purge par
-- /api/cron/onboarding).
--
-- Rejouable.

create table if not exists public.account_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('onboarding', 'reprise', 'manual', 'account')),
  template text not null check (char_length(template) between 1 and 60),
  subject text not null,
  sent_to text not null,
  html text,
  resend_id text,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  error text,
  sent_by text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  bounced_at timestamptz,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  click_count integer not null default 0 check (click_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists account_emails_user_sent_idx on public.account_emails (user_id, sent_at desc);
create index if not exists account_emails_sent_idx on public.account_emails (sent_at desc);
create unique index if not exists account_emails_resend_id_key on public.account_emails (resend_id) where resend_id is not null;
-- Un email de reprise ne part qu'une fois par compte (réservation avant l'envoi)
create unique index if not exists account_emails_reprise_once on public.account_emails (user_id, template) where category = 'reprise';

alter table public.account_emails enable row level security;
revoke all on table public.account_emails from anon, authenticated;
