import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';
import { ImageUploadError, uploadImageToBucket } from '@/lib/images';

const BUCKET = 'ad-banners';

/**
 * Envoie l'image d'une bannière dans le bucket public `ad-banners`.
 * Corps : multipart/form-data, champ « file ». Retourne { url }.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const url = await uploadImageToBucket(admin.supabase, BUCKET, request);
    return jsonResponse({ url }, 201);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return errorResponse(error.message, error.status);
    }
    console.error('POST /api/admin/banners/image', error);
    return errorResponse("Échec de l'envoi de l'image");
  }
}
