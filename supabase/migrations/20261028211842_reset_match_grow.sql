-- Correct the protected reset scope without changing any existing event data.
-- Historical records remain immutable; cleared requests cannot be undone or counted again.
create or replace function public.admin_event_operation(p_event_id integer,p_request_id uuid,p_staff_id uuid,
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
  v_before:=public.get_event_control(p_event_id,p_staff_id)||jsonb_build_object('completedMeetings',a.completed_meetings,'feedbackCount',a.feedback_count,'ratingSum',a.rating_sum);
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
    -- Scope is required so a cached MATCH/MEET confirmation cannot execute this reset.
    if p_value->>'confirmation' is distinct from 'RESET EVENT' or
      p_value->>'scope' is distinct from 'match_grow' or
      (p_value-array['confirmation','scope'])<>'{}'::jsonb then raise exception 'invalid_confirmation'; end if;
    update public.controller_requests set cleared_at=v_now
      where event_id=p_event_id and kind in ('meeting','feedback') and cleared_at is null;
    update public.dashboard_aggregates set completed_meetings=0,feedback_count=0,rating_sum=0,updated_at=v_now
      where event_id=p_event_id;
    update public.meet_checkin_control set version=version+1 where event_id=p_event_id;
  end if;
  if p_operation in ('stop_sync','activate_manual') then
    update public.sync_runs set status='failed',finished_at=v_now,safe_error='cancelled',
      duration_ms=greatest(0,floor(extract(epoch from (v_now-started_at))*1000)::integer)
      where event_id=p_event_id and status='running';
    delete from public.sync_leases where event_id=p_event_id;
  end if;
  v_after:=public.get_event_control(p_event_id,p_staff_id)||
    (select jsonb_build_object('completedMeetings',completed_meetings,'feedbackCount',feedback_count,'ratingSum',rating_sum)
      from public.dashboard_aggregates where event_id=p_event_id);
  insert into public.controller_operations(event_id,request_id,staff_id,operation,input,before_values,after_values)
    values(p_event_id,p_request_id,p_staff_id,p_operation,v_input,v_before,v_after) returning * into o;
  return jsonb_build_object('id',o.request_id,'createdAt',o.created_at);
end;
$$;
