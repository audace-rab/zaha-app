import type { RoomType } from '@zaha/shared';
import { createAdminClient } from '@/lib/supabase/server';

/** Liste des chambres actives d'un lieu, triées par ordre d'affichage puis prix. */
export async function listRoomTypes(placeId: string): Promise<RoomType[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('place_room_types')
    .select('id, place_id, name, description, capacity, price_per_night, currency')
    .eq('place_id', placeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('price_per_night', { ascending: true });

  if (error) {
    console.error('List room types error:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    description: row.description ?? undefined,
    capacity: row.capacity,
    pricePerNight: Number(row.price_per_night),
    currency: row.currency,
  }));
}
