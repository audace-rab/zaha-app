import type { PlacesSearchRequest } from '@zaha/shared';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { searchNearbyPlaces } from '@/services/locationService';

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

    return jsonResponse(result);
  } catch (error) {
    console.error('POST /api/places/search', error);
    return errorResponse('Failed to search places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
