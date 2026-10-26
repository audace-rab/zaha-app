-- Bannières publicitaires (image) gérées depuis le back-office et affichées dans
-- l'onglet Lieux de l'application, juste avant les résultats de recherche.
-- À exécuter dans Supabase → SQL Editor AVANT de déployer l'API et le back-office.
-- Idempotent : peut être relancé sans effet de bord.

create table if not exists public.ad_banners (
  id uuid primary key default uuid_generate_v4(),
  -- Libellé interne (aussi utilisé comme texte alternatif de l'image)
  title text not null,
  image_url text not null,
  -- Lien ouvert au clic sur la bannière (optionnel)
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ad_banners_active_idx
  on public.ad_banners (is_active, created_at desc);

alter table public.ad_banners enable row level security;

-- Lecture publique des bannières actives uniquement ; écriture : back-office (service_role).
drop policy if exists "Active banners are public" on public.ad_banners;
create policy "Active banners are public"
  on public.ad_banners for select using (is_active);

-- Bucket public pour les images de bannières (écriture via service_role uniquement).
insert into storage.buckets (id, name, public)
values ('ad-banners', 'ad-banners', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read ad banners" on storage.objects;
create policy "Public read ad banners"
  on storage.objects for select
  using (bucket_id = 'ad-banners');
