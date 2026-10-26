import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';
import { ImageUploadError, uploadImageToBucket } from '@/lib/images';

const BUCKET = 'place-photos';

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
    const url = await uploadImageToBucket(admin.supabase, BUCKET, request);
    return jsonResponse({ url }, 201);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return errorResponse(error.message, error.status);
    }
    console.error('POST /api/admin/places/photos', error);
    return errorResponse("Échec de l'envoi de la photo");
  }
}
