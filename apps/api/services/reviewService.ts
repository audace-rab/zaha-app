import { createAdminClient } from '@/lib/supabase/server';

export interface ReviewRow {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user?: { name: string | null; avatar_url: string | null } | null;
}

/**
 * Upsert d'un avis sur un lieu (upsert sur UNIQUE(user_id, place_id)).
 * Retourne null si le lieu n'existe pas.
 */
export async function upsertPlaceReview(
  placeId: string,
  userId: string,
  rating: number,
  comment?: string
): Promise<ReviewRow | null> {
  const supabase = createAdminClient();

  // Vérifier que le lieu existe
  const { data: place } = await supabase
    .from('places')
    .select('id')
    .eq('id', placeId)
    .maybeSingle();
  if (!place) return null;

  const { data: existing } = await supabase
    .from('place_reviews')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  let result;

  if (existing) {
    const { data, error } = await supabase
      .from('place_reviews')
      .update({ rating, comment: comment ?? null })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('Review update error:', error);
      throw new Error('Failed to update review');
    }
    result = data;
  } else {
    const { data, error } = await supabase
      .from('place_reviews')
      .insert({ place_id: placeId, user_id: userId, rating, comment: comment ?? null })
      .select('*')
      .maybeSingle();
    if (error && error.code === '23505') {
      // Conflit concurrent → mettre à jour
      const { data: updated, error: updErr } = await supabase
        .from('place_reviews')
        .update({ rating, comment: comment ?? null })
        .eq('place_id', placeId)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updErr) {
        console.error('Review concurrent update error:', updErr);
        throw new Error('Failed to save review');
      }
      result = updated;
    } else if (error) {
      console.error('Review insert error:', error);
      throw new Error('Failed to save review');
    } else {
      result = data;
    }
  }

  return result ?? null;
}

/**
 * Liste des avis d'un lieu + stats.
 */
export async function listPlaceReviews(placeId: string) {
  const supabase = createAdminClient();

  const { data: reviews, error } = await supabase
    .from('place_reviews')
    .select(`
      *,
      user:profiles!place_reviews_user_id_fkey ( name, avatar_url )
    `)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('List reviews error:', error);
    return { reviews: [], averageRating: 0, reviewCount: 0 };
  }

  const items = (reviews ?? []).map((r) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    return { ...r, user };
  });

  const count = items.length;
  const sum = items.reduce((acc, r) => acc + r.rating, 0);

  return {
    reviews: items,
    averageRating: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    reviewCount: count,
  };
}

/**
 * Stats de reviews pour tous les lieux (utilisé par GET /api/places).
 * Retourne une Map<placeId, {averageRating, reviewCount}>.
 */
export async function getReviewStatsMap(): Promise<
  Map<string, { averageRating: number; reviewCount: number }>
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('place_reviews')
    .select('place_id, rating');

  if (error) {
    console.error('Review stats error:', error);
    return new Map();
  }

  const map = new Map<string, { sum: number; count: number }>();

  for (const row of data ?? []) {
    const pid = String(row.place_id);
    const entry = map.get(pid);
    if (entry) {
      entry.sum += row.rating;
      entry.count += 1;
    } else {
      map.set(pid, { sum: row.rating, count: 1 });
    }
  }

  const result = new Map<string, { averageRating: number; reviewCount: number }>();
  for (const [pid, { sum, count }] of map) {
    result.set(pid, { averageRating: Math.round((sum / count) * 10) / 10, reviewCount: count });
  }
  return result;
}
