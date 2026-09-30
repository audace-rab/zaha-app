import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';
import { getAdminStats } from '@/lib/services/stats';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const stats = await getAdminStats(admin.supabase);
    return jsonResponse(stats);
  } catch (error) {
    console.error('GET /api/admin/stats', error);
    return errorResponse('Failed to load stats');
  }
}
