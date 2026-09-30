import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';

/** Liste des catégories distinctes de lieux (pour les filtres/formulaires). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { data, error } = await admin.supabase
      .from('places')
      .select('category')
      .order('category');

    if (error) throw error;

    const categories = [...new Set((data ?? []).map((r) => r.category))];
    return jsonResponse({ categories });
  } catch (error) {
    console.error('GET /api/admin/places/categories', error);
    return errorResponse('Failed to fetch categories');
  }
}
