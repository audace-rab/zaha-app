import { createAdminClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Toggle like d'un post par un utilisateur.
 * Retourne null si le post n'existe pas.
 */
export async function togglePostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likes: number } | null> {
  const supabase = createAdminClient();

  // Le post doit exister
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    console.error('Post lookup error:', postError);
    return null;
  }
  if (!post) return null;

  // Like déjà présent ?
  const { data: existing } = await supabase
    .from('likes')
    .select('user_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) {
      console.error('Unlike error:', error);
      throw new Error('Failed to unlike post');
    }
  } else {
    // 23505 = unique_violation : like créé entre-temps par une requête
    // concurrente -> considérer comme liké plutôt que d'échouer.
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') {
      console.error('Like error:', error);
      throw new Error('Failed to like post');
    }
  }

  const { count, error: countError } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (countError) {
    console.error('Likes count error:', countError);
  }

  return { liked: !existing, likes: count ?? 0 };
}
