-- Disposable database with synthetic Vault/net/cron transport only.
-- Never run against live Vault or net: the fixture host must install mocks first.
begin;
do $$begin
  if to_regclass('net.readiness_mock_requests') is null or exists(select 1 from public.event_memberships) or
    exists(select 1 from public.controller_requests) then raise exception 'verification_requires_isolated_mock_transport'; end if;
end;$$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000017135');
insert into public.event_memberships(event_id,user_id,role) values(17135,'00000000-0000-4000-8000-000000017135','admin');
do $$
declare a uuid:='00000000-0000-4000-8000-000000017135';
begin
  if(public.get_event_control(17135,a)->>'canStart')::boolean then raise exception 'start_enabled_without_credential'; end if;
  begin
    perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',0,'{}');
    raise exception 'start_without_scheduler_allowed';
  exception when raise_exception then if sqlerrm<>'scheduler_not_configured' then raise; end if; end;
  if(select sync_enabled from public.meet_checkin_control where event_id=17135) then raise exception 'failed_start_left_enabled'; end if;
end;$$;
insert into vault.decrypted_secrets(name,decrypted_secret) values('nh_b2match_worker_secret','synthetic-secret-never-valid-for-production');
update public.dashboard_aggregates set registered=100,checked_in=10,check_in_rate=10,last_successful_sync=clock_timestamp() where event_id=17135;
do $$
declare a uuid:='00000000-0000-4000-8000-000000017135'; v bigint; run_id uuid; tok uuid; n integer; dispatch bigint;
begin
  if not(public.get_event_control(17135,a)->>'canStart')::boolean then raise exception 'ready_start_disabled'; end if;
  if has_function_privilege('anon','event_private.dispatch_meet_sync()','EXECUTE') or
    has_function_privilege('authenticated','event_private.dispatch_meet_sync()','EXECUTE') or
    has_function_privilege('service_role','event_private.tick_meet_sync()','EXECUTE') then raise exception 'private_scheduler_permission_failed'; end if;
  perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>0 then raise exception 'idle_scheduler_dispatched'; end if;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',0,'{}');
  if(select count(*) from net.readiness_mock_requests)<>1 then raise exception 'start_not_immediate'; end if;
  perform event_private.tick_meet_sync();perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>1 then raise exception 'duplicate_dispatch'; end if;
  run_id:=gen_random_uuid();tok:=gen_random_uuid();
  if not public.claim_meet_sync(17135,run_id,tok) then raise exception 'claim_failed'; end if;
  perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>1 then raise exception 'running_overlap'; end if;
  if not public.complete_meet_sync(run_id,tok,100,15,2,100) then raise exception 'complete_failed'; end if;
  perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>1 then raise exception 'dispatch_before_due'; end if;
  update public.meet_checkin_control set next_sync_at=clock_timestamp()-interval '1 second' where event_id=17135;
  perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>2 then raise exception 'due_dispatch_failed'; end if;
  -- An invocation that never reaches claim is failed, without another request.
  update public.meet_checkin_control set dispatch_at=clock_timestamp()-interval '31 seconds' where event_id=17135;
  perform event_private.tick_meet_sync();perform event_private.tick_meet_sync();
  if(select sync_enabled from public.meet_checkin_control where event_id=17135) or
    (select sync_state from public.meet_checkin_control where event_id=17135)<>'failed' or
    (select count(*) from net.readiness_mock_requests)<>2 then raise exception 'dispatch_timeout_retried'; end if;
  -- Explicit restart permits one new run; a lost active worker fails via lease watchdog.
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',v,'{}');
  run_id:=gen_random_uuid();tok:=gen_random_uuid();perform public.claim_meet_sync(17135,run_id,tok);
  update public.sync_leases set expires_at=clock_timestamp()-interval '1 second' where event_id=17135;
  perform event_private.tick_meet_sync();
  if(select sync_enabled from public.meet_checkin_control where event_id=17135) or
    public.complete_meet_sync(run_id,tok,100,20,2,100) then raise exception 'expired_worker_published'; end if;
  -- A failed pg_net response stops scheduling even if Edge authentication failed before claim.
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',v,'{}');
  select dispatch_request_id into dispatch from public.meet_checkin_control where event_id=17135;
  insert into net._http_response(id,status_code,timed_out) values(dispatch,500,false);
  perform event_private.tick_meet_sync();
  if(select sync_enabled from public.meet_checkin_control where event_id=17135) or
    (select http_status from public.meet_checkin_control where event_id=17135)<>500 then raise exception 'transport_failure_did_not_stop'; end if;
  select count(*) into n from net.readiness_mock_requests;
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'activate_manual',v,'{}');
  perform event_private.tick_meet_sync();
  if(select count(*) from net.readiness_mock_requests)<>n or
    (select checked_in from public.dashboard_aggregates where event_id=17135)<>15 then raise exception 'manual_or_last_good_values_changed'; end if;
end;
$$;
rollback;
select 'PASS: isolated scheduler dispatch/watchdog/security tests rolled back' as verification_result;
