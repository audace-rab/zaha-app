-- Tracking des clics sur les boutons « Réserver » et « Appeler » de chaque lieu
-- (fiche du lieu et feed), affiché dans le dashboard du back-office.
-- À exécuter dans Supabase → SQL Editor AVANT de déployer l'API et le back-office.
-- Idempotent : peut être relancé sans effet de bord.

create table if not exists public.place_click_events (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places (id) on delete cascade,
  -- Utilisateur connecté qui a cliqué (null si son compte est supprimé)
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('reserve', 'call')),
  -- Où se trouvait le bouton : fiche du lieu ou post du feed
  source text not null default 'detail' check (source in ('detail', 'feed')),
  created_at timestamptz not null default now()
);

create index if not exists place_click_events_place_idx
  on public.place_click_events (place_id, action, created_at desc);
create index if not exists place_click_events_created_idx
  on public.place_click_events (created_at desc);

-- RLS activée SANS policy : seul le service_role (API et back-office) lit / écrit.
alter table public.place_click_events enable row level security;

-- Agrégat par lieu : total et 30 derniers jours, par action.
create or replace view public.place_click_stats as
select
  place_id,
  count(*) filter (where action = 'reserve') as reserve_total,
  count(*) filter (where action = 'call') as call_total,
  count(*) filter (where action = 'reserve' and created_at >= now() - interval '30 days') as reserve_30d,
  count(*) filter (where action = 'call' and created_at >= now() - interval '30 days') as call_30d,
  max(created_at) as last_click_at
from public.place_click_events
group by place_id;

-- La vue ne doit pas être lisible par les clients (anon / authenticated).
revoke all on public.place_click_stats from anon, authenticated;
grant select on public.place_click_stats to service_role;
