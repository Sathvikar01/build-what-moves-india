import { describe, expect, it } from "vitest";
import { DEFAULT_REPLAY_SCENARIO, runImpactReplay } from "./impact-replay";

describe("deterministic impact replay", () => {
  it("returns identical operational outcomes for seed 4242", () => {
    const first = runImpactReplay(DEFAULT_REPLAY_SCENARIO, 4242);
    const second = runImpactReplay(DEFAULT_REPLAY_SCENARIO, 4242);
    expect(first.baseline).toEqual(second.baseline);
    expect(first.adaptive).toEqual(second.adaptive);
    expect(first.seed).toBe(4242);
  });

  it("reports every judging metric without inventing percentage claims", () => {
    const result = runImpactReplay(DEFAULT_REPLAY_SCENARIO, 4242);
    for (const outcome of [result.baseline, result.adaptive]) {
      expect(outcome.missedPickups).toBeGreaterThanOrEqual(0);
      expect(outcome.overflowEvents).toBeGreaterThanOrEqual(0);
      expect(outcome.averageWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(outcome.longestNeglected.locality).toBeTruthy();
      expect(outcome.fairnessGapMinutes).toBeGreaterThanOrEqual(0);
      expect(outcome.routeDistanceKm).toBeGreaterThan(0);
      expect(outcome.fuelLitres).toBeCloseTo(outcome.routeDistanceKm * 0.12, 5);
      expect(outcome.co2Kg).toBeCloseTo(outcome.fuelLitres * 2.68, 5);
    }
    expect(result.method.fallbackUsed).toBe(false);
    expect(result.method.computeTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.method.distanceModel).toContain("depot");
    expect(result.method.overflowModel).toContain("threshold");
  });

  it("exposes the adaptive trade-off instead of forcing every metric to improve", () => {
    const result = runImpactReplay(DEFAULT_REPLAY_SCENARIO, 4242);
    expect(result.baseline.missedPickups).toBe(3);
    expect(result.adaptive.missedPickups).toBe(3);
    expect(result.adaptive.overflowEvents).toBeLessThan(result.baseline.overflowEvents);
    expect(result.adaptive.fairnessGapMinutes).toBeLessThanOrEqual(result.baseline.fairnessGapMinutes);
  });
});
