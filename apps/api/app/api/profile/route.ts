import { getOptionalUser, requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getProfile, updateProfile } from '@/services/profileService';
import { isValidUuid } from '@/services/postService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Le profil demandé : query param explicite, sinon l'utilisateur connecté
    let userId = url.searchParams.get('userId')?.trim();

    if (!userId) {
      const auth = await getOptionalUser(request);
      userId = auth?.userId;
    }

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
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const body = (await request.json()) as {
      name?: string;
      bio?: string;
      website?: string;
      avatar_url?: string;
    };

    // userId forcé à l'utilisateur authentifié (jamais celui du body)
    const profile = await updateProfile(auth.supabase, { ...body, userId: auth.userId });

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
