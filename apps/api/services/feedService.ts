import type { FeedItem, FeedPage } from '@zaha/shared';
import { createAdminClient } from '@/lib/supabase/server';
import { getFollowingIds } from '@/services/followService';

export interface FeedFilters {
  location?: string;
  query?: string;
  /** Viewer authentifié (JWT) — filtre "suivis" + hasLiked. */
  viewerId?: string;
  /** Curseur keyset "<created_at>|<id>" de la page précédente. */
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,()"']/g, ' ').trim();
}

function parseCursor(raw?: string): { createdAt: string; id: string } | null {
  if (!raw) return null;
  const sep = raw.indexOf('|');
  if (sep <= 0) return null;
  const createdAt = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

export async function getFeed(filters?: FeedFilters): Promise<FeedPage> {
  try {
    const supabase = createAdminClient();
    const limit = Math.min(Math.max(filters?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    // Quand viewerId est fourni, ne montrer que les posts des users suivis
    let followedIds: string[] | null = null;
    const viewerId = filters?.viewerId;

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
        post_media ( type, url, sort_order )
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // +1 pour détecter la page suivante

    if (followedIds) {
      dbQuery = dbQuery.in('author_id', followedIds);
    }

    // Pagination keyset : (created_at, id) strictement avant le curseur
    const cursor = parseCursor(filters?.cursor);
    if (cursor) {
      dbQuery = dbQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

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

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const pageIds = page.map((p) => p.id);

    // Compteurs likes/comments sur la page uniquement (2 requêtes groupées
    // côté JS) au lieu d'embarquer toutes les lignes dans le SELECT posts.
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

    const items: FeedItem[] = page.map((post) => {
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

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null;

    return { items, nextCursor };
  } catch (error) {
    console.error('Feed service error:', error);
    return { items: [], nextCursor: null };
  }
}
