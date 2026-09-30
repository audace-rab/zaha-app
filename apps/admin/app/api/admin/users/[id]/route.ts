import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/** Détail d'un utilisateur : profil + statut admin/ban + activité récente. */
export async function GET(
  _request: Request,
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

    const { data: profile, error } = await admin.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return errorResponse('User not found', 404);

    const [
      { data: adminRow },
      { data: posts },
      { data: reservations },
      authUserResult,
    ] = await Promise.all([
      admin.supabase.from('admin_users').select('user_id').eq('user_id', id).maybeSingle(),
      admin.supabase
        .from('posts')
        .select('id, content, location, created_at')
        .eq('author_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      admin.supabase
        .from('reservations')
        .select('id, date, status, price, currency, places(name)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      admin.supabase.auth.admin.getUserById(id),
    ]);

    const authUser = authUserResult.data?.user;
    const bannedUntil = (authUser as { banned_until?: string } | undefined)?.banned_until;
    const isBanned = !!bannedUntil && new Date(bannedUntil) > new Date();

    const reservationsMapped = (reservations ?? []).map((r) => {
      const place = r.places as unknown as { name: string } | null;
      return {
        id: r.id,
        date: r.date,
        status: r.status,
        price: r.price,
        currency: r.currency,
        placeName: place?.name ?? null,
      };
    });

    return jsonResponse({
      profile,
      isAdmin: !!adminRow,
      isBanned,
      email: authUser?.email ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      posts: posts ?? [],
      reservations: reservationsMapped,
    });
  } catch (error) {
    console.error('GET /api/admin/users/[id]', error);
    return errorResponse('Failed to fetch user');
  }
}

/** Mise à jour du profil (liste blanche de champs). */
export async function PATCH(
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

    const body = (await request.json()) as Partial<ProfileUpdate>;
    const payload: ProfileUpdate = {};
    const fields = [
      'name', 'location', 'phone', 'language', 'country',
      'country_flag', 'description', 'bio', 'website',
      'avatar_url', 'banner_url',
    ] as const;
    for (const field of fields) {
      if (body[field] !== undefined) {
        (payload as Record<string, unknown>)[field] = body[field];
      }
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse('No fields to update', 400);
    }

    const { data, error } = await admin.supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse('User not found', 404);

    return jsonResponse({ profile: data });
  } catch (error) {
    console.error('PATCH /api/admin/users/[id]', error);
    return errorResponse('Failed to update user');
  }
}
