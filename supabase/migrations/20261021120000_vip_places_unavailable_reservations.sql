-- Lieux VIP / normal, réservations "indisponible", photos multiples des lieux,
-- rattachement d'un post à un lieu.
-- À exécuter dans Supabase → SQL Editor AVANT de déployer l'API et le back-office.
-- Idempotent : peut être relancé sans effet de bord.

-- ----------------------------------------------------------------------------
-- 1. Statut des lieux : 'normal' | 'vip' (remplace l'ancien booléen is_pro)
-- ----------------------------------------------------------------------------
alter table public.places
  add column if not exists status text not null default 'normal';

alter table public.places drop constraint if exists places_status_check;
alter table public.places
  add constraint places_status_check check (status in ('normal', 'vip'));

-- Reprise des données : les lieux « pro » deviennent VIP.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places' and column_name = 'is_pro'
  ) then
    update public.places set status = 'vip' where is_pro = true;
  end if;
end $$;

-- La colonne is_pro n'est plus lue ni écrite par le code. Une fois l'API et le
-- back-office redéployés, vous pouvez la supprimer :
--   alter table public.places drop column is_pro;

-- ----------------------------------------------------------------------------
-- 2. Photos des lieux (carrousel) : l'ordre du tableau = l'ordre d'affichage,
--    la première photo est la photo de couverture (photo_url).
-- ----------------------------------------------------------------------------
alter table public.places
  add column if not exists photos text[] not null default '{}';

update public.places
set photos = array[photo_url]
where photo_url is not null
  and photo_url <> ''
  and cardinality(photos) = 0;

-- Bucket public pour les photos de lieux. Écriture réservée au back-office
-- (clé service_role, qui contourne la RLS) : aucune policy d'écriture client.
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read place photos" on storage.objects;
create policy "Public read place photos"
  on storage.objects for select
  using (bucket_id = 'place-photos');

-- ----------------------------------------------------------------------------
-- 3. Un post peut être rattaché à un lieu (badge VIP + bouton réservation)
-- ----------------------------------------------------------------------------
alter table public.posts
  add column if not exists place_id uuid references public.places (id) on delete set null;

create index if not exists posts_place_idx on public.posts (place_id);

-- ----------------------------------------------------------------------------
-- 4. Réservations : nouveau statut 'unavailable' (Indisponible)
-- ----------------------------------------------------------------------------
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'unavailable'));
