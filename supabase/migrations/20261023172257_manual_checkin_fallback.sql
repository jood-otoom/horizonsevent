-- Manual attendance runs in a separate accounting session. API snapshots remain raw.
create table public.meet_checkin_control (
  event_id integer primary key references public.event_settings(event_id),
  mode text not null default 'api' check (mode in ('api', 'manual')),
  session_id uuid,
  manual_baseline integer,
  session_started_at timestamptz,
  check ((mode = 'api') or
    (session_id is not null and manual_baseline is not null and session_started_at is not null))
);
insert into public.meet_checkin_control (event_id) values (17135);
alter table public.meet_checkin_control enable row level security;
revoke all on public.meet_checkin_control from public, anon, authenticated;
grant select, update on public.meet_checkin_control to service_role;

alter table public.controller_requests add column manual_session_id uuid;
alter table public.controller_requests drop constraint controller_requests_kind_check;
alter table public.controller_requests drop constraint controller_requests_check;
alter table public.controller_requests add constraint controller_requests_kind_check
  check (kind in ('meeting', 'feedback', 'checkin'));
alter table public.controller_requests add constraint controller_requests_shape_check check (
  (kind = 'meeting' and quantity is not null and rating is null and manual_session_id is null) or
  (kind = 'feedback' and rating is not null and quantity is null and manual_session_id is null) or
  (kind = 'checkin' and quantity = 1 and rating is null and manual_session_id is not null)
);

create table public.checkin_reconciliations (
  event_id integer not null references public.event_settings(event_id),
  request_id uuid not null,
  session_id uuid not null,
  staff_id uuid not null references auth.users(id),
  manual_checked_in integer not null,
  api_checked_in integer not null,
  api_snapshot_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (event_id, request_id),
  unique (event_id, session_id)
);
alter table public.checkin_reconciliations enable row level security;
revoke all on public.checkin_reconciliations from public, anon, authenticated;
grant select, insert on public.checkin_reconciliations to service_role;

create function public.record_manual_checkin(p_event_id integer, p_request_id uuid, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_control public.meet_checkin_control%rowtype;
  v_request public.controller_requests%rowtype;
  v_aggregate public.dashboard_aggregates%rowtype;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then raise exception 'forbidden'; end if;

  -- One event control lock serializes submissions, reversals, reconciliation and sync publication.
  select * into v_control from public.meet_checkin_control
    where event_id = p_event_id for update;
  select * into v_request from public.controller_requests
    where event_id = p_event_id and request_id = p_request_id;
  if found then
    if v_request.kind <> 'checkin' or v_request.staff_id <> p_staff_id then
      raise exception 'request_conflict';
    end if;
    return jsonb_build_object('id', v_request.request_id, 'createdAt', v_request.created_at);
  end if;
  select * into v_aggregate from public.dashboard_aggregates
    where event_id = p_event_id for update;
  if v_aggregate.registered is null or v_aggregate.checked_in is null then
    raise exception 'attendance_unavailable';
  end if;
  if v_aggregate.checked_in >= v_aggregate.registered then
    raise exception 'attendance_at_capacity';
  end if;
  if v_control.mode = 'api' then
    update public.meet_checkin_control set mode = 'manual', session_id = gen_random_uuid(),
      manual_baseline = v_aggregate.checked_in, session_started_at = now()
      where event_id = p_event_id returning * into v_control;
  end if;
  insert into public.controller_requests
    (event_id, request_id, kind, quantity, manual_session_id, staff_id)
    values (p_event_id, p_request_id, 'checkin', 1, v_control.session_id, p_staff_id)
    returning * into v_request;
  update public.dashboard_aggregates set checked_in = checked_in + 1,
    check_in_rate = round((checked_in + 1)::numeric * 100 / registered)::integer,
    updated_at = now() where event_id = p_event_id;
  return jsonb_build_object('id', v_request.request_id, 'createdAt', v_request.created_at);
end;
$$;

-- A recovered API pull records the raw snapshot but never changes an active manual count.
create or replace function public.complete_meet_sync(
  p_run_id uuid, p_token uuid, p_registered integer, p_checked_in integer,
  p_pages integer, p_records integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_event_id integer;
  v_started timestamptz;
  v_now timestamptz := now();
  v_control public.meet_checkin_control%rowtype;
  v_aggregate public.dashboard_aggregates%rowtype;
begin
  if p_registered < 0 or p_checked_in < 0 or p_checked_in > p_registered or
     p_pages < 1 or p_records < p_registered then return false; end if;
  select l.event_id, r.started_at into v_event_id, v_started
    from public.sync_leases l join public.sync_runs r on r.id = l.run_id
    where l.run_id = p_run_id and l.token = p_token and l.expires_at > v_now
      and r.status = 'running' for update of l;
  if not found then return false; end if;
  select * into v_control from public.meet_checkin_control
    where event_id = v_event_id for update;
  select * into v_aggregate from public.dashboard_aggregates
    where event_id = v_event_id for update;
  if v_control.mode = 'manual' and v_aggregate.checked_in > p_registered then
    raise exception 'manual_count_exceeds_registered';
  end if;
  insert into public.meet_snapshots (event_id, registered, checked_in, check_in_rate, last_successful_sync)
    values (v_event_id, p_registered, p_checked_in,
      case when p_registered = 0 then 0 else round(p_checked_in::numeric * 100 / p_registered)::integer end,
      v_now);
  update public.dashboard_aggregates set registered = p_registered,
    checked_in = case when v_control.mode = 'manual' then checked_in else p_checked_in end,
    check_in_rate = case when p_registered = 0 then 0 else
      round((case when v_control.mode = 'manual' then checked_in else p_checked_in end)::numeric
        * 100 / p_registered)::integer end,
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

-- A staff member must compare both displayed counts before switching sources.
create function public.reconcile_manual_checkins(
  p_event_id integer, p_request_id uuid, p_staff_id uuid,
  p_expected_manual integer, p_expected_api integer, p_expected_api_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_control public.meet_checkin_control%rowtype;
  v_aggregate public.dashboard_aggregates%rowtype;
  v_snapshot public.meet_snapshots%rowtype;
  v_prior public.checkin_reconciliations%rowtype;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null or
    p_expected_manual < 0 or p_expected_api < 0 or p_expected_api_at is null then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then raise exception 'forbidden'; end if;
  select * into v_control from public.meet_checkin_control
    where event_id = p_event_id for update;
  -- A retry may have waited for the first transaction to commit.
  select * into v_prior from public.checkin_reconciliations
    where event_id = p_event_id and request_id = p_request_id;
  if found then
    if v_prior.staff_id <> p_staff_id or v_prior.manual_checked_in <> p_expected_manual or
       v_prior.api_checked_in <> p_expected_api or v_prior.api_snapshot_at <> p_expected_api_at then
      raise exception 'request_conflict';
    end if;
    return jsonb_build_object('id', v_prior.request_id, 'createdAt', v_prior.created_at);
  end if;
  select * into v_aggregate from public.dashboard_aggregates
    where event_id = p_event_id for update;
  select * into v_snapshot from public.meet_snapshots
    where event_id = p_event_id order by last_successful_sync desc limit 1;
  if v_control.mode <> 'manual' or v_aggregate.checked_in <> p_expected_manual or
     v_snapshot.checked_in <> p_expected_api or v_snapshot.last_successful_sync <> p_expected_api_at or
     v_snapshot.last_successful_sync <= v_control.session_started_at or
     v_snapshot.registered <> v_aggregate.registered then
    raise exception 'reconciliation_conflict';
  end if;
  insert into public.checkin_reconciliations
    (event_id, request_id, session_id, staff_id, manual_checked_in, api_checked_in, api_snapshot_at)
    values (p_event_id, p_request_id, v_control.session_id, p_staff_id,
      p_expected_manual, p_expected_api, p_expected_api_at)
    returning * into v_prior;
  update public.dashboard_aggregates set checked_in = v_snapshot.checked_in,
    check_in_rate = v_snapshot.check_in_rate, updated_at = now()
    where event_id = p_event_id;
  update public.meet_checkin_control set mode = 'api', session_id = null,
    manual_baseline = null, session_started_at = null where event_id = p_event_id;
  return jsonb_build_object('id', v_prior.request_id, 'createdAt', v_prior.created_at);
end;
$$;

create or replace function public.reverse_controller_action(
  p_event_id integer, p_original_request_id uuid, p_reversal_request_id uuid,
  p_staff_id uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.controller_requests%rowtype;
  v_reversal public.controller_reversals%rowtype;
  v_record_count integer;
  v_control public.meet_checkin_control%rowtype;
begin
  if p_event_id <> 17135 or p_original_request_id is null or
    p_reversal_request_id is null or p_original_request_id = p_reversal_request_id or
    p_staff_id is null or p_reason is null or
    p_reason not in ('duplicate', 'wrong_count', 'wrong_rating', 'other') then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then raise exception 'forbidden'; end if;
  -- Match check-in submissions' lock order to the sync and submission functions.
  select * into v_control from public.meet_checkin_control
    where event_id = p_event_id for update;
  select * into v_request from public.controller_requests
    where event_id = p_event_id and request_id = p_original_request_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if (v_request.kind = 'meeting' and p_reason = 'wrong_rating') or
    (v_request.kind = 'feedback' and p_reason = 'wrong_count') or
    (v_request.kind = 'checkin' and p_reason = 'wrong_rating') then
    raise exception 'invalid_submission';
  end if;
  select * into v_reversal from public.controller_reversals
    where event_id = p_event_id and original_request_id = p_original_request_id;
  if found then
    if v_reversal.reversal_request_id <> p_reversal_request_id or
      v_reversal.staff_id <> p_staff_id or v_reversal.reason <> p_reason then
      raise exception 'already_reversed';
    end if;
    return jsonb_build_object('id', v_reversal.reversal_request_id,
      'originalRequestId', p_original_request_id, 'createdAt', v_reversal.created_at);
  end if;
  if exists (select 1 from public.controller_reversals where event_id = p_event_id
    and reversal_request_id = p_reversal_request_id) then raise exception 'request_conflict'; end if;
  if v_request.kind = 'meeting' then
    select count(*) into v_record_count from public.meeting_records
      where event_id = p_event_id and request_id = p_original_request_id;
    if v_record_count <> v_request.quantity then raise exception 'record_inconsistent'; end if;
    update public.dashboard_aggregates set completed_meetings = completed_meetings - v_request.quantity,
      updated_at = now() where event_id = p_event_id and completed_meetings >= v_request.quantity;
  elsif v_request.kind = 'feedback' then
    select count(*) into v_record_count from public.feedback_records
      where event_id = p_event_id and request_id = p_original_request_id and rating = v_request.rating;
    if v_record_count <> 1 then raise exception 'record_inconsistent'; end if;
    update public.dashboard_aggregates set feedback_count = feedback_count - 1,
      rating_sum = rating_sum - v_request.rating, updated_at = now()
      where event_id = p_event_id and feedback_count >= 1 and rating_sum >= v_request.rating;
  else
    if v_control.mode <> 'manual' or v_control.session_id <> v_request.manual_session_id then
      raise exception 'reconciliation_conflict';
    end if;
    update public.dashboard_aggregates set checked_in = checked_in - 1,
      check_in_rate = case when registered = 0 then 0 else
        round((checked_in - 1)::numeric * 100 / registered)::integer end,
      updated_at = now() where event_id = p_event_id and checked_in > v_control.manual_baseline;
  end if;
  if not found then raise exception 'aggregate_inconsistent'; end if;
  insert into public.controller_reversals
    (event_id, reversal_request_id, original_request_id, staff_id, reason)
    values (p_event_id, p_reversal_request_id, p_original_request_id, p_staff_id, p_reason)
    returning * into v_reversal;
  return jsonb_build_object('id', v_reversal.reversal_request_id,
    'originalRequestId', p_original_request_id, 'createdAt', v_reversal.created_at);
end;
$$;

create or replace function public.list_controller_actions(p_event_id integer, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_actions jsonb; v_session uuid; v_mode text;
begin
  if p_event_id <> 17135 or p_staff_id is null then raise exception 'invalid_submission'; end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then raise exception 'forbidden'; end if;
  select mode, session_id into v_mode, v_session from public.meet_checkin_control where event_id = p_event_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', recent.request_id, 'kind', recent.kind, 'operation', recent.operation,
    'quantity', recent.quantity, 'rating', recent.rating, 'value', recent.value,
    'originalRequestId', recent.original_request_id,
    'createdAt', recent.created_at, 'reversedAt', recent.reversed_at,
    'undoEligible', recent.operation = 'submission' and recent.reversed_at is null and
      (recent.kind <> 'checkin' or (v_mode = 'manual' and recent.manual_session_id = v_session)))
    order by recent.created_at desc, recent.request_id desc), '[]'::jsonb)
    into v_actions from (
      select events.* from (
        select r.request_id, r.kind, 'submission'::text as operation, r.quantity, r.rating,
          null::integer as value, null::uuid as original_request_id, r.created_at,
          v.created_at as reversed_at, r.manual_session_id
          from public.controller_requests r
          left join public.controller_reversals v on v.event_id = r.event_id
            and v.original_request_id = r.request_id
          where r.event_id = p_event_id
        union all
        select v.reversal_request_id, r.kind, 'undo', r.quantity, r.rating,
          null::integer, r.request_id, v.created_at, null::timestamptz, r.manual_session_id
          from public.controller_reversals v join public.controller_requests r
            on r.event_id = v.event_id and r.request_id = v.original_request_id
          where v.event_id = p_event_id
        union all
        select c.request_id, 'checkin', 'reconcile', null::smallint, null::smallint,
          c.api_checked_in, null::uuid, c.created_at, null::timestamptz, null::uuid
          from public.checkin_reconciliations c where c.event_id = p_event_id
      ) events order by events.created_at desc, events.request_id desc limit 5
    ) recent;
  return v_actions;
end;
$$;

create function public.get_checkin_control(p_event_id integer, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_control public.meet_checkin_control%rowtype; v_aggregate public.dashboard_aggregates%rowtype;
  v_snapshot public.meet_snapshots%rowtype;
begin
  if p_event_id <> 17135 or p_staff_id is null then raise exception 'invalid_submission'; end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then raise exception 'forbidden'; end if;
  select * into v_control from public.meet_checkin_control where event_id = p_event_id;
  select * into v_aggregate from public.dashboard_aggregates where event_id = p_event_id;
  select * into v_snapshot from public.meet_snapshots where event_id = p_event_id
    order by last_successful_sync desc limit 1;
  return jsonb_build_object('mode', v_control.mode, 'registered', v_aggregate.registered,
    'checkedIn', v_aggregate.checked_in, 'apiCheckedIn', v_snapshot.checked_in,
    'apiAsOf', v_snapshot.last_successful_sync,
    'canReconcile', coalesce(v_control.mode = 'manual' and
      v_snapshot.last_successful_sync > v_control.session_started_at and
      v_snapshot.registered = v_aggregate.registered, false));
end;
$$;

revoke all on function public.record_manual_checkin(integer, uuid, uuid),
  public.reconcile_manual_checkins(integer, uuid, uuid, integer, integer, timestamptz),
  public.get_checkin_control(integer, uuid) from public, anon, authenticated;
grant execute on function public.record_manual_checkin(integer, uuid, uuid),
  public.reconcile_manual_checkins(integer, uuid, uuid, integer, integer, timestamptz),
  public.get_checkin_control(integer, uuid) to service_role;
