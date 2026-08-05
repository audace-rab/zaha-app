-- Zaha App — schéma initial Supabase (PostgreSQL)

create extension if not exists "uuid-ossp";

-- Profils utilisateurs (lié à auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  banner_url text,
  location text default '',
  phone text,
  language text not null default 'FR' check (language in ('FR', 'EN')),
  country text not null default 'Madagascar',
  country_flag text default '🇲🇬',
  description text default '',
  profile_views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lieux (cache + données persistées)
create table public.places (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique,
  name text not null,
  category text not null,
  address text,
  snippet text,
  opening_hours text,
  rating numeric(2,1),
  latitude double precision,
  longitude double precision,
  google_maps_uri text,
  photo_url text,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

create index places_category_idx on public.places (category);
create index places_coords_idx on public.places (latitude, longitude);

-- Posts du feed
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  location text default '',
  is_business boolean not null default false,
  created_at timestamptz not null default now()
);

create index posts_author_idx on public.posts (author_id);
create index posts_created_idx on public.posts (created_at desc);

-- Médias des posts
create table public.post_media (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  url text not null,
  sort_order integer not null default 0
);

-- Commentaires
create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- Likes
create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Avis sur les lieux
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text not null,
  helpful_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Sessions de chat IA
create table public.chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  text text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

-- Cache serveur (remplace localStorage côté client)
create table public.ai_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index ai_cache_expires_idx on public.ai_cache (expires_at);

-- Auto-création du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.reviews enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles : lecture publique, édition par le propriétaire
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Places : lecture publique
create policy "Places are viewable by everyone"
  on public.places for select using (true);

-- Posts : lecture publique, écriture authentifiée
create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = author_id);

create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- Post media
create policy "Post media viewable by everyone"
  on public.post_media for select using (true);

create policy "Authors can manage post media"
  on public.post_media for all using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- Comments
create policy "Comments viewable by everyone"
  on public.comments for select using (true);

create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

-- Likes
create policy "Likes viewable by everyone"
  on public.likes for select using (true);

create policy "Authenticated users can like"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.likes for delete using (auth.uid() = user_id);

-- Reviews
create policy "Reviews viewable by everyone"
  on public.reviews for select using (true);

create policy "Authenticated users can review"
  on public.reviews for insert with check (auth.uid() = author_id);

-- Chat (privé par utilisateur)
create policy "Users manage own chat sessions"
  on public.chat_sessions for all using (auth.uid() = user_id);

create policy "Users manage own chat messages"
  on public.chat_messages for all using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Bucket storage pour les médias du feed
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

create policy "Public read post media files"
  on storage.objects for select
  using (bucket_id = 'post-media');

create policy "Authenticated users upload post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and auth.role() = 'authenticated');

create policy "Users delete own post media"
  on storage.objects for delete
  using (bucket_id = 'post-media' and auth.uid()::text = (storage.foldername(name))[1]);
