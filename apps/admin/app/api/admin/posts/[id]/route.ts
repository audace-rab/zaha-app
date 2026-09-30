import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';

/** Supprime un post (et ses médias associés). */
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
      return errorResponse('Post not found', 404);
    }

    // Suppression explicite des dépendances au cas où les cascades
    // ne seraient pas configurées côté base.
    await admin.supabase.from('post_media').delete().eq('post_id', id);
    await admin.supabase.from('comments').delete().eq('post_id', id);
    await admin.supabase.from('likes').delete().eq('post_id', id);

    const { error } = await admin.supabase.from('posts').delete().eq('id', id);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/posts/[id]', error);
    return errorResponse('Failed to delete post');
  }
}
