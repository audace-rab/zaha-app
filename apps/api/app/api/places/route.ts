import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { listAllPlaces } from '@/services/locationService';

export async function GET() {
  try {
    const places = await listAllPlaces();
    return jsonResponse({ places });
  } catch (error) {
    console.error('GET /api/places', error);
    return errorResponse('Failed to fetch places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
