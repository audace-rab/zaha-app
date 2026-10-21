-- Réservations : statut 'proposed' (créneau proposé par l'établissement).
-- Flux : l'admin marque la réservation 'unavailable', puis propose un autre créneau
-- ('proposed'). Le client confirme ('confirmed') ou annule ('cancelled').
-- Idempotent : peut être relancé sans effet de bord.

alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in (
    'pending', 'confirmed', 'cancelled', 'completed', 'unavailable', 'proposed'
  ));
