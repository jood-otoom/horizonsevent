-- Scheduling remains idle until an admin explicitly starts sync. No API request runs here.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists event_private;
revoke all on schema event_private from public,anon,authenticated;
grant usage on schema event_private to service_role;

-- Expose a readiness boolean, never the credential or job command.
create function event_private.meet_scheduler_ready()
returns boolean language sql security definer set search_path = '' as $$
  select exists(select 1 from vault.decrypted_secrets where name='nh_b2match_worker_secret' and length(decrypted_secret)>=32)
    and exists(select 1 from cron.job where jobname='nh-event-17135-b2match' and active);
$$;
revoke all on function event_private.meet_scheduler_ready() from public,anon,authenticated;
grant execute on function event_private.meet_scheduler_ready() to service_role;

-- Fixed destination and no caller-provided secret or URL. Vault is never browser-readable.
create function event_private.dispatch_meet_sync()
returns void language plpgsql security definer set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; v_secret text; v_request bigint;
begin
  select * into c from public.meet_checkin_control where event_id=17135 for update;
  if c.mode<>'api' or not c.sync_enabled or c.sync_state not in ('starting','running') or
    c.next_sync_at>clock_timestamp() or c.dispatch_at is not null or
    exists(select 1 from public.sync_leases where event_id=17135) then return; end if;
  if not event_private.meet_scheduler_ready() then raise exception 'scheduler_not_configured'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='nh_b2match_worker_secret';
  if v_secret is null or length(v_secret)<32 then raise exception 'scheduler_not_configured'; end if;
  v_request:=net.http_post(
    url:='https://kkiambvltxuieuncwtfz.supabase.co/functions/v1/sync-b2match',
    body:=jsonb_build_object('generation',c.generation),
    headers:=jsonb_build_object('Content-Type','application/json','x-b2match-worker-secret',v_secret),
    timeout_milliseconds:=160000);
  update public.meet_checkin_control set dispatch_at=clock_timestamp(),dispatch_request_id=v_request where event_id=17135;
end;
$$;
revoke all on function event_private.dispatch_meet_sync() from public,anon,authenticated;
grant execute on function event_private.dispatch_meet_sync() to service_role;

create function event_private.tick_meet_sync()
returns void language plpgsql security definer set search_path = '' as $$
declare c public.meet_checkin_control%rowtype; l public.sync_leases%rowtype;
  h record; v_message text; v_status integer; v_now timestamptz:=clock_timestamp();
begin
  select * into c from public.meet_checkin_control where event_id=17135 for update;
  if c.mode<>'api' or not c.sync_enabled then return; end if;
  select * into l from public.sync_leases where event_id=17135;
  if found and l.expires_at<=v_now then
    v_message:='B2Match worker timed out. Automatic synchronization stopped. Existing dashboard values preserved.';
  elsif c.dispatch_at is not null then
    select status_code,timed_out,error_msg into h from net._http_response where id=c.dispatch_request_id;
    if found and (h.status_code>=400 or h.timed_out or h.error_msg is not null) then
      v_message:='Synchronization worker request failed. Automatic synchronization stopped. Existing dashboard values preserved.';
      v_status:=h.status_code;
    elsif c.dispatch_at+interval '30 seconds'<=v_now then
      v_message:='Synchronization worker did not start. Automatic synchronization stopped. Existing dashboard values preserved.';
    end if;
  end if;
  if v_message is null then
    begin
      perform event_private.dispatch_meet_sync();
    exception when others then
      v_message:='Synchronization scheduler unavailable. Automatic synchronization stopped. Existing dashboard values preserved.';
    end;
  end if;
  if v_message is not null then
    update public.meet_checkin_control set sync_enabled=false,sync_state='failed',generation=generation+1,
      version=version+1,next_sync_at=null,failed_at=v_now,safe_error=v_message,
      http_status=case when v_status between 100 and 599 then v_status else null end,
      dispatch_at=null,dispatch_request_id=null where event_id=17135;
    update public.sync_runs set status='failed',finished_at=v_now,safe_error=v_message,
      http_status=case when v_status between 100 and 599 then v_status else null end,
      duration_ms=greatest(0,floor(extract(epoch from (v_now-started_at))*1000)::integer)
      where event_id=17135 and status='running';
    delete from public.sync_leases where event_id=17135;
    update public.dashboard_aggregates set meet_failed_at=v_now,updated_at=v_now where event_id=17135;
  end if;
end;
$$;
revoke all on function event_private.tick_meet_sync() from public,anon,authenticated,service_role;

-- Wake-up precision is at most ten seconds; due times are 120 seconds from each claimed start.
-- A slow fetch finishes before the next claim. No missed-run catch-up and no automatic recovery.
select cron.schedule('nh-event-17135-b2match','10 seconds','select event_private.tick_meet_sync();');
