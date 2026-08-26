import { createAdminClient } from '@/lib/supabase/server';

/**
 * Toggle follow. Retourne true si maintenant en train de suivre, false si désabonné.
 */
export async function toggleFollow(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) {
      console.error('Unfollow error:', error);
      throw new Error('Failed to unfollow');
    }
    return false;
  }

  // 23505 = unique_violation (follow créé entre-temps) → considérer comme suivi
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error && error.code !== '23505') {
    console.error('Follow error:', error);
    throw new Error('Failed to follow');
  }

  return true;
}

export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return Boolean(data);
}

export async function getFollowingIds(userId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) {
    console.error('Following ids fetch error:', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => String(r.following_id)));
}

export async function getFollowers(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower_id,
      profile:profiles!follows_follower_id_fkey (
        id, name, avatar_url, bio, country_flag
      )
    `)
    .eq('following_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Followers fetch error:', error);
    return { followers: [], count: 0 };
  }

  const followers = (data ?? [])
    .map((r) => {
      const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return profile;
    })
    .filter(Boolean);

  return { followers, count: followers.length };
}

export async function getFollowing(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following_id,
      profile:profiles!follows_following_id_fkey (
        id, name, avatar_url, bio, country_flag
      )
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Following fetch error:', error);
    return { following: [], count: 0 };
  }

  const following = (data ?? [])
    .map((r) => {
      const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return profile;
    })
    .filter(Boolean);

  return { following, count: following.length };
}
