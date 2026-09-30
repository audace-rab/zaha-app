import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { toggleFollow, unfollow } from '@/services/followService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    if (!isValidUuid(followingId)) {
      return errorResponse('User not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    if (auth.userId === followingId) {
      return errorResponse('Cannot follow yourself', 400);
    }

    const following = await toggleFollow(auth.supabase, auth.userId, followingId);
    return jsonResponse({ following });
  } catch (error) {
    console.error('POST /api/users/[id]/follow', error);
    return errorResponse('Failed to toggle follow');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    if (!isValidUuid(followingId)) {
      return errorResponse('User not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    // DELETE idempotent : unfollow uniquement, ne recrée jamais le follow
    await unfollow(auth.supabase, auth.userId, followingId);
    return jsonResponse({ following: false });
  } catch (error) {
    console.error('DELETE /api/users/[id]/follow', error);
    return errorResponse('Failed to unfollow');
  }
}
