"use client";

import { useState } from "react";
import { PriorityAudit } from "../../src/components/priority-audit";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { uiCopy } from "../../src/data/copy";
import { EmptyState } from "../../src/components/ui-bits";

type Tab="overview"|"priority"|"routes"|"bins"|"placement";

export default function BbmpPage(){
  const {ready}=useRequireUser();
  const {state,locale,selectReport,reoptimize,publishRoute,busy}=useDemo(); const copy=uiCopy[locale].bbmp;
  const [tab,setTab]=useState<Tab>("overview");

  const ranked=[...state.reports].filter(r=>r.status!=="confirmed").sort((a,b)=>b.priority.audit.effectiveScore-a.priority.audit.effectiveScore);
  const selected=state.reports.find(r=>r.id===state.selectedReportId)??ranked[0];
  const open=ranked.length, urgent=ranked.filter(r=>r.priority.audit.effectiveScore>=75).length, full=state.bins.filter(b=>b.fillPercent>=80).length;
  const tabs:Tab[]=["overview","priority","routes","bins","placement"];

  if(!ready) return <div className="page"><p>Loading…</p></div>;

  return <div>
    <nav>
      {tabs.map(id=><button key={id} onClick={()=>setTab(id)}>{copy.tabs[id]}</button>)}
    </nav>
    <p aria-live="polite">{state.lastAction} · {copy.cursor} {state.events.at(-1)?.cursor} · {copy.seed} {state.seed}</p>

    {tab==="overview"&&<>
      <section>
        <h2>Live operations</h2>
        <ul>
          <li>{copy.kpis.open}: {open} ({urgent} {copy.kpis.urgent})</li>
          <li>{copy.kpis.demand}: {state.signals.filter(s=>s.status!=="collected").length} {copy.kpis.waiting}</li>
          <li>{copy.kpis.vehicles}: {state.vehicles.filter(v=>v.status==="en_route"||v.status==="collecting").length} {copy.kpis.ofTotal}</li>
          <li>{copy.kpis.bins}: {full} {copy.kpis.threshold}</li>
          <li>{state.bins.filter(b=>b.fillPercent>=100).length} bins overflowed</li>
        </ul>
      </section>
      <section>
        <h2>{copy.mapTitle}</h2>
        <p>See the map tabs on the citizen/collector consoles; bin fill and report markers update live.</p>
      </section>
      <section>
        <h2>Recent activity</h2>
        {state.events.length===0&&<div role="status">No events yet.</div>}
        <ol>
          {state.events.slice(-8).reverse().map(event=>(
            <li key={event.id}><strong>{event.message}</strong> · {new Date(event.occurredAt).toLocaleTimeString("en-IN")}</li>
          ))}
        </ol>
      </section>
    </>}

    {tab==="priority"&&<section>
      <aside>
        <h2>{copy.queueTitle}</h2>
        {ranked.length===0
          ? <EmptyState>{copy.queueTitle}: 0 — every report has been citizen-confirmed.</EmptyState>
          : <ol>
              {ranked.map((report,index)=>(
                <li key={report.id}>
                  <button onClick={()=>selectReport(report.id)}>
                    <span>#{index+1}</span>
                    <strong>{report.title}</strong>
                    <span>{report.locality} · {report.status} · {report.priority.audit.effectiveScore.toFixed(1)}</span>
                  </button>
                </li>
              ))}
            </ol>}
      </aside>
      {selected&&<PriorityAudit result={selected.priority}/>}
    </section>}

    {tab==="routes"&&<section>
      <div>
        <h1>Adaptive route revision</h1>
        <p>Specialist colonies search the feasible stop set. Active weights adapt to current urgency and every stop preserves its signal trail.</p>
        <button data-testid="route-reoptimize" disabled={busy} onClick={()=>reoptimize("manual_control_room")}>Recalculate</button>
        <button data-testid="route-publish" disabled={busy} onClick={publishRoute}>Publish route</button>
      </div>
      <ul>
        <li>Plan: v{state.route.version} · {state.route.status}</li>
        <li>Distance: {state.route.totalDistanceKm} km</li>
        <li>Road trip: {Math.round(state.route.roadDistanceKm)} km on {state.route.roadGeometrySource==="osm_overpass"?"real OSM streets":"the labelled street grid"}</li>
        <li>Duration: {state.route.totalMinutes} min</li>
        <li>Unassigned: {state.route.unassigned.length}</li>
      </ul>
      <section>
        <h2>What the optimizer is listening to</h2>
        <ul>
          {Object.entries(state.route.weights).map(([key,value])=>
            <li key={key}>{key.replace(/([A-Z])/g," $1")}: {Math.round(value*100)}%</li>)}
        </ul>
      </section>
      {state.route.routes.filter(route=>route.stops.length>0).map(route=>(
        <section key={route.vehicleId}>
          <h2>{state.vehicles.find(v=>v.id===route.vehicleId)?.label??route.vehicleId}</h2>
          <ol>
            {route.stops.map(stop=>(
              <li key={stop.id}>
                <span>{stop.sequence}</span>
                <div>
                  <strong>{stop.label}</strong> · {stop.locality} · ETA {stop.etaMinutes} min · {stop.volumeLitres.toFixed(0)} L · {stop.status.replaceAll("_"," ")}
                  <p>{stop.explanation}</p>
                  <p>{stop.contributions.map(c=>`${c.contribution} ${c.label}`).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {state.route.unassigned.length>0&&<div role="alert"><strong>Unassigned work</strong><p>{state.route.unassigned.map(x=>`${x.id}: ${x.reason}`).join(" · ")}</p></div>}
    </section>}

    {tab==="bins"&&<section>
      <h1>Smart-bin status</h1>
      <table>
        <caption>Ten demo smart bins with deterministic fill telemetry</caption>
        <thead><tr><th>Bin</th><th>Locality</th><th>Fill</th><th>Status</th><th>Streams</th><th>Freshness</th></tr></thead>
        <tbody>{state.bins.map(bin=>(
          <tr key={bin.id}><th scope="row">{bin.label}</th><td>{bin.locality}</td><td>{bin.fillPercent}%</td><td>{bin.status}</td><td>{bin.accepted.join(", ")}</td><td>{new Date(bin.lastUpdatedAt).toLocaleTimeString("en-IN")}</td></tr>
        ))}</tbody>
      </table>
    </section>}

    {tab==="placement"&&<PlacementLab/>}
  </div>;
}

function PlacementLab(){
  const {state}=useDemo();
  const [selectedId,setSelectedId]=useState(state.recommendations[0]?.id);
  const rec=state.recommendations.find(r=>r.id===selectedId)??state.recommendations[0];

  return <section>
    <h1>Bin placement lab</h1>
    <ol>
      {state.recommendations.map(r=>(
        <li key={r.id}>
          <button onClick={()=>setSelectedId(r.id)}>
            <strong>#{r.rank} {r.label}</strong>
            <span>{r.locality} · {r.score.toFixed(1)}</span>
          </button>
        </li>
      ))}
    </ol>
    {rec&&<section>
      <h2>{rec.label}</h2>
      <p>Candidate #{rec.rank}</p>
      <p>{rec.reasons.join(" · ")}</p>
      {rec.requiresFieldValidation&&<div role="alert"><strong>Field validation required</strong><p>{rec.warnings.join(" ")}</p></div>}
      <table>
        <caption>Complete placement score factor breakdown</caption>
        <thead><tr><th>Factor</th><th>Raw</th><th>Normalized</th><th>Weight</th><th>Contribution</th><th>Source</th></tr></thead>
        <tbody>{rec.features.map(f=><tr key={f.key}><th scope="row">{f.label}</th><td>{f.raw??"Unknown"}</td><td>{f.value.toFixed(2)}</td><td>{Math.round(f.weight*100)}%</td><td>{f.contribution.toFixed(2)}</td><td>{f.source.replaceAll("_"," ")}</td></tr>)}</tbody>
      </table>
    </section>}
  </section>;
}
