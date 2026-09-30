import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';

/** Supprime un avis. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return errorResponse('Review not found', 404);
    }

    const { error } = await admin.supabase.from('place_reviews').delete().eq('id', id);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/reviews/[id]', error);
    return errorResponse('Failed to delete review');
  }
}
