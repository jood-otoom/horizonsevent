-- Durable event controls. All writes remain behind authenticated Edge Functions.
alter table public.meet_checkin_control
  add column source text not null default 'snapshot' check (source in ('snapshot','api','manual','reset')),
  add column sync_state text not null default 'stopped' check (sync_state in ('stopped','starting','running','syncing','failed')),
  add column sync_enabled boolean not null default false,
  add column generation bigint not null default 0,
  add column version bigint not null default 0,
  add column registered_override integer check (registered_override >= 0),
  add column last_attempt_at timestamptz,
  add column last_success_at timestamptz,
  add column next_sync_at timestamptz,
  add column failed_at timestamptz,
  add column safe_error text,
  add column http_status integer check (http_status between 100 and 599),
  add column dispatch_at timestamptz,
  add column dispatch_request_id bigint;
alter table public.sync_runs add column generation bigint not null default 0,
  add column http_status integer check (http_status between 100 and 599);
alter table public.controller_requests add column cleared_at timestamptz;
alter table public.controller_requests drop constraint controller_requests_quantity_check;
alter table public.controller_requests add constraint controller_requests_quantity_check
  check (quantity between 1 and 10);
alter table public.controller_requests drop constraint controller_requests_shape_check;
alter table public.controller_requests add constraint controller_requests_shape_check check (
  (kind = 'meeting' and quantity between 1 and 3 and rating is null and manual_session_id is null) or
  (kind = 'feedback' and rating is not null and quantity is null and manual_session_id is null) or
  (kind = 'checkin' and quantity in (1,2,5,10) and rating is null and manual_session_id is not null)
);

create table public.controller_operations (
  event_id integer not null references public.event_settings(event_id),
  request_id uuid not null,
  staff_id uuid not null references auth.users(id),
  operation text not null check (operation in ('start_sync','stop_sync','activate_manual','update_settings','set_checkins','reset_event')),
  input jsonb not null,
  before_values jsonb not null,
  after_values jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (event_id, request_id)
);
alter table public.controller_operations enable row level security;
revoke all on public.controller_operations from public, anon, authenticated;
grant select, insert on public.controller_operations to service_role;

create or replace function public.get_event_control(p_event_id integer, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; a public.dashboard_aggregates%rowtype;
  s public.meet_snapshots%rowtype; t integer; r text; v_ready boolean:=false;
begin
  if p_event_id <> 17135 or p_staff_id is null then raise exception 'invalid_submission'; end if;
  select role into r from public.event_memberships where event_id=p_event_id and user_id=p_staff_id;
  if r is null or r not in ('staff','admin') then raise exception 'forbidden'; end if;
  select * into c from public.meet_checkin_control where event_id=p_event_id;
  select * into a from public.dashboard_aggregates where event_id=p_event_id;
  select * into s from public.meet_snapshots where event_id=p_event_id order by last_successful_sync desc limit 1;
  select meeting_target into t from public.event_settings where event_id=p_event_id;
  begin
    execute 'select event_private.meet_scheduler_ready()' into v_ready;
  exception when undefined_function or invalid_schema_name then v_ready:=false; end;
  return jsonb_build_object('role',r,'mode',c.mode,
    'syncState',case when c.mode='manual' then 'manual' else c.sync_state end,
    'syncEnabled',c.sync_enabled,'registered',a.registered,'checkedIn',a.checked_in,
    'source',c.source,
    'version',c.version,'meetingTarget',t,'registeredOverride',c.registered_override,
    'lastSuccessAt',c.last_success_at,'lastAttemptAt',c.last_attempt_at,'nextSyncAt',c.next_sync_at,
    'apiRegistered',s.registered,'apiCheckedIn',s.checked_in,
    'error',c.safe_error,'httpStatus',c.http_status,
    'canStart',r='admin' and c.mode='api' and not c.sync_enabled and coalesce(v_ready,false));
end;
$$;

create or replace function public.get_checkin_control(p_event_id integer, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v jsonb; s public.meet_snapshots%rowtype;
begin
  v := public.get_event_control(p_event_id,p_staff_id);
  select * into s from public.meet_snapshots where event_id=p_event_id order by last_successful_sync desc limit 1;
  return jsonb_build_object('mode',v->'mode','registered',v->'registered','checkedIn',v->'checkedIn',
    'apiCheckedIn',s.checked_in,'apiAsOf',s.last_successful_sync,'canReconcile',false,
    'version',v->'version','source',v->'source','manualFallback',v->>'mode'='manual',
    'canSetExact',v->>'role'='admin');
end;
$$;

-- Never return to API mode during the event session.
create or replace function public.reconcile_manual_checkins(
  p_event_id integer,p_request_id uuid,p_staff_id uuid,
  p_expected_manual integer,p_expected_api integer,p_expected_api_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin raise exception 'manual_mode_permanent'; end;
$$;

-- Replaced with an explicit mode transition; the old three-argument RPC cannot silently enter manual mode.
drop function public.record_manual_checkin(integer,uuid,uuid);
create function public.record_manual_checkin(p_event_id integer,p_request_id uuid,p_staff_id uuid,p_quantity integer default 1)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; a public.dashboard_aggregates%rowtype;
  r public.controller_requests%rowtype;
begin
  if p_event_id<>17135 or p_request_id is null or p_staff_id is null or p_quantity is null or p_quantity not in (1,2,5,10)
    then raise exception 'invalid_submission'; end if;
  if not exists(select 1 from public.event_memberships where event_id=p_event_id and user_id=p_staff_id and role in ('staff','admin'))
    then raise exception 'forbidden'; end if;
  select * into c from public.meet_checkin_control where event_id=p_event_id for update;
  select * into r from public.controller_requests where event_id=p_event_id and request_id=p_request_id;
  if found then
    if r.kind<>'checkin' or r.quantity<>p_quantity or r.staff_id<>p_staff_id then raise exception 'request_conflict'; end if;
    return jsonb_build_object('id',r.request_id,'createdAt',r.created_at);
  end if;
  if exists(select 1 from public.controller_operations where event_id=p_event_id and request_id=p_request_id) or
    exists(select 1 from public.controller_reversals where event_id=p_event_id and reversal_request_id=p_request_id) then raise exception 'request_conflict'; end if;
  if c.mode<>'manual' then raise exception 'manual_mode_required'; end if;
  select * into a from public.dashboard_aggregates where event_id=p_event_id for update;
  if a.registered is null or a.checked_in is null then raise exception 'attendance_unavailable'; end if;
  if a.checked_in::bigint+p_quantity>a.registered then raise exception 'attendance_at_capacity'; end if;
  insert into public.controller_requests(event_id,request_id,kind,quantity,manual_session_id,staff_id)
    values(p_event_id,p_request_id,'checkin',p_quantity,c.session_id,p_staff_id) returning * into r;
  update public.dashboard_aggregates set checked_in=checked_in+p_quantity,
    check_in_rate=case when registered=0 then 0 else round((checked_in+p_quantity)::numeric*100/registered)::integer end,
    updated_at=clock_timestamp() where event_id=p_event_id;
  update public.meet_checkin_control set version=version+1 where event_id=p_event_id;
  return jsonb_build_object('id',r.request_id,'createdAt',r.created_at);
end;
$$;

create function public.set_manual_checkin(p_event_id integer,p_request_id uuid,p_staff_id uuid,p_checked_in integer,p_expected_version bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; a public.dashboard_aggregates%rowtype;
  o public.controller_operations%rowtype; v_input jsonb;
begin
  if p_event_id<>17135 or p_request_id is null or p_staff_id is null or p_checked_in is null or p_checked_in<0 or p_expected_version is null or p_expected_version<0
    then raise exception 'invalid_submission'; end if;
  if not exists(select 1 from public.event_memberships where event_id=p_event_id and user_id=p_staff_id and role='admin') then raise exception 'forbidden'; end if;
  v_input:=jsonb_build_object('checkedIn',p_checked_in,'expectedVersion',p_expected_version);
  select * into c from public.meet_checkin_control where event_id=p_event_id for update;
  select * into o from public.controller_operations where event_id=p_event_id and request_id=p_request_id;
  if found then
    if o.staff_id<>p_staff_id or o.operation<>'set_checkins' or o.input<>v_input then raise exception 'request_conflict'; end if;
    return jsonb_build_object('id',o.request_id,'createdAt',o.created_at);
  end if;
  if exists(select 1 from public.controller_requests where event_id=p_event_id and request_id=p_request_id) or
    exists(select 1 from public.controller_reversals where event_id=p_event_id and reversal_request_id=p_request_id) then raise exception 'request_conflict'; end if;
  if c.mode<>'manual' then raise exception 'manual_mode_required'; end if;
  if c.version<>p_expected_version then raise exception 'version_conflict'; end if;
  select * into a from public.dashboard_aggregates where event_id=p_event_id for update;
  if a.registered is null or p_checked_in>a.registered then raise exception 'attendance_at_capacity'; end if;
  update public.dashboard_aggregates set checked_in=p_checked_in,
    check_in_rate=case when registered=0 then 0 else round(p_checked_in::numeric*100/registered)::integer end,
    last_successful_sync=coalesce(last_successful_sync,clock_timestamp()),updated_at=clock_timestamp() where event_id=p_event_id;
  -- Exact correction begins a new manual baseline; older increments cannot later subtract from it.
  update public.meet_checkin_control set version=version+1,session_id=gen_random_uuid(),
    manual_baseline=p_checked_in,session_started_at=clock_timestamp() where event_id=p_event_id;
  insert into public.controller_operations(event_id,request_id,staff_id,operation,input,before_values,after_values)
    values(p_event_id,p_request_id,p_staff_id,'set_checkins',v_input,
      jsonb_build_object('checkedIn',a.checked_in),jsonb_build_object('checkedIn',p_checked_in)) returning * into o;
  return jsonb_build_object('id',o.request_id,'createdAt',o.created_at);
end;
$$;

create function public.admin_event_operation(p_event_id integer,p_request_id uuid,p_staff_id uuid,
  p_operation text,p_expected_version bigint,p_value jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; a public.dashboard_aggregates%rowtype;
  o public.controller_operations%rowtype; v_input jsonb; v_before jsonb; v_after jsonb;
  v_registered integer; v_target integer; v_now timestamptz:=clock_timestamp();
begin
  if p_event_id<>17135 or p_request_id is null or p_staff_id is null or p_expected_version is null or p_expected_version<0 or p_operation is null or
    p_operation not in ('start_sync','stop_sync','activate_manual','update_settings','reset_event') or
    p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'invalid_submission'; end if;
  if not exists(select 1 from public.event_memberships where event_id=p_event_id and user_id=p_staff_id and role='admin') then raise exception 'forbidden'; end if;
  v_input:=jsonb_build_object('value',p_value,'expectedVersion',p_expected_version);
  select * into c from public.meet_checkin_control where event_id=p_event_id for update;
  select * into o from public.controller_operations where event_id=p_event_id and request_id=p_request_id;
  if found then
    if o.staff_id<>p_staff_id or o.operation<>p_operation or o.input<>v_input then raise exception 'request_conflict'; end if;
    return jsonb_build_object('id',o.request_id,'createdAt',o.created_at);
  end if;
  if exists(select 1 from public.controller_requests where event_id=p_event_id and request_id=p_request_id) or
    exists(select 1 from public.controller_reversals where event_id=p_event_id and reversal_request_id=p_request_id) then raise exception 'request_conflict'; end if;
  if c.version<>p_expected_version then raise exception 'version_conflict'; end if;
  select * into a from public.dashboard_aggregates where event_id=p_event_id for update;
  v_before:=public.get_event_control(p_event_id,p_staff_id)||jsonb_build_object('completedMeetings',a.completed_meetings);
  if p_operation='start_sync' then
    if c.mode='manual' then raise exception 'manual_mode_permanent'; end if;
    if c.sync_enabled then raise exception 'already_running'; end if;
    update public.meet_checkin_control set sync_enabled=true,sync_state='starting',generation=generation+1,
      version=version+1,next_sync_at=v_now,safe_error=null,http_status=null,failed_at=null,dispatch_at=null,dispatch_request_id=null where event_id=p_event_id;
    -- Installed by the scheduling migration; without it Start must fail atomically.
    execute 'select event_private.dispatch_meet_sync()';
  elsif p_operation='stop_sync' then
    update public.meet_checkin_control set sync_enabled=false,sync_state='stopped',generation=generation+1,
      version=version+1,next_sync_at=null,dispatch_at=null,dispatch_request_id=null where event_id=p_event_id;
  elsif p_operation='activate_manual' then
    if c.sync_enabled then raise exception 'stop_sync_first'; end if;
    if c.mode='manual' then raise exception 'manual_mode_permanent'; end if;
    update public.meet_checkin_control set mode='manual',source='manual',sync_enabled=false,sync_state='stopped',
      generation=generation+1,version=version+1,next_sync_at=null,dispatch_at=null,dispatch_request_id=null,
      session_id=gen_random_uuid(),manual_baseline=coalesce(a.checked_in,0),session_started_at=v_now where event_id=p_event_id;
  elsif p_operation='update_settings' then
    if (p_value - array['registeredOverride','meetingTarget'])<>'{}'::jsonb or p_value='{}'::jsonb then raise exception 'invalid_submission'; end if;
    if p_value ? 'registeredOverride' then
      if jsonb_typeof(p_value->'registeredOverride')<>'number' or (p_value->>'registeredOverride')!~'^[0-9]+$' then raise exception 'invalid_submission'; end if;
      v_registered:=(p_value->>'registeredOverride')::integer;
      if v_registered<coalesce(a.checked_in,0) then raise exception 'attendance_at_capacity'; end if;
      update public.meet_checkin_control set registered_override=v_registered where event_id=p_event_id;
      update public.dashboard_aggregates set registered=v_registered,checked_in=coalesce(checked_in,0),
        check_in_rate=case when v_registered=0 then 0 else round(coalesce(checked_in,0)::numeric*100/v_registered)::integer end,
        last_successful_sync=coalesce(last_successful_sync,v_now),updated_at=v_now where event_id=p_event_id;
    end if;
    if p_value ? 'meetingTarget' then
      if jsonb_typeof(p_value->'meetingTarget')<>'number' or (p_value->>'meetingTarget')!~'^[0-9]+$' then raise exception 'invalid_submission'; end if;
      v_target:=(p_value->>'meetingTarget')::integer;
      if v_target<1 then raise exception 'invalid_submission'; end if;
      update public.event_settings set meeting_target=v_target where event_id=p_event_id;
      update public.dashboard_aggregates set updated_at=v_now where event_id=p_event_id;
    end if;
    update public.meet_checkin_control set version=version+1 where event_id=p_event_id;
  else
    if p_value->>'confirmation' is distinct from 'RESET EVENT' or (p_value-array['confirmation'])<>'{}'::jsonb then raise exception 'invalid_confirmation'; end if;
    update public.meet_checkin_control set sync_enabled=false,sync_state='stopped',source='reset',generation=generation+1,
      version=version+1,registered_override=null,next_sync_at=null,dispatch_at=null,dispatch_request_id=null,
      session_id=case when mode='manual' then gen_random_uuid() else null end,
      manual_baseline=case when mode='manual' then 0 else null end,
      session_started_at=case when mode='manual' then v_now else null end where event_id=p_event_id;
    update public.controller_requests set cleared_at=v_now where event_id=p_event_id and kind in ('meeting','checkin') and cleared_at is null;
    update public.dashboard_aggregates set registered=0,checked_in=0,check_in_rate=0,
      completed_meetings=0,last_successful_sync=v_now,meet_failed_at=null,updated_at=v_now where event_id=p_event_id;
  end if;
  if p_operation in ('stop_sync','activate_manual','reset_event') then
    update public.sync_runs set status='failed',finished_at=v_now,safe_error='cancelled',
      duration_ms=greatest(0,floor(extract(epoch from (v_now-started_at))*1000)::integer)
      where event_id=p_event_id and status='running';
    delete from public.sync_leases where event_id=p_event_id;
  end if;
  v_after:=public.get_event_control(p_event_id,p_staff_id)||
    jsonb_build_object('completedMeetings',(select completed_meetings from public.dashboard_aggregates where event_id=p_event_id));
  insert into public.controller_operations(event_id,request_id,staff_id,operation,input,before_values,after_values)
    values(p_event_id,p_request_id,p_staff_id,p_operation,v_input,v_before,v_after) returning * into o;
  return jsonb_build_object('id',o.request_id,'createdAt',o.created_at);
end;
$$;

drop function public.claim_meet_sync(integer,uuid,uuid);
create function public.claim_meet_sync(p_event_id integer,p_run_id uuid,p_token uuid,p_generation bigint default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_event_id<>17135 or p_run_id is null or p_token is null then return false; end if;
  select * into c from public.meet_checkin_control where event_id=p_event_id for update;
  if c.mode<>'api' or not c.sync_enabled or c.sync_state not in ('starting','running') or c.next_sync_at>v_now or
    (p_generation is not null and p_generation<>c.generation) then return false; end if;
  if exists(select 1 from public.sync_leases where event_id=p_event_id) then return false; end if;
  insert into public.sync_runs(id,event_id,status,generation) values(p_run_id,p_event_id,'running',c.generation);
  insert into public.sync_leases(event_id,token,run_id,expires_at) values(p_event_id,p_token,p_run_id,v_now+interval '150 seconds');
  update public.meet_checkin_control set sync_state='syncing',last_attempt_at=v_now,
    next_sync_at=v_now+interval '120 seconds',dispatch_at=null,dispatch_request_id=null,version=version+1 where event_id=p_event_id;
  return true;
end;
$$;

create or replace function public.complete_meet_sync(p_run_id uuid,p_token uuid,p_registered integer,p_checked_in integer,p_pages integer,p_records integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; l public.sync_leases%rowtype; r public.sync_runs%rowtype;
  v_event integer; v_now timestamptz:=clock_timestamp(); v_registered integer;
begin
  if p_registered is null or p_checked_in is null or p_pages is null or p_records is null or
    p_registered<0 or p_checked_in<0 or p_checked_in>p_registered or p_pages<1 or p_records<p_registered then return false; end if;
  select event_id into v_event from public.sync_runs where id=p_run_id;
  if v_event is null then return false; end if;
  select * into c from public.meet_checkin_control where event_id=v_event for update;
  select * into l from public.sync_leases where event_id=v_event and run_id=p_run_id and token=p_token for update;
  if not found then return false; end if;
  select * into r from public.sync_runs where id=p_run_id;
  if c.mode<>'api' or not c.sync_enabled or c.sync_state<>'syncing' or r.status<>'running' or r.generation<>c.generation or l.expires_at<=v_now then return false; end if;
  v_registered:=coalesce(c.registered_override,p_registered);
  if p_checked_in>v_registered then return false; end if;
  insert into public.meet_snapshots(event_id,registered,checked_in,check_in_rate,last_successful_sync)
    values(v_event,p_registered,p_checked_in,case when p_registered=0 then 0 else round(p_checked_in::numeric*100/p_registered)::integer end,v_now);
  update public.dashboard_aggregates set registered=v_registered,checked_in=p_checked_in,
    check_in_rate=case when v_registered=0 then 0 else round(p_checked_in::numeric*100/v_registered)::integer end,
    last_successful_sync=v_now,meet_failed_at=null,updated_at=v_now where event_id=v_event;
  update public.sync_runs set status='succeeded',finished_at=v_now,pages_processed=p_pages,records_processed=p_records,
    duration_ms=greatest(0,floor(extract(epoch from (v_now-started_at))*1000)::integer) where id=p_run_id;
  delete from public.sync_leases where event_id=v_event;
  update public.meet_checkin_control set sync_state='running',source='api',last_success_at=v_now,
    safe_error=null,http_status=null,failed_at=null,version=version+1 where event_id=v_event;
  return true;
end;
$$;

drop function public.fail_meet_sync(uuid,uuid,text,integer,integer);
create function public.fail_meet_sync(p_run_id uuid,p_token uuid,p_error text,p_pages integer default 0,p_records integer default 0,p_http_status integer default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; r public.sync_runs%rowtype; v_now timestamptz:=clock_timestamp(); v_message text;
begin
  select * into r from public.sync_runs where id=p_run_id;
  if not found then return; end if;
  select * into c from public.meet_checkin_control where event_id=r.event_id for update;
  if not c.sync_enabled or c.mode<>'api' or r.generation<>c.generation or r.status<>'running' or
    not exists(select 1 from public.sync_leases where event_id=r.event_id and run_id=p_run_id and token=p_token) then return; end if;
  v_message:=case
    when p_http_status=429 then 'API rate limit reached (429). Automatic synchronization stopped.'
    when p_http_status in (401,403) then 'B2Match authentication failed ('||p_http_status||'). Automatic synchronization stopped.'
    when p_error in ('sync_timeout','request_timeout') then 'B2Match request timed out. Automatic synchronization stopped.'
    when p_error='publication_failed' then 'Dashboard publication failed. Existing dashboard values preserved. Automatic synchronization stopped.'
    when p_error in ('invalid_json','invalid_response','incomplete_pagination','inconsistent_pagination','repeated_page_token','repeated_current_page','page_limit_exceeded','conflicting_participant','unknown_participant_status','wrong_event')
      then 'Incomplete API response. Existing dashboard values preserved. Automatic synchronization stopped.'
    else 'B2Match synchronization failed. Existing dashboard values preserved. Automatic synchronization stopped.' end;
  update public.sync_runs set status='failed',finished_at=v_now,pages_processed=greatest(0,coalesce(p_pages,0)),
    records_processed=greatest(0,coalesce(p_records,0)),safe_error=v_message,
    http_status=case when p_http_status between 100 and 599 then p_http_status else null end,
    duration_ms=greatest(0,floor(extract(epoch from (v_now-started_at))*1000)::integer) where id=p_run_id;
  update public.meet_checkin_control set sync_enabled=false,sync_state='failed',generation=generation+1,version=version+1,
    next_sync_at=null,failed_at=v_now,safe_error=v_message,http_status=case when p_http_status between 100 and 599 then p_http_status else null end,
    dispatch_at=null,dispatch_request_id=null where event_id=r.event_id;
  update public.dashboard_aggregates set meet_failed_at=v_now,updated_at=v_now where event_id=r.event_id;
  delete from public.sync_leases where event_id=r.event_id;
end;
$$;

-- Public Realtime carries only event 17135 aggregate counts and freshness timestamps.
grant select on public.dashboard_aggregates to anon;
create policy "public reads event aggregates" on public.dashboard_aggregates
  for select to anon using (event_id=17135);

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
  if exists(select 1 from public.controller_requests where event_id=p_event_id and request_id=p_reversal_request_id) or
    exists(select 1 from public.controller_operations where event_id=p_event_id and request_id=p_reversal_request_id) then raise exception 'request_conflict'; end if;
  if v_request.cleared_at is not null then raise exception 'action_cleared'; end if;
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
    update public.dashboard_aggregates set checked_in = checked_in - v_request.quantity,
      check_in_rate = case when registered = 0 then 0 else
        round((checked_in - v_request.quantity)::numeric * 100 / registered)::integer end,
      updated_at = now() where event_id = p_event_id and checked_in - v_request.quantity >= v_control.manual_baseline;
    if not found then raise exception 'aggregate_inconsistent'; end if;
    update public.meet_checkin_control set version=version+1 where event_id=p_event_id;
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


create or replace function public.list_controller_actions(p_event_id integer,p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_actions jsonb; v_session uuid; v_mode text;
begin
  if p_event_id<>17135 or p_staff_id is null then raise exception 'invalid_submission'; end if;
  if not exists(select 1 from public.event_memberships where event_id=p_event_id and user_id=p_staff_id and role in ('staff','admin')) then raise exception 'forbidden'; end if;
  select mode,session_id into v_mode,v_session from public.meet_checkin_control where event_id=p_event_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId',r.request_id,'kind',r.kind,'operation',r.operation,'quantity',r.quantity,'rating',r.rating,
    'value',r.value,'originalRequestId',r.original_request_id,'createdAt',r.created_at,'reversedAt',r.reversed_at,
    'undoEligible',r.undo_eligible) order by r.created_at desc,r.request_id desc),'[]'::jsonb)
    into v_actions from (
      select * from (
        select q.request_id,q.kind,'submission'::text operation,q.quantity,q.rating,null::integer value,
          null::uuid original_request_id,q.created_at,v.created_at reversed_at,
          q.cleared_at is null and v.created_at is null and
            (q.kind<>'checkin' or (v_mode='manual' and q.manual_session_id=v_session)) undo_eligible
          from public.controller_requests q left join public.controller_reversals v
            on v.event_id=q.event_id and v.original_request_id=q.request_id where q.event_id=p_event_id
        union all
        select v.reversal_request_id,q.kind,'undo',q.quantity,q.rating,null::integer,q.request_id,
          v.created_at,null::timestamptz,false from public.controller_reversals v join public.controller_requests q
          on q.event_id=v.event_id and q.request_id=v.original_request_id where v.event_id=p_event_id
        union all
        select o.request_id,case when o.operation='set_checkins' then 'checkin' else 'settings' end,
          o.operation,null::smallint,null::smallint,
          case when o.operation='set_checkins' then (o.after_values->>'checkedIn')::integer else null end,
          null::uuid,o.created_at,null::timestamptz,false from public.controller_operations o where o.event_id=p_event_id
        union all
        select c.request_id,'checkin','reconcile',null::smallint,null::smallint,c.api_checked_in,
          null::uuid,c.created_at,null::timestamptz,false from public.checkin_reconciliations c where c.event_id=p_event_id
      ) all_actions order by created_at desc,request_id desc limit 12
    ) r;
  return v_actions;
end;
$$;

revoke all on function public.get_event_control(integer,uuid),public.get_checkin_control(integer,uuid),
  public.admin_event_operation(integer,uuid,uuid,text,bigint,jsonb),
  public.record_manual_checkin(integer,uuid,uuid,integer),public.set_manual_checkin(integer,uuid,uuid,integer,bigint),
  public.claim_meet_sync(integer,uuid,uuid,bigint),public.complete_meet_sync(uuid,uuid,integer,integer,integer,integer),
  public.fail_meet_sync(uuid,uuid,text,integer,integer,integer),
  public.reverse_controller_action(integer,uuid,uuid,uuid,text),public.list_controller_actions(integer,uuid),
  public.reconcile_manual_checkins(integer,uuid,uuid,integer,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.get_event_control(integer,uuid),public.get_checkin_control(integer,uuid),
  public.admin_event_operation(integer,uuid,uuid,text,bigint,jsonb),
  public.record_manual_checkin(integer,uuid,uuid,integer),public.set_manual_checkin(integer,uuid,uuid,integer,bigint),
  public.claim_meet_sync(integer,uuid,uuid,bigint),public.complete_meet_sync(uuid,uuid,integer,integer,integer,integer),
  public.fail_meet_sync(uuid,uuid,text,integer,integer,integer),
  public.reverse_controller_action(integer,uuid,uuid,uuid,text),public.list_controller_actions(integer,uuid)
  to service_role;
-- The obsolete return-to-API RPC deliberately has no caller grant.
revoke all on function public.reconcile_manual_checkins(integer,uuid,uuid,integer,integer,timestamptz) from service_role;

create or replace function public.record_meetings(p_event_id integer, p_request_id uuid,
  p_staff_id uuid, p_quantity smallint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_request public.controller_requests%rowtype; v_total integer;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null or p_quantity is null or p_quantity not between 1 and 3 then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff','admin')) then raise exception 'forbidden'; end if;
  -- Same event lock as reset, exact totals, and source changes.
  perform 1 from public.meet_checkin_control where event_id=p_event_id for update;
  if exists(select 1 from public.controller_operations where event_id=p_event_id and request_id=p_request_id) or
    exists(select 1 from public.controller_reversals where event_id=p_event_id and reversal_request_id=p_request_id) then raise exception 'request_conflict'; end if;
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

create or replace function public.record_feedback(p_event_id integer, p_request_id uuid,
  p_staff_id uuid, p_rating smallint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_request public.controller_requests%rowtype; v_count integer; v_sum integer;
begin
  if p_event_id <> 17135 or p_request_id is null or p_staff_id is null or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff','admin')) then raise exception 'forbidden'; end if;
  -- Same event lock as reset, exact totals, and source changes.
  perform 1 from public.meet_checkin_control where event_id=p_event_id for update;
  if exists(select 1 from public.controller_operations where event_id=p_event_id and request_id=p_request_id) or
    exists(select 1 from public.controller_reversals where event_id=p_event_id and reversal_request_id=p_request_id) then raise exception 'request_conflict'; end if;
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

