import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

/** Liste paginée des posts avec auteur et médias. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { from, to, page, limit } = getPagination(request.url);

    const { data, count, error } = await admin.supabase
      .from('posts')
      .select('*, profiles(name, avatar_url), post_media(type, url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const posts = (data ?? []).map((p) => {
      const profile = p.profiles as unknown as { name: string; avatar_url: string | null } | null;
      return {
        id: p.id,
        content: p.content,
        location: p.location,
        is_business: p.is_business,
        created_at: p.created_at,
        authorName: profile?.name ?? null,
        authorAvatar: profile?.avatar_url ?? null,
        media: (p.post_media as unknown as Array<{ type: string; url: string }>) ?? [],
      };
    });

    return jsonResponse({ posts, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/posts', error);
    return errorResponse('Failed to fetch posts');
  }
}
