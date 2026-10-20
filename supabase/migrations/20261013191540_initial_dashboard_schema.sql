-- Event 17135 only. Nothing in this migration schedules a job or grants a browser write.
create table public.event_settings (
  event_id integer primary key check (event_id = 17135),
  meeting_target integer check (meeting_target >= 0),
  meet_verified boolean not null default false,
  max_meet_age_seconds integer not null default 300 check (max_meet_age_seconds between 30 and 86400)
);
insert into public.event_settings (event_id) values (17135);

create table public.event_memberships (
  event_id integer not null references public.event_settings(event_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'staff', 'admin')),
  primary key (event_id, user_id)
);

create table public.meet_snapshots (
  id bigint generated always as identity primary key,
  event_id integer not null references public.event_settings(event_id),
  registered integer not null check (registered >= 0),
  checked_in integer not null check (checked_in >= 0 and checked_in <= registered),
  check_in_rate integer not null check (check_in_rate between 0 and 100),
  last_successful_sync timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_id, last_successful_sync)
);
create index meet_snapshots_event_latest on public.meet_snapshots (event_id, last_successful_sync desc);

-- This is the only table published to Realtime. It contains safe aggregates only.
create table public.dashboard_aggregates (
  event_id integer primary key references public.event_settings(event_id),
  registered integer,
  checked_in integer,
  check_in_rate integer,
  last_successful_sync timestamptz,
  meet_failed_at timestamptz,
  completed_meetings integer not null default 0 check (completed_meetings >= 0),
  feedback_count integer not null default 0 check (feedback_count >= 0),
  rating_sum integer not null default 0 check (rating_sum >= 0),
  updated_at timestamptz not null default now(),
  check ((registered is null and checked_in is null and check_in_rate is null and last_successful_sync is null)
    or (registered is not null and checked_in is not null and check_in_rate is not null and last_successful_sync is not null)),
  check (checked_in is null or (checked_in >= 0 and checked_in <= registered)),
  check (check_in_rate is null or check_in_rate between 0 and 100),
  check (rating_sum >= feedback_count and rating_sum <= feedback_count * 5)
);
insert into public.dashboard_aggregates (event_id) values (17135);

create table public.sync_runs (
  id uuid primary key,
  event_id integer not null references public.event_settings(event_id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  pages_processed integer not null default 0 check (pages_processed >= 0),
  records_processed integer not null default 0 check (records_processed >= 0),
  safe_error text,
  duration_ms integer check (duration_ms >= 0)
);
create index sync_runs_event_started on public.sync_runs (event_id, started_at desc);

create table public.sync_leases (
  event_id integer primary key references public.event_settings(event_id),
  token uuid not null,
  run_id uuid not null unique references public.sync_runs(id),
  expires_at timestamptz not null
);

create table public.controller_requests (
  event_id integer not null references public.event_settings(event_id),
  request_id uuid not null,
  kind text not null check (kind in ('meeting', 'feedback')),
  quantity smallint check (quantity between 1 and 3),
  rating smallint check (rating between 1 and 5),
  staff_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (event_id, request_id),
  check ((kind = 'meeting' and quantity is not null and rating is null) or
    (kind = 'feedback' and rating is not null and quantity is null))
);

create table public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  event_id integer not null,
  request_id uuid not null,
  ordinal smallint not null check (ordinal between 1 and 3),
  staff_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, request_id, ordinal),
  foreign key (event_id, request_id) references public.controller_requests(event_id, request_id)
);
create index meeting_records_event_created on public.meeting_records (event_id, created_at desc);

create table public.feedback_records (
  id uuid primary key default gen_random_uuid(),
  event_id integer not null,
  request_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  staff_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, request_id),
  foreign key (event_id, request_id) references public.controller_requests(event_id, request_id)
);
create index feedback_records_event_created on public.feedback_records (event_id, created_at desc);

alter table public.event_settings enable row level security;
alter table public.event_memberships enable row level security;
alter table public.meet_snapshots enable row level security;
alter table public.dashboard_aggregates enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_leases enable row level security;
alter table public.controller_requests enable row level security;
alter table public.meeting_records enable row level security;
alter table public.feedback_records enable row level security;

revoke all on public.event_settings, public.event_memberships, public.meet_snapshots,
  public.dashboard_aggregates, public.sync_runs, public.sync_leases,
  public.controller_requests, public.meeting_records, public.feedback_records from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.event_memberships, public.event_settings, public.dashboard_aggregates to authenticated;

create policy "members read own membership" on public.event_memberships
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members read event settings" on public.event_settings
  for select to authenticated using (exists (
    select 1 from public.event_memberships m
    where m.event_id = event_settings.event_id and m.user_id = (select auth.uid())
  ));
create policy "members read safe aggregates" on public.dashboard_aggregates
  for select to authenticated using (exists (
    select 1 from public.event_memberships m
    where m.event_id = dashboard_aggregates.event_id and m.user_id = (select auth.uid())
  ));

-- The service role is the only writer; RLS still protects browser roles.
grant select, insert, update, delete on public.event_settings, public.event_memberships, public.meet_snapshots,
  public.dashboard_aggregates, public.sync_runs, public.sync_leases,
  public.controller_requests, public.meeting_records, public.feedback_records to service_role;
grant usage, select on sequence public.meet_snapshots_id_seq to service_role;

create function public.claim_meet_sync(p_event_id integer, p_run_id uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_event_id <> 17135 or p_run_id is null or p_token is null then return false; end if;
  update public.sync_runs set status = 'failed', finished_at = now(), safe_error = 'lease_expired',
    duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::integer)
    where id = (select run_id from public.sync_leases
      where event_id = p_event_id and expires_at < now()) and status = 'running';
  if found then
    update public.dashboard_aggregates set meet_failed_at = now(), updated_at = now()
      where event_id = p_event_id;
  end if;
  insert into public.sync_runs (id, event_id, status) values (p_run_id, p_event_id, 'running');
  insert into public.sync_leases (event_id, token, run_id, expires_at)
    values (p_event_id, p_token, p_run_id, now() + interval '180 seconds')
    on conflict (event_id) do update set token = excluded.token, run_id = excluded.run_id,
      expires_at = excluded.expires_at
    where public.sync_leases.expires_at < now();
  if not found then
    update public.sync_runs set status = 'failed', finished_at = now(), safe_error = 'overlap', duration_ms = 0
      where id = p_run_id;
    return false;
  end if;
  return true;
end;
$$;

create function public.complete_meet_sync(
  p_run_id uuid, p_token uuid, p_registered integer, p_checked_in integer,
  p_pages integer, p_records integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_event_id integer; v_started timestamptz; v_now timestamptz := now();
begin
  if p_registered < 0 or p_checked_in < 0 or p_checked_in > p_registered or
     p_pages < 1 or p_records < p_registered then return false; end if;
  select l.event_id, r.started_at into v_event_id, v_started
    from public.sync_leases l join public.sync_runs r on r.id = l.run_id
    where l.run_id = p_run_id and l.token = p_token and l.expires_at > v_now
      and r.status = 'running'
    for update of l;
  if not found then return false; end if;
  insert into public.meet_snapshots (event_id, registered, checked_in, check_in_rate, last_successful_sync)
    values (v_event_id, p_registered, p_checked_in,
      case when p_registered = 0 then 0 else round(p_checked_in::numeric * 100 / p_registered)::integer end,
      v_now);
  update public.dashboard_aggregates set registered = p_registered, checked_in = p_checked_in,
    check_in_rate = case when p_registered = 0 then 0 else round(p_checked_in::numeric * 100 / p_registered)::integer end,
    last_successful_sync = v_now, meet_failed_at = null, updated_at = v_now
    where event_id = v_event_id;
  update public.sync_runs set status = 'succeeded', finished_at = v_now,
    pages_processed = p_pages, records_processed = p_records,
    duration_ms = greatest(0, floor(extract(epoch from (v_now - v_started)) * 1000)::integer)
    where id = p_run_id;
  delete from public.sync_leases where event_id = v_event_id and token = p_token;
  return true;
end;
$$;

create function public.fail_meet_sync(p_run_id uuid, p_token uuid, p_error text,
  p_pages integer default 0, p_records integer default 0)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_event_id integer;
begin
  select event_id into v_event_id from public.sync_leases
    where run_id = p_run_id and token = p_token for update;
  if not found then return; end if;
  update public.sync_runs set status = 'failed', finished_at = now(),
    pages_processed = greatest(0, coalesce(p_pages, 0)),
    records_processed = greatest(0, coalesce(p_records, 0)),
    safe_error = case when p_error in ('missing_api_key','invalid_event_id','upstream_unauthorized',
      'event_not_found','upstream_redirect','invalid_json','invalid_response','wrong_event',
      'transient_upstream_failure','network_failure','sync_timeout','retry_after_exceeds_budget',
      'repeated_current_page','inconsistent_pagination','conflicting_participant',
      'incomplete_pagination','repeated_page_token','page_limit_exceeded',
      'unknown_participant_status','publication_failed','lease_expired') then p_error else 'unknown' end,
    duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::integer)
    where id = p_run_id and status = 'running';
  if not found then return; end if;
  update public.dashboard_aggregates set meet_failed_at = now(), updated_at = now()
    where event_id = v_event_id;
  delete from public.sync_leases where event_id = v_event_id and token = p_token;
end;
$$;

create function public.record_meetings(p_event_id integer, p_request_id uuid,
  p_staff_id uuid, p_quantity smallint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_request public.controller_requests%rowtype; v_total integer;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null or p_quantity not between 1 and 3 then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff','admin')) then raise exception 'forbidden'; end if;
  insert into public.controller_requests (event_id, request_id, kind, quantity, staff_id)
    values (p_event_id, p_request_id, 'meeting', p_quantity, p_staff_id)
    on conflict do nothing;
  select * into v_request from public.controller_requests
    where event_id = p_event_id and request_id = p_request_id for update;
  if v_request.kind <> 'meeting' or v_request.quantity <> p_quantity or v_request.staff_id <> p_staff_id then
    raise exception 'request_conflict';
  end if;
  if not exists (select 1 from public.meeting_records where event_id = p_event_id and request_id = p_request_id) then
    insert into public.meeting_records (event_id, request_id, ordinal, staff_id)
      select p_event_id, p_request_id, n, p_staff_id from generate_series(1, p_quantity) n;
    update public.dashboard_aggregates set completed_meetings = completed_meetings + p_quantity,
      updated_at = now() where event_id = p_event_id;
  end if;
  select completed_meetings into v_total from public.dashboard_aggregates where event_id = p_event_id;
  return jsonb_build_object('id', p_request_id, 'createdAt', v_request.created_at,
    'completedMeetings', v_total);
end;
$$;

create function public.record_feedback(p_event_id integer, p_request_id uuid,
  p_staff_id uuid, p_rating smallint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_request public.controller_requests%rowtype; v_count integer; v_sum integer;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null or p_rating not between 1 and 5 then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff','admin')) then raise exception 'forbidden'; end if;
  insert into public.controller_requests (event_id, request_id, kind, rating, staff_id)
    values (p_event_id, p_request_id, 'feedback', p_rating, p_staff_id)
    on conflict do nothing;
  select * into v_request from public.controller_requests
    where event_id = p_event_id and request_id = p_request_id for update;
  if v_request.kind <> 'feedback' or v_request.rating <> p_rating or v_request.staff_id <> p_staff_id then
    raise exception 'request_conflict';
  end if;
  if not exists (select 1 from public.feedback_records where event_id = p_event_id and request_id = p_request_id) then
    insert into public.feedback_records (event_id, request_id, rating, staff_id)
      values (p_event_id, p_request_id, p_rating, p_staff_id);
    update public.dashboard_aggregates set feedback_count = feedback_count + 1,
      rating_sum = rating_sum + p_rating, updated_at = now() where event_id = p_event_id;
  end if;
  select feedback_count, rating_sum into v_count, v_sum from public.dashboard_aggregates where event_id = p_event_id;
  return jsonb_build_object('id', p_request_id, 'createdAt', v_request.created_at,
    'rating', p_rating, 'feedbackCount', v_count,
    'averageRating', case when v_count = 0 then null else v_sum::numeric / v_count end);
end;
$$;

revoke all on function public.claim_meet_sync(integer, uuid, uuid),
  public.complete_meet_sync(uuid, uuid, integer, integer, integer, integer),
  public.fail_meet_sync(uuid, uuid, text, integer, integer),
  public.record_meetings(integer, uuid, uuid, smallint),
  public.record_feedback(integer, uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.claim_meet_sync(integer, uuid, uuid),
  public.complete_meet_sync(uuid, uuid, integer, integer, integer, integer),
  public.fail_meet_sync(uuid, uuid, text, integer, integer),
  public.record_meetings(integer, uuid, uuid, smallint),
  public.record_feedback(integer, uuid, uuid, smallint) to service_role;

alter publication supabase_realtime add table public.dashboard_aggregates;
