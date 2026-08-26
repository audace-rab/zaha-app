import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { getBookmarkedPlaceIds } from '@/services/bookmarkService';
import { isValidUuid } from '@/services/postService';
import { getReviewStatsMap } from '@/services/reviewService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.trim();

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const bookmarkedIds = await getBookmarkedPlaceIds(userId);
    if (bookmarkedIds.size === 0) {
      return jsonResponse({ places: [] });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .in('id', [...bookmarkedIds]);

    if (error) {
      console.error('Bookmarked places fetch error:', error);
      return errorResponse('Failed to fetch bookmarked places');
    }

    const reviewStats = await getReviewStatsMap();
    const places = (data ?? []).map((place) => ({
      ...place,
      averageRating: reviewStats.get(String(place.id))?.averageRating ?? null,
      reviewCount: reviewStats.get(String(place.id))?.reviewCount ?? 0,
      bookmarked: true,
    }));

    return jsonResponse({ places });
  } catch (error) {
    console.error('GET /api/places/bookmarked', error);
    return errorResponse('Failed to fetch bookmarked places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
