"use client";

import { useMemo, useState } from "react";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { tripStatusFor } from "../../src/components/trip-status";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { sanitizeEvidence } from "../../src/client/image";
import { uiCopy } from "../../src/data/copy";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { Toast, type ToastNotice } from "../../src/components/ui-bits";

export default function CollectorPage(){
  const {ready}=useRequireUser();
  const {state,locale,stopAction,acceptProof,busy}=useDemo(); const copy=uiCopy[locale].collector;
  const [proofOpen,setProofOpen]=useState(false);
  const [before,setBefore]=useState<File>();
  const [after,setAfter]=useState<File>();
  const [gps,setGps]=useState<{coords:{lat:number;lng:number};mode:"captured"|"demo"}>();
  const [checked,setChecked]=useState(false);
  const [proofStatus,setProofStatus]=useState<""|"uploading"|"error">("");
  const [acknowledged,setAcknowledged]=useState(false);
  const [notice,setNotice]=useState<ToastNotice>();

  const route=state.route.routes.find(r=>r.stops.length)??state.route.routes[0];
  const trip=tripStatusFor(state);
  const next=route?.stops.find(s=>s.status!=="collected"&&s.status!=="blocked"&&s.status!=="skipped");
  const vehicle=state.vehicles.find(v=>v.id===route?.vehicleId)??state.vehicles[0];
  const collected=route?.stops.filter(s=>s.status==="collected").length??0;
  const markers=useMemo<MapMarker[]>(()=>[
    {id:vehicle.id,label:vehicle.label,location:vehicle.location,kind:"vehicle",detail:"assigned collector vehicle"},
    ...(route?.stops.map(s=>({id:s.id,label:`Stop ${s.sequence}: ${s.label}`,location:s.location,kind:(s.kind==="bin"?"bin":s.kind==="pickup"?"pickup":"report") as "bin"|"report"|"pickup",detail:`${s.status} · ${s.etaMinutes} min`}))??[]),
  ],[route,vehicle]);

  async function choose(file:File|undefined,set:(value:File)=>void){if(file)set(await sanitizeEvidence(file))}
  function act(action:"arrived"|"collected"|"blocked"){
    if(busy)return;
    if(!next)return;
    stopAction(action);
    setNotice({kind:"success",message:action==="arrived"?`Arrived at ${next.label}.`:action==="collected"?`Collection recorded at ${next.label}. Submit before/after evidence.`:`${next.label} reported blocked and removed from the route suffix.`});
    if(navigator.vibrate)navigator.vibrate(30);
  }
  async function uploadEvidence(file:File){
    const form=new FormData(); form.set("photo",file);
    const response=await fetch("/api/uploads",{method:"POST",headers:{"x-demo-role":"collector","idempotency-key":`collector-upload-${crypto.randomUUID()}`},body:form});
    if(!response.ok)throw new Error("Evidence upload failed");
    const body=await response.json() as {data?:{assetId?:string}};
    if(!body.data?.assetId)throw new Error("Evidence asset was not stored");
    return body.data.assetId;
  }
  async function submitProof(){
    if(!before||!after||!gps||!checked||!next)return;
    setProofStatus("uploading");
    try{
      const [beforeAssetId,afterAssetId]=await Promise.all([uploadEvidence(before),uploadEvidence(after)]);
      const accepted=await acceptProof({stopId:next.id,beforeAssetId,afterAssetId,gps:gps.coords,gpsMode:gps.mode,checklist:{segregated:true,areaSwept:true,accessClear:true}});
      if(!accepted)throw new Error("Proof was not accepted");
      setNotice({kind:"success",message:`Evidence accepted for ${next.label}. The report is now cleaned.`});
      setProofOpen(false);setProofStatus("");
    }catch{setProofStatus("error")}
  }

  if(!ready) return <div className="page-wrap"><p>Loading…</p></div>;

  return <div className="atlas-split" lang={locale==="kn"?"kn":"en"}>
    <section className="atlas-map">
      <BengaluruMap markers={markers} vehiclePaths={state.route.roadPathByVehicle} userLocation={state.userLocation?.location??MOCK_USER_LOCATION} height="100%"/>
    </section>
    <aside className="atlas-rail">
      <section className="rail-hero">
        <p className="eyebrow">{copy.shift} · {vehicle.label}</p>
        <h1>{next?`${copy.next} ${next.locality}`:copy.complete}</h1>
        <p>{next?.label??copy.allDone}</p>
        <div style={{display:"flex",alignItems:"center",gap:"var(--space-3)",padding:"var(--space-3)",borderRadius:"var(--r-md)",background:"var(--accent-soft)",border:"1px solid var(--accent-edge)"}}><strong style={{fontSize:"1.2rem",fontFamily:"var(--font-display)",color:"var(--accent)"}}>{collected}/{route?.stops.length??0}</strong><span style={{fontSize:"0.78rem",color:"var(--ink-mid)"}}>{copy.collected}</span></div>
      </section>
      <div className="revision-banner panel">
        <div><strong>{copy.route} v{state.route.version} · {state.route.status}</strong><p>{state.route.trigger.replaceAll("_"," ")}. {copy.revisionNote}</p></div>
        <button data-testid="collector-acknowledge" type="button" onClick={()=>setAcknowledged(true)} disabled={acknowledged||busy}>{acknowledged?copy.acknowledged:copy.acknowledge}</button>
      </div>
      <Toast notice={notice} onDone={()=>setNotice(undefined)}/>
      {next&&<section className="panel next-stop-card">
        <div className="section-heading"><p className="eyebrow">{copy.stop} {next.sequence} · ETA {next.etaMinutes} {copy.minutes}</p><h2 className="title">{next.label}</h2></div>
        <div className="stop-facts"><span>{next.locality}</span><span>{next.volumeLitres.toFixed(0)} {copy.expected}</span><span>{next.distanceKm} km {copy.estimated}</span></div>
        <div><strong>{copy.why}</strong><p>{next.explanation}</p></div>
        <div style={{display:"flex",gap:"var(--space-2)",flexWrap:"wrap"}}>
          {next.status!=="arrived"&&<button className="landing-button landing-button-primary" data-testid="collector-arrive" disabled={busy} onClick={()=>act("arrived")}>{copy.arrive}</button>}
          {next.status==="arrived"&&<button className="landing-button landing-button-primary" data-testid="collector-collect" disabled={busy} onClick={()=>{act("collected");setProofOpen(true);setBefore(undefined);setAfter(undefined);setGps(undefined);setChecked(false);setProofStatus("")}}>{copy.collect}</button>}
          <button className="landing-button landing-button-secondary" disabled={busy} onClick={()=>act("blocked")}>{copy.blocked}</button>
        </div>
      </section>}
      {proofOpen&&next&&<section className="panel proof-panel">
        <h2>{copy.proofTitle}</h2>
        <div className="proof-grid">
          <label>{copy.before}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void choose(e.target.files?.[0],setBefore)}/></label>
          <label>{copy.after}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void choose(e.target.files?.[0],setAfter)}/></label>
        </div>
        <button type="button" onClick={()=>{const fallback=()=>setGps({coords:next.location??vehicle.location,mode:"demo"});if(!navigator.geolocation){fallback();return}navigator.geolocation.getCurrentPosition(position=>setGps({coords:{lat:position.coords.latitude,lng:position.coords.longitude},mode:"captured"}),fallback,{enableHighAccuracy:true,timeout:5000,maximumAge:0})}}>{gps?.mode==="captured"?`Captured · ${gps.coords.lat.toFixed(4)}, ${gps.coords.lng.toFixed(4)}`:gps?.mode==="demo"?"Demo stop coordinate · permission unavailable":copy.capture}</button>
        <label className="proof-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{copy.checklist}</label>
        <button className="landing-button landing-button-primary" data-testid="collector-submit-proof" type="button" disabled={!before||!after||!gps||!checked||proofStatus==="uploading"||busy} onClick={()=>void submitProof()}>{proofStatus==="uploading"?copy.storing:copy.submitProof}</button>
      </section>}
      <section className="manifest-panel">
        <h2 className="eyebrow">{copy.stopsTitle}</h2>
        <ol className="stop-list">
          {route?.stops.map(stop=>(
            <li key={stop.id} className={next&&stop.id===next.id?"stop-now":""}>
              <span>{stop.sequence}</span>
              <div><strong>{stop.label}</strong> · {stop.locality} · {stop.etaMinutes} {copy.minutes} · {stop.status.replaceAll("_"," ")}{next&&stop.id===next.id?" · NOW":""}</div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  </div>;
}
