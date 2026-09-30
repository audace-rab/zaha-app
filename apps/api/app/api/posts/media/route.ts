import { requireUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 Mo

// Signatures magiques des formats acceptés
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
  { mime: 'video/mp4', bytes: [0x00, 0x00, 0x00] }, // ftyp box (offset 4)
];

function sniffMime(buffer: Buffer): string | null {
  for (const { mime, bytes } of MAGIC_BYTES) {
    if (buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b)) {
      return mime;
    }
  }
  // mp4/mov : vérifier 'ftyp' à l'offset 4
  if (buffer.length > 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    if (!checkRateLimit(rateLimitKey(request, auth.userId, 'upload'), 10, 60_000)) {
      return errorResponse('Too many uploads, please retry later', 429);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return errorResponse('file is required (multipart/form-data)', 400);
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return errorResponse('file must be an image or video', 400);
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return errorResponse('file too large (max 10 MB)', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Vérification du contenu réel (magic bytes), pas seulement du MIME déclaré
    const sniffed = sniffMime(buffer);
    if (!sniffed) {
      return errorResponse('file content is not a supported image or video', 400);
    }

    const isVideo = sniffed.startsWith('video/');
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
    };
    const ext = extMap[sniffed] ?? (isVideo ? 'mp4' : 'jpg');
    const path = `${auth.userId}/${Date.now()}.${ext}`;

    // Client scopé utilisateur : la policy storage impose folder = auth.uid()
    const supabase = auth.supabase;
    const { error: uploadError } = await supabase.storage
      .from('post-photos')
      .upload(path, buffer, { contentType: sniffed, upsert: false });

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
