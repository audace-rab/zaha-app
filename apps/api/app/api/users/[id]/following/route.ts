import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getFollowing } from '@/services/followService';
import { isValidUuid } from '@/services/postService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    if (!isValidUuid(userId)) {
      return errorResponse('User not found', 404);
    }
    const result = await getFollowing(userId);
    return jsonResponse(result);
  } catch (error) {
    console.error('GET /api/users/[id]/following', error);
    return errorResponse('Failed to fetch following');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
