import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';
import { createReservation, getReservationsByUser } from '@/services/reservationService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      placeId?: string;
      reservationType?: string;
      date?: string;
      timeStart?: string;
      timeEnd?: string;
      guests?: number;
      roomType?: string;
      activitySlot?: string;
      price?: number;
      currency?: string;
      paymentMethod?: string;
      note?: string;
    };

    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      try {
        const supabase = createServerClient(authHeader.slice(7).trim());
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {}
    }
    if (!userId && body.userId?.trim()) {
      userId = body.userId.trim();
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    if (!body.placeId || !isValidUuid(body.placeId)) {
      return errorResponse('placeId is required and must be a valid UUID', 400);
    }

    if (!body.date) {
      return errorResponse('date is required (YYYY-MM-DD)', 400);
    }

    if (!['general', 'table', 'hotel', 'activity'].includes(body.reservationType ?? 'general')) {
      return errorResponse('reservationType must be one of: general, table, hotel, activity', 400);
    }

    const reservation = await createReservation({
      userId,
      placeId: body.placeId,
      reservationType: body.reservationType,
      date: body.date,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
      guests: body.guests,
      roomType: body.roomType,
      activitySlot: body.activitySlot,
      price: body.price,
      currency: body.currency,
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
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId')?.trim() ?? undefined;
    const status = searchParams.get('status')?.trim() ?? undefined;

    if (!userId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        try {
          const supabase = createServerClient(authHeader.slice(7).trim());
          const { data } = await supabase.auth.getUser();
          if (data?.user?.id) userId = data.user.id;
        } catch {}
      }
    }

    if (!userId || !isValidUuid(userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const reservations = await getReservationsByUser(userId, status);
    return jsonResponse({ reservations });
  } catch (error) {
    console.error('GET /api/reservations', error);
    return errorResponse('Failed to fetch reservations');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
