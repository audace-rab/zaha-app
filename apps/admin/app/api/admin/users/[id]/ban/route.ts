import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';

/**
 * Bannit ou réhabilite un utilisateur.
 * Body : { "banned": true | false }
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

    if (id === admin.userId) {
      return errorResponse('Vous ne pouvez pas vous bannir vous-même', 400);
    }

    const body = (await request.json()) as { banned?: boolean };
    if (typeof body.banned !== 'boolean') {
      return errorResponse('banned (boolean) is required', 400);
    }

    // Supabase Auth : ban_duration "none" lève le bannissement,
    // une durée très longue équivaut à un bannissement permanent.
    const { error } = await admin.supabase.auth.admin.updateUserById(id, {
      ban_duration: body.banned ? '876000h' : 'none',
    });

    if (error) throw error;

    return jsonResponse({ banned: body.banned });
  } catch (error) {
    console.error('POST /api/admin/users/[id]/ban', error);
    return errorResponse('Failed to update ban status');
  }
}
