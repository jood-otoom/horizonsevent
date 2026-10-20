-- Preserve original submissions and records. Reversals are a separate, immutable audit trail.
create index controller_requests_event_created
  on public.controller_requests (event_id, created_at desc, request_id desc);

create table public.controller_reversals (
  event_id integer not null,
  reversal_request_id uuid not null,
  original_request_id uuid not null,
  staff_id uuid not null references auth.users(id),
  reason text not null check (reason in ('duplicate', 'wrong_count', 'wrong_rating', 'other')),
  created_at timestamptz not null default now(),
  primary key (event_id, reversal_request_id),
  unique (event_id, original_request_id),
  foreign key (event_id, original_request_id)
    references public.controller_requests(event_id, request_id)
);
alter table public.controller_reversals enable row level security;
revoke all on public.controller_reversals from public, anon, authenticated;
grant select, insert on public.controller_reversals to service_role;

create function public.reverse_controller_action(
  p_event_id integer, p_original_request_id uuid, p_reversal_request_id uuid,
  p_staff_id uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.controller_requests%rowtype;
  v_reversal public.controller_reversals%rowtype;
  v_record_count integer;
begin
  if p_event_id <> 17135 or p_original_request_id is null or
    p_reversal_request_id is null or p_original_request_id = p_reversal_request_id or
    p_staff_id is null or p_reason is null or
    p_reason not in ('duplicate', 'wrong_count', 'wrong_rating', 'other') then
    raise exception 'invalid_submission';
  end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then
    raise exception 'forbidden';
  end if;

  -- The original request lock serializes simultaneous corrections of the same action.
  select * into v_request from public.controller_requests
    where event_id = p_event_id and request_id = p_original_request_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if (v_request.kind = 'meeting' and p_reason = 'wrong_rating') or
    (v_request.kind = 'feedback' and p_reason = 'wrong_count') then
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
    and reversal_request_id = p_reversal_request_id) then
    raise exception 'request_conflict';
  end if;

  if v_request.kind = 'meeting' then
    select count(*) into v_record_count from public.meeting_records
      where event_id = p_event_id and request_id = p_original_request_id;
    if v_record_count <> v_request.quantity then raise exception 'record_inconsistent'; end if;
    update public.dashboard_aggregates
      set completed_meetings = completed_meetings - v_request.quantity, updated_at = now()
      where event_id = p_event_id and completed_meetings >= v_request.quantity;
  else
    select count(*) into v_record_count from public.feedback_records
      where event_id = p_event_id and request_id = p_original_request_id
        and rating = v_request.rating;
    if v_record_count <> 1 then raise exception 'record_inconsistent'; end if;
    update public.dashboard_aggregates
      set feedback_count = feedback_count - 1, rating_sum = rating_sum - v_request.rating,
        updated_at = now()
      where event_id = p_event_id and feedback_count >= 1 and rating_sum >= v_request.rating;
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

create function public.list_controller_actions(p_event_id integer, p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_actions jsonb;
begin
  if p_event_id <> 17135 or p_staff_id is null then raise exception 'invalid_submission'; end if;
  if not exists (select 1 from public.event_memberships where event_id = p_event_id
    and user_id = p_staff_id and role in ('staff', 'admin')) then
    raise exception 'forbidden';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', recent.request_id, 'kind', recent.kind,
    'quantity', recent.quantity, 'rating', recent.rating,
    'createdAt', recent.created_at, 'reversedAt', recent.reversed_at)
    order by recent.created_at desc, recent.request_id desc), '[]'::jsonb)
    into v_actions from (
      select r.request_id, r.kind, r.quantity, r.rating, r.created_at,
        v.created_at as reversed_at
      from public.controller_requests r
      left join public.controller_reversals v on v.event_id = r.event_id
        and v.original_request_id = r.request_id
      where r.event_id = p_event_id
      order by r.created_at desc, r.request_id desc
      limit 12
    ) recent;
  return v_actions;
end;
$$;

revoke all on function public.reverse_controller_action(integer, uuid, uuid, uuid, text),
  public.list_controller_actions(integer, uuid) from public, anon, authenticated;
grant execute on function public.reverse_controller_action(integer, uuid, uuid, uuid, text),
  public.list_controller_actions(integer, uuid) to service_role;
