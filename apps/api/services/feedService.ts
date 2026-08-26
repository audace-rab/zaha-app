import type { FeedItem } from '@zaha/shared';
import { createAdminClient } from '@/lib/supabase/server';
import { getFollowingIds } from '@/services/followService';

export interface FeedFilters {
  location?: string;
  query?: string;
  userId?: string;
}

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,()"']/g, ' ').trim();
}

export async function getFeed(filters?: FeedFilters): Promise<FeedItem[]> {
  try {
    const supabase = createAdminClient();

    // Quand userId est fourni, ne montrer que les posts des users suivis
    let followedIds: string[] | null = null;
    const viewerId = filters?.userId?.trim() || undefined;

    if (viewerId) {
      const ids = await getFollowingIds(viewerId);
      if (ids.size > 0) {
        followedIds = [...ids];
      }
      // Si ne suit personne → montrer tous les posts (pas de filtre)
    }

  let dbQuery = supabase
    .from('posts')
    .select(`
      id,
      content,
      location,
      is_business,
      created_at,
      author:profiles!posts_author_id_fkey (
        id,
        name,
        avatar_url,
        country_flag
      ),
      post_media ( type, url, sort_order ),
      likes ( user_id ),
      comments (
        id,
        text,
        created_at,
        author:profiles!comments_author_id_fkey ( name, avatar_url )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (followedIds) {
    dbQuery = dbQuery.in('author_id', followedIds);
  }

  // Filtres optionnels : par défaut, TOUT le feed est renvoyé.
  const location = filters?.location?.trim();
  if (location) {
    dbQuery = dbQuery.ilike('location', `%${sanitizeIlike(location)}%`);
  }

  const query = filters?.query?.trim();
  if (query) {
    const safe = sanitizeIlike(query);
    if (safe) {
      dbQuery = dbQuery.or(`content.ilike.%${safe}%,location.ilike.%${safe}%`);
    }
  }

  const { data: posts, error } = await dbQuery;

  if (error) {
    console.error('Feed fetch error:', error);
    return [];
  }

  if (!posts?.length) return [];

  return posts.map((post) => {
    const author = Array.isArray(post.author) ? post.author[0] : post.author;
    const media = (post.post_media ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ type: m.type as 'image' | 'video', url: m.url }));

    const commentsList = (post.comments ?? []).map((c) => {
      const commentAuthor = Array.isArray(c.author) ? c.author[0] : c.author;
      return {
        id: c.id,
        author: commentAuthor?.name ?? 'Anonyme',
        authorAvatar: commentAuthor?.avatar_url ?? '',
        text: c.text,
        timestamp: new Date(c.created_at).getTime(),
        mentions: [],
      };
    });

    const item: FeedItem = {
      id: post.id,
      author: author?.name ?? 'Utilisateur',
      authorAvatar: author?.avatar_url ?? '',
      authorCountryFlag: author?.country_flag ?? undefined,
      media,
      content: post.content,
      likes: post.likes?.length ?? 0,
      commentsList,
      isBusiness: post.is_business,
      location: post.location ?? '',
      timestamp: new Date(post.created_at).toISOString(),
    };

    if (viewerId) {
      item.hasLiked = (post.likes ?? []).some((l) => l.user_id === viewerId);
    }

    return item;
  });
  } catch (error) {
    console.error('Feed service error:', error);
    return [];
  }
}
