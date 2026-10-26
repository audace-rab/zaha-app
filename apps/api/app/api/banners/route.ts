import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Bannières publicitaires actives (lecture publique), de la plus récente à la plus ancienne.
 * Affichées par le mobile dans l'onglet Lieux, juste avant les résultats.
 */
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('ad_banners')
      .select('id, title, image_url, link_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Banners fetch error:', error);
      return errorResponse('Failed to fetch banners', 500, request);
    }

    return jsonResponse(
      {
        banners: (data ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          imageUrl: b.image_url,
          linkUrl: b.link_url ?? undefined,
        })),
      },
      200,
      request
    );
  } catch (error) {
    console.error('GET /api/banners', error);
    return errorResponse('Failed to fetch banners', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
