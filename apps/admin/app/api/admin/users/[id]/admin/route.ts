import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';

/**
 * Accorde ou révoque le rôle administrateur.
 * Body : { "admin": true | false }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return errorResponse('User not found', 404);
    }

    const body = (await request.json()) as { admin?: boolean };
    if (typeof body.admin !== 'boolean') {
      return errorResponse('admin (boolean) is required', 400);
    }

    if (id === admin.userId && !body.admin) {
      return errorResponse('Vous ne pouvez pas révoquer votre propre rôle admin', 400);
    }

    if (body.admin) {
      // Vérifie que le profil existe avant de promouvoir
      const { data: profile } = await admin.supabase
        .from('profiles')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (!profile) return errorResponse('User not found', 404);

      const { error } = await admin.supabase
        .from('admin_users')
        .upsert({ user_id: id });
      if (error) throw error;
    } else {
      const { error } = await admin.supabase
        .from('admin_users')
        .delete()
        .eq('user_id', id);
      if (error) throw error;
    }

    return jsonResponse({ admin: body.admin });
  } catch (error) {
    console.error('POST /api/admin/users/[id]/admin', error);
    return errorResponse('Failed to update admin role');
  }
}
