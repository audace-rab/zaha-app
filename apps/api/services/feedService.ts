import type { FeedItem, FeedPage } from '@zaha/shared';
import { createAdminClient } from '@/lib/supabase/server';

export interface FeedFilters {
  location?: string;
  query?: string;
  /** Viewer authentifié (JWT) — calcul de hasLiked. */
  viewerId?: string;
}

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,()"']/g, ' ').trim();
}

export async function getFeed(filters?: FeedFilters): Promise<FeedPage> {
  try {
    const supabase = createAdminClient();
    const viewerId = filters?.viewerId;

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
        post_media ( type, url, sort_order )
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

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
      return { items: [], nextCursor: null };
    }

    if (!posts?.length) return { items: [], nextCursor: null };

    const pageIds = posts.map((p) => p.id);

    // Compteurs likes/comments (2 requêtes groupées côté JS) au lieu
    // d'embarquer toutes les lignes dans le SELECT posts.
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from('likes').select('post_id, user_id').in('post_id', pageIds),
      supabase.from('comments').select('post_id').in('post_id', pageIds),
    ]);

    const likesCount = new Map<string, number>();
    const likedByViewer = new Set<string>();
    for (const row of likesRes.data ?? []) {
      const pid = String(row.post_id);
      likesCount.set(pid, (likesCount.get(pid) ?? 0) + 1);
      if (viewerId && row.user_id === viewerId) likedByViewer.add(pid);
    }

    const commentsCount = new Map<string, number>();
    for (const row of commentsRes.data ?? []) {
      const pid = String(row.post_id);
      commentsCount.set(pid, (commentsCount.get(pid) ?? 0) + 1);
    }

    const items: FeedItem[] = posts.map((post) => {
      const author = Array.isArray(post.author) ? post.author[0] : post.author;
      const media = (post.post_media ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({ type: m.type as 'image' | 'video', url: m.url }));

      const item: FeedItem = {
        id: post.id,
        authorId: author?.id ?? '',
        author: author?.name ?? 'Utilisateur',
        authorAvatar: author?.avatar_url ?? '',
        authorCountryFlag: author?.country_flag ?? undefined,
        media,
        content: post.content,
        likes: likesCount.get(post.id) ?? 0,
        commentsList: [],
        commentsCount: commentsCount.get(post.id) ?? 0,
        isBusiness: post.is_business,
        location: post.location ?? '',
        timestamp: new Date(post.created_at).toISOString(),
      };

      if (viewerId) {
        item.hasLiked = likedByViewer.has(post.id);
      }

      return item;
    });

    return { items, nextCursor: null };
  } catch (error) {
    console.error('Feed service error:', error);
    return { items: [], nextCursor: null };
  }
}
