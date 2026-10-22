import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';

/**
 * Rattache un post à un lieu (ou le détache avec placeId = null).
 * Body : { "placeId": "<uuid>" | null }
 * Un post rattaché à un lieu VIP ou Premium affiche badge + boutons réserver / appeler sur mobile.
 */
export async function PATCH(
  request: Request,
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

    const body = (await request.json()) as { placeId?: string | null };
    if (body.placeId === undefined) {
      return errorResponse('placeId is required (uuid or null)', 400);
    }
    if (body.placeId !== null && !isValidUuid(body.placeId)) {
      return errorResponse('placeId must be a valid UUID or null', 400);
    }

    if (body.placeId !== null) {
      const { data: place } = await admin.supabase
        .from('places')
        .select('id')
        .eq('id', body.placeId)
        .maybeSingle();
      if (!place) return errorResponse('Place not found', 404);
    }

    const { data, error } = await admin.supabase
      .from('posts')
      .update({ place_id: body.placeId })
      .eq('id', id)
      .select('id, place_id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse('Post not found', 404);

    return jsonResponse({ post: data });
  } catch (error) {
    console.error('PATCH /api/admin/posts/[id]', error);
    return errorResponse('Failed to update post');
  }
}

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
