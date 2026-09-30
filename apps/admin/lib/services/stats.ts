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
}

async function countRows(supabase: SupabaseClient<Database>, table: keyof Database['public']['Tables']): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function getAdminStats(supabase: SupabaseClient<Database>): Promise<AdminStats> {
  const [users, places, posts, reviews, reservations, comments] = await Promise.all([
    countRows(supabase, 'profiles'),
    countRows(supabase, 'places'),
    countRows(supabase, 'posts'),
    countRows(supabase, 'place_reviews'),
    countRows(supabase, 'reservations'),
    countRows(supabase, 'comments'),
  ]);

  // Répartition des réservations par statut
  const { data: statusRows } = await supabase.from('reservations').select('status');
  const reservationsByStatus: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    reservationsByStatus[row.status] = (reservationsByStatus[row.status] ?? 0) + 1;
  }

  // Réservations récentes (avec noms du client et du lieu)
  const { data: recentReservationsRaw } = await supabase
    .from('reservations')
    .select('id, date, status, price, currency, profiles(name), places(name)')
    .order('created_at', { ascending: false })
    .limit(5);

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

  // Derniers inscrits
  const { data: recentUsersRaw } = await supabase
    .from('profiles')
    .select('id, name, country, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    counts: { users, places, posts, reviews, reservations, comments },
    reservationsByStatus,
    recentReservations,
    recentUsers: recentUsersRaw ?? [],
  };
}
