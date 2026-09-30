import { getOptionalUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getCityCoordinates, identifyCity } from '@/services/locationService';

export async function POST(request: Request) {
  try {
    const auth = await getOptionalUser(request);

    if (!checkRateLimit(rateLimitKey(request, auth?.userId, 'geocode'), 30, 60_000)) {
      return errorResponse('Too many requests, please retry later', 429, request);
    }

    const body = await request.json();

    if (body.action === 'identify') {
      if (!body.query) return errorResponse('query is required', 400, request);
      const result = await identifyCity(body.query);
      return jsonResponse({ result }, 200, request);
    }

    if (!body.address) return errorResponse('address is required', 400, request);
    const coords = await getCityCoordinates(body.address);
    return jsonResponse({ coords }, 200, request);
  } catch (error) {
    console.error('POST /api/places/geocode', error);
    return errorResponse('Geocoding failed', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
