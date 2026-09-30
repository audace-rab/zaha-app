import { getOptionalUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getBookmarkedPlaceIds } from '@/services/bookmarkService';
import { listAllPlaces } from '@/services/locationService';
import { getReviewStatsMap } from '@/services/reviewService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category')?.trim();

    const places = await listAllPlaces();
    const reviewStats = await getReviewStatsMap();

    const filtered = category && category !== 'all'
      ? places.filter((place) => place.category.toLowerCase() === category.toLowerCase())
      : places;

    // Bookmarks dérivés du JWT uniquement (jamais d'un query param)
    const auth = await getOptionalUser(request);
    const bookmarkedIds = auth ? await getBookmarkedPlaceIds(auth.userId) : null;

    return jsonResponse({
      places: filtered.map((place) => ({
        ...place,
        averageRating: reviewStats.get(place.id)?.averageRating ?? null,
        reviewCount: reviewStats.get(place.id)?.reviewCount ?? 0,
        ...(bookmarkedIds ? { bookmarked: bookmarkedIds.has(place.id) } : {}),
      })),
    }, 200, request);
  } catch (error) {
    console.error('GET /api/places', error);
    return errorResponse('Failed to fetch places', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
