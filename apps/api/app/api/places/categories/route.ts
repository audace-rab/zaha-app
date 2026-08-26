import { jsonResponse, optionsResponse } from '@/lib/api/response';
import { countPlacesByCategory } from '@/services/locationService';

export async function GET() {
  try {
    const categories = await countPlacesByCategory();
    return jsonResponse(categories);
  } catch (error) {
    console.error('GET /api/places/categories', error);
    return jsonResponse([]);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
