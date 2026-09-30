import { jsonResponse, optionsResponse } from '@/lib/api/response';
import { countPlacesByCategory } from '@/services/locationService';

export async function GET(request: Request) {
  try {
    const categories = await countPlacesByCategory();
    return jsonResponse(categories, 200, request);
  } catch (error) {
    console.error('GET /api/places/categories', error);
    return jsonResponse([], 200, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
