import { calculatePriority } from "./priority";
import type { DemoEvent, DemoState, GarbageReport, GeoPoint, SmartBin, Vehicle, WasteDump } from "./types";

// Single source of truth for the demo simulation rules shared by the client
// provider and the server store. Previously these rules were duplicated (and
// had already diverged) in demo-provider.tsx and server/store.ts.

export const BIN_FULL_THRESHOLD = 94;
export const BIN_FILLING_THRESHOLD = 70;

export function binStatusFor(fillPercent: number): SmartBin["status"] {
  if (fillPercent >= BIN_FULL_THRESHOLD) return "full";
  if (fillPercent >= BIN_FILLING_THRESHOLD) return "filling";
  return "available";
}

export function advanceBins(bins: SmartBin[], tickIndex: number, now: string): SmartBin[] {
  return bins.map((bin, index) => {
    if (bin.status === "offline") return bin;
    // Whole numbers only — the +1 trickle keeps fills on integers.
    const fillPercent = Math.min(100, Math.round(bin.fillPercent + (index % 3 === tickIndex % 3 ? 1 : 0)));
    return { ...bin, fillPercent, lastUpdatedAt: now, status: binStatusFor(fillPercent) };
  });
}

// ─── Household dump agents ───────────────────────────────────────────────────
// A resident walks up to a bin and drops a bag of waste: an instant, visible
// fill jump on top of the continuous trickle growth. `entropy` varies per
// engine call so consecutive dumps pick different bins; tests pass a constant
// for reproducibility. Mutates the bin in place and keeps the last 12 dumps.
export const DUMP_MIN_PERCENT = 4;
export const DUMP_MAX_PERCENT = 8;
export const DUMP_HISTORY_LIMIT = 12;

export function householdDump(state: DemoState, entropy: number): WasteDump | null {
  const history = state.dumps ?? [];
  state.dumps = history;
  const eligible = state.bins.filter(bin => bin.status !== "offline" && bin.fillPercent < 100);
  if (eligible.length === 0) return null;

  let s = ((state.seed >>> 0) ^ Math.imul(entropy + 1, 2654435761)) >>> 0;
  const rand = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Busier streets (higher fill rate) attract more dumping.
  const weights = eligible.map(bin => bin.fillRatePerHour ?? 4);
  let pick = rand() * weights.reduce((sum, weight) => sum + weight, 0);
  let bin = eligible[eligible.length - 1];
  for (let index = 0; index < eligible.length; index++) {
    pick -= weights[index];
    if (pick <= 0) { bin = eligible[index]; break; }
  }

  // Whole-number jump: a bag of waste is a clean 4-8% step, never a float.
  const percent = Math.round(DUMP_MIN_PERCENT + rand() * (DUMP_MAX_PERCENT - DUMP_MIN_PERCENT));
  const litres = Math.round(bin.capacityLitres * percent / 100);
  bin.fillPercent = Math.min(100, bin.fillPercent + percent);
  bin.status = binStatusFor(bin.fillPercent);
  bin.lastUpdatedAt = state.now;

  const dump: WasteDump = {
    id: `dump-${entropy}-${bin.id}`,
    binId: bin.id,
    binLabel: bin.label,
    locality: bin.locality,
    location: { ...bin.location },
    litres,
    at: state.now,
  };
  state.dumps = [...history.slice(-(DUMP_HISTORY_LIMIT - 1)), dump];
  return dump;
}

// ─── Mock citizen live-location drift ────────────────────────────────────────
// The mock citizen wanders slowly around Whitefield so the "you" dot and the
// route's pickup stop stay live. Pure helper: given the current point and an
// entropy seed it returns the next point plus the distance walked, always
// inside a small bounding box of the pilot zone. Deterministic per entropy.
export const USER_DRIFT_INTERVAL_WALL_MS = 40000;
export const USER_DRIFT_MIN_METERS = 50;
export const USER_DRIFT_MAX_METERS = 140;
// ~600 m x ~900 m box around Hope Farm / Whitefield (inside the OSM bbox).
export const USER_DRIFT_BOUNDS = { minLat: 12.9680, maxLat: 12.9765, minLng: 77.7420, maxLng: 77.7510 } as const;

export function driftUserLocation(location: GeoPoint, entropy: number): { location: GeoPoint; meters: number } {
  let s = Math.imul(entropy + 1, 2654435761) >>> 0;
  const rand = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const angle = rand() * Math.PI * 2;
  const meters = Math.round(USER_DRIFT_MIN_METERS + rand() * (USER_DRIFT_MAX_METERS - USER_DRIFT_MIN_METERS));
  const dLat = (meters * Math.cos(angle)) / 111320;
  const dLng = (meters * Math.sin(angle)) / (111320 * Math.max(0.5, Math.cos((location.lat * Math.PI) / 180)));
  const next: GeoPoint = {
    lat: clampRound6(location.lat + dLat, USER_DRIFT_BOUNDS.minLat, USER_DRIFT_BOUNDS.maxLat),
    lng: clampRound6(location.lng + dLng, USER_DRIFT_BOUNDS.minLng, USER_DRIFT_BOUNDS.maxLng),
  };
  return { location: next, meters };
}

function clampRound6(value: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, value)) * 1e6) / 1e6;
}

export function advanceVehicles(vehicles: Vehicle[], state: DemoState, now: string): Vehicle[] {
  return vehicles.map((vehicle, index) => {
    if (vehicle.status === "offline") return vehicle;
    const route = state.route.routes.find(r => r.vehicleId === vehicle.id);
    const target = route?.stops.find(s => s.status !== "collected")?.location;
    const step = 0.13;
    return {
      ...vehicle,
      location: target
        ? { lat: vehicle.location.lat + (target.lat - vehicle.location.lat) * step, lng: vehicle.location.lng + (target.lng - vehicle.location.lng) * step }
        : vehicle.location,
      lastSeenAt: now,
      heading: (vehicle.heading + 7 + index) % 360,
    };
  });
}

let localEventSeq = 0;
export function nextLocalEventId() {
  return `evt-local-${++localEventSeq}`;
}

export function appendEvents(state: DemoState, entries: { type: string; entityId: string; message: string }[]): DemoEvent[] {
  const base = state.events.at(-1)?.cursor ?? 0;
  return [...state.events, ...entries.map((entry, index) => ({
    id: nextLocalEventId(),
    cursor: base + index + 1,
    type: entry.type,
    entityId: entry.entityId,
    version: 1,
    occurredAt: state.now,
    message: entry.message,
  }))];
}

// Field-observation defaults applied to citizen-submitted reports. Also used
// by src/data/demo.ts for seeded reports via explicit values.
export function citizenReportPriority(input: {
  reportId: string; observedAt: string; calculatedAt: string;
  hygieneRisk: "low" | "moderate" | "high" | "severe";
  obstruction: "none" | "partial" | "significant" | "traffic_lane";
}) {
  return calculatePriority({
    reportId: input.reportId,
    observedAt: input.observedAt,
    calculatedAt: input.calculatedAt,
    garbageAmountLitres: 320,
    affectedAreaSqM: 240,
    peopleAffected: 460,
    hygieneRisk: input.hygieneRisk,
    obstruction: input.obstruction,
    reportAgeHours: 0,
    populationDensityPerKm2: 21800,
    buildingDensityPerKm2: 6800,
    corroboratingReports: 1,
    nearbyBinFillFraction: 0.94,
    activeCitizenDemand24h: 5,
    verifiedSpecialWaste: "none",
    trafficLaneBlocked: input.obstruction === "traffic_lane",
  });
}

export function applyTick(state: DemoState, seconds: number): DemoState {
  const tick = state.tick + 1;
  const now = new Date(Date.parse(state.now) + seconds * 1000).toISOString();
  return {
    ...state,
    tick,
    now,
    vehicles: advanceVehicles(state.vehicles, state, now),
    bins: advanceBins(state.bins, tick, now),
    lastAction: `Live telemetry advanced ${seconds} seconds`,
  };
}

export function makeCitizenReport(input: {
  id: string; title: string; category: string; locality?: string;
  location: { lat: number; lng: number }; photoUrl?: string;
  hygiene: "low" | "moderate" | "high" | "severe";
  obstruction: "none" | "partial" | "significant" | "traffic_lane";
  now: string; source: GarbageReport["source"];
}): GarbageReport {
  const priority = citizenReportPriority({
    reportId: input.id,
    observedAt: input.now,
    calculatedAt: input.now,
    hygieneRisk: input.hygiene,
    obstruction: input.obstruction,
  });
  return {
    id: input.id,
    title: input.title || "Citizen garbage report",
    category: input.category,
    locality: input.locality ?? "Whitefield",
    location: input.location,
    photoUrl: input.photoUrl,
    status: "acknowledged",
    createdAt: input.now,
    priority,
    source: input.source,
  };
}
