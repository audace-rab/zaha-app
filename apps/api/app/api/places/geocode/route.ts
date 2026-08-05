import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getCoordinatesFromAddress, identifyLocation } from '@/services/geminiService';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'identify') {
      if (!body.query) return errorResponse('query is required', 400);
      const result = await identifyLocation(body.query);
      return jsonResponse({ result });
    }

    if (!body.address) return errorResponse('address is required', 400);
    const coords = await getCoordinatesFromAddress(body.address);
    return jsonResponse({ coords });
  } catch (error) {
    console.error('POST /api/places/geocode', error);
    return errorResponse('Geocoding failed');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
