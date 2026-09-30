import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { createReservation, getReservationsByUser } from '@/services/reservationService';

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const body = (await request.json()) as {
      placeId?: string;
      reservationType?: string;
      date?: string;
      timeStart?: string;
      timeEnd?: string;
      guests?: number;
      roomType?: string;
      activitySlot?: string;
      paymentMethod?: string;
      note?: string;
    };

    if (!body.placeId || !isValidUuid(body.placeId)) {
      return errorResponse('placeId is required and must be a valid UUID', 400);
    }

    if (!body.date) {
      return errorResponse('date is required (YYYY-MM-DD)', 400);
    }

    if (!['general', 'table', 'hotel', 'activity'].includes(body.reservationType ?? 'general')) {
      return errorResponse('reservationType must be one of: general, table, hotel, activity', 400);
    }

    // userId toujours issu du JWT ; price/paymentStatus ignorés (forcés serveur)
    const reservation = await createReservation(auth.supabase, {
      userId: auth.userId,
      placeId: body.placeId,
      reservationType: body.reservationType,
      date: body.date,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
      guests: body.guests,
      roomType: body.roomType,
      activitySlot: body.activitySlot,
      paymentMethod: body.paymentMethod,
      note: body.note,
    });

    if (!reservation) {
      return errorResponse('Place not found', 404);
    }

    return jsonResponse({ reservation }, 201);
  } catch (error) {
    console.error('POST /api/reservations', error);
    return errorResponse('Failed to create reservation');
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim() ?? undefined;

    // Toujours les réservations de l'utilisateur authentifié
    const reservations = await getReservationsByUser(auth.supabase, auth.userId, status);
    return jsonResponse({ reservations });
  } catch (error) {
    console.error('GET /api/reservations', error);
    return errorResponse('Failed to fetch reservations');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
