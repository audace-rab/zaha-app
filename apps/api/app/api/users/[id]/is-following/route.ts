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
      return errorResponse('User not found', 404);
    }

    const url = new URL(request.url);
    const followerId = url.searchParams.get('followerId')?.trim();
    if (!followerId || !isValidUuid(followerId)) {
      return errorResponse('followerId is required and must be a valid UUID', 400);
    }

    const following = await isFollowing(followerId, followingId);
    return jsonResponse({ following });
  } catch (error) {
    console.error('GET /api/users/[id]/is-following', error);
    return errorResponse('Failed to check follow status');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
