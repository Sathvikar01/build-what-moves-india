"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, Camera, CheckCircle2, MapPin, Navigation, PackageCheck, Route, UploadCloud } from "lucide-react";
import { AtlasShell } from "../../src/components/atlas-shell";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { sanitizeEvidence } from "../../src/client/image";
import { uiCopy } from "../../src/data/copy";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { tripStatusFor } from "../../src/components/trip-status";
import { SkeletonBlock, Toast, type ToastNotice } from "../../src/components/ui-bits";

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
  const next=route?.stops.find(s=>s.status!=="collected"&&s.status!=="blocked"&&s.status!=="skipped");
  const vehicle=state.vehicles.find(v=>v.id===route?.vehicleId)??state.vehicles[0];
  const collected=route?.stops.filter(s=>s.status==="collected").length??0;
  // Live ETA/distance for the stop the truck is actually heading to.
  const trip=tripStatusFor(state);
  const activeStop=trip?.nextStopIndex!=null&&route?route.stops[trip.nextStopIndex]:undefined;
  const liveActive=!!next&&!!activeStop&&next.id===activeStop.id;
  const etaMinutes=liveActive&&trip?trip.etaToNextMinutes:(next?.etaMinutes??"-");
  const kmLeft=liveActive&&trip?.nextStopKm!=null?Math.max(0,Math.round(trip.nextStopKm-trip.progressKm)):(next?.distanceKm??"-");
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

  if(!ready) return <AtlasShell role="collector"><div className="page-wrap"><SkeletonBlock rows={3}/></div></AtlasShell>;

  // Route sheet: progress strip up top, map floor below, action rail on the right.
  return <AtlasShell role="collector">
    <div className="route-desk" lang={locale==="kn"?"kn":"en"}>
      <section className="route-strip" aria-label="Route progress">
        <div className="route-strip-id">
          <p className="eyebrow">{copy.shift} · {vehicle.label}</p>
          <strong>{copy.next} {next?next.locality:copy.complete}</strong>
        </div>
        <ol className="route-ticks" aria-hidden="true">
          {route?.stops.map(stop=>(
            <li key={stop.id} className={`tick tick-${stop.status}${next&&stop.id===next.id?" tick-now":""}`}>
              <b>{stop.sequence}</b>
              <i/>
            </li>
          ))}
        </ol>
        <div className="route-strip-progress">
          <strong>{collected}/{route?.stops.length??0}</strong>
          <span>{copy.collected}</span>
          <em>v{state.route.version}</em>
        </div>
      </section>
      <div className="route-body">
        <section className="route-map" aria-label="Assigned route map">
          <BengaluruMap markers={markers} route={state.route.roadPathByVehicle.find(v=>v.vehicleId===route?.vehicleId)?.path??state.route.roadPath} vehiclePaths={state.route.roadPathByVehicle.filter(v=>v.vehicleId===route?.vehicleId)} geometrySource={state.route.roadGeometrySource} tripStatus={tripStatusFor(state)} userLocation={state.userLocation?.location??MOCK_USER_LOCATION} height="100%"/>
        </section>
        <aside className="route-rail">
          <div className="revision-banner"><Route size={20}/><div><strong>{copy.route} v{state.route.version} · {state.route.status}</strong><p>{state.route.trigger.replaceAll("_"," ")}. {copy.revisionNote}</p></div><button data-testid="collector-acknowledge" type="button" onClick={()=>setAcknowledged(true)} aria-pressed={acknowledged} disabled={acknowledged||busy}>{acknowledged?copy.acknowledged:copy.acknowledge}</button></div>
          <Toast notice={notice} onDone={()=>setNotice(undefined)}/>
          {next&&<section className="panel next-stop-card">
            <div className="next-card-head">
              <span className="next-number" aria-hidden="true">{next.sequence}</span>
              <div className="section-heading"><h2 className="title">{next.label}</h2></div>
              <em className="next-eta">{etaMinutes} {copy.minutes}</em>
            </div>
            <div className="stop-facts"><span><MapPin/> {next.locality}</span><span><PackageCheck/> {next.volumeLitres.toFixed(0)} {copy.expected}</span><span><Navigation/> {kmLeft} {copy.estimated}</span></div>
            <div className="why-box"><strong>{copy.why}</strong><p>{next.explanation}</p><div className="contribution-row">{next.contributions.map(c=><span key={c.signal}><b>{c.contribution}</b>{c.label}</span>)}</div></div>
            <div className="collector-actions">
              {next.status!=="arrived"&&<button data-testid="collector-arrive" className="primary-button" disabled={busy} onClick={()=>act("arrived")}><Navigation/>{copy.arrive}</button>}
              {next.status==="arrived"&&<button data-testid="collector-collect" className="primary-button" disabled={busy} onClick={()=>{act("collected");setProofOpen(true);setBefore(undefined);setAfter(undefined);setGps(undefined);setChecked(false);setProofStatus("")}}><CheckCircle2/>{copy.collect}</button>}
              <button className="secondary-button danger-text" disabled={busy} onClick={()=>act("blocked")}><AlertOctagon/>{copy.blocked}</button>
            </div>
          </section>}
          {proofOpen&&next&&<section className="panel proof-panel">
            <div>
              <h2 className="title">{copy.proofTitle}</h2>
              <p className="muted">Before/after evidence is re-encoded in the browser and persisted privately. Recorded coordinates and every checklist item are required before the report can become cleaned.</p>
              {proofStatus==="error"&&<p className="danger-text" role="alert">Proof could not be stored. Evidence remains on this device; retry to continue.</p>}
            </div>
            <div>
              <div className="proof-grid">
                <label className={before?"proof-captured":""}><Camera/><strong>{copy.before}</strong><span>{before?"Prepared · metadata removed":copy.choose}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void choose(e.target.files?.[0],setBefore)}/></label>
                <label className={after?"proof-captured":""}><Camera/><strong>{copy.after}</strong><span>{after?"Prepared · metadata removed":copy.choose}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void choose(e.target.files?.[0],setAfter)}/></label>
                <button type="button" className={gps?"proof-captured":""} onClick={()=>{const fallback=()=>setGps({coords:next.location??vehicle.location,mode:"demo"});if(!navigator.geolocation){fallback();return}navigator.geolocation.getCurrentPosition(position=>setGps({coords:{lat:position.coords.latitude,lng:position.coords.longitude},mode:"captured"}),fallback,{enableHighAccuracy:true,timeout:5000,maximumAge:0})}}><MapPin/><strong>{copy.gps}</strong><span>{gps?.mode==="captured"?`Captured · ${gps.coords.lat.toFixed(4)}, ${gps.coords.lng.toFixed(4)}`:gps?.mode==="demo"?"Demo stop coordinate · permission unavailable":copy.capture}</span></button>
              </div>
              <label className="proof-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{copy.checklist}</label>
              <button data-testid="collector-submit-proof" type="button" className="primary-button wide-button" disabled={!before||!after||!gps||!checked||proofStatus==="uploading"||busy} onClick={()=>void submitProof()}><UploadCloud size={18}/>{proofStatus==="uploading"?copy.storing:copy.submitProof}</button>
            </div>
          </section>}
          <section className="panel manifest-panel">
            <div className="section-heading"><h2 className="title">{copy.stopsTitle}</h2></div>
            <ol className="stop-list">{route?.stops.map(stop=>(
              <li key={stop.id} className={next&&stop.id===next.id?"stop-now":""}><span className="stop-sequence">{stop.sequence}</span><div className="stop-main"><strong>{stop.label}</strong><small>{stop.locality} · {stop.etaMinutes} {copy.minutes}</small><span className={`status-chip status-${stop.status}`}>{stop.status.replaceAll("_"," ")}</span>{next&&stop.id===next.id&&<em className="stop-now-tag" aria-label="current stop">NOW</em>}</div></li>
            ))}</ol>
          </section>
        </aside>
      </div>
    </div>
  </AtlasShell>;
}
