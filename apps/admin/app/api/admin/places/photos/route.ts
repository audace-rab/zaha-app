import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';

const BUCKET = 'place-photos';
// Vercel limite le corps d'une requête à ~4,5 Mo : on reste en dessous.
const MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_MAGIC: { mime: string; ext: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Détecte le vrai type de l'image à partir de ses premiers octets. */
function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  for (const candidate of IMAGE_MAGIC) {
    if (
      buffer.length >= candidate.bytes.length &&
      candidate.bytes.every((b, i) => buffer[i] === b)
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Envoie une photo de lieu dans le bucket public `place-photos`.
 * Corps : multipart/form-data, champ « file ». Retourne { url }.
 * L'URL est ensuite enregistrée dans `places.photos` via PATCH /api/admin/places/[id].
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return errorResponse('file is required (multipart/form-data)', 400);
    }
    if (file.size > MAX_BYTES) {
      return errorResponse('Image trop lourde (max 4 Mo)', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(buffer);
    if (!sniffed) {
      return errorResponse('Format non supporté (JPEG, PNG, GIF ou WebP)', 400);
    }

    const path = `${crypto.randomUUID()}.${sniffed.ext}`;
    const { error: uploadError } = await admin.supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: sniffed.mime, upsert: false });

    if (uploadError) {
      console.error('POST /api/admin/places/photos upload', uploadError);
      return errorResponse("Échec de l'envoi de la photo");
    }

    const { data } = admin.supabase.storage.from(BUCKET).getPublicUrl(path);
    return jsonResponse({ url: data.publicUrl }, 201);
  } catch (error) {
    console.error('POST /api/admin/places/photos', error);
    return errorResponse("Échec de l'envoi de la photo");
  }
}
