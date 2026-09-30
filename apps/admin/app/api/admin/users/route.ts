import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

/** Liste paginée des profils avec recherche (?q=). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const { from, to, page, limit } = getPagination(request.url);

    let query = admin.supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%,country.ilike.%${q}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    // Marque les profils qui sont administrateurs
    const { data: adminRows } = await admin.supabase.from('admin_users').select('user_id');
    const adminIds = new Set((adminRows ?? []).map((r) => r.user_id));

    const users = (data ?? []).map((p) => ({ ...p, is_admin: adminIds.has(p.id) }));

    return jsonResponse({ users, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/users', error);
    return errorResponse('Failed to fetch users');
  }
}
