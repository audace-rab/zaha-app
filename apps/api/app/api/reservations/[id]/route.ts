import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { cancelReservation, getReservationById, updateReservation } from '@/services/reservationService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    if (!isValidUuid(reservationId)) {
      return errorResponse('Reservation not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    // RLS : un non-propriétaire obtient null → 404 (pas de fuite)
    const reservation = await getReservationById(auth.supabase, reservationId);
    if (!reservation) {
      return errorResponse('Reservation not found', 404);
    }

    return jsonResponse({ reservation });
  } catch (error) {
    console.error('GET /api/reservations/[id]', error);
    return errorResponse('Failed to fetch reservation');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    if (!isValidUuid(reservationId)) {
      return errorResponse('Reservation not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    // Body lu une seule fois
    const body = (await request.json()) as {
      status?: string;
      paymentMethod?: string;
      note?: string;
      guests?: number;
      timeStart?: string;
      timeEnd?: string;
    };

    // Le client ne peut que remettre en attente ou annuler —
    // confirmed/completed sont réservés à un futur back-office.
    if (body.status && !['pending', 'cancelled'].includes(body.status)) {
      return errorResponse('status must be one of: pending, cancelled', 400);
    }

    const existing = await getReservationById(auth.supabase, reservationId);
    if (!existing) {
      return errorResponse('Reservation not found', 404);
    }
    if (existing.user_id !== auth.userId) {
      return errorResponse('Reservation not found', 404);
    }

    // paymentStatus / price ne sont jamais acceptés du client
    const updated = await updateReservation(auth.supabase, reservationId, {
      status: body.status,
      paymentMethod: body.paymentMethod,
      note: body.note,
      guests: body.guests,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
    });

    if (!updated) {
      return errorResponse('Failed to update reservation', 500);
    }

    return jsonResponse({ reservation: updated });
  } catch (error) {
    console.error('PUT /api/reservations/[id]', error);
    return errorResponse('Failed to update reservation');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    if (!isValidUuid(reservationId)) {
      return errorResponse('Reservation not found', 404);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const cancelled = await cancelReservation(auth.supabase, reservationId, auth.userId);
    if (!cancelled) {
      return errorResponse('Reservation not found or already cancelled', 404);
    }

    return jsonResponse({ cancelled: true });
  } catch (error) {
    console.error('DELETE /api/reservations/[id]', error);
    return errorResponse('Failed to cancel reservation');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
