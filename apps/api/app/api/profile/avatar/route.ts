import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId: userIdRaw, file: base64Data } = body as { userId?: string; file?: string };

    const userId = typeof userIdRaw === 'string' ? userIdRaw.trim() : '';
    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }
    if (!base64Data || typeof base64Data !== 'string') {
      return errorResponse('file is required as base64 string', 400);
    }

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length > MAX_AVATAR_BYTES) {
      return errorResponse('file too large (max 5 MB)', 400);
    }

    const path = `${userId}/${Date.now()}.jpg`;
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return errorResponse('Failed to upload avatar', 500);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);

    return jsonResponse({ url: data.publicUrl });
  } catch (error) {
    console.error('POST /api/profile/avatar', error);
    return errorResponse('Failed to upload avatar');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
