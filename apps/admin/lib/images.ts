import type { SupabaseClient } from '@supabase/supabase-js';

// Vercel limite le corps d'une requête à ~4,5 Mo : on reste en dessous.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_MAGIC: { mime: string; ext: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Détecte le vrai type de l'image à partir de ses premiers octets. */
export function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
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

export class ImageUploadError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

/**
 * Valide une image reçue en multipart (champ « file ») et l'envoie dans un bucket public.
 * Retourne l'URL publique. Lève ImageUploadError pour les erreurs de validation.
 */
export async function uploadImageToBucket(
  supabase: SupabaseClient,
  bucket: string,
  request: Request
): Promise<string> {
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    throw new ImageUploadError('file is required (multipart/form-data)');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError('Image trop lourde (max 4 Mo)');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(buffer);
  if (!sniffed) {
    throw new ImageUploadError('Format non supporté (JPEG, PNG, GIF ou WebP)');
  }

  const path = `${crypto.randomUUID()}.${sniffed.ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: sniffed.mime, upsert: false });
  if (error) {
    console.error(`Upload to bucket ${bucket} failed`, error);
    throw new ImageUploadError("Échec de l'envoi de la photo", 500);
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
