import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type PlaceUpdate = Database['public']['Tables']['places']['Update'];

export async function GET(
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
      return errorResponse('Place not found', 404);
    }

    const { data, error } = await admin.supabase
      .from('places')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse('Place not found', 404);

    return jsonResponse({ place: data });
  } catch (error) {
    console.error('GET /api/admin/places/[id]', error);
    return errorResponse('Failed to fetch place');
  }
}

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
      return errorResponse('Place not found', 404);
    }

    const body = (await request.json()) as Partial<PlaceUpdate>;

    // Liste blanche des champs modifiables
    const payload: PlaceUpdate = {};
    const fields = [
      'name', 'category', 'place_type', 'address', 'snippet',
      'opening_hours', 'rating', 'latitude', 'longitude',
      'google_maps_uri', 'photo_url', 'is_pro', 'city_id', 'external_id',
    ] as const;
    for (const field of fields) {
      if (body[field] !== undefined) {
        (payload as Record<string, unknown>)[field] = body[field];
      }
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse('No fields to update', 400);
    }

    const { data, error } = await admin.supabase
      .from('places')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse('Place not found', 404);

    return jsonResponse({ place: data });
  } catch (error) {
    console.error('PATCH /api/admin/places/[id]', error);
    return errorResponse('Failed to update place');
  }
}

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
      return errorResponse('Place not found', 404);
    }

    const { error } = await admin.supabase.from('places').delete().eq('id', id);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/places/[id]', error);
    return errorResponse('Failed to delete place');
  }
}
