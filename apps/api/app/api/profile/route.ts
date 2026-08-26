import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { updateProfile } from '@/services/profileService';

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
