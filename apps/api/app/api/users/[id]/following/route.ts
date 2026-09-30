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
      return errorResponse('User not found', 404, request);
    }
    const result = await getFollowing(userId);
    return jsonResponse(result, 200, request);
  } catch (error) {
    console.error('GET /api/users/[id]/following', error);
    return errorResponse('Failed to fetch following', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
