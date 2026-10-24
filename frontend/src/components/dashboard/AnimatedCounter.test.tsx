// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnimatedCounter from "./AnimatedCounter";
import MatchPillar from "./MatchPillar";

const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let now = 0;
let reducedMotion = false;
let motionListeners = new Set<() => void>();

function frame(time: number) {
  act(() => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  });
}

beforeEach(() => {
  frames.clear();
  nextFrameId = 1;
  now = 0;
  reducedMotion = false;
  motionListeners = new Set();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return reducedMotion; },
    addEventListener: (_: string, listener: () => void) => motionListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => motionListeners.delete(listener),
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AnimatedCounter", () => {
  it("renders the first snapshot immediately, without a false zero-to-value animation", () => {
    render(<AnimatedCounter value={25} />);
    expect(screen.getByText("25")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("keeps thousands separators for large initial values", () => {
    render(<AnimatedCounter value={1234} />);
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("eases upward and finishes exactly on the latest value", () => {
    const view = render(<AnimatedCounter value={25} />);
    view.rerender(<AnimatedCounter value={30} />);
    expect(screen.getByText("25")).toBeTruthy();
    frame(300);
    expect(Number(view.container.textContent)).toBeGreaterThan(25);
    expect(Number(view.container.textContent)).toBeLessThan(30);
    frame(900);
    expect(screen.getByText("30")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("stays static for duplicate data, ordinary rerenders, and unrelated clock changes", () => {
    const view = render(<div><AnimatedCounter value={25} /><time>12:00:00</time></div>);
    view.rerender(<div><AnimatedCounter value={25} /><time>12:00:01</time></div>);
    view.rerender(<div><AnimatedCounter value={25} /><time>12:00:02</time></div>);
    expect(screen.getByText("25")).toBeTruthy();
    expect(frames.size).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("retargets rapid updates from the current display and cancels stale frames", () => {
    const view = render(<AnimatedCounter value={10} />);
    view.rerender(<AnimatedCounter value={15} />);
    frame(350);
    const intermediate = Number(view.container.textContent);
    expect(intermediate).toBeGreaterThan(10);
    view.rerender(<AnimatedCounter value={18} />);
    expect(Number(view.container.textContent)).toBe(intermediate);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    frame(1250);
    expect(screen.getByText("18")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("shows downward corrections immediately without running an increase animation", () => {
    const view = render(<AnimatedCounter value={30} />);
    view.rerender(<AnimatedCounter value={28} />);
    expect(screen.getByText("28")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("preserves decimal precision and existing trimmed percent formatting", () => {
    const view = render(<AnimatedCounter value={4.0} decimals={1} duration={700} />);
    expect(screen.getByText("4.0")).toBeTruthy();
    view.rerender(<AnimatedCounter value={4.6} decimals={1} duration={700} />);
    frame(700);
    expect(screen.getByText("4.6")).toBeTruthy();
    view.rerender(<AnimatedCounter value={4.4} decimals={1} duration={700} />);
    expect(screen.getByText("4.4")).toBeTruthy();

    view.unmount();
    render(<AnimatedCounter value={100} decimals={2} trimTrailingZeros suffix="%" />);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("respects reduced motion on updates and when enabled during an animation", () => {
    reducedMotion = true;
    const view = render(<AnimatedCounter value={25} />);
    view.rerender(<AnimatedCounter value={30} />);
    expect(screen.getByText("30")).toBeTruthy();
    expect(frames.size).toBe(0);

    reducedMotion = false;
    view.rerender(<AnimatedCounter value={35} />);
    expect(frames.size).toBe(1);
    reducedMotion = true;
    act(() => motionListeners.forEach((listener) => listener()));
    expect(screen.getByText("35")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("cancels scheduled frames when unmounted", () => {
    const view = render(<AnimatedCounter value={25} />);
    view.rerender(<AnimatedCounter value={30} />);
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("applies number-only emphasis to increases, then cancels it for corrections", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    try {
      const view = render(<AnimatedCounter value={25} />);
      view.rerender(<AnimatedCounter value={30} />);
      expect(animate).toHaveBeenCalledOnce();
      view.rerender(<AnimatedCounter value={30} />);
      expect(animate).toHaveBeenCalledOnce();
      view.rerender(<AnimatedCounter value={28} />);
      expect(cancel).toHaveBeenCalled();
      expect(animate).toHaveBeenCalledOnce();
      reducedMotion = true;
      view.rerender(<AnimatedCounter value={29} />);
      expect(animate).toHaveBeenCalledOnce();
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "animate", original);
      else Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });
});

describe("dashboard KPI integration", () => {
  it("shows the first live MATCH snapshot immediately after a pending state", () => {
    const metrics = { dataMode: "live" as const, status: "pending" as const,
      completedMeetings: null, targetMeetings: null };
    const view = render(<MatchPillar metrics={metrics} />);
    view.rerender(<MatchPillar metrics={{ ...metrics, completedMeetings: 25, targetMeetings: 1200 }} />);
    expect(screen.getByText("25")).toBeTruthy();
    expect(frames.size).toBe(0);
  });

  it("does not remount MATCH progress when the value changes or a duplicate snapshot arrives", () => {
    const metrics = { dataMode: "live" as const, status: "live" as const,
      completedMeetings: 25, targetMeetings: 1200 };
    const view = render(<MatchPillar metrics={metrics} />);
    expect(screen.getByText("25")).toBeTruthy();
    expect(frames.size).toBe(0);
    view.rerender(<MatchPillar metrics={{ ...metrics, completedMeetings: 30 }} />);
    expect(frames.size).toBe(2);
    view.rerender(<MatchPillar metrics={{ ...metrics, completedMeetings: 30 }} />);
    expect(frames.size).toBe(2);
    frame(1000);
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("2.5%")).toBeTruthy();
  });
});
