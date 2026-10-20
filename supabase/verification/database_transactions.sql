-- Run with `supabase db query --linked --file supabase/verification/database_transactions.sql`.
-- All synthetic users, records, snapshots, and lease changes are rolled back.
begin;

do $$
begin
  if (select count(*) from public.event_memberships) <> 0 or
     (select count(*) from public.sync_runs) <> 0 or
     (select count(*) from public.sync_leases) <> 0 or
     (select count(*) from public.controller_requests) <> 0 or
     (select count(*) from public.meeting_records) <> 0 or
     (select count(*) from public.feedback_records) <> 0 or
     (select count(*) from public.meet_snapshots) <> 0 or
     (select registered from public.dashboard_aggregates where event_id = 17135) is not null or
     (select completed_meetings from public.dashboard_aggregates where event_id = 17135) <> 0 or
     (select feedback_count from public.dashboard_aggregates where event_id = 17135) <> 0 then
    raise exception 'verification_requires_empty_app_tables';
  end if;
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000017135'),
  ('00000000-0000-4000-8000-000000017136');
insert into public.event_memberships (event_id, user_id, role) values
  (17135, '00000000-0000-4000-8000-000000017135', 'staff'),
  (17135, '00000000-0000-4000-8000-000000017136', 'viewer');

set local role anon;
do $$
declare v_denied boolean := false;
begin
  begin
    perform count(*) from public.dashboard_aggregates;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'anonymous_aggregate_read_allowed'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000017135', true);
do $$
declare v_denied boolean := false;
begin
  if current_user <> 'authenticated' or
     (select count(*) from public.event_memberships) <> 1 or
     (select count(*) from public.event_settings) <> 1 or
     (select count(*) from public.dashboard_aggregates) <> 1 then
    raise exception 'staff_read_policy_failed';
  end if;
  begin
    insert into public.feedback_records (event_id, request_id, rating, staff_id)
      values (17135, '99999999-9999-4999-8999-999999999999', 5,
        '00000000-0000-4000-8000-000000017135');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'authenticated_direct_write_allowed'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000017136', true);
do $$
begin
  if (select count(*) from public.event_memberships) <> 1 or
     (select count(*) from public.event_settings) <> 1 or
     (select count(*) from public.dashboard_aggregates) <> 1 then
    raise exception 'viewer_read_policy_failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000017137', true);
do $$
begin
  if (select count(*) from public.event_memberships) <> 0 or
     (select count(*) from public.event_settings) <> 0 or
     (select count(*) from public.dashboard_aggregates) <> 0 then
    raise exception 'unassigned_user_access';
  end if;
end;
$$;
reset role;

do $$
declare v_table text; v_function text;
begin
  foreach v_table in array array[
    'event_settings','event_memberships','meet_snapshots','dashboard_aggregates',
    'sync_runs','sync_leases','controller_requests','meeting_records','feedback_records'
  ] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) or
       has_table_privilege('anon', 'public.' || v_table, 'SELECT,INSERT,UPDATE,DELETE') or
       has_table_privilege('authenticated', 'public.' || v_table, 'INSERT,UPDATE,DELETE') then
      raise exception 'table_permission_failure: %', v_table;
    end if;
  end loop;
  foreach v_function in array array[
    'claim_meet_sync(integer,uuid,uuid)',
    'complete_meet_sync(uuid,uuid,integer,integer,integer,integer)',
    'fail_meet_sync(uuid,uuid,text,integer,integer)',
    'record_meetings(integer,uuid,uuid,smallint)',
    'record_feedback(integer,uuid,uuid,smallint)'
  ] loop
    if has_function_privilege('anon', 'public.' || v_function, 'EXECUTE') or
       has_function_privilege('authenticated', 'public.' || v_function, 'EXECUTE') or
       not has_function_privilege('service_role', 'public.' || v_function, 'EXECUTE') then
      raise exception 'rpc_permission_failure: %', v_function;
    end if;
  end loop;
  if (select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename in ('event_settings','event_memberships','meet_snapshots',
          'dashboard_aggregates','sync_runs','sync_leases','controller_requests',
          'meeting_records','feedback_records')) <> 1 or
     not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'dashboard_aggregates') then
    raise exception 'realtime_publication_failure';
  end if;
end;
$$;

set local role service_role;
do $$
declare v_result jsonb;
begin
  v_result := public.record_meetings(17135, '11111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000017135', 3::smallint);
  if (v_result->>'completedMeetings')::integer <> 3 then raise exception 'meeting_total_failure'; end if;
  perform public.record_meetings(17135, '11111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000017135', 3::smallint);
  if (select count(*) from public.meeting_records) <> 3 or
     (select completed_meetings from public.dashboard_aggregates where event_id = 17135) <> 3 then
    raise exception 'meeting_idempotency_failure';
  end if;
  begin
    perform public.record_meetings(17135, '11111111-1111-4111-8111-111111111111',
      '00000000-0000-4000-8000-000000017135', 2::smallint);
    raise exception 'meeting_conflict_not_rejected';
  exception when raise_exception then
    if sqlerrm <> 'request_conflict' then raise; end if;
  end;
  begin
    perform public.record_meetings(17135, '22222222-2222-4222-8222-222222222222',
      '00000000-0000-4000-8000-000000017136', 1::smallint);
    raise exception 'viewer_write_not_rejected';
  exception when raise_exception then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  v_result := public.record_feedback(17135, '33333333-3333-4333-8333-333333333333',
    '00000000-0000-4000-8000-000000017135', 4::smallint);
  perform public.record_feedback(17135, '33333333-3333-4333-8333-333333333333',
    '00000000-0000-4000-8000-000000017135', 4::smallint);
  if (v_result->>'averageRating')::numeric <> 4 or
     (select count(*) from public.feedback_records) <> 1 or
     (select feedback_count from public.dashboard_aggregates where event_id = 17135) <> 1 then
    raise exception 'feedback_idempotency_failure';
  end if;
  begin
    perform public.record_feedback(17135, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '00000000-0000-4000-8000-000000017135', 0::smallint);
    raise exception 'invalid_rating_not_rejected';
  exception when raise_exception then
    if sqlerrm <> 'invalid_submission' then raise; end if;
  end;
  begin
    perform public.record_meetings(17136, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '00000000-0000-4000-8000-000000017135', 1::smallint);
    raise exception 'other_event_not_rejected';
  exception when raise_exception then
    if sqlerrm <> 'invalid_submission' then raise; end if;
  end;
end;
$$;

do $$
declare v_claimed boolean;
begin
  v_claimed := public.claim_meet_sync(17135, '44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if not v_claimed then raise exception 'sync_claim_failure'; end if;
  if public.claim_meet_sync(17135, '55555555-5555-4555-8555-555555555555',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'sync_overlap_accepted'; end if;
  if public.complete_meet_sync('44444444-4444-4444-8444-444444444444',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 10, 6, 1, 10) then
    raise exception 'wrong_sync_token_accepted';
  end if;
  if public.complete_meet_sync('44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 11, 1, 10) then
    raise exception 'invalid_sync_count_accepted';
  end if;
  if (select count(*) from public.meet_snapshots) <> 0 then
    raise exception 'partial_snapshot_published';
  end if;
  if not public.complete_meet_sync('44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 6, 1, 10) then
    raise exception 'sync_publication_failure';
  end if;
  if (select count(*) from public.meet_snapshots) <> 1 or
     (select registered from public.dashboard_aggregates where event_id = 17135) <> 10 or
     (select checked_in from public.dashboard_aggregates where event_id = 17135) <> 6 or
     (select status from public.sync_runs where id = '44444444-4444-4444-8444-444444444444') <> 'succeeded' then
    raise exception 'sync_atomic_publication_failure';
  end if;
  -- now() is fixed for the entire verification transaction. Distinguish this
  -- synthetic earlier run from a later run that would have its own transaction.
  update public.meet_snapshots set last_successful_sync = now() - interval '1 second'
    where event_id = 17135;
  if not public.claim_meet_sync(17135, '66666666-6666-4666-8666-666666666666',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'second_sync_claim_failure'; end if;
  perform public.fail_meet_sync('66666666-6666-4666-8666-666666666666',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'network_failure');
  if (select status from public.sync_runs where id = '66666666-6666-4666-8666-666666666666') <> 'running' or
     (select meet_failed_at from public.dashboard_aggregates where event_id = 17135) is not null then
    raise exception 'wrong_failure_token_modified_run';
  end if;
  perform public.fail_meet_sync('66666666-6666-4666-8666-666666666666',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'network_failure');
  if (select status from public.sync_runs where id = '66666666-6666-4666-8666-666666666666') <> 'failed' or
     (select registered from public.dashboard_aggregates where event_id = 17135) <> 10 or
     (select meet_failed_at from public.dashboard_aggregates where event_id = 17135) is null then
    raise exception 'failed_sync_did_not_preserve_snapshot';
  end if;
  if not public.claim_meet_sync(17135, '77777777-7777-4777-8777-777777777777',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'expired_sync_setup_failed'; end if;
  update public.sync_leases set expires_at = now() - interval '1 second' where event_id = 17135;
  if not public.claim_meet_sync(17135, '88888888-8888-4888-8888-888888888888',
    'ffffffff-ffff-4fff-8fff-ffffffffffff') then raise exception 'expired_sync_reclaim_failed'; end if;
  if (select safe_error from public.sync_runs where id = '77777777-7777-4777-8777-777777777777') <> 'lease_expired' or
     public.complete_meet_sync('77777777-7777-4777-8777-777777777777',
       'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 11, 7, 1, 11) then
    raise exception 'expired_sync_was_published';
  end if;
  if not public.complete_meet_sync('88888888-8888-4888-8888-888888888888',
    'ffffffff-ffff-4fff-8fff-ffffffffffff', 12, 7, 1, 12) then
    raise exception 'reconciled_sync_failed';
  end if;
  if (select count(*) from public.meet_snapshots) <> 2 or
     (select registered from public.dashboard_aggregates where event_id = 17135) <> 12 or
     (select meet_failed_at from public.dashboard_aggregates where event_id = 17135) is not null then
    raise exception 'reconciliation_not_atomic';
  end if;
end;
$$;

reset role;
rollback;
select 'PASS: synthetic transaction and RLS checks rolled back' as verification_result;
