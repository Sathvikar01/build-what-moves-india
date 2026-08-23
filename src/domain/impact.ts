import type { DemoState } from "./types";

export interface ImpactSummary {
  litresCollected: number;
  reportsResolved: number;
  reportsPending: number;
  stopsCompleted: number;
  stopsTotal: number;
  avgPickupLatencyMinutes: number | null;
  confirmedByCitizens: number;
}

// "Today in Mahadevapura" summary derived from the demo state. Latency is
// derived from completed stop ETAs (labelled synthetic, seed 4242).
export function impactSummary(state: DemoState): ImpactSummary {
  const stops = state.route.routes.flatMap(r => r.stops);
  const completed = stops.filter(s => s.status === "collected");
  const litresCollected = Math.round(completed.reduce((sum, s) => sum + s.volumeLitres, 0));
  const confirmed = state.reports.filter(r => r.status === "confirmed").length;
  const reopenedOrOpen = state.reports.filter(r => !["confirmed"].includes(r.status)).length;
  const latency = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + s.etaMinutes, 0) / completed.length)
    : null;
  return {
    litresCollected,
    reportsResolved: confirmed,
    reportsPending: reopenedOrOpen,
    stopsCompleted: completed.length,
    stopsTotal: stops.length,
    avgPickupLatencyMinutes: latency,
    confirmedByCitizens: state.proofs.filter(p => p.status === "accepted").length,
  };
}
