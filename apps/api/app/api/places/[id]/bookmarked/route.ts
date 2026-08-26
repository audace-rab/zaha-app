import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
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

    // Session Supabase prioritaire, sinon ?userId=
    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {
        // token invalide : retomber sur query param
      }
    }

    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('userId')?.trim();
    if (!userId && userIdParam) {
      userId = userIdParam;
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const bookmarked = await isBookmarked(placeId, userId);

    return jsonResponse({ bookmarked });
  } catch (error) {
    console.error('GET /api/places/[id]/bookmarked', error);
    return errorResponse('Failed to check bookmark');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
