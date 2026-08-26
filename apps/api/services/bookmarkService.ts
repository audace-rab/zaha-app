import { createAdminClient } from '@/lib/supabase/server';

/**
 * Toggle bookmark d'un lieu pour un utilisateur.
 * Retourne null si le lieu n'existe pas.
 */
export async function toggleBookmark(
  placeId: string,
  userId: string
): Promise<boolean | null> {
  const supabase = createAdminClient();

  const { data: place, error: placeError } = await supabase
    .from('places')
    .select('id')
    .eq('id', placeId)
    .maybeSingle();

  if (placeError) {
    console.error('Place lookup error:', placeError);
    return null;
  }
  if (!place) return null;

  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('place_id', placeId)
      .eq('user_id', userId);
    if (error) {
      console.error('Unbookmark error:', error);
      throw new Error('Failed to remove bookmark');
    }
    return false;
  }

  // 23505 = unique_violation : bookmark créé entre-temps par une requête
  // concurrente -> considérer comme bookmarké plutôt que d'échouer.
  const { error } = await supabase
    .from('bookmarks')
    .insert({ place_id: placeId, user_id: userId });
  if (error && error.code !== '23505') {
    console.error('Bookmark error:', error);
    throw new Error('Failed to add bookmark');
  }

  return true;
}

export async function isBookmarked(
  placeId: string,
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Bookmark lookup error:', error);
    return false;
  }
  return Boolean(data);
}

export async function getBookmarkedPlaceIds(userId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookmarks')
    .select('place_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Bookmarks fetch error:', error);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.place_id)));
}
