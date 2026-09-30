import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

/** Liste paginée des avis avec auteur et lieu. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { from, to, page, limit } = getPagination(request.url);

    const { data, count, error } = await admin.supabase
      .from('place_reviews')
      .select('*, profiles(name), places(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const reviews = (data ?? []).map((r) => {
      const profile = r.profiles as unknown as { name: string } | null;
      const place = r.places as unknown as { name: string } | null;
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        authorName: profile?.name ?? null,
        placeName: place?.name ?? null,
      };
    });

    return jsonResponse({ reviews, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/reviews', error);
    return errorResponse('Failed to fetch reviews');
  }
}
