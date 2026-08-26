import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getFollowers } from '@/services/followService';
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
    const result = await getFollowers(userId);
    return jsonResponse(result);
  } catch (error) {
    console.error('GET /api/users/[id]/followers', error);
    return errorResponse('Failed to fetch followers');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
