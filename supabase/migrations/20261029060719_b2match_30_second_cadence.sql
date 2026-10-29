-- Change only the due time for newly claimed runs. Existing state and the
-- scheduler's ten-second wake-up remain unchanged.
create or replace function public.claim_meet_sync(p_event_id integer,p_run_id uuid,p_token uuid,p_generation bigint default null)
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
    next_sync_at=v_now+interval '30 seconds',dispatch_at=null,dispatch_request_id=null,version=version+1 where event_id=p_event_id;
  return true;
end;
$$;
