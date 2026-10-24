import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabase } from "../lib/supabaseClient";
import {
  MAP_GOVERNORATE_IDS, MAP_GOVERNORATE_NAMES, MAP_STAGES,
  type GovernorateSummary, type MapGovernorateId, type MapSnapshot, type MapSummary,
} from "../types/map";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Map statistics have an invalid format.");
  }
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error("Map statistics contain an invalid count.");
  }
  return Number(value);
}

function parseSummary(value: unknown): MapSummary {
  const data = record(value);
  const stages = record(data.stages);
  if (Object.keys(stages).sort().join("|") !== [...MAP_STAGES].sort().join("|")) {
    throw new Error("Map statistics contain unexpected programme stages.");
  }
  const parsedStages = {
    Acceleration: count(stages.Acceleration),
    "Grow+": count(stages["Grow+"]),
    "Go to Market": count(stages["Go to Market"]),
  };
  const total = count(data.total);
  if (MAP_STAGES.reduce((sum, stage) => sum + parsedStages[stage], 0) !== total) {
    throw new Error("Map programme stages do not reconcile.");
  }
  return { total, stages: parsedStages };
}

export function parseMapSnapshot(value: unknown): MapSnapshot {
  const row = record(value);
  const payload = record(row.payload);
  if (row.event_id !== 17135 || payload.schemaVersion !== 1 ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) {
    throw new Error("Map statistics have an invalid event or version.");
  }
  const sourceRecordCount = count(row.source_record_count);
  const nationwideRaw = record(payload.nationwide);
  const nationwideSummary = parseSummary(nationwideRaw);
  const representedGovernorates = count(nationwideRaw.represented_governorates);
  const rawGovernorates = record(payload.governorates);
  if (Object.keys(rawGovernorates).sort().join("|") !== [...MAP_GOVERNORATE_IDS].sort().join("|")) {
    throw new Error("Map statistics have an unexpected governorate set.");
  }
  const governorates = {} as Record<MapGovernorateId, GovernorateSummary>;
  for (const id of MAP_GOVERNORATE_IDS) {
    const raw = record(rawGovernorates[id]);
    if (raw.name !== MAP_GOVERNORATE_NAMES[id]) throw new Error(`Map name mismatch for ${id}.`);
    governorates[id] = { name: MAP_GOVERNORATE_NAMES[id], ...parseSummary(raw) };
  }
  if (representedGovernorates !== MAP_GOVERNORATE_IDS.length ||
      MAP_GOVERNORATE_IDS.some(id => governorates[id].total === 0) ||
      sourceRecordCount !== nationwideSummary.total ||
      MAP_GOVERNORATE_IDS.reduce((sum, id) => sum + governorates[id].total, 0) !== nationwideSummary.total ||
      MAP_STAGES.some(stage => MAP_GOVERNORATE_IDS.reduce(
        (sum, id) => sum + governorates[id].stages[stage], 0,
      ) !== nationwideSummary.stages[stage])) {
    throw new Error("Map governorate and nationwide totals do not reconcile.");
  }
  return {
    eventId: 17135, sourceRecordCount, createdAt: row.created_at,
    nationwide: { ...nationwideSummary, representedGovernorates }, governorates,
  };
}

let pending: Promise<MapSnapshot> | null = null;
let cached: MapSnapshot | null = null;

export async function fetchMapSnapshot(client: SupabaseClient | null = mapSupabase): Promise<MapSnapshot> {
  if (!client) throw new Error("Map statistics need a configured Supabase connection.");
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    const { data, error } = await client.from("map_dashboard_snapshots")
      .select("event_id,payload,source_record_count,created_at")
      .eq("event_id", 17135).single();
    if (error || !data) throw new Error("Published map statistics are unavailable. Please try again later.");
    return parseMapSnapshot(data);
  })();
  try {
    cached = await pending;
    return cached;
  } finally {
    pending = null;
  }
}

export function clearMapSnapshotCache() {
  cached = null;
  pending = null;
}
