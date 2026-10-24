import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearMapSnapshotCache, fetchMapSnapshot, parseMapSnapshot } from "./mapService";
import { mapRow } from "../../tests/mapFixture";

describe("published map snapshot", () => {
  beforeEach(clearMapSnapshotCache);

  it("reconciles all stage and governorate totals", () => {
    const snapshot = parseMapSnapshot(mapRow);
    expect(snapshot.nationwide.total).toBe(266);
    expect(snapshot.sourceRecordCount).toBe(266);
    expect(Object.keys(snapshot.governorates)).toHaveLength(8);
    expect(snapshot.governorates.maan.stages.Acceleration).toBe(0);
  });

  it("rejects inconsistent, unknown or malformed published statistics", () => {
    expect(() => parseMapSnapshot({ ...mapRow, source_record_count: 265 })).toThrow("reconcile");
    expect(() => parseMapSnapshot({ ...mapRow, payload: { ...mapRow.payload, nationwide: { ...mapRow.payload.nationwide, total: 267 } } })).toThrow("reconcile");
    expect(() => parseMapSnapshot({ ...mapRow, payload: { ...mapRow.payload, governorates: { ...mapRow.payload.governorates, other: {} } } })).toThrow("governorate");
    const zeroRegion = structuredClone(mapRow);
    zeroRegion.payload.governorates.maan.total = 0;
    zeroRegion.payload.governorates.maan.stages["Go to Market"] = 0;
    zeroRegion.payload.governorates.aqaba.total += 3;
    zeroRegion.payload.governorates.aqaba.stages["Go to Market"] += 3;
    expect(() => parseMapSnapshot(zeroRegion)).toThrow("reconcile");
  });

  it("uses one Supabase read for concurrent mounts and caches the result", async () => {
    const single = vi.fn().mockResolvedValue({ data: mapRow, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as SupabaseClient;
    const [first, second] = await Promise.all([fetchMapSnapshot(client), fetchMapSnapshot(client)]);
    expect(first).toBe(second);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("map_dashboard_snapshots");
    expect(eq).toHaveBeenCalledWith("event_id", 17135);
    await fetchMapSnapshot(client);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("reports a failed read without a sample fallback", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error("offline") }) }) }) }) } as unknown as SupabaseClient;
    await expect(fetchMapSnapshot(client)).rejects.toThrow("unavailable");
  });
});
