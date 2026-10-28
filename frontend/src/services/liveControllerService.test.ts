import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, FunctionsFetchError } from "@supabase/supabase-js";
import { liveControllerService, parseActions, parseCheckins, parseSettings } from "./liveControllerService";
import type { ControllerSettings, SettingsAction } from "../types/controller";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { functions: { invoke } } }));

afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); });

const action = {
  requestId: "11111111-1111-4111-8111-111111111111",
  kind: "meeting",
  quantity: 2,
  rating: null,
  createdAt: "2026-10-15T20:00:00Z",
  reversedAt: null,
};

describe("live controller history boundary", () => {
  it("accepts a valid action and reversal timestamp", () => {
    expect(parseActions({ actions: [action, {
      ...action, kind: "feedback", quantity: null, rating: 5,
      reversedAt: "2026-10-15T20:01:00Z",
    }] })).toHaveLength(2);
  });

  it("rejects contradictory or malformed history without displaying it", () => {
    expect(() => parseActions({ actions: [{ ...action, rating: 5 }] })).toThrow();
    expect(() => parseActions({ actions: [{ ...action, reversedAt: "unknown" }] })).toThrow();
    expect(() => parseActions({ actions: [{ ...action, requestId: "not-a-uuid" }] })).toThrow();
    expect(() => parseActions({ actions: Array(13).fill(action) })).toThrow();
  });

  it("accepts manual check-ins and validates the reconciled aggregate boundary", () => {
    expect(parseActions({ actions: [{ ...action, kind: "checkin", quantity: 1,
      undoEligible: false }] })[0].undoEligible).toBe(false);
    expect(parseCheckins({ mode: "manual", registered: 202, checkedIn: 1,
      apiCheckedIn: 2, apiAsOf: "2026-10-23T00:00:00Z", canReconcile: true }).checkedIn).toBe(1);
    expect(() => parseCheckins({ mode: "manual", registered: 1, checkedIn: 2,
      apiCheckedIn: 2, apiAsOf: "2026-10-23T00:00:00Z", canReconcile: true })).toThrow();
  });

  it("accepts administrator audit operations without granting Undo", () => {
    expect(parseActions({ actions: [{ ...action, kind: "settings", operation: "reset_event",
      quantity: null, undoEligible: false }, { ...action, kind: "checkin", operation: "set_checkins",
      quantity: null, value: 20, undoEligible: false }, { ...action, kind: "checkin", quantity: 10 }] }))
      .toMatchObject([{ kind: "settings", undoEligible: false }, { value: 20, undoEligible: false }, { quantity: 10 }]);
    expect(() => parseActions({ actions: [{ ...action, kind: "settings", operation: "reset_event",
      quantity: null, undoEligible: true }] })).toThrow();
  });

  it("validates settings counts, versions, states, and timestamps at the boundary", () => {
    const settings = { role: "admin", mode: "manual", syncState: "manual", syncEnabled: false,
      version: 3, registered: 100, checkedIn: 10, source: "manual", registeredOverride: 100,
      meetingTarget: 1200, lastSuccessAt: "2026-10-28T08:00:00Z", lastAttemptAt: null,
      nextSyncAt: null, apiRegistered: 90, apiCheckedIn: 5, error: null, httpStatus: null, canStart: false };
    expect(parseSettings(settings).version).toBe(3);
    expect(() => parseSettings({ ...settings, checkedIn: 101 })).toThrow();
    expect(() => parseSettings({ ...settings, version: -1 })).toThrow();
    expect(() => parseSettings({ ...settings, registered: 1.5 })).toThrow();
    expect(() => parseSettings({ ...settings, lastAttemptAt: "invalid" })).toThrow();
    expect(() => parseSettings({ ...settings, syncState: "retrying" })).toThrow();
  });
});

describe("live controller administrative response boundary", () => {
  const settings: ControllerSettings = {
    role: "admin", mode: "api", syncState: "stopped", syncEnabled: false,
    version: 4, registered: 100, checkedIn: 10, source: "api", registeredOverride: null,
    meetingTarget: 1200, lastSuccessAt: "2026-10-28T08:00:00Z", lastAttemptAt: null,
    nextSyncAt: null, apiRegistered: 100, apiCheckedIn: 10, error: null, httpStatus: null, canStart: true,
  };
  const record = { id: action.requestId, createdAt: action.createdAt };

  it.each<SettingsAction>([
    { kind: "start_sync" },
    { kind: "stop_sync" },
    { kind: "reset_event", confirmation: "RESET EVENT" },
  ])("confirms $kind from the deployed {record,settings} response without checkins", async (operation) => {
    const updated: ControllerSettings = operation.kind === "start_sync"
      ? { ...settings, syncState: "starting", syncEnabled: true, canStart: false }
      : operation.kind === "reset_event"
        ? { ...settings, registered: 0, checkedIn: 0, source: "reset" }
        : settings;
    invoke.mockResolvedValueOnce({ data: { record, settings: updated }, error: null });
    const request = { ...operation, requestId: record.id, expectedVersion: 3 };

    await expect(liveControllerService.updateSettings(request)).resolves.toEqual({
      record: { ...record, rating: undefined }, settings: updated,
    });
    expect(invoke).toHaveBeenCalledExactlyOnceWith("controller-submit", {
      method: "POST", body: { eventId: 17135, ...request }, timeout: 15_000,
    });
  });

  it("still rejects a malformed settings payload or missing commit receipt", async () => {
    const request = { kind: "stop_sync" as const, requestId: record.id, expectedVersion: 3 };
    invoke.mockResolvedValueOnce({ data: { record, settings: { ...settings, version: -1 } }, error: null });
    await expect(liveControllerService.updateSettings(request)).rejects.toThrow("Invalid settings response.");
    invoke.mockResolvedValueOnce({ data: { settings }, error: null });
    await expect(liveControllerService.updateSettings(request)).rejects.toThrow("Invalid controller response.");
  });

  it("bounds Settings reads without changing other controller requests", async () => {
    invoke.mockResolvedValueOnce({ data: { settings }, error: null });
    await expect(liveControllerService.getSettings()).resolves.toEqual(settings);
    expect(invoke).toHaveBeenLastCalledWith("controller-submit?view=settings", { method: "GET", timeout: 15_000 });

    const checkins = { mode: "manual", registered: 100, checkedIn: 10, apiCheckedIn: 10,
      apiAsOf: settings.lastSuccessAt, canReconcile: false };
    invoke.mockResolvedValueOnce({ data: { record, checkins }, error: null });
    await liveControllerService.setCheckins({ requestId: record.id, checkedIn: 10, expectedVersion: 3 });
    expect(invoke).toHaveBeenLastCalledWith("controller-submit", { method: "POST", body: {
      eventId: 17135, kind: "set_checkins", requestId: record.id, checkedIn: 10, expectedVersion: 3,
    } });
  });

  it("aborts a Settings mutation at 15 seconds, cleans up, and never retries automatically", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
    }));
    const sdk = createClient("https://synthetic.invalid", "sb_publishable_synthetic", {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },
    });
    invoke.mockImplementationOnce((name, options) => sdk.functions.invoke(name, options));
    const request = { kind: "stop_sync" as const, requestId: record.id, expectedVersion: 3 };
    const result = liveControllerService.updateSettings(request);
    const settled = vi.fn();
    void result.then(settled, settled);
    const rejection = expect(result).rejects.toThrow("Settings request timed out after 15 seconds. The operation may have completed.");

    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves an unconfirmed response loss without retrying a mutation", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new TypeError("Network failed")) });
    await expect(liveControllerService.updateSettings({ kind: "stop_sync", requestId: record.id, expectedVersion: 3 }))
      .rejects.toThrow("The request was not confirmed. Retry safely with the same submission ID.");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("explains a Settings read timeout without reporting mutation success", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new DOMException("Request aborted", "AbortError")) });
    await expect(liveControllerService.getSettings()).rejects.toThrow("Settings took longer than 15 seconds to load.");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
