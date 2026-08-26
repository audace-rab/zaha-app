import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userIdRaw = formData.get('userId');
    const file = formData.get('file');

    const userId = typeof userIdRaw === 'string' ? userIdRaw.trim() : '';
    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }
    if (!(file instanceof File)) {
      return errorResponse('file is required (multipart/form-data)', 400);
    }
    if (!file.type.startsWith('image/')) {
      return errorResponse('file must be an image', 400);
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return errorResponse('file too large (max 5 MB)', 400);
    }

    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') ||
      'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: file.type, upsert: false });

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
