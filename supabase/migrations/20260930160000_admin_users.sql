-- Table des administrateurs du back-office.
-- Un utilisateur Supabase Auth présent ici peut accéder à apps/admin.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Chaque utilisateur peut uniquement vérifier son propre statut admin.
create policy "admin_users_select_own"
  on public.admin_users
  for select
  using (auth.uid() = user_id);

-- Pas d'insert/update/delete côté client : la gestion se fait
-- exclusivement via la clé service-role (back-office ou SQL).

-- Pour promouvoir le premier administrateur, exécuter dans le SQL Editor :
--   insert into public.admin_users (user_id)
--   values ('<uuid-de-votre-compte-auth>');
