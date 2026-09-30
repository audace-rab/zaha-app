import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isBookmarked } from '@/services/bookmarkService';
import { isValidUuid } from '@/services/postService';

export async function GET(
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

    const bookmarked = await isBookmarked(auth.supabase, placeId, auth.userId);

    return jsonResponse({ bookmarked });
  } catch (error) {
    console.error('GET /api/places/[id]/bookmarked', error);
    return errorResponse('Failed to check bookmark');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
