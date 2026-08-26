import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { cancelReservation, getReservationById, updateReservation } from '@/services/reservationService';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    if (!isValidUuid(reservationId)) {
      return errorResponse('Reservation not found', 404);
    }

    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {}
    }

    const reservation = await getReservationById(reservationId);
    if (!reservation) {
      return errorResponse('Reservation not found', 404);
    }

    if (userId && reservation.user_id !== userId) {
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

    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {}
    }
    if (!userId) {
      const body = (await request.json()) as { userId?: string };
      if (body.userId?.trim()) userId = body.userId.trim();
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required', 400);
    }

    const existing = await getReservationById(reservationId);
    if (!existing) {
      return errorResponse('Reservation not found', 404);
    }
    if (existing.user_id !== userId) {
      return errorResponse('Reservation not found', 404);
    }

    const body = (await request.json()) as {
      status?: string;
      paymentMethod?: string;
      paymentStatus?: string;
      note?: string;
      guests?: number;
      timeStart?: string;
      timeEnd?: string;
    };

    if (body.status && !['pending', 'confirmed', 'cancelled', 'completed'].includes(body.status)) {
      return errorResponse('status must be one of: pending, confirmed, cancelled, completed', 400);
    }

    if (body.paymentStatus && !['unpaid', 'paid', 'refunded'].includes(body.paymentStatus)) {
      return errorResponse('paymentStatus must be one of: unpaid, paid, refunded', 400);
    }

    const updated = await updateReservation(reservationId, {
      status: body.status,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
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

    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {}
    }

    if (!userId) {
      const body = await request.json().catch(() => ({})) as { userId?: string };
      if (body.userId?.trim()) userId = body.userId.trim();
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required', 400);
    }

    const cancelled = await cancelReservation(reservationId, userId);
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
