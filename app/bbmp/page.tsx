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

  if(!ready) return <div className="page-wrap"><p>Loading…</p></div>;

  return <div className="ops-desk">
    <aside className="ops-rail">
      <div className="ops-rail-brand"><strong>BBMP control room</strong><span>{copy.cursor} {state.events.at(-1)?.cursor}</span></div>
      <nav>
      {tabs.map(id=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{copy.tabs[id]}</button>)}
      </nav>
      <div className="ops-rail-foot"><small>{copy.seed} {state.seed}</small></div>
    </aside>
    <section className="ops-main">
      <p className="eyebrow" aria-live="polite">{state.lastAction}</p>

      {tab==="overview"&&<section className="page-wrap">
        <div className="section-heading"><h2 className="display-2">Live operations</h2></div>
        <div className="panel">
          <ul className="stop-list">
            <li>{copy.kpis.open}: <strong>{open}</strong> ({urgent} {copy.kpis.urgent})</li>
            <li>{copy.kpis.demand}: <strong>{state.signals.filter(s=>s.status!=="collected").length}</strong> {copy.kpis.waiting}</li>
            <li>{copy.kpis.vehicles}: <strong>{state.vehicles.filter(v=>v.status==="en_route"||v.status==="collecting").length}</strong> {copy.kpis.ofTotal}</li>
            <li>{copy.kpis.bins}: <strong>{full}</strong> {copy.kpis.threshold}</li>
            <li>{state.bins.filter(b=>b.fillPercent>=100).length} bins overflowed</li>
          </ul>
        </div>
        <div className="panel">
          <h2>Recent activity</h2>
          {state.events.length===0&&<div className="empty-state">No events yet.</div>}
          <ol className="stop-list">
            {state.events.slice(-8).reverse().map(event=>(
              <li key={event.id}><strong>{event.message}</strong> · {new Date(event.occurredAt).toLocaleTimeString("en-IN")}</li>
            ))}
          </ol>
        </div>
      </section>}

      {tab==="priority"&&<section className="page-wrap">
        <div className="section-heading"><h2 className="display-2">{copy.queueTitle}</h2></div>
        {ranked.length===0
          ? <div className="empty-state">{copy.queueTitle}: 0 — every report has been citizen-confirmed.</div>
          : <ol className="stop-list">
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
        {selected&&<div className="panel"><PriorityAudit result={selected.priority}/></div>}
      </section>}

      {tab==="routes"&&<section className="page-wrap">
        <div className="section-heading"><h2 className="display-2">Adaptive route revision</h2><p>Specialist colonies search the feasible stop set. Active weights adapt to current urgency.</p></div>
        <div style={{display:"flex",gap:"var(--space-2)",marginBottom:"var(--space-5)"}}>
          <button className="landing-button landing-button-primary" data-testid="route-reoptimize" disabled={busy} onClick={()=>reoptimize("manual_control_room")}>Recalculate</button>
          <button className="landing-button landing-button-secondary" data-testid="route-publish" disabled={busy} onClick={publishRoute}>Publish route</button>
        </div>
        <div className="panel">
          <ul className="stop-list">
            <li>Plan: v{state.route.version} · {state.route.status}</li>
            <li>Distance: <strong>{state.route.totalDistanceKm} km</strong></li>
            <li>Road trip: <strong>{Math.round(state.route.roadDistanceKm)} km</strong> on {state.route.roadGeometrySource==="osm_overpass"?"real OSM streets":"the labelled street grid"}</li>
            <li>Duration: {state.route.totalMinutes} min</li>
            <li>Unassigned: {state.route.unassigned.length}</li>
          </ul>
        </div>
        <div className="panel">
          <h2>What the optimizer is listening to</h2>
          <ul className="stop-list">
            {Object.entries(state.route.weights).map(([key,value])=>
              <li key={key}>{key.replace(/([A-Z])/g," $1")}: {Math.round(value*100)}%</li>)}
          </ul>
        </div>
        {state.route.routes.filter(route=>route.stops.length>0).map(route=>(
          <div key={route.vehicleId} className="panel">
            <h2>{state.vehicles.find(v=>v.id===route.vehicleId)?.label??route.vehicleId}</h2>
            <ol className="stop-list">
              {route.stops.map(stop=>(
                <li key={stop.id}>
                  <span>{stop.sequence}</span>
                  <div>
                    <strong>{stop.label}</strong> · {stop.locality} · ETA {stop.etaMinutes} min · {stop.volumeLitres.toFixed(0)} L · {stop.status.replaceAll("_"," ")}
                    <p className="muted">{stop.explanation}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {state.route.unassigned.length>0&&<div className="alert" role="alert"><strong>Unassigned work</strong><p>{state.route.unassigned.map(x=>`${x.id}: ${x.reason}`).join(" · ")}</p></div>}
      </section>}

      {tab==="bins"&&<section className="page-wrap">
        <div className="section-heading"><h2 className="display-2">Smart bin monitor</h2></div>
        <div className="panel">
          <ol className="stop-list">
            {state.bins.map(bin=>(
              <li key={bin.id}>
                <strong>{bin.label}</strong> · {bin.locality} · {bin.fillPercent}% · {bin.status}
              </li>
            ))}
          </ol>
        </div>
      </section>}

      {tab==="placement"&&<section className="page-wrap">
        <div className="section-heading"><h2 className="display-2">Placement recommendations</h2></div>
        {state.recommendations.length===0&&<div className="empty-state">No recommendations yet.</div>}
        {state.recommendations.map(rec=>(
          <div key={rec.rank} className="panel" style={{marginBottom:"var(--space-4)"}}>
            <h2>{rec.label}</h2>
            <p className="muted">Candidate #{rec.rank} · {rec.reasons.join(" · ")}</p>
            {rec.requiresFieldValidation&&<div className="alert" role="alert"><strong>Field validation required</strong><p>{rec.warnings.join(" ")}</p></div>}
            <table>
              <caption>Complete placement score factor breakdown</caption>
              <thead><tr><th>Factor</th><th>Raw</th><th>Normalized</th><th>Weight</th><th>Contribution</th><th>Source</th></tr></thead>
              <tbody>{rec.features.map(f=><tr key={f.key}><th scope="row">{f.label}</th><td>{f.raw??"Unknown"}</td><td>{f.value.toFixed(2)}</td><td>{Math.round(f.weight*100)}%</td><td>{f.contribution.toFixed(2)}</td><td>{f.source.replaceAll("_"," ")}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </section>}
    </section>
  </div>;
}
