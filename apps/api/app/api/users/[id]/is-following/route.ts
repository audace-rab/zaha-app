import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isFollowing } from '@/services/followService';
import { isValidUuid } from '@/services/postService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    if (!isValidUuid(followingId)) {
      return errorResponse('User not found', 404, request);
    }

    // Le follower est toujours l'utilisateur authentifié (JWT)
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401, request);
    }

    const following = await isFollowing(auth.supabase, auth.userId, followingId);
    return jsonResponse({ following }, 200, request);
  } catch (error) {
    console.error('GET /api/users/[id]/is-following', error);
    return errorResponse('Failed to check follow status', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
