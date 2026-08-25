import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
import { isValidUuid, togglePostLike } from '@/services/postService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    if (!isValidUuid(postId)) {
      return errorResponse('Post not found', 404);
    }

    const body = (await request.json().catch(() => ({}))) as { userId?: string };

    // Préférer la session Supabase si un token est fourni, sinon userId explicite
    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {
        // token invalide : retomber sur body.userId
      }
    }

    if (!userId && body.userId?.trim()) {
      userId = body.userId.trim();
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const result = await togglePostLike(postId, userId);

    if (!result) {
      return errorResponse('Post not found', 404);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('POST /api/posts/[id]/like', error);
    return errorResponse('Failed to toggle like');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
