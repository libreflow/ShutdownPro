import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, resolveAbsoluteTarget, actionWording } from "./main";

describe("formatDuration", () => {
  it("formats seconds under a minute as mm:ss", () => {
    expect(formatDuration(45)).toBe("00:45");
  });

  it("formats minutes and seconds without a leading hour segment", () => {
    expect(formatDuration(125)).toBe("02:05");
  });

  it("includes the hour segment once seconds reach an hour", () => {
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  it("formats zero as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("pads every segment to two digits", () => {
    expect(formatDuration(9)).toBe("00:09");
  });

  it("handles the 24h max delay", () => {
    expect(formatDuration(24 * 60 * 60)).toBe("24:00:00");
  });
});

describe("actionWording", () => {
  it("returns shutdown wording for 'shutdown'", () => {
    const w = actionWording("shutdown");
    expect(w.noun).toBe("Extinction");
    expect(w.scheduledWord).toBe("programmée");
  });

  it("returns restart wording for 'restart'", () => {
    const w = actionWording("restart");
    expect(w.noun).toBe("Redémarrage");
    expect(w.scheduledWord).toBe("programmé");
  });
});

describe("resolveAbsoluteTarget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a future time today without rolling to tomorrow", () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0));
    const result = resolveAbsoluteTarget("14:30");
    expect(result).not.toBeNull();
    expect(result?.isTomorrow).toBe(false);
    // 14:30 - 10:00 = 4h30 = 16200s
    expect(result?.seconds).toBe(4 * 3600 + 30 * 60);
  });

  it("rolls to tomorrow when the target time already passed today", () => {
    vi.setSystemTime(new Date(2026, 0, 15, 18, 0, 0));
    const result = resolveAbsoluteTarget("09:00");
    expect(result).not.toBeNull();
    expect(result?.isTomorrow).toBe(true);
    // 09:00 tomorrow - 18:00 today = 15h = 54000s
    expect(result?.seconds).toBe(15 * 3600);
  });

  it("rolls to tomorrow when the target time equals now exactly", () => {
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0, 0));
    const result = resolveAbsoluteTarget("09:00");
    expect(result?.isTomorrow).toBe(true);
    expect(result?.seconds).toBe(24 * 3600);
  });

  it("returns null for malformed input", () => {
    expect(resolveAbsoluteTarget("not-a-time")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(resolveAbsoluteTarget("")).toBeNull();
  });
});
