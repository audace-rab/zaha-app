import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { listNearbyPlaces } from '@/services/locationService';

const DEFAULT_RADIUS_M = 5000;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 100000;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const radiusRaw = Number(url.searchParams.get('radius'));

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return errorResponse('lat is required and must be between -90 and 90', 400);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return errorResponse('lng is required and must be between -180 and 180', 400);
    }

    const radius = Number.isFinite(radiusRaw)
      ? Math.min(Math.max(radiusRaw, MIN_RADIUS_M), MAX_RADIUS_M)
      : DEFAULT_RADIUS_M;

    const places = await listNearbyPlaces(lat, lng, radius);

    return jsonResponse({ places });
  } catch (error) {
    console.error('GET /api/places/nearby', error);
    return errorResponse('Failed to fetch nearby places');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
