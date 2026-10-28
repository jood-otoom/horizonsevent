// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLiveDashboardResponse } from "../services/dashboardService";
import useDashboardData from "./useDashboardData";

const response = (completedMeetings: number, meet: unknown = null) => parseLiveDashboardResponse({
  eventId: 17135, meet,
  match: { completedMeetings, targetMeetings: 1200 },
  grow: { feedbackCount: 0, averageRating: null },
});

afterEach(() => vi.useRealTimers());

describe("public live dashboard refresh", () => {
  it("refetches after Realtime subscription or change and removes the subscription", async () => {
    let notify: (() => void) | undefined;
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((refresh: () => void) => { notify = refresh; return unsubscribe; });
    const load = vi.fn(async () => response(5));
    const { unmount } = renderHook(() => useDashboardData({ mode: "live", load, subscribe }));
    await act(async () => { await Promise.resolve(); });
    expect(subscribe).toHaveBeenCalledTimes(1);
    await act(async () => { notify?.(); await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(2);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps one polling interval per mount and cleans it up in Strict Mode", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => response(1));
    const { unmount } = renderHook(() => useDashboardData({ mode: "live", load }), { wrapper: StrictMode });
    await act(async () => { await Promise.resolve(); });
    const initialReads = load.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(load).toHaveBeenCalledTimes(initialReads + 1);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(load).toHaveBeenCalledTimes(initialReads + 1);
  });

  it("retains the same React state for an unchanged authoritative response", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => response(2));
    const { result } = renderHook(() => useDashboardData({ mode: "live", load }));
    await act(async () => { await Promise.resolve(); });
    const first = result.current;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(first);
  });

  it("retains aggregate counts but labels every source stale when a later read fails", async () => {
    vi.useFakeTimers();
    const meet = { registered: 10, checkedIn: 4, checkInRate: 40,
      lastSuccessfulSync: "2026-10-10T10:00:00Z", status: "live", verification: "approved" };
    const load = vi.fn().mockResolvedValueOnce(response(3, meet)).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useDashboardData({ mode: "live", load }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.meet).toMatchObject({ status: "ready", data: { registered: 10, status: "live" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.meet).toMatchObject({ status: "ready", data: { registered: 10, status: "stale" } });
    expect(result.current.match.status).toBe("stale");
    expect(result.current.grow.status).toBe("stale");
  });

  it("shows no demo values after a failed first live read", async () => {
    const load = vi.fn(async () => { throw new Error("offline"); });
    const { result } = renderHook(() => useDashboardData({ mode: "live", load }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.meet.status).toBe("error");
    expect(result.current.match.completedMeetings).toBeNull();
    expect(result.current.grow.feedbackCount).toBeNull();
  });

  it("refetches on browser reconnection and queues a read when one is active", async () => {
    const pending: Array<(value: ReturnType<typeof response>) => void> = [];
    const load = vi.fn(() => new Promise<ReturnType<typeof response>>((resolve) => pending.push(resolve)));
    const { result, unmount } = renderHook(() => useDashboardData({ mode: "live", load }));
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await act(async () => { pending.shift()?.(response(0)); await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { pending.shift()?.(response(1)); await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(1);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => { pending.shift()?.(response(2)); await Promise.resolve(); });
    expect(result.current.match.completedMeetings).toBe(2);
    unmount();
    window.dispatchEvent(new Event("online"));
    expect(load).toHaveBeenCalledTimes(3);
  });
});
