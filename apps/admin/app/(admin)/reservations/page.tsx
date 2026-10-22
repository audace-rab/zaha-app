'use client';

import { useCallback, useEffect, useState } from 'react';

interface ReservationRow {
  id: string;
  /** Hôtel : date d'arrivée. */
  date: string;
  /** Hôtel : date de départ. */
  date_end: string | null;
  time_start: string | null;
  time_end: string | null;
  guests: number;
  room_type: string | null;
  reservation_type: string;
  status: string;
  payment_status: string;
  price: number;
  currency: string;
  note: string | null;
  userName: string | null;
  placeName: string | null;
}

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  unavailable: 'Indisponible',
  proposed: 'Créneau proposé',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-slate-200 text-slate-700',
  unavailable: 'bg-orange-100 text-orange-700',
  proposed: 'bg-violet-100 text-violet-700',
};

/** "19:00:00" -> "19:00" (champ <input type="time">). */
function toTimeInput(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

/** Nombre de nuits entre deux dates YYYY-MM-DD (0 si invalide). */
function countNights(start: string, end: string | null): number {
  if (!end) return 0;
  const toUtc = (v: string) => {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('fr-FR');

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Non payé',
  pending: 'En cours',
  paid: 'Payé',
  refunded: 'Remboursé',
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/admin/reservations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReservations(data.reservations);
      setTotal(data.total);
    } catch {
      setError('Impossible de charger les réservations.');
    } finally {
      setLoading(false);
    }
  }, [page, status, paymentStatus, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, newStatus: string) {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setReservations((rows) =>
        rows.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } else {
      alert('Échec du changement de statut.');
    }
  }

  // --- Reprogrammation : proposer un autre créneau à une réservation indisponible ---
  const [rescheduling, setRescheduling] = useState<ReservationRow | null>(null);
  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotDateEnd, setSlotDateEnd] = useState('');
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  function openReschedule(r: ReservationRow) {
    setRescheduling(r);
    setSlotDate(r.date);
    setSlotStart(toTimeInput(r.time_start));
    setSlotEnd(toTimeInput(r.time_end));
    setSlotDateEnd(r.date_end ?? '');
    setSlotError(null);
  }

  async function submitReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduling) return;

    if (!slotDate) {
      setSlotError('Choisissez une date.');
      return;
    }
    const isHotel = rescheduling.reservation_type === 'hotel';
    if (isHotel) {
      if (!slotDateEnd || countNights(slotDate, slotDateEnd) < 1) {
        setSlotError('Le départ doit être après l\u2019arrivée.');
        return;
      }
    } else if (slotStart && slotEnd && slotEnd <= slotStart) {
      setSlotError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const unchanged = isHotel
      ? slotDate === rescheduling.date && slotDateEnd === (rescheduling.date_end ?? '')
      : slotDate === rescheduling.date &&
        slotStart === toTimeInput(rescheduling.time_start) &&
        slotEnd === toTimeInput(rescheduling.time_end);
    if (unchanged) {
      setSlotError('Proposez un créneau différent du créneau actuel.');
      return;
    }

    setSlotSaving(true);
    setSlotError(null);
    try {
      // Le créneau est seulement PROPOSÉ : le client doit le confirmer depuis l'application.
      const res = await fetch(`/api/admin/reservations/${rescheduling.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isHotel
            ? { date: slotDate, dateEnd: slotDateEnd, status: 'proposed' }
            : {
                date: slotDate,
                timeStart: slotStart || null,
                timeEnd: slotEnd || null,
                status: 'proposed',
              }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSlotError(data.error ?? 'Échec de la reprogrammation.');
        return;
      }
      const id = rescheduling.id;
      const { reservation: saved } = await res.json().catch(() => ({ reservation: null }));
      setReservations((rows) =>
        rows.map((r) =>
          r.id === id
            ? isHotel
              ? {
                  ...r,
                  date: slotDate,
                  date_end: slotDateEnd,
                  time_start: null,
                  time_end: null,
                  price: saved?.price ?? r.price,
                  status: 'proposed',
                }
              : {
                  ...r,
                  date: slotDate,
                  time_start: slotStart || null,
                  time_end: slotEnd || null,
                  status: 'proposed',
                }
            : r
        )
      );
      setRescheduling(null);
    } catch {
      setSlotError('Une erreur est survenue.');
    } finally {
      setSlotSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Réservations</h1>

      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Tous les paiements</option>
          {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className={selectClass}
          aria-label="Date de début"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className={selectClass}
          aria-label="Date de fin"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Lieu</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Aucune réservation trouvée.
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">
                    {formatDate(r.date)}
                    {r.reservation_type === 'hotel' && r.date_end && (
                      <span className="block text-xs text-slate-500">
                        → {formatDate(r.date_end)} · {countNights(r.date, r.date_end)} nuit
                        {countNights(r.date, r.date_end) > 1 ? 's' : ''}
                      </span>
                    )}
                    {r.time_start && (
                      <span className="block text-xs text-slate-500">
                        {toTimeInput(r.time_start)}
                        {r.time_end ? ` – ${toTimeInput(r.time_end)}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.placeName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.userName ?? '—'}
                    <span className="block text-xs text-slate-400">
                      {r.guests} pers.
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.reservation_type}
                    {r.room_type && (
                      <span className="block text-xs text-slate-400">Chambre : {r.room_type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {r.price.toLocaleString('fr-FR')} {r.currency}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {PAYMENT_LABELS[r.payment_status] ?? r.payment_status}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {(r.status === 'unavailable' || r.status === 'proposed') && (
                      <button
                        onClick={() => openReschedule(r)}
                        className="mt-2 block rounded-lg border border-orange-300 px-2.5 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-50"
                      >
                        {r.status === 'proposed' ? 'Proposer un autre créneau' : 'Reprogrammer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} réservation{total > 1 ? 's' : ''} — page {page}/{totalPages}
        </span>
        <div className="space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Précédent
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>

      {rescheduling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-title"
        >
          <form
            onSubmit={submitReschedule}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div>
              <h2 id="reschedule-title" className="text-lg font-semibold text-slate-900">
                Reprogrammer la réservation
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {rescheduling.placeName ?? 'Lieu'} · {rescheduling.userName ?? 'Client'} · créneau
                indisponible du {formatDate(rescheduling.date)}
                {rescheduling.reservation_type === 'hotel' && rescheduling.date_end
                  ? ` au ${formatDate(rescheduling.date_end)}`
                  : rescheduling.time_start
                    ? ` à ${toTimeInput(rescheduling.time_start)}`
                    : ''}
              </p>
            </div>

            {slotError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {slotError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="slot-date" className="block text-sm font-medium text-slate-700">
                {rescheduling.reservation_type === 'hotel' ? 'Nouvelle arrivée' : 'Nouvelle date'}
              </label>
              <input
                id="slot-date"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className={`${selectClass} w-full`}
              />
            </div>

            {rescheduling.reservation_type === 'hotel' ? (
              <div className="space-y-2">
                <label htmlFor="slot-date-end" className="block text-sm font-medium text-slate-700">
                  Nouveau départ
                </label>
                <input
                  id="slot-date-end"
                  type="date"
                  required
                  min={slotDate || new Date().toISOString().slice(0, 10)}
                  value={slotDateEnd}
                  onChange={(e) => setSlotDateEnd(e.target.value)}
                  className={`${selectClass} w-full`}
                />
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="slot-start" className="block text-sm font-medium text-slate-700">
                  Heure de début
                </label>
                <input
                  id="slot-start"
                  type="time"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                  className={`${selectClass} w-full`}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="slot-end" className="block text-sm font-medium text-slate-700">
                  Heure de fin
                </label>
                <input
                  id="slot-end"
                  type="time"
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                  className={`${selectClass} w-full`}
                />
              </div>
            </div>
            )}

            <p className="text-xs text-slate-500">
              Le client devra confirmer ce nouveau créneau depuis l’application. La réservation passe
              en « Créneau proposé » en attendant sa réponse.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRescheduling(null)}
                disabled={slotSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={slotSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {slotSaving ? 'Enregistrement…' : 'Proposer ce créneau'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
