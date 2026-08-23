import type { PriorityResult } from "./priority";

export type DemoRole = "citizen" | "bbmp" | "collector";
export type GeoPoint = { lat: number; lng: number };
export type SourceKind = "official" | "openstreetmap" | "derived" | "synthetic_demo";
export type SourceMeta = { kind: SourceKind; label: string; isSynthetic: boolean; license?: string; url?: string };

export interface Vehicle {
  id: string; label: string; type: "auto_tipper" | "compactor" | "mini_truck";
  location: GeoPoint; heading: number; status: "available" | "en_route" | "collecting" | "offline";
  capacityLitres: number; loadLitres: number; lastSeenAt: string; routeId?: string; source: SourceMeta;
}

export interface SmartBin {
  id: string; label: string; locality: string; location: GeoPoint; capacityLitres: number;
  fillPercent: number; status: "available" | "filling" | "full" | "offline";
  accepted: string[]; lastUpdatedAt: string; source: SourceMeta;
  fillRatePerHour?: number; // % per simulated hour households add to this bin
  overflowedAt?: string;    // set when the bin hit 100% and raised an overflow alert
}

export interface WasteSignal {
  id: string; type: "have_waste" | "waste_outside"; category: string; amountBand: "small" | "medium" | "large";
  locality: string; location: GeoPoint; status: "received" | "queued" | "assigned" | "en_route" | "collected" | "cancelled";
  createdAt: string; etaMinutes?: number; routeId?: string; source: SourceMeta;
}

export interface GarbageReport {
  id: string; title: string; category: string; locality: string; location: GeoPoint; status: "submitted" | "acknowledged" | "assigned" | "en_route" | "cleaned" | "confirmed" | "reopened";
  createdAt: string; photoUrl?: string; note?: string; priority: PriorityResult; source: SourceMeta;
}

export type RouteSignalName = "smartBinFill" | "citizenDemand" | "reportSeverity" | "urbanDensity" | "travelEfficiency";
export interface RouteContribution { signal: RouteSignalName; label: string; value: number; weight: number; contribution: number }
export interface RouteStop {
  id: string; workId: string; kind: "bin" | "signal" | "report"; label: string; locality: string; location: GeoPoint;
  sequence: number; etaMinutes: number; serviceMinutes: number; volumeLitres: number;
  status: "pending" | "en_route" | "arrived" | "collected" | "blocked" | "skipped";
  priorityScore: number; contributions: RouteContribution[]; explanation: string; distanceKm: number; locked: boolean;
  distanceSource: "haversine_road_estimate" | "precomputed_osrm"; reasonCodes: string[];
  capacityImpact: { volumeLitres: number; projectedLoadLitres: number; utilizationPercent: number };
  priorityFactors: { key: string; contribution: number; explanation: string }[];
}
export interface VehicleRoute { vehicleId: string; stops: RouteStop[]; totalDistanceKm: number; totalMinutes: number; projectedLoadLitres: number }
export interface AdaptiveWeights { smartBinFill: number; citizenDemand: number; reportSeverity: number; urbanDensity: number; travelEfficiency: number }
export interface RoutePlan {
  id: string; version: number; status: "proposed" | "published" | "active" | "completed";
  algorithm: "multi-signal-aco-inspired-v1"; seed: number; trigger: string; generatedAt: string;
  weights: AdaptiveWeights; routes: VehicleRoute[]; unassigned: { id: string; reason: string }[];
  totalDistanceKm: number; totalMinutes: number; fallbackUsed: boolean; distanceMode: "haversine_road_estimate" | "precomputed_osrm";
  // A* street-grid geometry for the ACO-chosen stop sequences: the blue line
  // the maps animate trucks along. Each path is a full trip — it starts at the
  // vehicle's current location, threads the ACO-ordered stops, and returns to
  // the origin. `roadPath` follows the first route with stops.
  roadPath: GeoPoint[]; roadDistanceKm: number;
  roadPathByVehicle: { vehicleId: string; path: GeoPoint[]; distanceKm: number; stopDistancesKm: number[]; stopPoints: GeoPoint[] }[];
  // Which router produced the geometry: real OSM streets via Overpass, or the
  // labelled synthetic street grid (fallback when Overpass is unreachable).
  roadGeometrySource: "osm_overpass" | "synthetic_grid";
}

export interface PlacementFeature { key: string; label: string; raw: string | number | null; value: number; weight: number; contribution: number; source: SourceKind }
export interface PlacementRecommendation {
  id: string; rank: number; label: string; locality: string; location: GeoPoint; score: number; confidence: number;
  features: PlacementFeature[]; reasons: string[]; warnings: string[]; requiresFieldValidation: boolean;
}

export interface CleanupProof { id: string; reportId: string; stopId: string; capturedAt: string; status: "pending_sync" | "submitted" | "accepted" | "rejected"; note: string; beforeAssetId?: string; afterAssetId?: string; gps?: GeoPoint; gpsMode?: "captured"|"demo"; checklist?: Record<string,boolean>; source: SourceMeta }

// A resident/household dumping waste into a bin. The day-cycle engine creates
// these so the fill jump is visible on the map (pulsing person marker) and in
// the audit feed, on top of the continuous per-bin trickle growth.
export interface WasteDump { id: string; binId: string; binLabel: string; locality: string; location: GeoPoint; litres: number; at: string }
export interface DemoEvent { id: string; cursor: number; type: string; entityId: string; version: number; occurredAt: string; message: string }

export interface DayCycle {
  day: number;
  phase: "en_route" | "servicing" | "at_depot";
  progressKm: number;             // live progress along the day's road trip
  nextStopIndex: number;          // which stop (in trip order) is next
  dwellUntilWallMs: number;       // wall clock; servicing pause while a bin is emptied
  dayStartedAt: string;           // sim time the shift began
  litresCollectedToday: number;
  binsServicedToday: number;
  binsServicedTotal: number;
  nextDepartureInMinutes: number; // countdown shown while at the depot
}

export interface DemoState {
  seed: number; now: string; tick: number; vehicles: Vehicle[]; bins: SmartBin[]; signals: WasteSignal[];
  reports: GarbageReport[]; route: RoutePlan; recommendations: PlacementRecommendation[]; proofs: CleanupProof[];
  dumps: WasteDump[];
  events: DemoEvent[]; selectedReportId?: string; lastAction: string; dayCycle: DayCycle;
}
