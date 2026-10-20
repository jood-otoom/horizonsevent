-- Run only after the audit_controller_reversals migration in an isolated database.
-- Requires empty controller tables. All synthetic rows roll back.
begin;

do $$
begin
  if (select count(*) from public.event_memberships) <> 0 or
    (select count(*) from public.controller_requests) <> 0 or
    (select count(*) from public.meeting_records) <> 0 or
    (select count(*) from public.feedback_records) <> 0 or
    (select count(*) from public.controller_reversals) <> 0 or
    (select completed_meetings from public.dashboard_aggregates where event_id = 17135) <> 0 or
    (select feedback_count from public.dashboard_aggregates where event_id = 17135) <> 0 then
    raise exception 'verification_requires_empty_controller_tables';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.controller_reversals'::regclass) or
    has_table_privilege('anon', 'public.controller_reversals', 'SELECT,INSERT,UPDATE,DELETE') or
    has_table_privilege('authenticated', 'public.controller_reversals', 'SELECT,INSERT,UPDATE,DELETE') or
    has_function_privilege('authenticated', 'public.reverse_controller_action(integer,uuid,uuid,uuid,text)', 'EXECUTE') or
    has_function_privilege('authenticated', 'public.list_controller_actions(integer,uuid)', 'EXECUTE') then
    raise exception 'correction_access_boundary_failed';
  end if;
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000017135'),
  ('00000000-0000-4000-8000-000000017136');
insert into public.event_memberships (event_id, user_id, role) values
  (17135, '00000000-0000-4000-8000-000000017135', 'staff'),
  (17135, '00000000-0000-4000-8000-000000017136', 'viewer');

set local role service_role;
do $$
declare v_actions jsonb; v_reversal jsonb;
begin
  perform public.record_meetings(17135, '11111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000017135', 3::smallint);
  perform public.record_feedback(17135, '22222222-2222-4222-8222-222222222222',
    '00000000-0000-4000-8000-000000017135', 1::smallint);
  perform public.record_feedback(17135, '33333333-3333-4333-8333-333333333333',
    '00000000-0000-4000-8000-000000017135', 5::smallint);
  v_reversal := public.reverse_controller_action(17135,
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-4000-8000-000000017135', 'wrong_count');
  if v_reversal->>'originalRequestId' <> '11111111-1111-4111-8111-111111111111' or
    (select completed_meetings from public.dashboard_aggregates where event_id = 17135) <> 0 or
    (select count(*) from public.meeting_records) <> 3 then
    raise exception 'meeting_reversal_or_audit_failed';
  end if;
  perform public.reverse_controller_action(17135,
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-4000-8000-000000017135', 'wrong_count');
  if (select count(*) from public.controller_reversals) <> 1 then
    raise exception 'reversal_retry_not_idempotent';
  end if;
  begin
    perform public.reverse_controller_action(17135,
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      '00000000-0000-4000-8000-000000017135', 'duplicate');
    raise exception 'second_reversal_accepted';
  exception when raise_exception then
    if sqlerrm <> 'already_reversed' then raise; end if;
  end;
  begin
    perform public.reverse_controller_action(17135,
      '22222222-2222-4222-8222-222222222222',
      '66666666-6666-4666-8666-666666666666',
      '00000000-0000-4000-8000-000000017136', 'wrong_rating');
    raise exception 'viewer_reversal_accepted';
  exception when raise_exception then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  perform public.reverse_controller_action(17135,
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777777',
    '00000000-0000-4000-8000-000000017135', 'wrong_rating');
  if (select feedback_count from public.dashboard_aggregates where event_id = 17135) <> 1 or
    (select rating_sum from public.dashboard_aggregates where event_id = 17135) <> 5 or
    (select count(*) from public.feedback_records) <> 2 or
    (select count(*) from public.controller_reversals) <> 2 then
    raise exception 'feedback_reversal_or_audit_failed';
  end if;
  v_actions := public.list_controller_actions(17135, '00000000-0000-4000-8000-000000017135');
  if jsonb_array_length(v_actions) <> 3 or
    (select count(*) from jsonb_array_elements(v_actions) as item(value)
      where item.value->>'reversedAt' is not null) <> 2 then
    raise exception 'controller_history_failed';
  end if;
end;
$$;
reset role;

rollback;
