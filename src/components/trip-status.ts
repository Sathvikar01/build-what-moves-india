import type { DemoState } from "../domain/types";

// Display projection of the server day-cycle engine for the map chip. All
// human-facing numbers are whole — no 1.7999-style floats on screen.
export const TRUCK_SPEED_KMH = 25;
export const DEMO_TIME_SCALE = 10;

export type TripStatus = {
  remainingKm: number;
  etaMinutes: number;
  totalKm: number;
  progressKm: number;
  nextStopKm: number | null; // distance along the path of the upcoming stop
  nextStopIndex: number | null; // index into the route stops of the upcoming stop
  nextStopLabel: string | null; // label of the stop being headed to / serviced
  etaToNextMinutes: number; // live minutes until the truck reaches that stop
  servicing: boolean; // true while the truck is halted emptying a stop
  label: string;
  sub: string;
};

export function tripStatusFor(state: DemoState): TripStatus | null {
  const lead = state.route.roadPathByVehicle[0];
  if (!lead || lead.distanceKm <= 0) return null;
  const dc = state.dayCycle;
  const routeStops = state.route.routes[0]?.stops ?? [];
  const totalKm = Math.round(lead.distanceKm);
  if (dc.phase === "at_depot") {
    const hours = Math.floor(dc.nextDepartureInMinutes / 60);
    const minutes = dc.nextDepartureInMinutes % 60;
    return {
      remainingKm: 0, etaMinutes: 0, totalKm, progressKm: lead.distanceKm, nextStopKm: null, nextStopIndex: null,
      nextStopLabel: null, etaToNextMinutes: 0, servicing: false,
      label: `Day ${dc.day} complete · at depot`,
      sub: `Next collection in ${hours}h ${minutes}m · overnight fast-forward · ${state.route.roadGeometrySource === "osm_overpass" ? "real OSM roads" : "demo street grid"}`,
    };
  }
  const progressKm = Math.min(dc.progressKm, lead.distanceKm);
  const remainingKm = Math.max(0, Math.round(lead.distanceKm - progressKm));
  const nextStopKm = lead.stopDistancesKm.find(distance => distance > progressKm + 0.05) ?? null;
  const legRemainingKm = nextStopKm === null ? lead.distanceKm - progressKm : Math.max(0, nextStopKm - progressKm);
  const servicing = dc.phase === "servicing";
  const activeIndex = Math.min(dc.nextStopIndex, Math.max(0, routeStops.length - 1));
  const nextStopLabel = routeStops[activeIndex]?.label ?? null;
  // Live ETA to the next stop from the exact leg distance left, plus the
  // service time already committed when the truck is mid-halt.
  const etaToNextMinutes = Math.round(legRemainingKm / TRUCK_SPEED_KMH * 60 + (servicing ? (routeStops[activeIndex]?.serviceMinutes ?? 0) : 0));
  const stopNumber = Math.min(dc.nextStopIndex + 1, routeStops.length || 1);
  return {
    remainingKm,
    etaMinutes: Math.max(0, Math.round((lead.distanceKm - progressKm) / TRUCK_SPEED_KMH * 60)),
    totalKm,
    progressKm,
    nextStopKm,
    nextStopIndex: dc.nextStopIndex,
    nextStopLabel,
    etaToNextMinutes,
    servicing,
    label: servicing
      ? `Day ${dc.day} · halting at stop ${stopNumber} · emptying`
      : `Day ${dc.day} · stop ${stopNumber} in ${Math.max(0, Math.round(legRemainingKm))} km`,
    sub: `${state.route.roadGeometrySource === "osm_overpass" ? "real OSM roads" : "demo street grid"} · ${TRUCK_SPEED_KMH} km/h · ×${DEMO_TIME_SCALE}`,
  };
}
