-- ============================================================================
-- Zaha App — Schéma complet Supabase (fichier unique, installation fraîche)
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Profils utilisateurs (lié à auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
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
  bio text,
  website text,
  profile_views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Colonnes profil Phase 1 : idempotent pour les bases déjà créées sans bio/site
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists website text;

-- ----------------------------------------------------------------------------
-- 2.2 Villes (référentiel géographique — PAS des lieux)
--     État final après les migrations 2 et 3 : le nom vit dans city_names.
-- ----------------------------------------------------------------------------
create table if not exists public.cities (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  country_flag text,
  latitude double precision not null,
  longitude double precision not null,
  description text,
  created_at timestamptz not null default now(),
  unique(latitude, longitude)
);

-- Noms multilingues des villes (une ville peut avoir plusieurs noms/alias)
create table if not exists public.city_names (
  id uuid primary key default uuid_generate_v4(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  language text not null default 'fr' check (language in ('fr', 'en', 'mg')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(city_id, name, language)
);

-- ----------------------------------------------------------------------------
-- 2.3 Lieux (vrais points d'intérêt : restaurants, hôtels, pharmacies…)
--     Reconcilie initial_schema (colonnes de base) + separate_cities_and_places
--     (city_id + place_type). Une ville n'est jamais stockée ici.
-- ----------------------------------------------------------------------------
create table if not exists public.places (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique,
  name text not null,
  category text not null,
  place_type text check (
    place_type in ('restaurant', 'hotel', 'activité', 'pharmacie', 'attraction', 'autre')
  ),
  address text,
  snippet text,
  opening_hours text,
  rating numeric(2,1),
  latitude double precision,
  longitude double precision,
  google_maps_uri text,
  photo_url text,
  is_pro boolean not null default false,
  city_id uuid references public.cities(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.4 Contenu communautaire : posts, médias, commentaires, likes
--     Les FK inline garantissent les noms de contraintes attendus par le code :
--     posts_author_id_fkey et comments_author_id_fkey (feedService.ts).
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  location text default '',
  is_business boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  url text not null,
  sort_order integer not null default 0
);

create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 2.5 Cache serveur (utilisé par apps/api/lib/cache/cacheService.ts)
-- ----------------------------------------------------------------------------
create table if not exists public.ai_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.6 Bookmarks de lieux (favoris par utilisateur)
-- ----------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, place_id)
);

-- 2.7 Avis sur les lieux
create table if not exists public.place_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(user_id, place_id)
);

-- 2.8 Follows entre utilisateurs
create table if not exists public.follows (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

-- ============================================================================
-- 3. INDEX
-- ============================================================================
create index if not exists cities_coords_idx on public.cities (latitude, longitude);

create index if not exists city_names_city_idx on public.city_names (city_id);
create index if not exists city_names_name_idx on public.city_names (name);
create index if not exists city_names_lang_idx on public.city_names (language);

create index if not exists places_category_idx on public.places (category);
create index if not exists places_coords_idx on public.places (latitude, longitude);
create index if not exists places_city_idx on public.places (city_id);

create index if not exists posts_author_idx on public.posts (author_id);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists post_media_post_idx on public.post_media (post_id);
create index if not exists comments_post_idx on public.comments (post_id);

create index if not exists ai_cache_expires_idx on public.ai_cache (expires_at);

create index if not exists bookmarks_user_idx on public.bookmarks (user_id);
create index if not exists bookmarks_place_idx on public.bookmarks (place_id);

create index if not exists reviews_place_idx on public.place_reviews (place_id);
create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

-- ============================================================================
-- 4. FONCTION + TRIGGER : auto-création du profil à l'inscription
-- ============================================================================
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 5. ROW LEVEL SECURITY + POLICIES (lecture publique comme les migrations)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.city_names enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.ai_cache enable row level security;
alter table public.bookmarks enable row level security;
alter table public.place_reviews enable row level security;
alter table public.follows enable row level security;

-- Profiles : lecture publique, édition par le propriétaire
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Villes et noms de villes : publics en lecture
drop policy if exists "cities_are_public" on public.cities;
create policy "cities_are_public"
  on public.cities for select using (true);

drop policy if exists "city_names_are_public" on public.city_names;
create policy "city_names_are_public"
  on public.city_names for select using (true);

-- Lieux : publics en lecture
drop policy if exists "places_are_public" on public.places;
create policy "places_are_public"
  on public.places for select using (true);

-- Posts : lecture publique, écriture par l'auteur
drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

drop policy if exists "Authenticated users can create posts" on public.posts;
create policy "Authenticated users can create posts"
  on public.posts for insert with check (auth.uid() = author_id);

drop policy if exists "Authors can update own posts" on public.posts;
create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = author_id);

drop policy if exists "Authors can delete own posts" on public.posts;
create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- Médias de posts
drop policy if exists "Post media viewable by everyone" on public.post_media;
create policy "Post media viewable by everyone"
  on public.post_media for select using (true);

drop policy if exists "Authors can manage post media" on public.post_media;
create policy "Authors can manage post media"
  on public.post_media for all using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- Commentaires
drop policy if exists "Comments viewable by everyone" on public.comments;
create policy "Comments viewable by everyone"
  on public.comments for select using (true);

drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

-- Likes
drop policy if exists "Likes viewable by everyone" on public.likes;
create policy "Likes viewable by everyone"
  on public.likes for select using (true);

drop policy if exists "Authenticated users can like" on public.likes;
create policy "Authenticated users can like"
  on public.likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unlike" on public.likes;
create policy "Users can unlike"
  on public.likes for delete using (auth.uid() = user_id);

-- Bookmarks : strictement owner-only (lecture ET écriture)
drop policy if exists "Bookmarks are viewable by owner" on public.bookmarks;
create policy "Bookmarks are viewable by owner"
  on public.bookmarks for select using (auth.uid() = user_id);

drop policy if exists "Bookmarks are insertable by owner" on public.bookmarks;
create policy "Bookmarks are insertable by owner"
  on public.bookmarks for insert with check (auth.uid() = user_id);

drop policy if exists "Bookmarks are deletable by owner" on public.bookmarks;
create policy "Bookmarks are deletable by owner"
  on public.bookmarks for delete using (auth.uid() = user_id);

-- Avis lieux : lecture publique, écriture par le propriétaire
drop policy if exists "Place reviews viewable by everyone" on public.place_reviews;
create policy "Place reviews viewable by everyone"
  on public.place_reviews for select using (true);

drop policy if exists "Authenticated users can review places" on public.place_reviews;
create policy "Authenticated users can review places"
  on public.place_reviews for insert with check (auth.uid() = user_id);

drop policy if exists "Review owners can update own review" on public.place_reviews;
create policy "Review owners can update own review"
  on public.place_reviews for update using (auth.uid() = user_id);

drop policy if exists "Review owners can delete own review" on public.place_reviews;
create policy "Review owners can delete own review"
  on public.place_reviews for delete using (auth.uid() = user_id);

-- Follows : lecture publique, follow/unfollow par le propriétaire
drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

drop policy if exists "Authenticated users can follow" on public.follows;
create policy "Authenticated users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- Cache IA : service_role uniquement (bypass RLS).
-- Aucune policy => inaccessible aux clients anon/authenticated, ce qui est
-- voulu : seule l'API (clé service_role) lit/écrit le cache.
-- (Écart volontaire vs migration initiale qui oubliait d'activer RLS ici.)

-- ============================================================================
-- 6. STORAGE : bucket public pour les médias du feed
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "Public read post media files" on storage.objects;
create policy "Public read post media files"
  on storage.objects for select
  using (bucket_id = 'post-media');

drop policy if exists "Authenticated users upload post media" on storage.objects;
create policy "Authenticated users upload post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and auth.role() = 'authenticated');

drop policy if exists "Users delete own post media" on storage.objects;
create policy "Users delete own post media"
  on storage.objects for delete
  using (bucket_id = 'post-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- Bucket public pour les photos de profil (lecture publique, écriture owner-only,
-- un dossier par utilisateur : avatars/<user_id>/<fichier>)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users upload avatar" on storage.objects;
create policy "Authenticated users upload avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Bucket public pour les photos de posts (upload avant création du post)
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read post photos" on storage.objects;
create policy "Public read post photos"
  on storage.objects for select
  using (bucket_id = 'post-photos');

drop policy if exists "Authenticated users upload post photos" on storage.objects;
create policy "Authenticated users upload post photos"
  on storage.objects for insert
  with check (
    bucket_id = 'post-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own post photos" on storage.objects;
create policy "Users delete own post photos"
  on storage.objects for delete
  using (bucket_id = 'post-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 7. SEED : VILLES (source : CITY_COORDINATES du legacy geminiService.ts)
--    17 alias du legacy -> 10 villes uniques. UUIDs fixes pour que les seeds
--    de lieux puissent référencer les villes de façon déterministe.
-- ============================================================================
insert into public.cities (id, country, country_flag, latitude, longitude, description)
values
  ('c1000000-0000-0000-0000-000000000001', 'Madagascar', '🇲🇬', -18.8792, 47.5079, 'Capitale de Madagascar'),
  ('c1000000-0000-0000-0000-000000000002', 'Madagascar', '🇲🇬', -18.1492, 49.4023, 'Port côtier, ville côtière'),
  ('c1000000-0000-0000-0000-000000000003', 'Madagascar', '🇲🇬', -13.3183, 48.2673, 'Île touristique'),
  ('c1000000-0000-0000-0000-000000000004', 'Madagascar', '🇲🇬', -15.7167, 46.3167, 'Ville côtière nord-ouest'),
  ('c1000000-0000-0000-0000-000000000005', 'Madagascar', '🇲🇬', -12.2787, 49.2917, 'Ville du nord, port historique'),
  ('c1000000-0000-0000-0000-000000000006', 'Madagascar', '🇲🇬', -21.4527, 47.0857, 'Ville des Hautes Terres'),
  ('c1000000-0000-0000-0000-000000000007', 'Madagascar', '🇲🇬', -20.2833, 44.2833, 'Ville connue pour les baobabs'),
  ('c1000000-0000-0000-0000-000000000008', 'Madagascar', '🇲🇬', -23.3540, 43.6696, 'Ville du sud-ouest'),
  ('c1000000-0000-0000-0000-000000000009', 'Madagascar', '🇲🇬', -16.9044, 49.9002, 'Île de Madagascar'),
  ('c2000000-0000-0000-0000-000000000001', 'France', '🇫🇷', 48.8566, 2.3522, 'Capitale de la France')
on conflict (latitude, longitude) do nothing;

-- Noms multilingues + alias (tous les alias de CITY_COORDINATES sont couverts :
-- antananarivo/tana, toamasina/tamatave, mahajanga/majunga,
-- antsiranana/diego suarez/diego, toliara/tuléar/tulear…)
insert into public.city_names (city_id, name, language, is_primary)
values
  -- Antananarivo
  ('c1000000-0000-0000-0000-000000000001', 'Antananarivo', 'mg', true),
  ('c1000000-0000-0000-0000-000000000001', 'Tananarive', 'fr', false),
  ('c1000000-0000-0000-0000-000000000001', 'Tana', 'en', false),
  -- Toamasina
  ('c1000000-0000-0000-0000-000000000002', 'Toamasina', 'mg', true),
  ('c1000000-0000-0000-0000-000000000002', 'Tamatave', 'fr', false),
  -- Nosy Be
  ('c1000000-0000-0000-0000-000000000003', 'Nosy Be', 'mg', true),
  ('c1000000-0000-0000-0000-000000000003', 'Nosy Be', 'en', false),
  ('c1000000-0000-0000-0000-000000000003', 'Nosy Be', 'fr', true),
  -- Mahajanga
  ('c1000000-0000-0000-0000-000000000004', 'Mahajanga', 'mg', true),
  ('c1000000-0000-0000-0000-000000000004', 'Majunga', 'en', false),
  ('c1000000-0000-0000-0000-000000000004', 'Majunga', 'fr', false),
  -- Antsiranana
  ('c1000000-0000-0000-0000-000000000005', 'Antsiranana', 'mg', true),
  ('c1000000-0000-0000-0000-000000000005', 'Diego Suarez', 'fr', false),
  ('c1000000-0000-0000-0000-000000000005', 'Diego Suarez', 'en', false),
  
  -- Fianarantsoa
  ('c1000000-0000-0000-0000-000000000006', 'Fianarantsoa', 'fr', true),
  ('c1000000-0000-0000-0000-000000000006', 'Fianarantsoa', 'mg', true),
  -- Morondava
  ('c1000000-0000-0000-0000-000000000007', 'Morondava', 'fr', true),
  ('c1000000-0000-0000-0000-000000000007', 'Morondava', 'mg', true),
  -- Toliara
  ('c1000000-0000-0000-0000-000000000008', 'Toliara', 'mg', true),
  ('c1000000-0000-0000-0000-000000000008', 'Tuléar', 'fr', false),
  ('c1000000-0000-0000-0000-000000000008', 'Tulear', 'en', false),
  -- Sainte Marie
  ('c1000000-0000-0000-0000-000000000009', 'Sainte Marie', 'mg', true),
  ('c1000000-0000-0000-0000-000000000009', 'Sainte Marie', 'fr', false),
  -- Paris
  ('c2000000-0000-0000-0000-000000000001', 'Paris', 'fr', true),
  ('c2000000-0000-0000-0000-000000000001', 'Paris', 'en', true)
on conflict (city_id, name, language) do nothing;

-- ============================================================================
-- 8. SEED : LIEUX (sources : supabase/seed_places.sql + FALLBACK_PLACES legacy)
--    Tous les lieux sont de vrais POI rattachés à leur ville via city_id.
-- ============================================================================

-- Nettoyage idempotent des anciens lieux parisiens remplacés par des lieux
-- malgaches (aucune table ne référence public.places en FK, suppression sûre).
delete from public.places
where external_id in ('restaurant-le-comptoir-du-relais', 'hotel-hotel-du-louvre');

insert into public.places (
  external_id, name, category, place_type, address, snippet, opening_hours,
  rating, latitude, longitude, google_maps_uri, photo_url, is_pro, city_id
)
values
  -- --- Lieux emblématiques (ex-seed_places.sql ; les 2 lieux parisiens ont été remplacés par des lieux malgaches) ---
  (
    'attraction-allee-des-baobabs', 'Allée des Baobabs', 'activités', 'attraction',
    'RN8 entre Morondava et Belo-sur-Tsiribihina, Menabe',
    'Avenue majestueuse de baobabs centenaires, spectaculaire au coucher du soleil.',
    'Ouvert 24h/24', 4.9, -20.2504811, 44.4196950,
    'https://maps.google.com/?q=Allee+des+Baobabs+Morondava',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000007'
  ),
  (
    'attraction-plage-de-ramena', 'Plage de Ramena', 'activités', 'attraction',
    'Ramena, Antsiranana (Diego Suarez)',
    'Lagon turquoise et pirogues à voile à une trentaine de minutes de Diego Suarez.',
    'Ouvert 24h/24', 4.7, -12.2494307, 49.3414343,
    'https://maps.google.com/?q=Plage+de+Ramena+Antsiranana',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000005'
  ),
  (
    'restaurant-la-varangue', 'La Varangue', 'restaurant', 'restaurant',
    'Rue Printsy Ratsimamanga, Isoraka, Antananarivo',
    'Restaurant gastronomique renommé proposant des saveurs malgaches et françaises.',
    '12:00 - 22:00', 4.8, -18.9118862, 47.5250393,
    'https://maps.google.com/?q=La+Varangue+Antananarivo',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'hotel-carlton-madagascar', 'Hôtel Carlton Madagascar', 'hotel', 'hotel',
    'Anosy, Antananarivo 101',
    'Hôtel 5 étoiles emblématique surplombant le lac Anosy.',
    'Ouvert 24h/24', 4.7, -18.9148484, 47.5178489,
    'https://maps.google.com/?q=Carlton+Hotel+Antananarivo',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  -- --- Depuis FALLBACK_PLACES legacy : restaurants ---
  (
    'restaurant-le-marais', 'Le Marais', 'restaurant', 'restaurant',
    'Ankorondrano, Antananarivo',
    'Cuisine raffinée et vue panoramique sur la ville avec une carte de cocktails créatifs.',
    '11:30 - 23:00', 4.7, -18.8873568, 47.5235411,
    'https://maps.google.com/?q=Le+Marais+Antananarivo',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'restaurant-cafe-de-la-gare', 'Café de la Gare', 'restaurant', 'restaurant',
    'Gare Soarano, Analakely, Antananarivo',
    'Brasserie historique au cœur de la gare rénovée, réputée pour ses steaks de zébu et son ambiance.',
    '07:00 - 22:30', 4.6, -18.9035523, 47.5207223,
    'https://maps.google.com/?q=Cafe+de+la+Gare+Antananarivo',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'restaurant-sakamanga', 'Sakamanga Restaurant', 'restaurant', 'restaurant',
    'Rue Ratianarivo, Isoraka, Antananarivo',
    'Institution incontournable offrant des plats traditionnels et internationaux au milieu de pièces de musée.',
    '06:30 - 22:00', 4.5, -18.9081875, 47.5211719,
    'https://maps.google.com/?q=Sakamanga+Antananarivo',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  -- --- Depuis FALLBACK_PLACES legacy : hôtels ---
  (
    'hotel-radisson-blu-waterfront', 'Radisson Blu Hotel Waterfront', 'hotel', 'hotel',
    'Zone Tana Waterfront, Ambodivona, Antananarivo',
    'Design moderne au bord de l''eau, chambres spacieuses et centre de remise en forme.',
    'Ouvert 24h/24', 4.8, -18.8902563, 47.5246662,
    'https://maps.google.com/?q=Radisson+Blu+Antananarivo',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'hotel-sakamanga', 'Hôtel Sakamanga', 'hotel', 'hotel',
    'Isoraka, Antananarivo',
    'Hôtel de charme chaleureux et artistique avec terrasse verdoyante et piscine.',
    'Ouvert 24h/24', 4.6, -18.9083700, 47.5212480,
    'https://maps.google.com/?q=Hotel+Sakamanga+Antananarivo',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  ),
  -- --- Depuis FALLBACK_PLACES legacy : activités ---
  (
    'attraction-rova-manjakamiadana', 'Rova de Manjakamiadana (Palais de la Reine)', 'activités', 'attraction',
    'Haute Ville, Antananarivo',
    'Monument historique majeur offrant une vue panoramique à 360 degrés sur toute la capitale.',
    '08:30 - 17:00', 4.8, -18.9237141, 47.5320673,
    'https://maps.google.com/?q=Rova+de+Manjakamiadana',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'attraction-parc-tsimbazaza', 'Parc Zoologique et Botanique de Tsimbazaza', 'activités', 'attraction',
    'Rue Kasanga Fernand, Tsimbazaza, Antananarivo',
    'Découverte de la faune et de la flore uniques de Madagascar, y compris de nombreuses espèces de lémuriens.',
    '09:00 - 17:00', 4.4, -18.9303365, 47.5277513,
    'https://maps.google.com/?q=Parc+Tsimbazaza+Antananarivo',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'attraction-lemurs-park', 'Lemurs'' Park', 'activités', 'attraction',
    'Katsaoka, RN1 (à 22km d''Antananarivo)',
    'Réserve naturelle privée abritant 9 espèces de lémuriens en liberté au bord de la rivière Katsaoka.',
    '08:30 - 16:00', 4.7, -18.9526685, 47.3580533,
    'https://maps.google.com/?q=Lemurs+Park+Madagascar',
    'https://images.unsplash.com/photo-1574063413132-355dbfd83e0c?w=800&q=80',
    true, 'c1000000-0000-0000-0000-000000000001'
  ),
  -- --- Depuis FALLBACK_PLACES legacy : pharmacies ---
  (
    'pharmacie-isoraka', 'Pharmacie d''Isoraka', 'pharmacie', 'pharmacie',
    'Rue Rainitovo, Isoraka, Antananarivo',
    'Pharmacie centrale proposant un grand choix de médicaments et produits de parapharmacie.',
    '07:30 - 20:00', 4.6, -18.9107613, 47.5218475,
    'https://maps.google.com/?q=Pharmacie+Isoraka+Antananarivo',
    'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'pharmacie-metropole', 'Pharmacie Métropole', 'pharmacie', 'pharmacie',
    'Avenue de l''Indépendance, Analakely, Antananarivo',
    'Pharmacie de référence au centre-ville avec service de garde régulier.',
    'Ouvert 24h/24', 4.5, -18.9106604, 47.5259774,
    'https://maps.google.com/?q=Pharmacie+Metropole+Antananarivo',
    'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'pharmacie-ankorondrano', 'Pharmacie Ankorondrano', 'pharmacie', 'pharmacie',
    'Boulevard de Tokyo, Ankorondrano, Antananarivo',
    'Pharmacie moderne ouverte 7j/7 proche des grands centres commerciaux.',
    '08:00 - 21:00', 4.7, -18.8830368, 47.5251797,
    'https://maps.google.com/?q=Pharmacie+Ankorondrano',
    'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80',
    false, 'c1000000-0000-0000-0000-000000000001'
  )
on conflict (external_id) do update set
  name = excluded.name,
  category = excluded.category,
  place_type = excluded.place_type,
  address = excluded.address,
  snippet = excluded.snippet,
  opening_hours = excluded.opening_hours,
  rating = excluded.rating,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  google_maps_uri = excluded.google_maps_uri,
  photo_url = excluded.photo_url,
  is_pro = excluded.is_pro,
  city_id = excluded.city_id;

-- ============================================================================
-- 8.1 MISE A JOUR DES COORDONNEES REELLES (idempotent)
--    Ré-exécuter le fichier corrige aussi les lignes déjà présentes en base.
--    Positions réelles connues des POI (précision ~10-100 m). Clé stable :
--    external_id (le nom peut évoluer, pas l'identifiant).
-- ============================================================================
update public.places set latitude = -18.9112, longitude = 47.5258 where external_id = 'restaurant-la-varangue';        -- La Varangue, Antaninarenina
update public.places set latitude = -18.9287, longitude = 47.5183 where external_id = 'hotel-carlton-madagascar';      -- Hôtel Carlton, lac Anosy
update public.places set latitude = -20.2506, longitude = 44.4183 where external_id = 'attraction-allee-des-baobabs';  -- Morondava, Menabe
update public.places set latitude = -12.2680, longitude = 49.3930 where external_id = 'attraction-plage-de-ramena';    -- Antsiranana
update public.places set latitude = -18.8815, longitude = 47.5230 where external_id = 'restaurant-le-marais';          -- Ankorondrano
update public.places set latitude = -18.9076, longitude = 47.5212 where external_id = 'restaurant-cafe-de-la-gare';    -- Gare Soarano, Analakely
update public.places set latitude = -18.9121, longitude = 47.5224 where external_id = 'restaurant-sakamanga';          -- Rue Ratianarivo, Isoraka
update public.places set latitude = -18.9047, longitude = 47.5290 where external_id = 'hotel-radisson-blu-waterfront'; -- Tana Waterfront, Ambodivona
update public.places set latitude = -18.9126, longitude = 47.5210 where external_id = 'hotel-sakamanga';               -- Isoraka
update public.places set latitude = -18.9235, longitude = 47.5285 where external_id = 'attraction-rova-manjakamiadana'; -- Rova Manjakamiadana
update public.places set latitude = -18.9452, longitude = 47.5317 where external_id = 'attraction-parc-tsimbazaza';    -- Rue Kasanga Fernand
update public.places set latitude = -18.9537, longitude = 47.3701 where external_id = 'attraction-lemurs-park';        -- RN1 Katsaoka (~22 km ouest)
update public.places set latitude = -18.9138, longitude = 47.5207 where external_id = 'pharmacie-isoraka';             -- Rue Rainitovo, Isoraka
update public.places set latitude = -18.9062, longitude = 47.5240 where external_id = 'pharmacie-metropole';           -- Av. de la République, Analakely
update public.places set latitude = -18.8798, longitude = 47.5209 where external_id = 'pharmacie-ankorondrano';        -- Bd de Tokyo, Ankorondrano

-- ============================================================================
-- 9. SEED DÉMO FEED : auteurs, posts, médias, likes, commentaires
--    Objectif : pouvoir tester la recherche du feed dès l'installation.
--    3 auteurs démo (auth.users + auth.identities + profiles), 13 posts FR,
--    10 médias, ~20 likes, 8 commentaires. UUIDs fixes + on conflict do
--    nothing => ré-exécutable sans dupliquer.
--
--    ⚠️ Si votre base existe déjà : ré-exécutez simplement CE FICHIER, seules
--    les nouvelles lignes seront insérées.
-- ============================================================================

-- pgcrypto : nécessaire pour crypt() / gen_salt() (mots de passe bcrypt)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 9.1 Auteurs de démo (le trigger on_auth_user_created crée leurs profiles)
--     Mot de passe commun : zaha-demo-2026
--
--     ⚠️ COMPATIBILITÉ auth.users.email :
--     - Projets Supabase récents : email est une colonne GÉNÉRÉE
--       (GENERATED ALWAYS, dérivée de email_change) => insert SANS la colonne
--       email, avec email_change = '<email démo>'.
--     - Projets plus anciens : email est une colonne normale => insert classique.
--     La détection est dynamique via pg_attribute.attgenerated, le même fichier
--     fonctionne donc sur les deux variantes. Idempotent (on conflict do nothing).
-- ----------------------------------------------------------------------------
do $auth_seed$
declare
  v_users_email_generated boolean;
  v_identities_email_generated boolean;
begin
  -- La colonne email de auth.users est-elle générée ? ('s' = STORED generated)
  select coalesce(bool_or(attgenerated <> ''), false)
    into v_users_email_generated
    from pg_attribute
   where attrelid = 'auth.users'::regclass
     and attname = 'email'
     and attisdropped = false;

  if v_users_email_generated then
    -- Projets récents : email générée => passer par email_change
    execute $dyn$
      insert into auth.users (
        instance_id, id, aud, role, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      )
      values
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000001',
          'authenticated', 'authenticated',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Alex Voyageur","email":"alex@demo.zaha.app"}',
          now(), now(), '', '', '', 'alex@demo.zaha.app'
        ),
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000002',
          'authenticated', 'authenticated',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Mialy Rabe","email":"mialy@demo.zaha.app"}',
          now(), now(), '', '', '', 'mialy@demo.zaha.app'
        ),
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000003',
          'authenticated', 'authenticated',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Claire Dubois","email":"claire@demo.zaha.app"}',
          now(), now(), '', '', '', 'claire@demo.zaha.app'
        )
      on conflict (id) do nothing;
    $dyn$;
  else
    -- Projets plus anciens : email colonne normale => insert classique
    execute $dyn$
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      )
      values
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000001',
          'authenticated', 'authenticated', 'alex@demo.zaha.app',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Alex Voyageur","email":"alex@demo.zaha.app"}',
          now(), now(), '', '', '', ''
        ),
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000002',
          'authenticated', 'authenticated', 'mialy@demo.zaha.app',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Mialy Rabe","email":"mialy@demo.zaha.app"}',
          now(), now(), '', '', '', ''
        ),
        (
          '00000000-0000-0000-0000-000000000000',
          'a1000000-0000-0000-0000-000000000003',
          'authenticated', 'authenticated', 'claire@demo.zaha.app',
          crypt('zaha-demo-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"Claire Dubois","email":"claire@demo.zaha.app"}',
          now(), now(), '', '', '', ''
        )
      on conflict (id) do nothing;
    $dyn$;
  end if;

  -- Même vérification pour auth.identities.email (générée sur certains schémas)
  select coalesce(bool_or(attgenerated <> ''), false)
    into v_identities_email_generated
    from pg_attribute
   where attrelid = 'auth.identities'::regclass
     and attname = 'email'
     and attisdropped = false;

  if v_identities_email_generated then
    execute $dyn$
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at,
        created_at, updated_at
      )
      values
        (
          'a1000000-0000-0000-0000-000000000001',
          'a1000000-0000-0000-0000-000000000001',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000001',
            'email', 'alex@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now()
        ),
        (
          'a1000000-0000-0000-0000-000000000002',
          'a1000000-0000-0000-0000-000000000002',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000002',
            'email', 'mialy@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now()
        ),
        (
          'a1000000-0000-0000-0000-000000000003',
          'a1000000-0000-0000-0000-000000000003',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000003',
            'email', 'claire@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now()
        )
      on conflict do nothing;
    $dyn$;
  else
    execute $dyn$
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at,
        created_at, updated_at, email
      )
      values
        (
          'a1000000-0000-0000-0000-000000000001',
          'a1000000-0000-0000-0000-000000000001',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000001',
            'email', 'alex@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now(), 'alex@demo.zaha.app'
        ),
        (
          'a1000000-0000-0000-0000-000000000002',
          'a1000000-0000-0000-0000-000000000002',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000002',
            'email', 'mialy@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now(), 'mialy@demo.zaha.app'
        ),
        (
          'a1000000-0000-0000-0000-000000000003',
          'a1000000-0000-0000-0000-000000000003',
          jsonb_build_object(
            'sub', 'a1000000-0000-0000-0000-000000000003',
            'email', 'claire@demo.zaha.app',
            'email_verified', true
          ),
          'email', now(), now(), now(), 'claire@demo.zaha.app'
        )
      on conflict do nothing;
    $dyn$;
  end if;
end
$auth_seed$;

-- Compléter les profiles créés automatiquement par le trigger
update public.profiles set
  name = 'Alex Voyageur',
  avatar_url = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces',
  country = 'Madagascar',
  country_flag = '🇲🇬',
  location = 'Antananarivo',
  description = 'Guide voyage amoureux de Madagascar, toujours en quête de nouveaux spots.'
where id = 'a1000000-0000-0000-0000-000000000001';

update public.profiles set
  name = 'Mialy Rabe',
  avatar_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
  country = 'Madagascar',
  country_flag = '🇲🇬',
  location = 'Nosy Be',
  description = 'Photographe basée à Nosy Be. Plages, couchers de soleil et vie locale.'
where id = 'a1000000-0000-0000-0000-000000000002';

update public.profiles set
  name = 'Claire Dubois',
  avatar_url = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces',
  country = 'France',
  country_flag = '🇫🇷',
  location = 'Paris',
  description = 'Expatriée entre Paris et Madagascar. Je partage mes bonnes adresses.'
where id = 'a1000000-0000-0000-0000-000000000003';

-- ----------------------------------------------------------------------------
-- 9.2 Posts de démo (13 posts FR, villes variées, mots-clés de recherche)
--     Testables via GET /api/feed?query=... :
--       baobab -> 3 | coucher de soleil -> 4 | plage -> 2 | vanille -> 2
--       restaurant -> 1 | hôtel -> 1 | zébu -> 1 | marché -> 1
--       lémuriens -> 1 | riz -> 1
--     et via GET /api/feed?location=... :
--       Antananarivo -> 4 | Nosy Be -> 2 | Morondava -> 3 ...
-- ----------------------------------------------------------------------------
insert into public.posts (id, author_id, content, location, is_business, created_at)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Vue incroyable depuis le Rova ce matin ! Antananarivo est magique sous ce ciel bleu.',
    'Antananarivo', false, now() - interval '12 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'Les épices du marché d''Analakely : vanille, poivre vert, combava... Un régal pour les sens !',
    'Analakely, Antananarivo', false, now() - interval '11 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    'Zébu grillé au restaurant Sakamanga : le meilleur d''Antananarivo, sans conteste.',
    'Isoraka, Antananarivo', false, now() - interval '10 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',
    'Après-midi avec les lémuriens du Parc Zoologique de Tsimbazaza. Adorables et si proches !',
    'Tsimbazaza, Antananarivo', false, now() - interval '9 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000002',
    'Hôtel les pieds dans l''eau à Andilana : la plage de Nosy Be est tout simplement parfaite.',
    'Andilana, Nosy Be', false, now() - interval '8 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000003',
    'Coucher de soleil depuis le Mont Passot à Nosy Be. Moment magique, rien à ajouter.',
    'Mont Passot, Nosy Be', false, now() - interval '7 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000001',
    'L''odeur de vanille flotte autour du port de Toamasina. La ville des épices porte bien son nom.',
    'Toamasina', false, now() - interval '6 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000008',
    'a1000000-0000-0000-0000-000000000002',
    'Le Cirque Rouge de Mahajanga flambe au coucher du soleil. Les falaises sont irréelles.',
    'Mahajanga', false, now() - interval '5 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-000000000003',
    'L''allée des Baobabs à l''aube : ces géants centenaires de Morondava impressionnent à chaque fois.',
    'Allée des Baobabs, Morondava', false, now() - interval '4 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000010',
    'a1000000-0000-0000-0000-000000000001',
    'Coucher de soleil parmi les baobabs de Morondava. Une expérience inoubliable.',
    'Allée des Baobabs, Morondava', false, now() - interval '3 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000011',
    'a1000000-0000-0000-0000-000000000002',
    'La baie d''Antsiranana (Diego Suarez), l''une des plus belles baies du monde. Et la plage de Ramena est à 30 minutes !',
    'Antsiranana', false, now() - interval '2 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000012',
    'a1000000-0000-0000-0000-000000000003',
    'Rizières en terrasses autour de Fianarantsoa : ici le riz rythme la vie des Hautes Terres.',
    'Fianarantsoa', false, now() - interval '1 day'
  ),
  (
    'b0000000-0000-0000-0000-000000000013',
    'a1000000-0000-0000-0000-000000000001',
    'Coucher de soleil sur l''Allée des Baobabs : le moment le plus magique de Morondava.',
    'Morondava', false, now()
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 9.3 Médias de démo (10 images unsplash sur 9 posts)
-- ----------------------------------------------------------------------------
insert into public.post_media (id, post_id, type, url, sort_order)
values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'image', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'image', 'https://images.unsplash.com/photo-1488459716781-b2132a8f8df0?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'image', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'image', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'image', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005', 'image', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80', 1),
  ('e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000006', 'image', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 'image', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 'image', 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', 0),
  ('e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000013', 'image', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80', 0)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 9.4 Likes croisés entre les 3 auteurs
-- ----------------------------------------------------------------------------
insert into public.likes (post_id, user_id, created_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', now() - interval '11 days'),
  ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', now() - interval '9 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', now() - interval '9 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', now() - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', now() - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', now() - interval '6 days'),
  ('b0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000003', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000003', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000003', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000002', now())
on conflict (post_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 9.5 Commentaires de démo (français réaliste, auteurs croisés)
-- ----------------------------------------------------------------------------
insert into public.comments (id, post_id, author_id, text, created_at)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'Magnifique ! Il faut que j''y retourne au lever du jour.',
    now() - interval '11 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001',
    'Le zébu y est effectivement excellent, très bonne adresse !',
    now() - interval '9 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'Andilana est la plus belle plage de Nosy Be, sans hésiter.',
    now() - interval '7 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-000000000002',
    'J''y étais la semaine dernière, la brume du matin est féerique.',
    now() - interval '3 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000003',
    'Ça donne vraiment envie de visiter Toamasina !',
    now() - interval '5 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000001',
    'Superbe coucher de soleil, bien joué pour la photo.',
    now() - interval '6 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000007',
    'b0000000-0000-0000-0000-000000000013',
    'a1000000-0000-0000-0000-000000000002',
    'La photo au coucher du soleil est sublime, j''y retourne dès mon prochain passage à Morondava !',
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000008',
    'b0000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000003',
    'Les lémuriens sont trop mignons, on y emmène les enfants ce week-end.',
    now() - interval '8 days'
  )
on conflict (id) do nothing;

-- ============================================================================
-- FIN — Vérification rapide (optionnel) :
--   select cn.name, cn.language, c.country
--   from public.city_names cn join public.cities c on c.id = cn.city_id
--   order by c.country, cn.name;
--   select p.name, p.category, cn.name as city
--   from public.places p
--   left join public.cities c on c.id = p.city_id
--   left join public.city_names cn on cn.city_id = c.id and cn.is_primary and cn.language = 'fr';
--   select pr.name as author, po.location, left(po.content, 40) as excerpt,
--          count(distinct me.id) as medias,
--          (select count(*) from public.likes l where l.post_id = po.id) as likes,
--          (select count(*) from public.comments cm where cm.post_id = po.id) as comments
--   from public.posts po
--   join public.profiles pr on pr.id = po.author_id
--   left join public.post_media me on me.post_id = po.id
--   group by pr.name, po.location, left(po.content, 40), po.created_at
--   order by po.created_at desc;
-- ============================================================================
