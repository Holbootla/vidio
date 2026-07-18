import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgressReporter, isNearCompletion } from "@/lib/player/progress-reporter";

describe("progress reporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles periodic reports to 15 seconds", () => {
    const onReport = vi.fn();
    const reporter = createProgressReporter({ onReport, intervalMs: 15_000 });
    reporter.start(() => ({ position: 10, duration: 100 }));

    vi.advanceTimersByTime(14_999);
    expect(onReport).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith({ position: 10, duration: 100 }, undefined);

    reporter.stop();
  });

  it("flushes immediately on pause-like events", () => {
    const onReport = vi.fn();
    const reporter = createProgressReporter({ onReport, intervalMs: 15_000 });
    reporter.flush({ position: 42, duration: 100 }, false);
    expect(onReport).toHaveBeenCalledWith({ position: 42, duration: 100 }, false);
  });

  it("detects near-completion threshold", () => {
    expect(isNearCompletion(900, 1000)).toBe(true);
    expect(isNearCompletion(100, 1000)).toBe(false);
  });
});
