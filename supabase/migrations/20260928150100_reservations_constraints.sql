-- Contraintes d'intégrité sur reservations (validation côté BDD, pas seulement API)

alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'completed'));

alter table public.reservations
  add constraint reservations_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'refunded'));

alter table public.reservations
  add constraint reservations_type_check
  check (reservation_type in ('general', 'table', 'hotel', 'activity'));
