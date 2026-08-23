"use client";

import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock3, LocateFixed, Navigation, Radio, Trash2, Truck } from "lucide-react";
import { AppHeader } from "../../src/components/app-header";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { citizenCopy } from "../../src/data/copy";
import { sanitizeEvidence } from "../../src/client/image";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { tripStatusFor } from "../../src/components/trip-status";

type Notice={kind:"success"|"error";message:string};

export default function CitizenPage(){
  const {ready}=useRequireUser();
  const {state,locale,signal,report,confirmCleanup}=useDemo(); const copy=citizenCopy[locale];
  const [notice,setNotice]=useState<Notice>(); const [submitting,setSubmitting]=useState(false); const [formOpen,setFormOpen]=useState(false); const [location,setLocation]=useState<"idle"|"ready"|"locating"|"denied"|"demo">("idle"); const [coords,setCoords]=useState<{lat:number;lng:number}>(); const [photo,setPhoto]=useState<File>();
  const nearest=state.vehicles.find(v=>v.status!=="offline"); const eta=Math.max(3,9-state.tick);
  const markers=useMemo<MapMarker[]>(()=>[
    ...state.vehicles.filter(v=>v.status!=="offline").map(v=>({id:v.id,label:v.label,location:v.location,kind:"vehicle" as const,detail:`${v.status.replaceAll("_"," ")} · synthetic`})),
    ...state.bins.slice(0,5).map(b=>({id:b.id,label:b.label,location:b.location,kind:"bin" as const,detail:`${Math.round(b.fillPercent)}% full`,overflow:b.fillPercent>=100})),
  ],[state.vehicles,state.bins]);
  function succeed(message:string){setNotice({kind:"success",message});setTimeout(()=>setNotice(undefined),6000)}
  function failNotice(message:string){setNotice({kind:"error",message})}
  function sendSignal(kind:"have_waste"|"waste_outside"){signal(kind,coords);succeed(copy.signalDone)}
  function locate(){if(location==="denied"){setCoords({lat:12.9716,lng:77.7507});setLocation("demo");return}setLocation("locating");if(!navigator.geolocation){setLocation("denied");return}navigator.geolocation.getCurrentPosition(position=>{setCoords({lat:position.coords.latitude,lng:position.coords.longitude});setLocation("ready")},()=>setLocation("denied"),{enableHighAccuracy:true,timeout:8000})}
  const awaiting=state.reports.find(r=>r.status==="cleaned");
  if(!ready) return <main className="app-shell citizen-shell"><AppHeader role="citizen"/><div className="page-wrap"><p className="empty-state" role="status">Checking sign-in…</p></div></main>;
  async function submitReport(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!photo||!coords){failNotice(copy.errors.photoLocation);return}
    setSubmitting(true);
    try{
      const form=new FormData(e.currentTarget); const upload=new FormData(); upload.set("photo",photo);
      const response=await fetch("/api/uploads",{method:"POST",headers:{"x-demo-role":"citizen","idempotency-key":`citizen-upload-${crypto.randomUUID()}`},body:upload});
      if(!response.ok){failNotice(copy.errors.photoStore);return}
      const body=await response.json() as {data?:{assetId?:string}};
      if(!body.data?.assetId){failNotice(copy.errors.photoReceipt);return}
      report({title:String(form.get("title")),category:String(form.get("category")),hygiene:String(form.get("hygiene")) as "low"|"moderate"|"high"|"severe",obstruction:String(form.get("obstruction")) as "none"|"partial"|"significant"|"traffic_lane",location:coords,photoUrl:body.data.assetId});
      succeed(copy.reportDone); setFormOpen(false);
    } finally { setSubmitting(false); }
  }
  return <main className="app-shell citizen-shell" lang={locale==="kn"?"kn":"en"}>
    <AppHeader role="citizen"/>
    <div className="page-wrap narrow-wrap">
      <section className="citizen-hero"><div><p className="eyebrow">Mahadevapura pilot · wards 28–50</p><h1>{copy.hero}</h1><p>{copy.sub}</p></div><div className="hero-eta"><Truck size={28}/><span>ETA</span><strong>{nearest?`${eta} min`:"—"}</strong><small>Simulated estimate</small></div></section>
      {notice&&<div className={notice.kind==="error"?"toast-inline toast-error":"toast-inline"} role={notice.kind==="error"?"alert":"status"}><CheckCircle2 size={18}/>{notice.message}</div>}
      <section className="quick-actions" aria-labelledby="quick-title"><div className="section-heading"><p className="eyebrow">Quick signal</p><h2 id="quick-title">What is waiting?</h2></div><div className="action-grid">
        <button data-testid="signal-have-waste" className="signal-card" onClick={()=>sendSignal("have_waste")}><span className="signal-icon"><Trash2/></span><strong>{copy.haveWaste}</strong><small>{copy.haveWasteHint}</small><span>{copy.sendSignal}</span></button>
        <button data-testid="signal-outside" className="signal-card amber-card" onClick={()=>sendSignal("waste_outside")}><span className="signal-icon"><Radio/></span><strong>{copy.outside}</strong><small>{copy.outsideHint}</small><span>{copy.sendSignal}</span></button>
      </div></section>
      <section className="two-column citizen-live">
        <article className="panel"><div className="section-heading split-heading"><div><p className="eyebrow">Live collection</p><h2>{copy.truck}</h2></div><span className="live-pill"><i/>Live</span></div>
          {nearest
            ? <div className="truck-card"><span className="truck-avatar"><Truck/></span><div><strong>{nearest.label}</strong><p>Auto-tipper · on the way</p><span><Clock3 size={15}/>{eta} min · updated at tick {state.tick}</span></div><b>{Math.round(nearest.loadLitres/nearest.capacityLitres*100)}% loaded</b></div>
            : <div className="empty-state" role="status">{copy.noVehicle}</div>}
          <BengaluruMap markers={markers} route={state.route.roadPath} vehiclePaths={state.route.roadPathByVehicle} geometrySource={state.route.roadGeometrySource} tripStatus={tripStatusFor(state)} userLocation={MOCK_USER_LOCATION} height={270}/>
        </article>
        <article className="panel"><div className="section-heading"><p className="eyebrow">Sensor status</p><h2>{copy.bins}</h2></div>{state.bins.length===0&&<div className="empty-state" role="status">{copy.noBins}</div>}<div className="bin-list">{state.bins.slice(0,4).map(bin=><div className="bin-row" key={bin.id}><span className={`fill-ring fill-${bin.status}`} style={{"--fill":`${bin.fillPercent*3.6}deg`} as React.CSSProperties}><b>{bin.fillPercent}%</b></span><div><strong>{bin.label}</strong><p>{bin.locality} · {bin.accepted.join(" + ")}</p><small>{bin.status==="full"?copy.binFull:bin.status==="offline"?copy.binOffline:copy.binSpace}</small></div></div>)}</div></article>
      </section>
      <section className="panel report-panel"><div className="section-heading split-heading"><div><p className="eyebrow">Photo + location</p><h2>{copy.report}</h2></div><button className="primary-button" onClick={()=>setFormOpen(v=>!v)}><Camera size={18}/>{formOpen?"Close form":copy.report}</button></div>
        {formOpen&&<form data-testid="report-form" className="report-form" onSubmit={submitReport}>
          <label className="upload-drop"><Camera/><strong>{photo?copy.uploadReady:copy.uploadEmpty}</strong><span>{photo?`${Math.round(photo.size/1024)} KB · ${copy.uploadMeta}`:copy.uploadHint}</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(file){try{setPhoto(await sanitizeEvidence(file))}catch(error){failNotice(error instanceof Error?error.message:copy.errors.imagePrepare)}}}}/></label>
          <label><span>{copy.title}</span><input name="title" required maxLength={120} placeholder={copy.titlePlaceholder}/></label>
          <label><span>{copy.category}</span><select name="category" defaultValue="mixed">{Object.entries(copy.categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{copy.hygiene}</span><select name="hygiene" defaultValue="high">{Object.entries(copy.hygieneLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{copy.obstruction}</span><select name="obstruction" defaultValue="partial">{Object.entries(copy.obstructionLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <button type="button" className="location-button" onClick={locate}><LocateFixed size={18}/>{location==="locating"?"Finding your location…":location==="ready"?"Location captured":location==="demo"?"Demo location · Whitefield":location==="denied"?"Permission denied · use labelled demo location":"Capture my location"}</button>
          <button data-testid="report-submit" className="primary-button wide-button" type="submit" disabled={submitting}>{submitting?copy.submitPending:copy.submit}{!submitting&&<Navigation size={18}/>}</button>
        </form>}
      </section>
      {awaiting&&<section className="panel confirmation-panel"><div><p className="eyebrow">Cleanup confirmation</p><h2>Was {awaiting.locality} cleaned?</h2><p>Collector proof was accepted. Your confirmation closes the public audit loop.</p></div><div className="confirmation-actions"><button data-testid="confirm-cleaned" className="primary-button" onClick={()=>confirmCleanup("cleaned")}>{copy.cleaned}</button><button className="secondary-button" onClick={()=>confirmCleanup("partial")}>{copy.partial}</button><button className="secondary-button danger-text" onClick={()=>confirmCleanup("still_present")}>{copy.present}</button></div></section>}
      <section className="panel"><div className="section-heading"><p className="eyebrow">Transparent updates</p><h2>{copy.activity}</h2></div>{state.events.length===0&&<div className="empty-state" role="status">{copy.noEvents}</div>}<ol className="timeline">{state.events.slice(-6).reverse().map(event=><li key={event.id}><span/><div><strong>{event.message}</strong><small>{new Date(event.occurredAt).toLocaleString(copy.localeTag)} · audit cursor {event.cursor}</small></div></li>)}</ol></section>
    </div>
  </main>
}
