import type { PlacesSearchRequest } from '@zaha/shared';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { searchNearbyPlaces } from '@/services/geminiService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlacesSearchRequest;

    if (!body.category || !body.coords) {
      return errorResponse('category and coords are required', 400);
    }

    const result = await searchNearbyPlaces(
      body.category,
      body.coords,
      body.filter,
      body.searchQuery,
      body.locationName
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
