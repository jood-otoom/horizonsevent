// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import useDashboardData from "./useDashboardData";

afterEach(() => vi.useRealTimers());

describe("live dashboard refresh", () => {
  it("keeps Strict Mode remounts on separate Realtime topics", async () => {
    const topics: string[] = [];
    const client = {
      functions: { invoke: async () => ({ data: {
        eventId: 17135, meet: null,
        match: { completedMeetings: 1, targetMeetings: 1200 },
        grow: { feedbackCount: 0, averageRating: null },
      }, error: null }) },
      channel: (topic: string) => {
        topics.push(topic);
        const channel = { on: () => channel, subscribe: () => channel };
        return channel;
      },
      removeChannel: async () => "ok",
    } as unknown as SupabaseClient;
    const { unmount } = renderHook(() => useDashboardData({ mode: "live", client }), { wrapper: StrictMode });
    await act(async () => { await Promise.resolve(); });
    expect(topics).toHaveLength(2);
    expect(new Set(topics).size).toBe(2);
    unmount();
  });

  it("retains aggregate counts but labels every source stale when a later read fails", async () => {
    vi.useFakeTimers();
    let count = 0;
    const channel = { on: () => channel, subscribe: () => channel };
    const client = {
      functions: { invoke: async () => {
        count++;
        return count === 1 ? { data: {
          eventId: 17135,
          meet: { registered: 10, checkedIn: 4, checkInRate: 40,
            lastSuccessfulSync: "2026-10-10T10:00:00Z", status: "live", verification: "approved" },
          match: { completedMeetings: 3, targetMeetings: null },
          grow: { feedbackCount: 1, averageRating: 5 },
        }, error: null } : { data: null, error: new Error("offline") };
      } },
      channel: () => channel,
      removeChannel: async () => "ok",
    } as unknown as SupabaseClient;
    const { result } = renderHook(() => useDashboardData({ mode: "live", client }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.meet).toMatchObject({ status: "ready", data: { registered: 10, status: "live" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.meet).toMatchObject({ status: "ready", data: { registered: 10, status: "stale" } });
    expect(result.current.match.status).toBe("stale");
    expect(result.current.grow.status).toBe("stale");
  });

  it("refetches authoritative aggregates after a Realtime change", async () => {
    let onChange: (() => void) | undefined;
    let reads = 0;
    const channel = {
      on: (_event: string, _filter: unknown, callback: () => void) => { onChange = callback; return channel; },
      subscribe: () => channel,
    };
    const client = {
      functions: { invoke: async () => ({ data: {
        eventId: 17135, meet: null,
        match: { completedMeetings: ++reads, targetMeetings: null },
        grow: { feedbackCount: 0, averageRating: null },
      }, error: null }) },
      channel: () => channel,
      removeChannel: async () => "ok",
    } as unknown as SupabaseClient;
    const { result, unmount } = renderHook(() => useDashboardData({ mode: "live", client }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(1);
    await act(async () => { onChange?.(); await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(2);
    unmount();
  });

  it("refetches after reconnect and does not drop a change during an active read", async () => {
    let onChange: (() => void) | undefined;
    let onStatus: ((status: string) => void) | undefined;
    const pending: Array<(value: unknown) => void> = [];
    const channel = {
      on: (_event: string, _filter: unknown, callback: () => void) => { onChange = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { onStatus = callback; return channel; },
    };
    const client = {
      functions: { invoke: () => new Promise((resolve) => pending.push(resolve)) },
      channel: () => channel,
      removeChannel: async () => "ok",
    } as unknown as SupabaseClient;
    const response = (completedMeetings: number) => ({ data: {
      eventId: 17135, meet: null,
      match: { completedMeetings, targetMeetings: 1200 },
      grow: { feedbackCount: 0, averageRating: null },
    }, error: null });
    const { result, unmount } = renderHook(() => useDashboardData({ mode: "live", client }));
    expect(pending).toHaveLength(1);
    await act(async () => { onChange?.(); onStatus?.("SUBSCRIBED"); });
    await act(async () => { pending.shift()?.(response(0)); await Promise.resolve(); });
    expect(pending).toHaveLength(1);
    await act(async () => { pending.shift()?.(response(1)); await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(1);
    await act(async () => { onStatus?.("SUBSCRIBED"); });
    expect(pending).toHaveLength(1);
    await act(async () => { pending.shift()?.(response(2)); await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(2);
    unmount();
  });
});
