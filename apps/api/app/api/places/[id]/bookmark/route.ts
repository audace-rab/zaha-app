import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { toggleBookmark } from '@/services/bookmarkService';
import { isValidUuid } from '@/services/postService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;

    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const result = await toggleBookmark(auth.supabase, placeId, auth.userId);

    if (result === null) {
      return errorResponse('Place not found', 404);
    }

    return jsonResponse({ bookmarked: result });
  } catch (error) {
    console.error('POST /api/places/[id]/bookmark', error);
    return errorResponse('Failed to toggle bookmark');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
