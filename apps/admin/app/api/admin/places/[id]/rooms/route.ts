import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type RoomRow = Database['public']['Tables']['place_room_types']['Row'];

interface RoomInput {
  id?: string;
  name?: string;
  description?: string | null;
  capacity?: number;
  price_per_night?: number;
  currency?: string;
  is_active?: boolean;
}

/** Toutes les chambres du lieu (actives ou non), dans l'ordre d'affichage. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return errorResponse('Forbidden', 403);

  try {
    const { id } = await params;
    if (!isValidUuid(id)) return errorResponse('Place not found', 404);

    const { data, error } = await admin.supabase
      .from('place_room_types')
      .select('*')
      .eq('place_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;

    return jsonResponse({ rooms: (data ?? []) as RoomRow[] });
  } catch (error) {
    console.error('GET /api/admin/places/[id]/rooms', error);
    return errorResponse('Failed to fetch rooms');
  }
}

/**
 * Synchronise la liste des chambres du lieu avec celle envoyée :
 * - id connu  -> mise à jour ;
 * - sans id   -> création ;
 * - absent    -> suppression (les réservations existantes gardent le nom et le prix).
 * L'ordre du tableau devient l'ordre d'affichage.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return errorResponse('Forbidden', 403);

  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) return errorResponse('Place not found', 404);

    const body = (await request.json()) as { rooms?: RoomInput[] };
    if (!Array.isArray(body.rooms)) {
      return errorResponse('rooms must be an array', 400);
    }

    const { data: place } = await admin.supabase
      .from('places')
      .select('id')
      .eq('id', placeId)
      .maybeSingle();
    if (!place) return errorResponse('Place not found', 404);

    const rooms: Database['public']['Tables']['place_room_types']['Insert'][] = [];
    for (const [index, input] of body.rooms.entries()) {
      const name = input.name?.trim();
      if (!name) return errorResponse(`Chambre ${index + 1} : le nom est obligatoire`, 400);

      const capacity = Number(input.capacity ?? 2);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
        return errorResponse(`Chambre « ${name} » : capacité invalide (1 à 50)`, 400);
      }
      const price = Number(input.price_per_night ?? 0);
      if (!Number.isFinite(price) || price < 0) {
        return errorResponse(`Chambre « ${name} » : prix par nuit invalide`, 400);
      }
      if (input.id !== undefined && !isValidUuid(input.id)) {
        return errorResponse(`Chambre « ${name} » : identifiant invalide`, 400);
      }

      rooms.push({
        ...(input.id ? { id: input.id } : {}),
        place_id: placeId,
        name,
        description: input.description?.trim() || null,
        capacity,
        price_per_night: price,
        currency: input.currency?.trim() || 'MGA',
        sort_order: index,
        is_active: input.is_active ?? true,
      });
    }

    // Suppression des chambres retirées de la liste.
    const { data: existing, error: existingError } = await admin.supabase
      .from('place_room_types')
      .select('id')
      .eq('place_id', placeId);
    if (existingError) throw existingError;

    // Un id doit appartenir à ce lieu (évite de réécrire la chambre d'un autre lieu).
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    if (rooms.some((r) => r.id && !existingIds.has(r.id))) {
      return errorResponse('Une chambre n\u2019appartient pas à ce lieu', 400);
    }

    const keptIds = new Set(rooms.map((r) => r.id).filter(Boolean) as string[]);
    const toDelete = [...existingIds].filter((rid) => !keptIds.has(rid));
    if (toDelete.length > 0) {
      const { error } = await admin.supabase
        .from('place_room_types')
        .delete()
        .eq('place_id', placeId)
        .in('id', toDelete);
      if (error) throw error;
    }

    if (rooms.length > 0) {
      const { error } = await admin.supabase.from('place_room_types').upsert(rooms, { onConflict: 'id' });
      if (error) throw error;
    }

    const { data, error } = await admin.supabase
      .from('place_room_types')
      .select('*')
      .eq('place_id', placeId)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    return jsonResponse({ rooms: data ?? [] });
  } catch (error) {
    console.error('PUT /api/admin/places/[id]/rooms', error);
    return errorResponse('Failed to save rooms');
  }
}
