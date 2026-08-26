import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getProfile, updateProfile } from '@/services/profileService';
import { isValidUuid } from '@/services/postService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.trim();

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const profile = await getProfile(userId);
    if (!profile) {
      return errorResponse('Profile not found', 404);
    }

    return jsonResponse({ profile });
  } catch (error) {
    console.error('GET /api/profile', error);
    return errorResponse('Failed to fetch profile');
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      name?: string;
      bio?: string;
      website?: string;
      avatar_url?: string;
    };

    if (!body.userId?.trim() || !isValidUuid(body.userId.trim())) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const profile = await updateProfile({ ...body, userId: body.userId.trim() });

    if (!profile) {
      return errorResponse('Profile not found', 404);
    }

    return jsonResponse({ profile });
  } catch (error) {
    console.error('PUT /api/profile', error);
    return errorResponse('Failed to update profile');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
