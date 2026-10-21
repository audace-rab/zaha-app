import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

/** Liste paginée des posts avec auteur, médias et commentaires (avec leur auteur). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { from, to, page, limit } = getPagination(request.url);

    const { data, count, error } = await admin.supabase
      .from('posts')
      // FK explicites : posts<->profiles existe aussi via likes (many-to-many) → ambigu sinon.
      .select(
        '*, profiles!posts_author_id_fkey(name, avatar_url), place:places!posts_place_id_fkey(id, name, status), post_media(type, url), comments(id, text, created_at, profiles!comments_author_id_fkey(name))',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'comments', ascending: true })
      .range(from, to);

    if (error) throw error;

    const posts = (data ?? []).map((p) => {
      const profile = p.profiles as unknown as { name: string; avatar_url: string | null } | null;
      const rawPlace = (Array.isArray(p.place) ? p.place[0] : p.place) as unknown as
        | { id: string; name: string; status: string }
        | null
        | undefined;
      const rawComments = (p.comments ?? []) as unknown as Array<{
        id: string;
        text: string;
        created_at: string;
        profiles: { name: string } | null;
      }>;
      return {
        id: p.id,
        content: p.content,
        location: p.location,
        is_business: p.is_business,
        created_at: p.created_at,
        authorName: profile?.name ?? null,
        authorAvatar: profile?.avatar_url ?? null,
        place: rawPlace ? { id: rawPlace.id, name: rawPlace.name, status: rawPlace.status } : null,
        media: (p.post_media as unknown as Array<{ type: string; url: string }>) ?? [],
        comments: rawComments.map((c) => ({
          id: c.id,
          text: c.text,
          created_at: c.created_at,
          authorName: c.profiles?.name ?? null,
        })),
      };
    });

    return jsonResponse({ posts, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/posts', error);
    return errorResponse('Failed to fetch posts');
  }
}
