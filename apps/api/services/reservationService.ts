import { createAdminClient } from '@/lib/supabase/server';

export interface ReservationRow {
  id: string;
  user_id: string;
  place_id: string;
  reservation_type: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  guests: number;
  room_type: string | null;
  activity_slot: string | null;
  price: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  place?: { name: string | null; category: string | null; address: string | null } | null;
  user?: { name: string | null; avatar_url: string | null } | null;
}

export interface CreateReservationInput {
  userId: string;
  placeId: string;
  reservationType?: string;
  date: string;
  timeStart?: string;
  timeEnd?: string;
  guests?: number;
  roomType?: string;
  activitySlot?: string;
  price?: number;
  currency?: string;
  paymentMethod?: string;
  note?: string;
}

/**
 * Créer une réservation.
 * Retourne null si le lieu n'existe pas.
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<ReservationRow | null> {
  const supabase = createAdminClient();

  const { data: place } = await supabase
    .from('places')
    .select('id')
    .eq('id', input.placeId)
    .maybeSingle();
  if (!place) return null;

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_id: input.userId,
      place_id: input.placeId,
      reservation_type: input.reservationType ?? 'general',
      date: input.date,
      time_start: input.timeStart ?? null,
      time_end: input.timeEnd ?? null,
      guests: input.guests ?? 1,
      room_type: input.roomType ?? null,
      activity_slot: input.activitySlot ?? null,
      price: input.price ?? 0,
      currency: input.currency ?? 'MGA',
      payment_method: input.paymentMethod ?? null,
      note: input.note ?? null,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Create reservation error:', error);
    throw new Error('Failed to create reservation');
  }

  return data ?? null;
}

/**
 * Lister les réservations d'un utilisateur.
 */
export async function getReservationsByUser(
  userId: string,
  status?: string
): Promise<ReservationRow[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('reservations')
    .select(`
      *,
      place:places!reservations_place_id_fkey ( name, category, address )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('List reservations error:', error);
    return [];
  }

  return (data ?? []).map((r) => {
    const place = Array.isArray(r.place) ? r.place[0] : r.place;
    return { ...r, place, user: null };
  });
}

/**
 * Récupérer une réservation par son ID.
 */
export async function getReservationById(
  reservationId: string
): Promise<ReservationRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      place:places!reservations_place_id_fkey ( name, category, address ),
      user:profiles!reservations_user_id_fkey ( name, avatar_url )
    `)
    .eq('id', reservationId)
    .maybeSingle();

  if (error) {
    console.error('Get reservation error:', error);
    return null;
  }

  if (!data) return null;

  const place = Array.isArray(data.place) ? data.place[0] : data.place;
  const user = Array.isArray(data.user) ? data.user[0] : data.user;
  return { ...data, place, user };
}

/**
 * Mettre à jour une réservation (statut, détails, paiement).
 * Retourne null si introuvable ou si le propriétaire ne correspond pas.
 */
export async function updateReservation(
  reservationId: string,
  patch: Partial<{
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    note: string;
    guests: number;
    timeStart: string;
    timeEnd: string;
  }>
): Promise<ReservationRow | null> {
  const supabase = createAdminClient();

  // Build typed partial — Supabase rejects Record<string, unknown>
  const updateData: {
    status?: string;
    payment_method?: string;
    payment_status?: string;
    note?: string;
    guests?: number;
    time_start?: string;
    time_end?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.paymentMethod !== undefined) updateData.payment_method = patch.paymentMethod;
  if (patch.paymentStatus !== undefined) updateData.payment_status = patch.paymentStatus;
  if (patch.note !== undefined) updateData.note = patch.note;
  if (patch.guests !== undefined) updateData.guests = patch.guests;
  if (patch.timeStart !== undefined) updateData.time_start = patch.timeStart;
  if (patch.timeEnd !== undefined) updateData.time_end = patch.timeEnd;

  const { data, error } = await supabase
    .from('reservations')
    .update(updateData)
    .eq('id', reservationId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Update reservation error:', error);
    throw new Error('Failed to update reservation');
  }

  return data ?? null;
}

/**
 * Annuler une réservation (met le statut à 'cancelled').
 * Vérifie que la réservation appartient bien à l'utilisateur.
 */
export async function cancelReservation(
  reservationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('reservations')
    .select('id, status')
    .eq('id', reservationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) return false;
  if (existing.status === 'cancelled') return true;

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Cancel reservation error:', error);
    throw new Error('Failed to cancel reservation');
  }

  return true;
}

/**
 * Vérifier la disponibilité d'un lieu pour une date donnée.
 * Retourne les créneaux existants (non annulés) pour ce lieu à cette date.
 */
export interface AvailabilitySlot {
  id: string;
  user_id: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  guests: number;
  status: string;
  reservation_type: string;
}

export async function getAvailability(
  placeId: string,
  date: string
): Promise<AvailabilitySlot[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('reservations')
    .select('id, user_id, date, time_start, time_end, guests, status, reservation_type')
    .eq('place_id', placeId)
    .eq('date', date)
    .neq('status', 'cancelled')
    .order('time_start', { ascending: true });

  if (error) {
    console.error('Get availability error:', error);
    return [];
  }

  return data ?? [];
}
