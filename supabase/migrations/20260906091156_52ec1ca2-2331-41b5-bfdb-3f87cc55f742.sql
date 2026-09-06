create or replace function public.event_rsvp_totals(_event_id uuid)
returns table(going integer, maybe integer, not_going integer, going_party_total integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when r.status = 'going' then 1 else 0 end), 0)::int,
    coalesce(sum(case when r.status = 'maybe' then 1 else 0 end), 0)::int,
    coalesce(sum(case when r.status = 'not_going' then 1 else 0 end), 0)::int,
    coalesce(sum(case when r.status = 'going' then greatest(r.party_size, 1) else 0 end), 0)::int
  from public.event_rsvps r
  join public.events e on e.id = r.event_id
  where r.event_id = _event_id and e.is_published = true;
$$;

revoke all on function public.event_rsvp_totals(uuid) from public;
grant execute on function public.event_rsvp_totals(uuid) to anon, authenticated, service_role;