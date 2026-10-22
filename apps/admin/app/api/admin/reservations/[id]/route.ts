import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, isValidUuid } from '@/lib/api';
import type { Database } from '@/lib/supabase/database.types';

type ReservationUpdate = Database['public']['Tables']['reservations']['Update'];

const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'unavailable', 'proposed'];
const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'refunded'];

/**
 * Mise à jour d'une réservation : statut, paiement, note et reprogrammation
 * (date / horaires — utilisée pour proposer un autre créneau à une réservation indisponible).
 */
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
      date?: string;
      /** Hôtel : date de départ (date = arrivée). */
      dateEnd?: string;
      timeStart?: string | null;
      timeEnd?: string | null;
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

    // Reprogrammation
    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return errorResponse('date must be formatted YYYY-MM-DD', 400);
      }
      payload.date = body.date;
    }
    const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
    for (const [key, column] of [['timeStart', 'time_start'], ['timeEnd', 'time_end']] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (value !== null && !timePattern.test(value)) {
        return errorResponse(`${key} must be formatted HH:MM`, 400);
      }
      payload[column] = value;
    }
    if (payload.time_start && payload.time_end && payload.time_end <= payload.time_start) {
      return errorResponse('timeEnd must be after timeStart', 400);
    }

    if (body.dateEnd !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateEnd)) {
        return errorResponse('dateEnd must be formatted YYYY-MM-DD', 400);
      }
      payload.date_end = body.dateEnd;
    }

    // Hôtel : arrivée/départ cohérents + prix recalculé (nuits x tarif de la chambre).
    if (body.date !== undefined || body.dateEnd !== undefined) {
      const { data: current } = await admin.supabase
        .from('reservations')
        .select('reservation_type, date, date_end, room_type_id')
        .eq('id', id)
        .maybeSingle();
      if (!current) return errorResponse('Reservation not found', 404);

      if (current.reservation_type === 'hotel') {
        const start = payload.date ?? current.date;
        const end = payload.date_end ?? current.date_end;
        if (end) {
          const toUtc = (v: string) => {
            const [y, m, d] = v.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
          };
          const nights = Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
          if (nights < 1) {
            return errorResponse('dateEnd must be after date', 400);
          }
          if (current.room_type_id) {
            const { data: room } = await admin.supabase
              .from('place_room_types')
              .select('price_per_night, currency')
              .eq('id', current.room_type_id)
              .maybeSingle();
            if (room) {
              payload.price = nights * Number(room.price_per_night);
              payload.currency = room.currency;
            }
          }
        }
        // Pas d'horaires pour un hôtel.
        payload.time_start = null;
        payload.time_end = null;
      } else if (body.dateEnd !== undefined) {
        return errorResponse('dateEnd is only valid for hotel reservations', 400);
      }
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
