import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
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

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const result = await togglePostLike(auth.supabase, postId, auth.userId);

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
