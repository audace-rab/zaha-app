import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import { MAX_BANNER_TITLE, parseLink } from '@/lib/banners';
import type { Database } from '@/lib/supabase/database.types';

type BannerUpdate = Database['public']['Tables']['ad_banners']['Update'];

/** Modifie une bannière : titre, lien, activation. Body : { title?, linkUrl?, isActive? } */
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
    if (!isValidUuid(id)) return errorResponse('Banner not found', 404);

    const body = (await request.json()) as {
      title?: string;
      linkUrl?: string | null;
      isActive?: boolean;
    };

    const payload: BannerUpdate = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return errorResponse('title cannot be empty', 400);
      if (title.length > MAX_BANNER_TITLE) {
        return errorResponse(`title max ${MAX_BANNER_TITLE} caractères`, 400);
      }
      payload.title = title;
    }
    if (body.linkUrl !== undefined) {
      const linkUrl = parseLink(body.linkUrl);
      if (linkUrl === undefined) return errorResponse('linkUrl must be a valid http(s) URL', 400);
      payload.link_url = linkUrl;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return errorResponse('isActive must be a boolean', 400);
      payload.is_active = body.isActive;
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse('No fields to update', 400);
    }

    const { data, error } = await admin.supabase
      .from('ad_banners')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return errorResponse('Banner not found', 404);

    return jsonResponse({ banner: data });
  } catch (error) {
    console.error('PATCH /api/admin/banners/[id]', error);
    return errorResponse('Failed to update banner');
  }
}

/** Supprime une bannière. */
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
    if (!isValidUuid(id)) return errorResponse('Banner not found', 404);

    const { error } = await admin.supabase.from('ad_banners').delete().eq('id', id);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/banners/[id]', error);
    return errorResponse('Failed to delete banner');
  }
}
