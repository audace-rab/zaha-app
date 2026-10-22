import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { listRoomTypes } from '@/services/roomService';

/** Types de chambre actifs d'un lieu (lecture publique). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404, request);
    }

    const rooms = await listRoomTypes(placeId);
    return jsonResponse({ rooms }, 200, request);
  } catch (error) {
    console.error('GET /api/places/[id]/rooms', error);
    return errorResponse('Failed to fetch rooms', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
