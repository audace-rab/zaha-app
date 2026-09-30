import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination } from '@/lib/api';

const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

/** Liste paginée des réservations avec filtres (?status=&paymentStatus=&from=&to=). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const paymentStatus = searchParams.get('paymentStatus')?.trim();
    const fromDate = searchParams.get('from')?.trim();
    const toDate = searchParams.get('to')?.trim();
    const { from, to, page, limit } = getPagination(request.url);

    let query = admin.supabase
      .from('reservations')
      .select('*, profiles(name), places(name)', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to);

    if (status && RESERVATION_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }
    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const reservations = (data ?? []).map((r) => {
      const profile = r.profiles as unknown as { name: string } | null;
      const place = r.places as unknown as { name: string } | null;
      return {
        ...r,
        profiles: undefined,
        places: undefined,
        userName: profile?.name ?? null,
        placeName: place?.name ?? null,
      };
    });

    return jsonResponse({ reservations, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/reservations', error);
    return errorResponse('Failed to fetch reservations');
  }
}
