import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { getAvailability } from '@/services/reservationService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date')?.trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse('date is required (YYYY-MM-DD)', 400);
    }

    const reservations = await getAvailability(placeId, date);
    return jsonResponse({ reservations });
  } catch (error) {
    console.error('GET /api/places/[id]/reservations', error);
    return errorResponse('Failed to fetch availability');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
