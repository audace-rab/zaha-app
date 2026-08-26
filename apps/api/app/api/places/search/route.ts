import type { PlacesSearchRequest } from '@zaha/shared';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getBookmarkedPlaceIds } from '@/services/bookmarkService';
import { searchNearbyPlaces } from '@/services/locationService';
import { isValidUuid } from '@/services/postService';
import { getReviewStatsMap } from '@/services/reviewService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PlacesSearchRequest>;

    if (!body.category || !body.category.trim()) {
      return errorResponse('category is required', 400);
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
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('userId')?.trim();
    const bookmarkedIds =
      userIdParam && isValidUuid(userIdParam)
        ? await getBookmarkedPlaceIds(userIdParam)
        : null;

    return jsonResponse({
      ...result,
      places: result.places.map((place) => ({
        ...place,
        averageRating: reviewStats.get(String(place.id))?.averageRating ?? null,
        reviewCount: reviewStats.get(String(place.id))?.reviewCount ?? 0,
        ...(bookmarkedIds ? { bookmarked: bookmarkedIds.has(String(place.id)) } : {}),
      })),
    });
  } catch (error) {
    console.error('POST /api/places/search', error);
    return errorResponse('Failed to search places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
