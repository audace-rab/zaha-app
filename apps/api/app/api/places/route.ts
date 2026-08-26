import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getBookmarkedPlaceIds } from '@/services/bookmarkService';
import { listAllPlaces } from '@/services/locationService';
import { isValidUuid } from '@/services/postService';
import { getReviewStatsMap } from '@/services/reviewService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category')?.trim();
    const userIdParam = url.searchParams.get('userId')?.trim();

    const places = await listAllPlaces();
    const reviewStats = await getReviewStatsMap();

    let filtered = category && category !== 'all'
      ? places.filter((place) => place.category.toLowerCase() === category.toLowerCase())
      : places;

    const bookmarkedIds =
      userIdParam && isValidUuid(userIdParam)
        ? await getBookmarkedPlaceIds(userIdParam)
        : null;

    return jsonResponse({
      places: filtered.map((place) => ({
        ...place,
        averageRating: reviewStats.get(place.id)?.averageRating ?? null,
        reviewCount: reviewStats.get(place.id)?.reviewCount ?? 0,
        ...(bookmarkedIds ? { bookmarked: bookmarkedIds.has(place.id) } : {}),
      })),
    });
  } catch (error) {
    console.error('GET /api/places', error);
    return errorResponse('Failed to fetch places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
