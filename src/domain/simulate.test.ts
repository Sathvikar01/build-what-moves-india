import { describe, expect, it } from "vitest";
import { appendEvents, advanceBins, binStatusFor, citizenReportPriority, driftUserLocation, DUMP_HISTORY_LIMIT, householdDump, makeCitizenReport, USER_DRIFT_BOUNDS, USER_DRIFT_MAX_METERS, USER_DRIFT_MIN_METERS } from "./simulate";
import { haversineKm } from "./geo";
import type { GeoPoint } from "./types";
import { MOCK_USER_LOCATION } from "../data/locations";
import { createDemoState, SYNTHETIC_SOURCE } from "../data/demo";

describe("binStatusFor", () => {
  it("classifies fill levels with the shared thresholds", () => {
    expect(binStatusFor(0)).toBe("available");
    expect(binStatusFor(69)).toBe("available");
    expect(binStatusFor(70)).toBe("filling");
    expect(binStatusFor(93)).toBe("filling");
    expect(binStatusFor(94)).toBe("full");
    expect(binStatusFor(100)).toBe("full");
  });
});

describe("advanceBins", () => {
  it("uses the post-increment fill value for status (no stale status)", () => {
    const bins = createDemoState().bins;
    const bin93 = bins.find(b => b.fillPercent === 93) ?? { ...bins[0], fillPercent: 93, status: "filling" as const };
    const [next] = advanceBins([{ ...bin93, fillPercent: 93 }], 0, "2026-08-21T12:00:00.000Z");
    expect(next.fillPercent).toBe(94);
    expect(next.status).toBe("full");
  });

  it("never exceeds 100 and leaves offline bins untouched", () => {
    const bins = createDemoState().bins;
    const full = bins.find(b => b.status === "offline")!;
    const [next] = advanceBins([full], 0, "2026-08-21T12:00:00.000Z");
    expect(next.fillPercent).toBe(full.fillPercent);
    expect(next.status).toBe("offline");
  });
});

describe("appendEvents", () => {
  it("produces unique ids and monotonically increasing cursors", () => {
    const state = createDemoState();
    const first = appendEvents(state, [{ type: "demo.ticked", entityId: "x", message: "one" }]);
    const second = appendEvents({ ...state, events: first }, [
      { type: "demo.ticked", entityId: "x", message: "two" },
      { type: "demo.ticked", entityId: "x", message: "three" },
    ]);
    const ids = second.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cursors = second.map(e => e.cursor);
    expect(cursors).toEqual([...cursors].sort((a, b) => a - b));
  });
});

describe("citizenReportPriority", () => {
  it("uses the shared field defaults and flags traffic-lane obstruction", () => {
    const base = citizenReportPriority({ reportId: "r", observedAt: "2026-08-21T12:00:00.000Z", calculatedAt: "2026-08-21T12:00:00.000Z", hygieneRisk: "moderate", obstruction: "none" });
    const blocked = citizenReportPriority({ reportId: "r", observedAt: "2026-08-21T12:00:00.000Z", calculatedAt: "2026-08-21T12:00:00.000Z", hygieneRisk: "moderate", obstruction: "traffic_lane" });
    expect(base.audit.factors.length).toBeGreaterThan(0);
    expect(blocked.audit.effectiveScore).toBeGreaterThan(base.audit.effectiveScore);
  });

  it("makeCitizenReport produces an acknowledged report with an audit", () => {
    const report = makeCitizenReport({ id: "rep-x", title: "", category: "mixed", location: { lat: 12.97, lng: 77.75 }, hygiene: "high", obstruction: "partial", now: "2026-08-21T12:00:00.000Z", source: SYNTHETIC_SOURCE });
    expect(report.title).toBe("Citizen garbage report");
    expect(report.status).toBe("acknowledged");
    expect(report.priority.audit.factors.length).toBeGreaterThan(0);
  });
});

describe("householdDump", () => {
  it("raises the chosen bin's fill, updates its status, and records the dump", () => {
    const state = createDemoState();
    const before = new Map(state.bins.map(b => [b.id, b.fillPercent]));
    const dump = householdDump(state, 7);
    expect(dump).not.toBeNull();
    const bin = state.bins.find(b => b.id === dump!.binId)!;
    expect(bin.status).not.toBe("offline");
    expect(bin.fillPercent).toBeGreaterThan(before.get(bin.id)!);
    expect(bin.fillPercent).toBeLessThanOrEqual(100);
    expect(bin.status).toBe(binStatusFor(bin.fillPercent));
    expect(dump!.litres).toBeGreaterThan(0);
    expect(dump!.binLabel).toBe(bin.label);
    expect(dump!.location).toEqual(bin.location);
    expect(state.dumps?.at(-1)?.id).toBe(dump!.id);
  });

  it("is deterministic for the same seed and entropy", () => {
    const a = createDemoState();
    const b = createDemoState();
    const dumpA = householdDump(a, 42);
    const dumpB = householdDump(b, 42);
    expect(dumpB).toEqual(dumpA);
  });

  it("never targets offline bins and clamps at 100%", () => {
    const state = createDemoState();
    const offline = state.bins.find(b => b.status === "offline")!;
    for (let i = 0; i < 60; i++) {
      const dump = householdDump(state, i);
      if (!dump) break;
      expect(dump.binId).not.toBe(offline.id);
      expect(offline.fillPercent).toBe(0);
      const bin = state.bins.find(b => b.id === dump.binId)!;
      expect(bin.fillPercent).toBeLessThanOrEqual(100);
    }
  });

  it("keeps only the most recent dumps in history", () => {
    const state = createDemoState();
    for (let i = 0; i < 40; i++) {
      if (!householdDump(state, 500 + i)) break;
    }
    expect(state.dumps!.length).toBeLessThanOrEqual(DUMP_HISTORY_LIMIT);
  });

  it("keeps bin levels on whole numbers after dumps", () => {
    const state = createDemoState();
    for (let i = 0; i < 30; i++) {
      if (!householdDump(state, 900 + i)) break;
      for (const bin of state.bins) {
        expect(Number.isInteger(bin.fillPercent)).toBe(true);
      }
    }
  });

  it("returns null when every bin is offline or full", () => {
    const state = createDemoState();
    for (const bin of state.bins) bin.fillPercent = 100;
    expect(householdDump(state, 1)).toBeNull();
  });
});

describe("driftUserLocation", () => {
  it("is deterministic per entropy and moves within the configured band", () => {
    const a = driftUserLocation(MOCK_USER_LOCATION, 7);
    const b = driftUserLocation(MOCK_USER_LOCATION, 7);
    expect(a).toEqual(b);
    expect(a.meters).toBeGreaterThanOrEqual(USER_DRIFT_MIN_METERS);
    expect(a.meters).toBeLessThanOrEqual(USER_DRIFT_MAX_METERS);
    // A ≥50 m walk always changes the 6-decimal point.
    expect(a.location).not.toEqual(MOCK_USER_LOCATION);
    expect(haversineKm(MOCK_USER_LOCATION, a.location) * 1000).toBeLessThanOrEqual(USER_DRIFT_MAX_METERS + 5);
  });

  it("keeps every step inside the Whitefield bounding box", () => {
    let point: GeoPoint = { lat: USER_DRIFT_BOUNDS.maxLat, lng: USER_DRIFT_BOUNDS.maxLng };
    for (let i = 0; i < 300; i++) {
      point = driftUserLocation(point, i).location;
      expect(point.lat).toBeGreaterThanOrEqual(USER_DRIFT_BOUNDS.minLat);
      expect(point.lat).toBeLessThanOrEqual(USER_DRIFT_BOUNDS.maxLat);
      expect(point.lng).toBeGreaterThanOrEqual(USER_DRIFT_BOUNDS.minLng);
      expect(point.lng).toBeLessThanOrEqual(USER_DRIFT_BOUNDS.maxLng);
      expect(Number.isInteger(point.lat * 1e6)).toBe(true);
    }
  });

  it("wanders rather than marching in one direction", () => {
    let point = MOCK_USER_LOCATION;
    let north = 0;
    for (let i = 0; i < 100; i++) {
      const next = driftUserLocation(point, i).location;
      if (next.lat > point.lat) north++;
      point = next;
    }
    expect(north).toBeGreaterThan(20);
    expect(north).toBeLessThan(80);
  });
});
