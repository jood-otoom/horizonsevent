-- Isolated disposable database only, after all core migrations. Never run on the live event.
-- The empty-state guard rejects the production database before any fixture is written.
begin;
do $$
begin
  if exists(select 1 from public.controller_requests) or exists(select 1 from public.controller_operations) or
    exists(select 1 from public.event_memberships) or exists(select 1 from public.meet_snapshots) or
    (select registered from public.dashboard_aggregates where event_id=17135) is not null then
    raise exception 'verification_requires_empty_app_tables';
  end if;
end;
$$;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000017135'),
  ('00000000-0000-4000-8000-000000017136'),
  ('00000000-0000-4000-8000-000000017137');
insert into public.event_memberships(event_id,user_id,role) values
  (17135,'00000000-0000-4000-8000-000000017135','admin'),
  (17135,'00000000-0000-4000-8000-000000017136','staff'),
  (17135,'00000000-0000-4000-8000-000000017137','viewer');
update public.event_settings set meeting_target=1200,meet_verified=true where event_id=17135;
update public.dashboard_aggregates set registered=100,checked_in=10,check_in_rate=10,last_successful_sync=clock_timestamp() where event_id=17135;

-- Browser roles have aggregate reads only, and no access to privileged RPCs or audit/control rows.
do $$
declare t text; f text;
begin
  foreach t in array array['meet_checkin_control','controller_operations','checkin_reconciliations'] loop
    if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or
      has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or
      has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'private_table_permission_failure: %',t; end if;
  end loop;
  foreach f in array array[
    'get_event_control(integer,uuid)','get_checkin_control(integer,uuid)',
    'record_manual_checkin(integer,uuid,uuid,integer)','set_manual_checkin(integer,uuid,uuid,integer,bigint)',
    'admin_event_operation(integer,uuid,uuid,text,bigint,jsonb)',
    'claim_meet_sync(integer,uuid,uuid,bigint)','complete_meet_sync(uuid,uuid,integer,integer,integer,integer)',
    'fail_meet_sync(uuid,uuid,text,integer,integer,integer)'] loop
    if has_function_privilege('anon','public.'||f,'EXECUTE') or has_function_privilege('authenticated','public.'||f,'EXECUTE') or
      not has_function_privilege('service_role','public.'||f,'EXECUTE') then raise exception 'private_rpc_permission_failure: %',f; end if;
  end loop;
  if has_function_privilege('service_role','public.reconcile_manual_checkins(integer,uuid,uuid,integer,integer,timestamptz)','EXECUTE') then raise exception 'return_to_api_granted'; end if;
  if has_table_privilege('anon','public.dashboard_aggregates','INSERT,UPDATE,DELETE') then raise exception 'public_write_allowed'; end if;
end;
$$;
set local role anon;
do $$begin if(select count(*) from public.dashboard_aggregates)<>1 then raise exception 'public_aggregate_read_failed'; end if; end;$$;
reset role;
set local role service_role;

do $$
declare a uuid:='00000000-0000-4000-8000-000000017135'; s uuid:='00000000-0000-4000-8000-000000017136';
  v bigint; rid uuid:=gen_random_uuid(); run1 uuid:=gen_random_uuid(); tok1 uuid:=gen_random_uuid();
  run2 uuid:=gen_random_uuid(); tok2 uuid:=gen_random_uuid(); before_count integer;
begin
  -- Staff cannot change settings, and API mode cannot accept manual submissions.
  begin perform public.admin_event_operation(17135,gen_random_uuid(),s,'update_settings',0,'{"meetingTarget":1500}'); raise exception 'staff_settings_allowed';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  begin perform public.record_manual_checkin(17135,gen_random_uuid(),s,1); raise exception 'api_manual_mutation_allowed';
  exception when raise_exception then if sqlerrm<>'manual_mode_required' then raise; end if; end;
  -- A registration override is independent of source mode and stays authoritative during API publication.
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'update_settings',0,'{"registeredOverride":250}');
  select version into v from public.meet_checkin_control where event_id=17135;
  -- Start is durable and duplicate submission does not create a second activation.
  perform public.admin_event_operation(17135,rid,a,'start_sync',v,'{}');
  perform public.admin_event_operation(17135,rid,a,'start_sync',v,'{}');
  if(select count(*) from public.controller_operations where operation='start_sync')<>1 then raise exception 'start_idempotency_failed'; end if;
  if public.claim_meet_sync(17135,gen_random_uuid(),gen_random_uuid(),-1) then raise exception 'stale_dispatch_claimed'; end if;
  if not public.claim_meet_sync(17135,run1,tok1) then raise exception 'immediate_claim_failed'; end if;
  if public.claim_meet_sync(17135,gen_random_uuid(),gen_random_uuid()) then raise exception 'overlapping_claim_allowed'; end if;
  if public.complete_meet_sync(run1,gen_random_uuid(),200,20,4,200) or public.complete_meet_sync(run1,tok1,200,201,4,200) then raise exception 'invalid_publication_allowed'; end if;
  if(select count(*) from public.meet_snapshots)<>0 then raise exception 'partial_publication'; end if;
  if not public.complete_meet_sync(run1,tok1,200,20,4,200) then raise exception 'verified_publication_failed'; end if;
  if(select registered from public.dashboard_aggregates where event_id=17135)<>250 or
    (select registered from public.meet_snapshots order by last_successful_sync desc limit 1)<>200 then raise exception 'api_overwrote_registration_override'; end if;
  if public.claim_meet_sync(17135,gen_random_uuid(),gen_random_uuid()) then raise exception 'two_minute_cadence_ignored'; end if;
  if(select next_sync_at-last_attempt_at from public.meet_checkin_control where event_id=17135)<>interval '120 seconds' then raise exception 'cadence_not_120_seconds'; end if;
  -- A failed complete pull stops the schedule, preserves counts, and records only safe errors.
  update public.meet_checkin_control set next_sync_at=clock_timestamp()-interval '1 second' where event_id=17135;
  if not public.claim_meet_sync(17135,run2,tok2) then raise exception 'second_claim_failed'; end if;
  if public.complete_meet_sync(run2,tok2,300,251,6,300) then raise exception 'api_exceeded_effective_capacity'; end if;
  perform public.fail_meet_sync(run2,tok2,'rate_limited',1,50,429);
  if(select sync_enabled from public.meet_checkin_control where event_id=17135) or
    (select sync_state from public.meet_checkin_control where event_id=17135)<>'failed' or
    (select http_status from public.meet_checkin_control where event_id=17135)<>429 or
    (select checked_in from public.dashboard_aggregates where event_id=17135)<>20 then raise exception 'failure_did_not_preserve_stop'; end if;
  if public.claim_meet_sync(17135,gen_random_uuid(),gen_random_uuid()) then raise exception 'automatic_restart_allowed'; end if;
  -- Explicit restart followed by stop fences a request that was already running.
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',v,'{}');
  run2:=gen_random_uuid();tok2:=gen_random_uuid();
  if not public.claim_meet_sync(17135,run2,tok2) then raise exception 'restart_claim_failed'; end if;
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'stop_sync',v,'{}');
  if public.complete_meet_sync(run2,tok2,300,30,6,300) then raise exception 'stopped_worker_published'; end if;
  if(select registered from public.dashboard_aggregates where event_id=17135)<>250 then raise exception 'stop_changed_counts'; end if;
  select version into v from public.meet_checkin_control where event_id=17135;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'activate_manual',v,'{}');
  select version into v from public.meet_checkin_control where event_id=17135;
  begin perform public.admin_event_operation(17135,gen_random_uuid(),a,'start_sync',v,'{}'); raise exception 'return_to_api_allowed';
  exception when raise_exception then if sqlerrm<>'manual_mode_permanent' then raise; end if; end;
  -- All four increments are additive and idempotent.
  perform public.record_manual_checkin(17135,gen_random_uuid(),s,1);
  perform public.record_manual_checkin(17135,gen_random_uuid(),s,2);
  rid:=gen_random_uuid();perform public.record_manual_checkin(17135,rid,s,5);perform public.record_manual_checkin(17135,rid,s,5);
  perform public.record_manual_checkin(17135,gen_random_uuid(),s,10);
  if(select checked_in from public.dashboard_aggregates where event_id=17135)<>38 then raise exception 'increments_or_idempotency_failed'; end if;
  begin perform public.record_manual_checkin(17135,gen_random_uuid(),s,3); raise exception 'invalid_increment_allowed';
  exception when raise_exception then if sqlerrm<>'invalid_submission' then raise; end if; end;
  select version into v from public.meet_checkin_control where event_id=17135;
  begin perform public.set_manual_checkin(17135,gen_random_uuid(),s,40,v); raise exception 'staff_exact_allowed';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
  begin perform public.set_manual_checkin(17135,gen_random_uuid(),a,40,v-1); raise exception 'stale_exact_allowed';
  exception when raise_exception then if sqlerrm<>'version_conflict' then raise; end if; end;
  rid:=gen_random_uuid();perform public.set_manual_checkin(17135,rid,a,40,v);perform public.set_manual_checkin(17135,rid,a,40,v);
  if(select checked_in from public.dashboard_aggregates where event_id=17135)<>40 then raise exception 'exact_was_additive'; end if;
  select version into v from public.meet_checkin_control where event_id=17135;
  begin perform public.set_manual_checkin(17135,gen_random_uuid(),a,251,v); raise exception 'capacity_allowed';
  exception when raise_exception then if sqlerrm<>'attendance_at_capacity' then raise; end if; end;
  begin perform public.set_manual_checkin(17135,gen_random_uuid(),a,-1,v); raise exception 'negative_exact_allowed';
  exception when raise_exception then if sqlerrm<>'invalid_submission' then raise; end if; end;
  begin perform public.admin_event_operation(17135,gen_random_uuid(),a,'update_settings',v,'{"registeredOverride":39}'); raise exception 'registration_below_attendance_allowed';
  exception when raise_exception then if sqlerrm<>'attendance_at_capacity' then raise; end if; end;
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'update_settings',v,'{"registeredOverride":250,"meetingTarget":1500}');
  if(select registered from public.dashboard_aggregates where event_id=17135)<>250 or
    (select registered from public.meet_snapshots order by last_successful_sync desc limit 1)<>200 then raise exception 'override_overwrote_raw_api'; end if;
  -- Fresh manual increment undo is exact; an old pre-correction increment cannot affect the new baseline.
  rid:=gen_random_uuid();perform public.record_manual_checkin(17135,rid,s,5);
  perform public.reverse_controller_action(17135,rid,gen_random_uuid(),s,'duplicate');
  if(select checked_in from public.dashboard_aggregates where event_id=17135)<>40 then raise exception 'increment_undo_failed'; end if;
  select request_id into rid from public.controller_requests where kind='checkin' and quantity=10;
  begin perform public.reverse_controller_action(17135,rid,gen_random_uuid(),s,'wrong_count'); raise exception 'old_baseline_undo_allowed';
  exception when raise_exception then if sqlerrm<>'reconciliation_conflict' then raise; end if; end;
  -- Existing MATCH +1/+2/+3 and GROW persist, then the critical reset touches only MATCH/MEET.
  perform public.record_meetings(17135,gen_random_uuid(),s,1::smallint);
  perform public.record_meetings(17135,gen_random_uuid(),s,2::smallint);
  rid:=gen_random_uuid();perform public.record_meetings(17135,rid,s,3::smallint);
  perform public.record_feedback(17135,gen_random_uuid(),s,4::smallint);
  if(select completed_meetings from public.dashboard_aggregates where event_id=17135)<>6 then raise exception 'match_increments_failed'; end if;
  -- Request UUIDs have one namespace across submissions, corrections and admin operations.
  select request_id into run1 from public.controller_operations order by created_at limit 1;
  begin perform public.record_meetings(17135,run1,s,1::smallint); raise exception 'operation_uuid_reused_for_meeting';
  exception when raise_exception then if sqlerrm<>'request_conflict' then raise; end if; end;
  begin perform public.record_feedback(17135,run1,s,5::smallint); raise exception 'operation_uuid_reused_for_feedback';
  exception when raise_exception then if sqlerrm<>'request_conflict' then raise; end if; end;
  begin perform public.reverse_controller_action(17135,rid,run1,s,'wrong_count'); raise exception 'operation_uuid_reused_for_undo';
  exception when raise_exception then if sqlerrm<>'request_conflict' then raise; end if; end;
  select reversal_request_id into tok1 from public.controller_reversals limit 1;
  select version into v from public.meet_checkin_control where event_id=17135;
  begin perform public.admin_event_operation(17135,tok1,a,'stop_sync',v,'{}'); raise exception 'undo_uuid_reused_for_operation';
  exception when raise_exception then if sqlerrm<>'request_conflict' then raise; end if; end;
  select version into v from public.meet_checkin_control where event_id=17135;
  begin perform public.admin_event_operation(17135,gen_random_uuid(),a,'reset_event',v,'{"confirmation":"RESET"}'); raise exception 'unconfirmed_reset_allowed';
  exception when raise_exception then if sqlerrm<>'invalid_confirmation' then raise; end if; end;
  if(select completed_meetings from public.dashboard_aggregates where event_id=17135)<>6 then raise exception 'dialog_reset_data'; end if;
  before_count:=(select count(*) from public.meet_snapshots);
  perform public.admin_event_operation(17135,gen_random_uuid(),a,'reset_event',v,'{"confirmation":"RESET EVENT"}');
  if exists(select 1 from public.dashboard_aggregates where event_id=17135 and
    (registered<>0 or checked_in<>0 or completed_meetings<>0 or feedback_count<>1 or rating_sum<>4)) then raise exception 'reset_scope_failed'; end if;
  if(select meeting_target from public.event_settings where event_id=17135)<>1500 or
    (select registered_override from public.meet_checkin_control where event_id=17135) is not null or
    (select count(*) from public.meet_snapshots)<>before_count or
    (select count(*) from public.feedback_records)<>1 or (select count(*) from public.meeting_records)<>6 then raise exception 'reset_deleted_history_or_configuration'; end if;
  perform public.record_meetings(17135,rid,s,3::smallint);
  if(select completed_meetings from public.dashboard_aggregates where event_id=17135)<>0 then raise exception 'old_request_repopulated_reset'; end if;
  begin perform public.reverse_controller_action(17135,rid,gen_random_uuid(),s,'wrong_count'); raise exception 'cleared_action_undo_allowed';
  exception when raise_exception then if sqlerrm<>'action_cleared' then raise; end if; end;
  if not exists(select 1 from jsonb_array_elements(public.list_controller_actions(17135,a)) x where x->>'operation'='reset_event') then raise exception 'reset_history_missing'; end if;
  perform public.record_meetings(17135,gen_random_uuid(),s,1::smallint);
  if(select completed_meetings from public.dashboard_aggregates where event_id=17135)<>1 then raise exception 'post_reset_increment_failed'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: isolated sync/manual/settings/reset/security checks rolled back' as verification_result;
