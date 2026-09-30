import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type PlaceInsert = Database['public']['Tables']['places']['Insert'];

/** Liste paginée des lieux avec recherche (?q=) et filtre catégorie (?category=). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const category = searchParams.get('category')?.trim();
    const { from, to, page, limit } = getPagination(request.url);

    let query = admin.supabase
      .from('places')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return jsonResponse({ places: data ?? [], total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/places', error);
    return errorResponse('Failed to fetch places');
  }
}

/** Création d'un lieu. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const body = (await request.json()) as Partial<PlaceInsert>;

    if (!body.name?.trim() || !body.category?.trim()) {
      return errorResponse('name and category are required', 400);
    }

    const payload: PlaceInsert = {
      name: body.name.trim(),
      category: body.category.trim(),
      place_type: body.place_type ?? null,
      address: body.address ?? null,
      snippet: body.snippet ?? null,
      opening_hours: body.opening_hours ?? null,
      rating: body.rating ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      google_maps_uri: body.google_maps_uri ?? null,
      photo_url: body.photo_url ?? null,
      is_pro: body.is_pro ?? false,
      city_id: body.city_id ?? null,
      external_id: body.external_id ?? null,
    };

    const { data, error } = await admin.supabase
      .from('places')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ place: data }, 201);
  } catch (error) {
    console.error('POST /api/admin/places', error);
    return errorResponse('Failed to create place');
  }
}
