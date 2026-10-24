-- Disposable local Supabase database only. Requires the manual_checkin_fallback migration.
-- This transaction rolls back every synthetic fixture and assertion change.
begin;

do $$
begin
  if exists (select 1 from public.controller_requests) or
     exists (select 1 from public.controller_reversals) or
     exists (select 1 from public.checkin_reconciliations) or
     exists (select 1 from public.meet_snapshots) or
     (select registered from public.dashboard_aggregates where event_id = 17135) is not null then
    raise exception 'verification_requires_empty_app_tables';
  end if;
end;
$$;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000017135');
insert into public.event_memberships (event_id, user_id, role)
  values (17135, '00000000-0000-4000-8000-000000017135', 'staff');
update public.event_settings set meet_verified = true where event_id = 17135;
insert into public.meet_snapshots
  (event_id, registered, checked_in, check_in_rate, last_successful_sync)
  values (17135, 6, 4, 67, now() - interval '2 minutes');
update public.dashboard_aggregates set registered = 6, checked_in = 4, check_in_rate = 67,
  last_successful_sync = now() - interval '2 minutes' where event_id = 17135;

do $$
declare v_table text; v_function text;
begin
  foreach v_table in array array['meet_checkin_control', 'checkin_reconciliations'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) or
       has_table_privilege('anon', 'public.' || v_table, 'SELECT,INSERT,UPDATE,DELETE') or
       has_table_privilege('authenticated', 'public.' || v_table, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'checkin_table_permission_failure: %', v_table;
    end if;
  end loop;
  foreach v_function in array array[
    'record_manual_checkin(integer,uuid,uuid)',
    'get_checkin_control(integer,uuid)',
    'reconcile_manual_checkins(integer,uuid,uuid,integer,integer,timestamptz)'
  ] loop
    if has_function_privilege('anon', 'public.' || v_function, 'EXECUTE') or
       has_function_privilege('authenticated', 'public.' || v_function, 'EXECUTE') or
       not has_function_privilege('service_role', 'public.' || v_function, 'EXECUTE') then
      raise exception 'checkin_rpc_permission_failure: %', v_function;
    end if;
  end loop;
end;
$$;

set local role service_role;
do $$
declare
  v_staff uuid := '00000000-0000-4000-8000-000000017135';
  v_original uuid := '11111111-1111-4111-8111-111111111111';
  v_second uuid := '22222222-2222-4222-8222-222222222222';
  v_reversal uuid := '33333333-3333-4333-8333-333333333333';
  v_run uuid := '44444444-4444-4444-8444-444444444444';
  v_token uuid := '55555555-5555-4555-8555-555555555555';
  v_reconcile uuid := '66666666-6666-4666-8666-666666666666';
  v_snapshot_at timestamptz;
  v_failed boolean;
begin
  perform public.record_manual_checkin(17135, v_original, v_staff);
  perform public.record_manual_checkin(17135, v_original, v_staff);
  if (select checked_in from public.dashboard_aggregates where event_id = 17135) <> 5 or
     (select count(*) from public.controller_requests where kind = 'checkin') <> 1 then
    raise exception 'checkin_idempotency_failed';
  end if;
  perform public.reverse_controller_action(17135, v_original, v_reversal, v_staff, 'duplicate');
  if (select checked_in from public.dashboard_aggregates where event_id = 17135) <> 4 or
     (select count(*) from public.controller_reversals) <> 1 then
    raise exception 'checkin_reversal_failed';
  end if;
  perform public.record_manual_checkin(17135, v_second, v_staff);
  insert into public.sync_runs (id, event_id, status) values (v_run, 17135, 'running');
  insert into public.sync_leases (event_id, token, run_id, expires_at)
    values (17135, v_token, v_run, now() + interval '2 minutes');
  if not public.complete_meet_sync(v_run, v_token, 6, 5, 1, 6) then
    raise exception 'sync_publication_failed';
  end if;
  select last_successful_sync into v_snapshot_at from public.meet_snapshots
    where event_id = 17135 order by last_successful_sync desc limit 1;
  if (select checked_in from public.dashboard_aggregates where event_id = 17135) <> 5 or
     (select count(*) from public.meet_snapshots) <> 2 or
     (public.get_checkin_control(17135, v_staff)->>'canReconcile')::boolean is not true then
    raise exception 'manual_count_overwritten_or_recovery_hidden';
  end if;
  perform public.reconcile_manual_checkins(17135, v_reconcile, v_staff, 5, 5, v_snapshot_at);
  perform public.reconcile_manual_checkins(17135, v_reconcile, v_staff, 5, 5, v_snapshot_at);
  if (select mode from public.meet_checkin_control where event_id = 17135) <> 'api' or
     (select count(*) from public.checkin_reconciliations) <> 1 then
    raise exception 'reconciliation_idempotency_failed';
  end if;
  v_failed := false;
  begin
    perform public.reverse_controller_action(17135, v_second,
      '77777777-7777-4777-8777-777777777777', v_staff, 'duplicate');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'reconciled_action_remained_undoable'; end if;
  if (select checked_in from public.dashboard_aggregates where event_id = 17135) <> 5 or
     (select registered from public.dashboard_aggregates where event_id = 17135) <> 6 or
     (select completed_meetings from public.dashboard_aggregates where event_id = 17135) <> 0 or
     (select feedback_count from public.dashboard_aggregates where event_id = 17135) <> 0 then
    raise exception 'aggregate_inconsistent';
  end if;
end;
$$;
reset role;
rollback;
