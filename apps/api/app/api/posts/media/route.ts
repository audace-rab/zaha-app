import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 Mo

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
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return errorResponse('file must be an image or video', 400);
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return errorResponse('file too large (max 10 MB)', 400);
    }

    const isVideo = file.type.startsWith('video/');
    const ext =
      (file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg'))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || (isVideo ? 'mp4' : 'jpg');
    const path = `${userId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('post-photos')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Post media upload error:', uploadError);
      return errorResponse('Failed to upload media', 500);
    }

    const { data } = supabase.storage.from('post-photos').getPublicUrl(path);
    return jsonResponse({ url: data.publicUrl });
  } catch (error) {
    console.error('POST /api/posts/media', error);
    return errorResponse('Failed to upload media');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
