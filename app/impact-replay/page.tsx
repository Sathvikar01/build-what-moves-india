import { ArrowLeft, CheckCircle2, Clock3, Database, Gauge, Route, Scale, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { DEFAULT_REPLAY_SCENARIO, runImpactReplay, type ReplayOutcome } from "../../src/domain/impact-replay";

const result = runImpactReplay(DEFAULT_REPLAY_SCENARIO, 4242);
function metricRows(outcome: ReplayOutcome) { return [
  ["Missed pickups", String(outcome.missedPickups)], ["Overflow events", String(outcome.overflowEvents)],
  ["Average wait", `${outcome.averageWaitMinutes} min`], ["Longest neglected", `${outcome.longestNeglected.locality} · ${outcome.longestNeglected.minutes} min`],
  ["Fairness gap", `${outcome.fairnessGapMinutes} min`], ["Route distance", `${outcome.routeDistanceKm} km`],
  ["Fuel proxy", `${outcome.fuelLitres} L`], ["CO₂ proxy", `${outcome.co2Kg} kg`],
]; }
const baselineRows = metricRows(result.baseline); const adaptiveRows = metricRows(result.adaptive);

export default function ImpactReplayPage() { return <main className="replay-page">
  <header className="replay-header"><Link href="/"><ArrowLeft size={18}/>Back</Link><span className="demo-badge">Deterministic seed {result.seed}</span></header>
  <section className="replay-hero"><div><p className="eyebrow">Impact replay · not a field trial</p><h1>Same demand. Two routing decisions.</h1><p>A fixed manifest and an adaptive priority order run against the exact same seed-4242 jobs, shift and stop limit. These are computed scenario outcomes—not claimed real-world improvements. The adaptive choice avoids a modelled overflow and narrows the fairness gap here, but travels farther and misses the same number of stops.</p></div><div className="replay-verdict"><CheckCircle2/><strong>{result.adaptive.overflowEvents} adaptive overflows</strong><span>versus {result.baseline.overflowEvents} fixed · fairness gap {result.adaptive.fairnessGapMinutes} vs {result.baseline.fairnessGapMinutes} min</span></div></section>
  <section className="replay-method-strip" aria-label="Replay method"><span><Database/><strong>8 identical jobs</strong><small>same localities and demand</small></span><span><Clock3/><strong>{DEFAULT_REPLAY_SCENARIO.shiftMinutes} min shift</strong><small>{DEFAULT_REPLAY_SCENARIO.maxStops}-stop limit</small></span><span><Route/><strong>Fixed baseline</strong><small>manifest order</small></span><span><Scale/><strong>Adaptive order</strong><small>urgency + wait + fill</small></span></section>
  <section className="panel replay-table-panel"><div className="section-heading"><p className="eyebrow">Raw comparison</p><h2>No percentage theatre</h2></div><div className="table-scroll"><table className="data-table replay-table"><caption>Seed 4242 baseline and adaptive outcomes</caption><thead><tr><th>Measure</th><th>Fixed manifest</th><th>Adaptive route</th></tr></thead><tbody>{baselineRows.map((row,index)=><tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{adaptiveRows[index][1]}</td></tr>)}</tbody></table></div></section>
  <section className="replay-cards"><article><Gauge/><h2>Fairness is operational</h2><p>The replay counts the gap between the longest and shortest household wait. Old work cannot disappear behind a good average.</p></article><article><Truck/><h2>Environmental values are proxies</h2><p>{result.method.distanceModel}. Fuel uses 0.12 L/km and CO₂ uses 2.68 kg/L; none is measured telemetry.</p></article><article><ShieldCheck/><h2>Overflow and fallback stay visible</h2><p>{result.method.overflowModel}. Fallback: <strong>{result.method.fallbackUsed?"yes":"no"}</strong>. Compute: <strong>{result.method.computeTimeMs} ms</strong>.</p></article></section>
  <section className="replay-limit"><strong>What this proves</strong><p>The product can compare decisions reproducibly and expose trade-offs. It does not prove citywide savings; a field pilot must replace synthetic inputs and publish pre-registered outcome measures.</p><a href="/data-assumptions">Read all data assumptions →</a></section>
</main>; }
