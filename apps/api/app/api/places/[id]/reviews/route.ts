import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';
import { listPlaceReviews, upsertPlaceReview } from '@/services/reviewService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404);
    }
    const result = await listPlaceReviews(placeId);
    return jsonResponse(result);
  } catch (error) {
    console.error('GET /api/places/[id]/reviews', error);
    return errorResponse('Failed to fetch reviews');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404);
    }

    const body = (await request.json()) as {
      userId?: string;
      rating?: number;
      comment?: string;
    };

    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {}
    }
    if (!userId && body.userId?.trim()) {
      userId = body.userId.trim();
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return errorResponse('rating is required and must be between 1 and 5', 400);
    }

    const review = await upsertPlaceReview(placeId, userId, body.rating, body.comment);

    if (!review) {
      return errorResponse('Place not found', 404);
    }

    return jsonResponse({ review });
  } catch (error) {
    console.error('POST /api/places/[id]/reviews', error);
    return errorResponse('Failed to save review');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
