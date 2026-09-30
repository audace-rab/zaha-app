import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';

/** Retourne l'identité de l'admin connecté (utilisé après le login). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }
  return jsonResponse({ userId: admin.userId, email: admin.email });
}
