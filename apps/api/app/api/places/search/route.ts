import type { PlacesSearchRequest } from '@zaha/shared';
import { getOptionalUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getBookmarkedPlaceIds } from '@/services/bookmarkService';
import { searchNearbyPlaces } from '@/services/locationService';
import { getReviewStatsMap } from '@/services/reviewService';

export async function POST(request: Request) {
  try {
    const auth = await getOptionalUser(request);

    if (!checkRateLimit(rateLimitKey(request, auth?.userId, 'places-search'), 30, 60_000)) {
      return errorResponse('Too many requests, please retry later', 429, request);
    }

    const body = (await request.json()) as Partial<PlacesSearchRequest>;

    if (!body.category || !body.category.trim()) {
      return errorResponse('category is required', 400, request);
    }

    // coords et locationName sont optionnels : sans eux, la recherche
    // porte sur TOUS les lieux correspondant aux critères.
    const result = await searchNearbyPlaces(
      body.category.trim(),
      body.coords ?? null,
      body.locationName,
      body.filter,
      body.searchQuery
    );

    const reviewStats = await getReviewStatsMap();
    // Bookmarks dérivés du JWT uniquement (jamais d'un query param)
    const bookmarkedIds = auth ? await getBookmarkedPlaceIds(auth.userId) : null;

    return jsonResponse({
      ...result,
      places: result.places.map((place) => ({
        ...place,
        averageRating: reviewStats.get(String(place.id))?.averageRating ?? null,
        reviewCount: reviewStats.get(String(place.id))?.reviewCount ?? 0,
        ...(bookmarkedIds ? { bookmarked: bookmarkedIds.has(String(place.id)) } : {}),
      })),
    }, 200, request);
  } catch (error) {
    console.error('POST /api/places/search', error);
    return errorResponse('Failed to search places', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
