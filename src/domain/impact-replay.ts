export interface ReplayJob {
  id: string;
  locality: string;
  waitingMinutes: number;
  serviceMinutes: number;
  distanceKm: number;
  location: { x: number; y: number };
  urgency: number;
  fillPercent: number;
  fillRatePerMinute: number;
}
export interface ReplayScenario { jobs: ReplayJob[]; shiftMinutes: number; maxStops: number }
export interface ReplayOutcome {
  missedPickups: number;
  overflowEvents: number;
  averageWaitMinutes: number;
  longestNeglected: { locality: string; minutes: number };
  fairnessGapMinutes: number;
  routeDistanceKm: number;
  fuelLitres: number;
  co2Kg: number;
}
export interface ReplayResult {
  seed: number;
  baseline: ReplayOutcome;
  adaptive: ReplayOutcome;
  method: { computeTimeMs: number; fallbackUsed: boolean; label: string; distanceModel: string; overflowModel: string };
}

export const DEFAULT_REPLAY_SCENARIO: ReplayScenario = {
  shiftMinutes: 150,
  maxStops: 6,
  jobs: [
    { id: "j1", locality: "Hoodi", waitingMinutes: 45, serviceMinutes: 12, distanceKm: 3.8, location:{x:2.7,y:2.7}, urgency: 0.38, fillPercent: 62, fillRatePerMinute:.01 },
    { id: "j2", locality: "Whitefield", waitingMinutes: 55, serviceMinutes: 14, distanceKm: 4.2, location:{x:4.0,y:1.3}, urgency: 0.44, fillPercent: 68, fillRatePerMinute:.01 },
    { id: "j3", locality: "Varthur", waitingMinutes: 205, serviceMinutes: 13, distanceKm: 5.1, location:{x:4.8,y:-1.7}, urgency: 0.91, fillPercent: 96, fillRatePerMinute:.015 },
    { id: "j4", locality: "Kadugodi", waitingMinutes: 170, serviceMinutes: 11, distanceKm: 4.7, location:{x:3.4,y:3.2}, urgency: 0.84, fillPercent: 93, fillRatePerMinute:.012 },
    { id: "j5", locality: "Marathahalli", waitingMinutes: 80, serviceMinutes: 16, distanceKm: 6.2, location:{x:-3.8,y:-4.9}, urgency: 0.57, fillPercent: 74, fillRatePerMinute:.01 },
    { id: "j6", locality: "Brookefield", waitingMinutes: 130, serviceMinutes: 12, distanceKm: 3.4, location:{x:1.0,y:-3.2}, urgency: 0.72, fillPercent: 88, fillRatePerMinute:.015 },
    { id: "j7", locality: "Bellandur", waitingMinutes: 240, serviceMinutes: 15, distanceKm: 5.8, location:{x:-2.6,y:-5.2}, urgency: 0.95, fillPercent: 98, fillRatePerMinute:.03 },
    { id: "j8", locality: "Mahadevapura", waitingMinutes: 100, serviceMinutes: 13, distanceKm: 3.1, location:{x:-2.8,y:.9}, urgency: 0.66, fillPercent: 81, fillRatePerMinute:.01 },
  ],
};

function seededJitter(seed: number, id: string) {
  let value = seed;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return (value % 1000) / 1_000_000;
}

function simulate(scenario: ReplayScenario, ordered: ReplayJob[]): ReplayOutcome {
  let elapsed = 0;
  let distance = 0;
  let current = { x: 0, y: 0 };
  const completion = new Map<string, number>();
  for (const job of ordered.slice(0, scenario.maxStops)) {
    const legDistance = Math.hypot(job.location.x-current.x,job.location.y-current.y);
    const travelMinutes = legDistance * 2.2;
    const returnMinutes=Math.hypot(job.location.x,job.location.y)*2.2;
    if (elapsed + travelMinutes + job.serviceMinutes + returnMinutes > scenario.shiftMinutes) continue;
    elapsed += travelMinutes + job.serviceMinutes;
    distance += legDistance;
    current=job.location;
    completion.set(job.id, job.waitingMinutes + elapsed);
  }
  distance+=Math.hypot(current.x,current.y);
  const waits = scenario.jobs.map((job) => completion.get(job.id) ?? job.waitingMinutes + scenario.shiftMinutes);
  const longestIndex = waits.indexOf(Math.max(...waits));
  const missed = scenario.jobs.filter((job) => !completion.has(job.id));
  const overflowEvents=scenario.jobs.filter(job=>job.fillPercent<100&&job.fillPercent+job.fillRatePerMinute*(completion.has(job.id)?Math.max(0,(completion.get(job.id)??job.waitingMinutes)-job.waitingMinutes):scenario.shiftMinutes)>=100).length;
  const routeDistanceKm=Number(distance.toFixed(1));
  const fuelLitres = Number((routeDistanceKm * 0.12).toFixed(3));
  return {
    missedPickups: missed.length,
    overflowEvents,
    averageWaitMinutes: Number((waits.reduce((sum, wait) => sum + wait, 0) / waits.length).toFixed(1)),
    longestNeglected: { locality: scenario.jobs[longestIndex].locality, minutes: Number(waits[longestIndex].toFixed(1)) },
    fairnessGapMinutes: Number((Math.max(...waits) - Math.min(...waits)).toFixed(1)),
    routeDistanceKm,
    fuelLitres,
    co2Kg: Number((fuelLitres * 2.68).toFixed(5)),
  };
}

export function runImpactReplay(scenario: ReplayScenario, seed = 4242): ReplayResult {
  const started = performance.now();
  const baselineOrder = [...scenario.jobs];
  const adaptiveOrder = [...scenario.jobs].sort((a, b) => {
    const scoreA = a.urgency * 0.55 + Math.min(1, a.waitingMinutes / 240) * 0.35 + Math.min(1, a.fillPercent / 100) * 0.1 + seededJitter(seed, a.id);
    const scoreB = b.urgency * 0.55 + Math.min(1, b.waitingMinutes / 240) * 0.35 + Math.min(1, b.fillPercent / 100) * 0.1 + seededJitter(seed, b.id);
    return scoreB - scoreA;
  });
  return {
    seed,
    baseline: simulate(scenario, baselineOrder),
    adaptive: simulate(scenario, adaptiveOrder),
    method: { computeTimeMs: Number((performance.now() - started).toFixed(2)), fallbackUsed: false, label: "Fixed manifest vs urgency + wait + fill replay", distanceModel:"Euclidean depot-to-stop legs plus return-to-depot", overflowModel:"Initial fill plus per-minute growth crossing the 100% threshold before service" },
  };
}
