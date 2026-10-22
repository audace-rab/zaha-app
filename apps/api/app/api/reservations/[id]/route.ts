import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import {
  cancelReservation,
  getReservationById,
  ReservationError,
  updateReservation,
} from '@/services/reservationService';

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
      roomType?: string;
      roomTypeId?: string;
      activitySlot?: string;
      date?: string;
      dateEnd?: string;
      timeStart?: string;
      timeEnd?: string;
    };


    if (body.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return errorResponse('date must be formatted YYYY-MM-DD', 400);
    }
    if (body.dateEnd !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.dateEnd)) {
      return errorResponse('dateEnd must be formatted YYYY-MM-DD', 400);
    }
    if (body.roomTypeId !== undefined && !isValidUuid(body.roomTypeId)) {
      return errorResponse('roomTypeId must be a valid UUID', 400);
    }
    if (body.timeStart && body.timeEnd && body.timeEnd <= body.timeStart) {
      return errorResponse('timeEnd must be after timeStart', 400);
    }

    const existing = await getReservationById(auth.supabase, reservationId);
    if (!existing) {
      return errorResponse('Reservation not found', 404);
    }
    if (existing.user_id !== auth.userId) {
      return errorResponse('Reservation not found', 404);
    }

    const status = existing.status;
    const slotFields =
      body.date !== undefined ||
      body.dateEnd !== undefined ||
      body.timeStart !== undefined ||
      body.timeEnd !== undefined;
    const otherFields =
      body.guests !== undefined ||
      body.roomType !== undefined ||
      body.roomTypeId !== undefined ||
      body.activitySlot !== undefined ||
      body.note !== undefined ||
      body.paymentMethod !== undefined;
    const edits = slotFields || otherFields;

    // 1) Créneau proposé par l'établissement : le client confirme ou annule, rien d'autre.
    if (status === 'proposed') {
      if (edits || (body.status !== 'confirmed' && body.status !== 'cancelled')) {
        return errorResponse('Un créneau proposé ne peut être que confirmé ou annulé', 400);
      }
    } else if (body.status === 'confirmed') {
      return errorResponse('Seul un créneau proposé peut être confirmé', 400);
    }

    // 2) Réservation indisponible : le client reprogramme (nouveau créneau) ou annule.
    if (status === 'unavailable') {
      if (body.status !== undefined && body.status !== 'cancelled') {
        return errorResponse('Une réservation indisponible peut être reprogrammée ou annulée', 400);
      }
      if (otherFields) {
        return errorResponse('Seuls la date et les horaires peuvent être modifiés', 400);
      }
    }

    // 3) Modification : uniquement tant que la réservation est en attente
    //    (ou reprogrammation d'une réservation indisponible). Le lieu n'est jamais modifiable.
    if (edits) {
      if (status !== 'pending' && status !== 'unavailable') {
        return errorResponse('Une réservation ne peut être modifiée que lorsqu\u2019elle est en attente', 400);
      }
      if (body.status === 'cancelled') {
        return errorResponse('Choisissez soit une modification, soit l\u2019annulation', 400);
      }
      if (body.roomType !== undefined && existing.reservation_type !== 'hotel') {
        return errorResponse('roomType n\u2019est valable que pour une réservation d\u2019hôtel', 400);
      }
      if (body.activitySlot !== undefined && existing.reservation_type !== 'activity') {
        return errorResponse('activitySlot n\u2019est valable que pour une réservation d\u2019activité', 400);
      }
      const isHotel = existing.reservation_type === 'hotel';
      if ((body.roomTypeId !== undefined || body.dateEnd !== undefined) && !isHotel) {
        return errorResponse('roomTypeId et dateEnd ne sont valables que pour une réservation d\u2019hôtel', 400);
      }
      if (isHotel && (body.timeStart !== undefined || body.timeEnd !== undefined)) {
        return errorResponse('Une réservation d\u2019hôtel n\u2019a pas d\u2019horaires (arrivée et départ uniquement)', 400);
      }
    }

    // Un nouveau créneau remet une réservation indisponible en attente.
    const nextStatus = status === 'unavailable' && slotFields ? 'pending' : body.status;
    // paymentStatus / price ne sont jamais acceptés du client
    const updated = await updateReservation(auth.supabase, reservationId, {
      status: nextStatus,
      paymentMethod: body.paymentMethod,
      note: body.note,
      guests: body.guests,
      roomType: body.roomType,
      roomTypeId: body.roomTypeId,
      activitySlot: body.activitySlot,
      date: body.date,
      dateEnd: body.dateEnd,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
    });

    if (!updated) {
      return errorResponse('Failed to update reservation', 500);
    }

    return jsonResponse({ reservation: updated });
  } catch (error) {
    if (error instanceof ReservationError) {
      return errorResponse(error.message, error.status);
    }
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
