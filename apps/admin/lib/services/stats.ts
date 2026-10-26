import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface AdminStats {
  counts: {
    users: number;
    places: number;
    posts: number;
    reviews: number;
    reservations: number;
    comments: number;
  };
  reservationsByStatus: Record<string, number>;
  recentReservations: Array<{
    id: string;
    date: string;
    status: string;
    price: number;
    currency: string;
    userName: string | null;
    placeName: string | null;
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    country: string;
    created_at: string;
  }>;
  /** Clics « Réserver » / « Appeler » par lieu (total et 30 derniers jours). */
  clicksByPlace: PlaceClickStats[];
  clickTotals: { reserve: number; call: number; reserve30d: number; call30d: number };
}

export interface PlaceClickStats {
  placeId: string;
  placeName: string;
  placeStatus: string;
  reserveTotal: number;
  callTotal: number;
  reserve30d: number;
  call30d: number;
  lastClickAt: string | null;
}

/**
 * Clics par lieu : tous les lieux VIP / Premium (y compris ceux à 0 clic, puisque
 * ce sont les seuls à avoir les boutons) + tout lieu ayant déjà reçu des clics.
 */
async function getClickStats(supabase: SupabaseClient<Database>): Promise<PlaceClickStats[]> {
  const [{ data: statRows }, { data: reservablePlaces }] = await Promise.all([
    supabase.from('place_click_stats').select('*'),
    supabase.from('places').select('id, name, status').in('status', ['vip', 'premium']),
  ]);

  const stats = new Map((statRows ?? []).map((r) => [r.place_id as string, r]));
  const places = new Map<string, { name: string; status: string }>(
    (reservablePlaces ?? []).map((p) => [p.id, { name: p.name, status: p.status }])
  );

  // Lieux ayant des clics mais n'étant plus VIP / Premium : on récupère leur nom.
  const missingIds = [...stats.keys()].filter((id) => !places.has(id));
  if (missingIds.length > 0) {
    const { data: others } = await supabase
      .from('places')
      .select('id, name, status')
      .in('id', missingIds);
    for (const p of others ?? []) places.set(p.id, { name: p.name, status: p.status });
  }

  return [...places.entries()]
    .map(([placeId, place]) => {
      const row = stats.get(placeId);
      return {
        placeId,
        placeName: place.name,
        placeStatus: place.status,
        reserveTotal: Number(row?.reserve_total ?? 0),
        callTotal: Number(row?.call_total ?? 0),
        reserve30d: Number(row?.reserve_30d ?? 0),
        call30d: Number(row?.call_30d ?? 0),
        lastClickAt: row?.last_click_at ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.reserveTotal + b.callTotal - (a.reserveTotal + a.callTotal) ||
        a.placeName.localeCompare(b.placeName)
    );
}

async function countRows(supabase: SupabaseClient<Database>, table: keyof Database['public']['Tables']): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function getAdminStats(supabase: SupabaseClient<Database>): Promise<AdminStats> {
  // Toutes les requêtes en parallèle (1 aller-retour réseau au lieu de 4).
  const [
    users,
    places,
    posts,
    reviews,
    reservations,
    comments,
    { data: statusRows },
    { data: recentReservationsRaw },
    { data: recentUsersRaw },
    clicksByPlace,
  ] = await Promise.all([
    countRows(supabase, 'profiles'),
    countRows(supabase, 'places'),
    countRows(supabase, 'posts'),
    countRows(supabase, 'place_reviews'),
    countRows(supabase, 'reservations'),
    countRows(supabase, 'comments'),
    // Répartition des réservations par statut
    supabase.from('reservations').select('status'),
    // Réservations récentes (avec noms du client et du lieu)
    supabase
      .from('reservations')
      .select('id, date, status, price, currency, profiles(name), places(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    // Derniers inscrits
    supabase
      .from('profiles')
      .select('id, name, country, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    getClickStats(supabase),
  ]);

  const clickTotals = clicksByPlace.reduce(
    (acc, p) => ({
      reserve: acc.reserve + p.reserveTotal,
      call: acc.call + p.callTotal,
      reserve30d: acc.reserve30d + p.reserve30d,
      call30d: acc.call30d + p.call30d,
    }),
    { reserve: 0, call: 0, reserve30d: 0, call30d: 0 }
  );

  const reservationsByStatus: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    reservationsByStatus[row.status] = (reservationsByStatus[row.status] ?? 0) + 1;
  }

  const recentReservations = (recentReservationsRaw ?? []).map((r) => {
    const profile = r.profiles as unknown as { name: string } | null;
    const place = r.places as unknown as { name: string } | null;
    return {
      id: r.id,
      date: r.date,
      status: r.status,
      price: r.price,
      currency: r.currency,
      userName: profile?.name ?? null,
      placeName: place?.name ?? null,
    };
  });

  return {
    counts: { users, places, posts, reviews, reservations, comments },
    reservationsByStatus,
    recentReservations,
    recentUsers: recentUsersRaw ?? [],
    clicksByPlace,
    clickTotals,
  };
}
