// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEventClock } from "./useEventClock";

function Clock() {
  const value = useEventClock();
  return <div>{value.date} | {value.time}</div>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useEventClock", () => {
  it("updates seconds and crosses midnight in Asia/Amman independently of dashboard data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T20:59:59Z"));
    const view = render(<Clock />);
    expect(screen.getByText("Thu, Oct 22, 2026 | 11:59:59 PM")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Fri, Oct 23, 2026 | 12:00:00 AM")).toBeTruthy();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
