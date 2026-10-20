-- One-time, owner-approved publication for event 17135.
-- The owner matched 202 registered and 0 checked in against the b2match portal.
-- This does not call b2match, create a sync run, or enable a schedule.
-- The existing last_successful_sync column stores the manual publication time;
-- dashboard-data exposes it as publishedAt while automatic sync is disabled.
begin;

do $$
declare
  v_settings public.event_settings%rowtype;
  v_aggregate public.dashboard_aggregates%rowtype;
  v_published_at timestamptz := clock_timestamp();
begin
  select * into v_settings from public.event_settings
    where event_id = 17135 for update;
  if not found or v_settings.meeting_target is distinct from 1200 or v_settings.meet_verified then
    raise exception 'portal_snapshot_settings_changed';
  end if;

  select * into v_aggregate from public.dashboard_aggregates
    where event_id = 17135 for update;
  if not found or v_aggregate.registered is not null or v_aggregate.checked_in is not null or
     v_aggregate.check_in_rate is not null or v_aggregate.last_successful_sync is not null or
     v_aggregate.meet_failed_at is not null then
    raise exception 'portal_snapshot_aggregate_changed';
  end if;

  if exists (select 1 from public.meet_snapshots where event_id = 17135) or
     exists (select 1 from public.sync_runs where event_id = 17135) or
     exists (select 1 from public.sync_leases where event_id = 17135) then
    raise exception 'portal_snapshot_sync_state_changed';
  end if;

  insert into public.meet_snapshots
    (event_id, registered, checked_in, check_in_rate, last_successful_sync)
    values (17135, 202, 0, 0, v_published_at);

  update public.dashboard_aggregates
    set registered = 202, checked_in = 0, check_in_rate = 0,
        last_successful_sync = v_published_at, updated_at = v_published_at
    where event_id = 17135;

  update public.event_settings set meet_verified = true where event_id = 17135;
end;
$$;

select a.event_id, a.registered, a.checked_in, a.check_in_rate,
  a.last_successful_sync as published_at, s.meet_verified,
  (select count(*) from public.meet_snapshots where event_id = 17135) as snapshots,
  (select count(*) from public.sync_runs where event_id = 17135) as sync_runs,
  (select count(*) from public.sync_leases where event_id = 17135) as sync_leases
  from public.dashboard_aggregates a
  join public.event_settings s on s.event_id = a.event_id
  where a.event_id = 17135;

commit;
