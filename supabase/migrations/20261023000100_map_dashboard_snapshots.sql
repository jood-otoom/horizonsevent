-- Event 17135 map publication stores only workbook-derived aggregates.
create table public.map_dashboard_snapshots (
  event_id integer primary key references public.event_settings(event_id) check (event_id = 17135),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_record_count integer not null check (source_record_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.map_dashboard_snapshots enable row level security;
revoke all on public.map_dashboard_snapshots from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.map_dashboard_snapshots to anon, authenticated;
grant select, insert, update, delete on public.map_dashboard_snapshots to service_role;

-- The map has no participant-level data. Signed-out venue viewers may read this one event row.
create policy "public reads published map aggregates"
  on public.map_dashboard_snapshots for select to anon, authenticated
  using (event_id = 17135);
