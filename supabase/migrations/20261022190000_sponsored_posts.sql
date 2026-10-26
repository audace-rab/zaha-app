-- Posts sponsorisés : créés depuis le back-office, affichés tout en haut du feed
-- de tous les utilisateurs (avant les posts classiques).
-- À exécuter dans Supabase → SQL Editor AVANT de déployer l'API et le back-office.
-- Idempotent : peut être relancé sans effet de bord.

alter table public.posts
  add column if not exists is_sponsored boolean not null default false;

-- Les posts sponsorisés sont peu nombreux : index partiel pour les récupérer vite.
create index if not exists posts_sponsored_idx
  on public.posts (created_at desc)
  where is_sponsored;
