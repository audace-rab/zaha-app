import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';
import { toggleFollow } from '@/services/followService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    if (!isValidUuid(followingId)) {
      return errorResponse('User not found', 404);
    }

    const body = (await request.json().catch(() => ({}))) as { followerId?: string };

    let followerId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) followerId = data.user.id;
      } catch {}
    }
    if (!followerId && body.followerId?.trim()) {
      followerId = body.followerId.trim();
    }

    if (!followerId || !isValidUuid(followerId)) {
      return errorResponse('followerId is required and must be a valid UUID', 400);
    }
    if (followerId === followingId) {
      return errorResponse('Cannot follow yourself', 400);
    }

    const following = await toggleFollow(followerId, followingId);
    return jsonResponse({ following });
  } catch (error) {
    console.error('POST /api/users/[id]/follow', error);
    return errorResponse('Failed to toggle follow');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
