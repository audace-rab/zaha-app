-- Statut Premium, téléphone des lieux, chambres d'hôtel (types + prix),
-- réservations d'hôtel avec date d'arrivée / de départ.
-- À exécuter dans Supabase → SQL Editor AVANT de déployer l'API et le back-office.
-- Idempotent : peut être relancé sans effet de bord.

-- ----------------------------------------------------------------------------
-- 1. Statut des lieux : 'normal' | 'vip' | 'premium' (premium = même fonctionnalités que vip)
-- ----------------------------------------------------------------------------
alter table public.places drop constraint if exists places_status_check;
alter table public.places
  add constraint places_status_check check (status in ('normal', 'vip', 'premium'));

-- ----------------------------------------------------------------------------
-- 2. Téléphone des lieux (bouton « Appeler »)
-- ----------------------------------------------------------------------------
alter table public.places add column if not exists phone text;

-- ----------------------------------------------------------------------------
-- 3. Types de chambre par lieu (hôtels), avec prix par nuit.
--    Lecture publique ; écriture réservée au back-office (service_role).
-- ----------------------------------------------------------------------------
create table if not exists public.place_room_types (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places (id) on delete cascade,
  name text not null,
  description text,
  capacity int not null default 2 check (capacity >= 1),
  price_per_night numeric(12,2) not null default 0 check (price_per_night >= 0),
  currency text not null default 'MGA',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists place_room_types_place_idx
  on public.place_room_types (place_id, sort_order);

alter table public.place_room_types enable row level security;

drop policy if exists "Room types are public" on public.place_room_types;
create policy "Room types are public"
  on public.place_room_types for select using (true);

-- ----------------------------------------------------------------------------
-- 4. Réservations d'hôtel : date = arrivée, date_end = départ, chambre choisie
-- ----------------------------------------------------------------------------
alter table public.reservations add column if not exists date_end date;
alter table public.reservations
  add column if not exists room_type_id uuid references public.place_room_types (id) on delete set null;

alter table public.reservations drop constraint if exists reservations_date_end_check;
alter table public.reservations
  add constraint reservations_date_end_check check (date_end is null or date_end >= date);
