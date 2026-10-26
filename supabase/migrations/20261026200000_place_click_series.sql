-- Série temporelle des clics « Réserver » / « Appeler » pour le graphique du dashboard.
-- p_unit  : 'hour' (une valeur par heure) ou 'day' (une valeur par jour)
-- p_count : nombre de tranches renvoyées (les plus récentes), y compris celles à 0 clic
-- Les tranches sont calculées à l'heure de Madagascar (Indian/Antananarivo, UTC+3).
-- À exécuter dans Supabase → SQL Editor AVANT de déployer le back-office.
-- Idempotent : peut être relancé sans effet de bord.

create or replace function public.place_click_series(p_unit text, p_count int)
returns table (bucket_start timestamp, reserve_count bigint, call_count bigint)
language sql
stable
set search_path = public
as $$
  with params as (
    select
      case when p_unit = 'hour' then 'hour' else 'day' end as unit,
      case when p_unit = 'hour' then interval '1 hour' else interval '1 day' end as step,
      greatest(least(p_count, 366), 1) as n
  ),
  bounds as (
    select unit, step, n,
           date_trunc(unit, now() at time zone 'Indian/Antananarivo') as last_bucket
    from params
  ),
  series as (
    select generate_series(last_bucket - step * (n - 1), last_bucket, step) as b, unit, step, n
    from bounds
  )
  select
    s.b as bucket_start,
    count(e.id) filter (where e.action = 'reserve') as reserve_count,
    count(e.id) filter (where e.action = 'call') as call_count
  from series s
  left join public.place_click_events e
    -- borne basse : permet d'utiliser l'index sur created_at
    on e.created_at >= now() - (s.step * s.n) - interval '1 day'
   and date_trunc(s.unit, e.created_at at time zone 'Indian/Antananarivo') = s.b
  group by s.b
  order by s.b;
$$;

-- Réservée au back-office (service_role) : pas d'accès direct depuis les clients.
revoke all on function public.place_click_series(text, int) from public, anon, authenticated;
grant execute on function public.place_click_series(text, int) to service_role;
