import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type ReservationUpdate = Database['public']['Tables']['reservations']['Update'];

const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];
const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'refunded'];

/** Mise à jour du statut d'une réservation (et optionnellement du paiement). */
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
      return errorResponse('Reservation not found', 404);
    }

    const body = (await request.json()) as {
      status?: string;
      paymentStatus?: string;
      note?: string;
    };

    const payload: ReservationUpdate = {};

    if (body.status !== undefined) {
      if (!RESERVATION_STATUSES.includes(body.status)) {
        return errorResponse(
          `status must be one of: ${RESERVATION_STATUSES.join(', ')}`,
          400
        );
      }
      payload.status = body.status;
    }

    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return errorResponse(
          `paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`,
          400
        );
      }
      payload.payment_status = body.paymentStatus;
    }

    if (body.note !== undefined) {
      payload.note = body.note;
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse('No fields to update', 400);
    }

    payload.updated_at = new Date().toISOString();

    const { data, error } = await admin.supabase
      .from('reservations')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse('Reservation not found', 404);

    return jsonResponse({ reservation: data });
  } catch (error) {
    console.error('PATCH /api/admin/reservations/[id]', error);
    return errorResponse('Failed to update reservation');
  }
}
