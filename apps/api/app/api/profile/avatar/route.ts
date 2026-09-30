import { requireUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 Mo

const IMAGE_MAGIC: { mime: string; ext: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  for (const candidate of IMAGE_MAGIC) {
    if (buffer.length >= candidate.bytes.length && candidate.bytes.every((b, i) => buffer[i] === b)) {
      return candidate;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    if (!checkRateLimit(rateLimitKey(request, auth.userId, 'avatar'), 10, 60_000)) {
      return errorResponse('Too many uploads, please retry later', 429);
    }

    const body = await request.json();
    const { file: base64Data } = body as { file?: string };

    if (!base64Data || typeof base64Data !== 'string') {
      return errorResponse('file is required as base64 string', 400);
    }

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length > MAX_AVATAR_BYTES) {
      return errorResponse('file too large (max 5 MB)', 400);
    }

    // Vérifier le contenu réel de l'image (magic bytes)
    const sniffed = sniffImage(buffer);
    if (!sniffed) {
      return errorResponse('file content is not a supported image', 400);
    }

    const path = `${auth.userId}/${Date.now()}.${sniffed.ext}`;
    // Client scopé utilisateur : la policy storage impose folder = auth.uid()
    const supabase = auth.supabase;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: sniffed.mime, upsert: false });

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
