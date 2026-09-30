import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

/** Liste paginée des commentaires avec auteur. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { from, to, page, limit } = getPagination(request.url);

    const { data, count, error } = await admin.supabase
      .from('comments')
      .select('*, profiles(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const comments = (data ?? []).map((c) => {
      const profile = c.profiles as unknown as { name: string } | null;
      return {
        id: c.id,
        post_id: c.post_id,
        text: c.text,
        created_at: c.created_at,
        authorName: profile?.name ?? null,
      };
    });

    return jsonResponse({ comments, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/comments', error);
    return errorResponse('Failed to fetch comments');
  }
}
