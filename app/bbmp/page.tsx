"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, MapPinned, Play, RadioTower, RotateCcwSquare, Route } from "lucide-react";
import { AtlasShell } from "../../src/components/atlas-shell";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { PriorityAudit } from "../../src/components/priority-audit";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { uiCopy } from "../../src/data/copy";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { TRUCK_SPEED_KMH, tripStatusFor, type TripStatus } from "../../src/components/trip-status";
import { EmptyState, SkeletonBlock } from "../../src/components/ui-bits";

type Tab="overview"|"priority"|"routes"|"bins"|"placement";
const tabIds: Tab[]=["overview","priority","routes","bins","placement"];

export default function BbmpPage(){
 const {ready}=useRequireUser();
 const {state,locale,selectReport}=useDemo(); const copy=uiCopy[locale].bbmp;
 const [tab,setTab]=useState<Tab>("overview");
 const tabNav=useRef<HTMLElement>(null);

 const ranked=[...state.reports].filter(r=>r.status!=="confirmed").sort((a,b)=>b.priority.audit.effectiveScore-a.priority.audit.effectiveScore);
 const selected=state.reports.find(r=>r.id===state.selectedReportId)??ranked[0];
 const markers=useMemo<MapMarker[]>(()=>[
   ...state.vehicles.map(v=>({id:v.id,label:v.label,location:v.location,kind:"vehicle" as const,detail:v.status.replaceAll("_"," ")})),
   ...state.bins.map(b=>({id:b.id,label:b.label,location:b.location,kind:"bin" as const,detail:`${Math.round(b.fillPercent)}% full`,overflow:b.fillPercent>=100})),
   ...state.reports.filter(r=>r.status!=="confirmed").map(r=>({id:r.id,label:r.title,location:r.location,kind:"report" as const,detail:`${r.priority.audit.effectiveScore.toFixed(1)} · ${r.priority.audit.effectiveBand}`})),
 ],[state]);
 const open=ranked.length, urgent=ranked.filter(r=>r.priority.audit.effectiveScore>=75).length, full=state.bins.filter(b=>b.fillPercent>=80).length;
 const tabs=useMemo(()=>tabIds.map(id=>({id,label:copy.tabs[id]})),[copy]);

 function moveTab(delta:number){
   const currentIndex=tabs.findIndex(t=>t.id===tab);
   const nextTab=tabs[(currentIndex+delta+tabs.length)%tabs.length];
   setTab(nextTab.id);
   const buttons=tabNav.current?.querySelectorAll("button");
   (buttons?.[tabs.findIndex(t=>t.id===nextTab.id)] as HTMLButtonElement|undefined)?.focus();
 }

 if(!ready) return <AtlasShell role="bbmp"><div className="page-wrap"><SkeletonBlock rows={3}/></div></AtlasShell>;

 // Ops desk: vertical section rail on the left, work column on the right.
 return <AtlasShell role="bbmp">
  <div className="ops-desk" lang={locale==="kn"?"kn":"en"}>
  <aside className="ops-rail">
    <div className="ops-rail-brand"><strong>{copy.navTitle}</strong><span>{copy.navSub}</span></div>
    <nav aria-label="Operations sections" role="tablist" ref={tabNav} onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();moveTab(1)}if(e.key==="ArrowLeft"){e.preventDefault();moveTab(-1)}}}>
      {tabs.map((item,index)=>(
        <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}>
          <i aria-hidden="true">{String(index+1).padStart(2,"0")}</i>{item.label}
        </button>
      ))}
    </nav>
    <div className="ops-rail-foot">
      <RadioTower size={16} aria-hidden="true"/>
      <div>
        <strong aria-live="polite">{state.lastAction}</strong>
        <small>{copy.cursor} {state.events.at(-1)?.cursor} · {copy.seed} {state.seed}</small>
      </div>
    </div>
  </aside>
  <div className="ops-main">
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab==="overview"&&<>
        <section className="stat-ticker" aria-label="Live operations summary">
          <TickerCell label={`${copy.day.day} ${state.dayCycle.day} · ${state.dayCycle.phase==="en_route"?copy.day.collecting:state.dayCycle.phase==="servicing"?copy.day.servicing:copy.day.depot}`} value={state.dayCycle.phase==="at_depot"?`${Math.floor(state.dayCycle.nextDepartureInMinutes/60)}h ${state.dayCycle.nextDepartureInMinutes%60}m`:`${state.dayCycle.binsServicedToday} ${copy.day.stopsToday}`}/>
          <TickerCell label={copy.day.litresToday} value={String(state.dayCycle.litresCollectedToday)}/>
          <TickerCell label={copy.day.totalServiced} value={String(state.dayCycle.binsServicedTotal)}/>
          <TickerCell label={copy.day.overnight} value={state.dayCycle.phase==="at_depot"?copy.day.overnight:`${state.bins.filter(b=>b.fillPercent>=80).length} bins ≥80%`}/>
          <TickerCell label={copy.kpis.open} value={String(open)} detail={`${urgent} ${copy.kpis.urgent}`} tone="red"/>
          <TickerCell label={copy.kpis.demand} value={String(state.signals.filter(s=>s.status!=="collected").length)} detail={copy.kpis.waiting} tone="teal"/>
          <TickerCell label={copy.kpis.vehicles} value={String(state.vehicles.filter(v=>v.status==="en_route"||v.status==="collecting").length)} detail={copy.kpis.ofTotal}/>
          <TickerCell label={copy.kpis.bins} value={String(full)} detail={copy.kpis.threshold} tone="amber"/>
        </section>
        <div className="ops-bench">
          <div className="docket-wrap">
            <PriorityQueue ranked={ranked.slice(0,3)} selectedId={selected?.id} onSelect={id=>{selectReport(id);setTab("priority")}}/>
            {ranked.length>3&&<button type="button" className="queue-more" onClick={()=>setTab("priority")}>Full queue · {ranked.length} open →</button>}
          </div>
          <article className="bench-map">
            <div className="bench-map-head">
              <h1 className="title">{copy.mapTitle}</h1>
              <span className="source-chip">{copy.geography}</span>
            </div>
            <BengaluruMap markers={markers} route={state.route.roadPath} vehiclePaths={state.route.roadPathByVehicle} geometrySource={state.route.roadGeometrySource} tripStatus={tripStatusFor(state)} userLocation={state.userLocation?.location??MOCK_USER_LOCATION} height={520}/>
          </article>
        </div>
      </>}
      {tab==="priority"&&<section className="priority-layout"><PriorityQueue ranked={ranked} selectedId={selected?.id} onSelect={selectReport}/>{selected&&<PriorityAudit result={selected.priority}/>}</section>}
      {tab==="routes"&&<RoutesLab/>}
      {tab==="bins"&&<BinsTable/>}
      {tab==="placement"&&<PlacementLab/>}
    </div>
  </div>
  </div>
 </AtlasShell>;
}

function TickerCell({label,value,detail,tone}:{label:string;value:string;detail?:string;tone?:"red"|"amber"|"teal"}){
  return <div className={tone?`ticker-cell tone-${tone}`:"ticker-cell"}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail&&<small>{detail}</small>}
  </div>;
}

function PriorityQueue({ranked,selectedId,onSelect}:{ranked:ReturnType<typeof useDemo>["state"]["reports"];selectedId?:string;onSelect:(id:string)=>void}){
  const {locale}=useDemo();const copy=uiCopy[locale].bbmp;
  return <aside className="queue-docket">
    <div className="section-heading split-heading"><div><h2 className="title">{copy.queueTitle}</h2><p className="queue-sub">{copy.queueEyebrow} · top {ranked.length} by effective score</p></div><span className="docket-count">{ranked.length}</span></div>
    {ranked.length===0
      ? <EmptyState>{uiCopy[locale].bbmp.queueTitle}: 0 — every report has been citizen-confirmed.</EmptyState>
      : <ol className="docket-rows">{ranked.map((report,index)=>(
          <li key={report.id}>
            <button className={selectedId===report.id?"docket-row selected":"docket-row"} onClick={()=>onSelect(report.id)}>
              <span className="docket-rank">{String(index+1).padStart(2,"0")}</span>
              <span className="docket-copy">
                <strong>{report.title}</strong>
                <p>{report.locality} · {report.status}</p>
                <small>{[...report.priority.audit.factors].sort((a,b)=>b.contribution-a.contribution).slice(0,2).map(f=>f.key.replace(/([A-Z])/g," $1").toLowerCase()).join(" + ")}</small>
                <i className="docket-bar" aria-hidden="true"><b style={{width:`${Math.min(100,report.priority.audit.effectiveScore)}%`}}/></i>
              </span>
              <span className={`score-chip band-${report.priority.audit.effectiveBand}`}><b>{report.priority.audit.effectiveScore.toFixed(1)}</b>{report.priority.audit.effectiveBand}</span>
            </button>
          </li>
        ))}</ol>}
  </aside>;
}

function RoutesLab(){
  const {state,reoptimize,publishRoute,busy}=useDemo();
  const [replayKm,setReplayKm]=useState<number|null>(null);
  const lead=state.route.roadPathByVehicle[0];
  const liveTrip=tripStatusFor(state);
  const replayTrip:TripStatus|null=useMemo(()=>{
    if(replayKm==null||!lead)return null;
    const stops=state.route.routes.find(r=>r.vehicleId===lead.vehicleId)?.stops??[];
    let index=-1,acc=0;
    for(let i=0;i<stops.length;i++){acc+=stops[i].distanceKm;if(replayKm<=acc){index=i;break}}
    const nextDistance=index>=0?acc:null;
    return {
      vehicleId:lead.vehicleId,
      remainingKm:Math.max(0,Math.round(lead.distanceKm-replayKm)),
      etaMinutes:Math.max(0,Math.round((lead.distanceKm-replayKm)/TRUCK_SPEED_KMH*60)),
      totalKm:Math.round(lead.distanceKm),
      progressKm:replayKm,
      nextStopKm:nextDistance,
      nextStopIndex:index>=0?index:null,
      nextStopLabel:stops[index]?.label??null,
      etaToNextMinutes:nextDistance!=null?Math.max(0,Math.round((nextDistance-replayKm)/TRUCK_SPEED_KMH*60)):0,
      servicing:false,
      label:"Route replay",
      sub:`${Math.round(replayKm)} of ${Math.round(lead.distanceKm)} km · plan v${state.route.version}`,
    };
  },[replayKm,lead,state.route.routes,state.route.version]);

  function startReplay(){
    if(!lead||lead.distanceKm<=0)return;
    const total=lead.distanceKm;
    const reducedMotion=typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reducedMotion){setReplayKm(total);setTimeout(()=>setReplayKm(null),2500);return}
    const durationMs=Math.min(24000,Math.max(7000,total*650));
    const startedAt=performance.now();
    const step=(now:number)=>{
      const fraction=Math.min(1,(now-startedAt)/durationMs);
      setReplayKm(fraction*total);
      if(fraction<1)requestAnimationFrame(step);
      else setTimeout(()=>setReplayKm(null),1800);
    };
    requestAnimationFrame(step);
  }

  return <section>
    <div className="lab-heading">
      <div><p className="eyebrow">multi-signal-aco-inspired-v1</p><h1>Adaptive route revision</h1><p>Five specialist colonies search the same feasible stop set. Active weights adapt to current urgency and every stop preserves its signal trail.</p></div>
      <div>
        <button data-testid="route-reoptimize" className="secondary-button" disabled={busy} onClick={()=>reoptimize("manual_control_room")}>Recalculate</button>
        <button data-testid="route-publish" className="primary-button" disabled={busy} onClick={publishRoute}><Check size={18}/>Publish route</button>
      </div>
    </div>
    <div className="route-metrics">
      <div><span>Plan</span><strong>v{state.route.version} · {state.route.status}</strong></div>
      <div><span>Distance</span><strong>{state.route.totalDistanceKm} km</strong></div>
      <div><span>Duration</span><strong>{state.route.totalMinutes} min</strong></div>
      <div><span>Unassigned</span><strong>{state.route.unassigned.length}</strong></div>
    </div>
    <section className="panel replay-panel">
      <div className="section-heading split-heading">
        <div><h2 className="title">Replay this route</h2><p>Animate the assigned vehicle along the published OSM path to preview the round before the shift starts.</p></div>
        <div className="replay-actions">
          {replayTrip
            ? <button type="button" className="secondary-button" onClick={()=>setReplayKm(null)}><RotateCcwSquare size={18}/>Stop replay</button>
            : <button type="button" data-testid="route-replay" className="secondary-button" onClick={startReplay}><Play size={18}/>Replay route</button>}
        </div>
      </div>
      <BengaluruMap markers={[]} route={lead?.path??[]} vehiclePaths={lead?[lead]:undefined} geometrySource={state.route.roadGeometrySource} tripStatus={replayTrip} height={340}/>
      {replayTrip&&<div className="replay-progress" role="status"><i style={{transform:`scaleX(${Math.min(1,replayTrip.progressKm/Math.max(1,replayTrip.totalKm))})`}}/><span>{replayTrip.sub}{replayTrip.nextStopLabel?` · next: ${replayTrip.nextStopLabel}`:" · returning to depot"}</span></div>}
    </section>
    <section className="panel">
      <div className="section-heading"><h2 className="title">What the optimizer is listening to</h2></div>
      <div className="weights-grid">{Object.entries(state.route.weights).map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><strong>{Math.round(value*100)}%</strong><i><b style={{transform:`scaleX(${value})`}}/></i></div>)}</div>
    </section>
    <div className="route-cards">
      {state.route.routes.filter(route=>route.stops.length>0).map(route=>(
        <section className="panel route-card" key={route.vehicleId}>
          <div className="section-heading split-heading"><div><h2 className="title">{state.vehicles.find(v=>v.id===route.vehicleId)?.label??route.vehicleId}</h2></div><Route size={18}/></div>
          <ol className="stop-list">{route.stops.map((stop,stopIndex)=>(
            <li key={stop.id}>
              <span className="stop-sequence">{stop.sequence}</span>
              <div className="stop-main">
                <div><strong>{stop.label}</strong><small>{stop.locality} · {liveTrip&&liveTrip.nextStopIndex!==null&&route.vehicleId===state.vehicles[0]?.id&&liveTrip.nextStopIndex===stopIndex?(liveTrip.servicing?"halting now":"ETA in "+liveTrip.etaToNextMinutes+" min (live)"):"ETA "+stop.etaMinutes+" min"} · {stop.volumeLitres.toFixed(0)} L</small></div>
                <span className={`status-chip status-${stop.status}`}>{stop.locked?"locked · ":""}{stop.status.replaceAll("_"," ")}</span>
                <p>{stop.explanation}</p>
                <div className="contribution-row">{stop.contributions.map(c=><span key={c.signal}><b>{c.contribution}</b>{c.label}</span>)}</div>
              </div>
            </li>
          ))}</ol>
        </section>
      ))}
    </div>
    {state.route.unassigned.length>0&&<div className="alert warning"><AlertTriangle/><div><strong>Unassigned work</strong><p>{state.route.unassigned.map(x=>`${x.id}: ${x.reason}`).join(" · ")}</p></div></div>}
  </section>;
}

function BinsTable(){
  const {state}=useDemo();
  return <section className="panel">
    <div className="section-heading"><h1 className="title">Smart-bin status</h1></div>
    <div className="table-scroll"><table className="data-table">
      <caption>Ten demo smart bins with deterministic fill telemetry</caption>
      <thead><tr><th>Bin</th><th>Locality</th><th>Fill</th><th>Status</th><th>Streams</th><th>Freshness</th></tr></thead>
      <tbody>{state.bins.map(bin=>(
        <tr key={bin.id}><th scope="row">{bin.label}</th><td>{bin.locality}</td><td><strong>{bin.fillPercent}%</strong></td><td><span className={`status-chip status-${bin.status}`}>{bin.status}</span></td><td>{bin.accepted.join(", ")}</td><td>{new Date(bin.lastUpdatedAt).toLocaleTimeString("en-IN")}</td></tr>
      ))}</tbody>
    </table></div>
  </section>;
}

function PlacementLab(){
  const {state}=useDemo();
  const [selected,setSelected]=useState(state.recommendations[0]?.id);
  const rec=state.recommendations.find(r=>r.id===selected)??state.recommendations[0];
  const markers=state.recommendations.map(r=>({id:r.id,label:r.label,location:r.location,kind:"recommendation" as const,detail:`score ${r.score.toFixed(1)} · ${Math.round(r.confidence*100)}% confidence`}));
  return <section>
    <div className="lab-heading"><div><p className="eyebrow">EPSG:32643 · 120 m grid · 300 m suppression</p><h1>Smart-bin placement lab</h1><p>Recommendations combine real Bengaluru geography proxies with labelled demo demand. Unknown land ownership always requires field validation.</p></div><span className="source-chip">OSM + official wards</span></div>
    <div className="placement-layout">
      <div className="panel"><BengaluruMap markers={markers} height={500}/></div>
      <aside className="panel placement-list">
        <div className="section-heading"><h2 className="title">Recommended public edges</h2></div>
        {state.recommendations.map(r=>(
          <button className={selected===r.id?"placement-row selected":"placement-row"} key={r.id} onClick={()=>setSelected(r.id)}>
            <span>{r.rank}</span><div><strong>{r.label}</strong><small>{r.locality} · {Math.round(r.confidence*100)}% confidence</small></div><b>{r.score.toFixed(1)}</b>
          </button>
        ))}
      </aside>
    </div>
    {rec&&<section className="panel recommendation-detail">
      <div className="section-heading split-heading"><div><h2 className="title">{rec.label}</h2><p className="queue-sub">Candidate #{rec.rank}</p><p>{rec.reasons.join(" · ")}</p></div><div className="score-orb"><strong>{rec.score.toFixed(1)}</strong><span>placement</span></div></div>
      {rec.requiresFieldValidation&&<div className="alert warning"><MapPinned/><div><strong>Field validation required</strong><p>{rec.warnings.join(" ")}</p></div></div>}
      <div className="table-scroll"><table className="data-table">
        <caption>Complete placement score factor breakdown</caption>
        <thead><tr><th>Factor</th><th>Raw</th><th>Normalized</th><th>Weight</th><th>Contribution</th><th>Source</th></tr></thead>
        <tbody>{rec.features.map(f=><tr key={f.key}><th scope="row">{f.label}</th><td>{f.raw??"Unknown"}</td><td>{f.value.toFixed(2)}</td><td>{Math.round(f.weight*100)}%</td><td><strong>{f.contribution.toFixed(2)}</strong></td><td>{f.source.replaceAll("_"," ")}</td></tr>)}</tbody>
      </table></div>
    </section>}
  </section>;
}
