// Runs PostgreSQL assertions in memory. No database URL or network transport is accepted.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireRuntime = createRequire(process.env.NH_PGLITE_RUNTIME
  ? resolve(process.env.NH_PGLITE_RUNTIME, "package.json") : import.meta.url);
let PGlite;
try {
  const modulePath = requireRuntime.resolve("@electric-sql/pglite");
  const metadata = JSON.parse(await readFile(resolve(dirname(modulePath), "../package.json"), "utf8"));
  if (metadata.version !== "0.3.14") throw new Error("Expected PGlite 0.3.14");
  ({ PGlite } = requireRuntime("@electric-sql/pglite"));
} catch (error) {
  console.error(`Isolated tests require @electric-sql/pglite@0.3.14. Set NH_PGLITE_RUNTIME to its package directory. ${error.message}`);
  process.exit(1);
}

const migrations = [
  "20261013191540_initial_dashboard_schema.sql",
  "20261014201641_restrict_rls_auto_enable_execute.sql",
  "20261015204348_audit_controller_reversals.sql",
  "20261023000100_map_dashboard_snapshots.sql",
  "20261023172257_manual_checkin_fallback.sql",
  "20261028192045_event_operations_and_sync.sql",
];
const bootstrap = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create publication supabase_realtime;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;`;

async function runSuite(name, setup, fixture) {
  const db = new PGlite();
  let step = "bootstrap";
  try {
    await db.exec(bootstrap);
    for (const migration of migrations) {
      step = migration;
      await db.exec(await readFile(resolve(root, "supabase/migrations", migration), "utf8"));
    }
    step = "synthetic transport";
    await setup(db);
    step = fixture;
    await db.exec(await readFile(resolve(root, "supabase/verification", fixture), "utf8"));
    console.log(`PASS ${name}: migrations and ${fixture}`);
  } catch (error) {
    console.error(`FAIL ${name} at ${step}: ${error.message}${error.where ? ` (${error.where})` : ""}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

await runSuite("manual, settings, reset and authorization", async (db) => {
  await db.exec(`
    create schema event_private; grant usage on schema event_private to service_role;
    create function event_private.dispatch_meet_sync() returns void language plpgsql as $$begin return; end$$;
    create function event_private.meet_scheduler_ready() returns boolean language sql as $$select true$$;
    grant execute on function event_private.dispatch_meet_sync(),event_private.meet_scheduler_ready() to service_role;`);
}, "manual_checkins.sql");

await runSuite("scheduler dispatch and watchdog", async (db) => {
  await db.exec(`
    create schema net; create schema vault; create schema cron;
    create table vault.decrypted_secrets(name text unique,decrypted_secret text);
    create table net.readiness_mock_requests(id bigint generated always as identity,url text,body jsonb,headers jsonb,timeout_milliseconds int);
    create table net._http_response(id bigint,status_code int,timed_out bool,error_msg text);
    create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,active boolean default true);
    create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds int default 2000)
      returns bigint language plpgsql as $$declare i bigint;begin
        insert into net.readiness_mock_requests(url,body,headers,timeout_milliseconds) values(url,body,headers,timeout_milliseconds) returning id into i;return i;end$$;
    create function cron.schedule(p_name text,p_schedule text,p_command text) returns bigint language plpgsql as $$declare i bigint;begin
      insert into cron.job(jobname,schedule,command) values(p_name,p_schedule,p_command) returning jobid into i;return i;end$$;`);
  const scheduler = await readFile(resolve(root, "supabase/migrations/20261028192319_b2match_server_schedule.sql"), "utf8");
  // PGlite has no pg_net/pg_cron. Their SQL interfaces above are synthetic and cannot send HTTP.
  await db.exec(scheduler.replaceAll(/^create extension[^;]+;$/gm, ""));
}, "sync_schedule.sql");
