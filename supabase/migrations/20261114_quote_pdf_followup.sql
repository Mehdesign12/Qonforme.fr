-- Devis : date du premier téléchargement du PDF et email de suivi à l'artisan (14/11/2026).
--
-- pdf_downloaded_at   : posée par GET /api/quotes/[id]/pdf au premier téléchargement.
--                       Sert à demander à l'artisan, 10 jours plus tard, si le devis
--                       téléchargé (et envoyé par lui-même) a été accepté.
-- artisan_followup_at : posée quand l'email « Le devis … a-t-il été accepté ? » est
--                       réservé ou envoyé. Un seul email par devis.
--
-- Sans cette migration, le site marche comme avant : ni date gardée, ni email.
-- Rejouable.

-- sent_at vient de 20261019_quotes_sent_at.sql : ajoutée ici aussi si elle manque (l'index la lit)
alter table public.quotes add column if not exists sent_at timestamptz;
alter table public.quotes add column if not exists pdf_downloaded_at timestamptz;
alter table public.quotes add column if not exists artisan_followup_at timestamptz;

-- Devis qui attendent encore leur email de suivi (lecture de la tâche planifiée)
create index if not exists quotes_followup_pending_idx
  on public.quotes (status, sent_at, pdf_downloaded_at)
  where artisan_followup_at is null and status in ('draft', 'sent');
