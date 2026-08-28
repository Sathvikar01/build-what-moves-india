"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock3, LocateFixed, Navigation, Radio, Trash2, Truck } from "lucide-react";
import { AtlasShell } from "../../src/components/atlas-shell";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { citizenCopy } from "../../src/data/copy";
import { sanitizeEvidence } from "../../src/client/image";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { tripStatusFor } from "../../src/components/trip-status";
import { EvidencePair, ReportTracker, SkeletonBlock } from "../../src/components/ui-bits";

type Notice={kind:"success"|"error";message:string};
type Step="signal"|"track"|"verify";

const STEP_INDEX:Record<string,number>={submitted:0,acknowledged:1,assigned:2,en_route:2,cleaned:3,reopened:1,confirmed:4};

export default function CitizenPage(){
  const {ready}=useRequireUser();
  const {state,locale,signal,report,confirmCleanup,busy}=useDemo(); const copy=citizenCopy[locale];
  const [step,setStep]=useState<Step>("signal");
  const [notice,setNotice]=useState<Notice>();
  const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [formOpen,setFormOpen]=useState(true);
  const [location,setLocation]=useState<"idle"|"ready"|"locating"|"denied"|"demo">("idle");
  const [coords,setCoords]=useState<{lat:number;lng:number}>();
  const [photo,setPhoto]=useState<File>();

  useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current)},[]);

  const nearest=state.vehicles.find(v=>v.status!=="offline");
  // One source of truth for ETA: the live day-cycle trip projection.
  const trip=tripStatusFor(state);
  const etaMinutes=trip?trip.etaToNextMinutes:null;
  const markers=useMemo<MapMarker[]>(()=>[
    ...state.vehicles.filter(v=>v.status!=="offline").map(v=>({id:v.id,label:v.label,location:v.location,kind:"vehicle" as const,detail:`${v.status.replaceAll("_"," ")} · synthetic`})),
    ...state.bins.slice(0,5).map(b=>({id:b.id,label:b.label,location:b.location,kind:"bin" as const,detail:`${Math.round(b.fillPercent)}% full`,overflow:b.fillPercent>=100})),
  ],[state.vehicles,state.bins]);
  // Map/list parity: the sensor list shows the same bins the map plots.
  const listedBins=state.bins.slice(0,5);
  const myReports=useMemo(()=>state.reports.filter(r=>r.id.startsWith("rep-citizen-")||r.id.startsWith("rep-api-")),[state.reports]);
  const awaiting=state.reports.find(r=>r.status==="cleaned");

  const tabs:{id:Step;label:string}[]=[
    {id:"signal",label:copy.signalsTitle},
    {id:"track",label:copy.trackerTitle},
    {id:"verify",label:copy.activity},
  ];

  function showNotice(next:Notice){
    setNotice(next);
    if(noticeTimer.current)clearTimeout(noticeTimer.current);
    if(next.kind==="success")noticeTimer.current=setTimeout(()=>setNotice(undefined),6000);
  }
  function sendSignal(kind:"have_waste"|"waste_outside"){
    if(busy)return;
    signal(kind,coords);
    showNotice({kind:"success",message:copy.signalDone});
    setStep("track");
  }
  function locate(){
    if(location==="denied"){setCoords({lat:12.9716,lng:77.7507});setLocation("demo");return}
    setLocation("locating");
    if(!navigator.geolocation){setLocation("denied");return}
    navigator.geolocation.getCurrentPosition(
      position=>{setCoords({lat:position.coords.latitude,lng:position.coords.longitude});setLocation("ready")},
      ()=>setLocation("denied"),
      {enableHighAccuracy:true,timeout:8000},
    );
  }

  async function submitReport(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!photo||!coords){showNotice({kind:"error",message:copy.errors.photoLocation});return}
    setSubmitting(true);
    try{
      const form=new FormData(e.currentTarget);
      const upload=new FormData(); upload.set("photo",photo);
      const response=await fetch("/api/uploads",{method:"POST",headers:{"x-demo-role":"citizen","idempotency-key":`citizen-upload-${crypto.randomUUID()}`},body:upload});
      if(!response.ok){showNotice({kind:"error",message:copy.errors.photoStore});return}
      const body=await response.json() as {data?:{assetId?:string}};
      if(!body.data?.assetId){showNotice({kind:"error",message:copy.errors.photoReceipt});return}
      report({title:String(form.get("title")),category:String(form.get("category")),hygiene:String(form.get("hygiene")) as "low"|"moderate"|"high"|"severe",obstruction:String(form.get("obstruction")) as "none"|"partial"|"significant"|"traffic_lane",location:coords,photoUrl:body.data.assetId});
      showNotice({kind:"success",message:copy.reportDone});
      setPhoto(undefined);
      setStep("track");
    } finally {
      setSubmitting(false);
    }
  }

  if(!ready) return <AtlasShell role="citizen"><div className="page-wrap narrow-wrap"><SkeletonBlock rows={3}/></div></AtlasShell>;

  return <AtlasShell role="citizen">
    <div className="atlas-split" lang={locale==="kn"?"kn":"en"}>
      <section className="atlas-map">
        <BengaluruMap markers={markers} route={state.route.roadPath} vehiclePaths={state.route.roadPathByVehicle} geometrySource={state.route.roadGeometrySource} tripStatus={trip} userLocation={state.userLocation?.location??MOCK_USER_LOCATION} height="100%"/>
      </section>
      <aside className="atlas-rail">
        <section className="rail-hero">
          <p className="eyebrow">Mahadevapura pilot · wards 28–50</p>
          <h1>{copy.hero}</h1>
          <div className="hero-eta"><Truck size={28}/><span>ETA</span><strong>{nearest?(etaMinutes!==null?`${etaMinutes} min`:copy.etaWaiting):copy.etaWaiting}</strong><small>{etaMinutes!==null?copy.etaLive:"Simulated estimate"}</small></div>
        </section>
        {notice&&<div className={notice.kind==="error"?"toast-inline toast-error":"toast-inline"} role={notice.kind==="error"?"alert":"status"}><CheckCircle2 size={18}/>{notice.message}</div>}
        <div className="flow-tabs" role="tablist" aria-label="Citizen steps">
          {tabs.map(item=>(
            <button key={item.id} role="tab" aria-selected={step===item.id} className={step===item.id?"flow-tab active":"flow-tab"} onClick={()=>setStep(item.id)}>
              {item.label}
              {item.id==="verify"&&awaiting&&<span className="dot" aria-hidden="true"/>}
            </button>
          ))}
        </div>
        {/* key={step} remounts the panel so the entrance transition replays */}
        <div key={step} className="step-panel" role="tabpanel">
          {step==="signal"&&<>
            <section className="panel" aria-labelledby="quick-title">
              <div className="section-heading"><p className="eyebrow">{copy.signalsTitle}</p><h2 className="title" id="quick-title">What is waiting?</h2></div>
              <div className="action-grid">
                <button data-testid="signal-have-waste" className="signal-card" disabled={busy||submitting} onClick={()=>sendSignal("have_waste")}><span className="signal-icon"><Trash2/></span><strong>{copy.haveWaste}</strong><small>{copy.haveWasteHint}</small><span>{copy.sendSignal}</span></button>
                <button data-testid="signal-outside" className="signal-card amber-card" disabled={busy||submitting} onClick={()=>sendSignal("waste_outside")}><span className="signal-icon"><Radio/></span><strong>{copy.outside}</strong><small>{copy.outsideHint}</small><span>{copy.sendSignal}</span></button>
              </div>
            </section>
            <section className="panel">
              <div className="section-heading"><p className="eyebrow">{copy.report}</p><h2 className="title">See something? Show the city.</h2></div>
              <form className="report-form" onSubmit={submitReport}>
                <label className="upload-drop"><Camera/><strong>{photo?copy.uploadReady:copy.uploadEmpty}</strong><span>{photo?`${Math.round(photo.size/1024)} KB · ${copy.uploadMeta}`:copy.uploadHint}</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(file){try{setPhoto(await sanitizeEvidence(file))}catch(error){showNotice({kind:"error",message:error instanceof Error?error.message:copy.errors.imagePrepare})}}}}/></label>
                <label><span>{copy.title}</span><input name="title" required maxLength={120} placeholder={copy.titlePlaceholder}/></label>
                <label><span>{copy.category}</span><select name="category" defaultValue="mixed">{Object.entries(copy.categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>{copy.hygiene}</span><select name="hygiene" defaultValue="high">{Object.entries(copy.hygieneLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>{copy.obstruction}</span><select name="obstruction" defaultValue="partial">{Object.entries(copy.obstructionLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                <button type="button" className="location-button" onClick={locate}><LocateFixed size={18}/>{location==="locating"?"Finding your location…":location==="ready"?"Location captured":location==="demo"?"Demo location · Whitefield":location==="denied"?"Permission denied · use labelled demo location":"Capture my location"}</button>
                <button data-testid="report-submit" className="primary-button wide-button" type="submit" disabled={submitting}>{submitting?copy.submitPending:copy.submit}{!submitting&&<Navigation size={18}/>}</button>
              </form>
            </section>
          </>}
          {step==="track"&&<>
            <ReportTracker reports={myReports} stepIndexFor={status=>STEP_INDEX[status]??0} reopenedLabel={copy.trackerReopened} currentLabel={copy.stepCurrent} emptyLabel={copy.trackerEmpty} steps={copy.steps}/>
            <section className="panel">
              <div className="section-heading"><p className="eyebrow">Live collection</p><h2 className="title">{copy.truck}</h2></div>
              {nearest
                ? <div className="truck-card"><span className="truck-avatar"><Truck/></span><div><strong>{nearest.label}</strong><p>Auto-tipper · on the way</p><span><Clock3 size={15}/>{trip?`${trip.totalKm} km trip · ${trip.sub}`:`${etaMinutes??copy.etaWaiting} min`}</span></div><b>{Math.round(nearest.loadLitres/nearest.capacityLitres*100)}% loaded</b></div>
                : <div className="empty-state" role="status">{copy.noVehicle}</div>}
            </section>
            <section className="panel">
              <div className="section-heading"><p className="eyebrow">Sensor status</p><h2 className="title">{copy.bins}</h2></div>
              {listedBins.length===0&&<div className="empty-state" role="status">{copy.noBins}</div>}
              <div className="bin-list">{listedBins.map(bin=>(
                <div className="bin-row" key={bin.id}>
                  <span className={`fill-ring fill-${bin.status}`} style={{"--fill":`${Math.round(bin.fillPercent*3.6)}deg`} as React.CSSProperties}><b>{bin.fillPercent}%</b></span>
                  <div><strong>{bin.label}</strong><p>{bin.locality} · {bin.accepted.join(" + ")}</p><small>{bin.status==="full"?copy.binFull:bin.status==="offline"?copy.binOffline:bin.status==="filling"?`${copy.binSpace} · filling`:copy.binSpace}</small></div>
                </div>
              ))}</div>
            </section>
          </>}
          {step==="verify"&&<>
            {awaiting&&<section className="panel confirmation-panel">
              <div><p className="eyebrow">Cleanup confirmation</p><h2 className="title">Was {awaiting.locality} cleaned?</h2><p>Collector proof was accepted. Your confirmation closes the public audit loop.</p></div>
              <EvidencePair proof={state.proofs.find(p=>p.reportId===awaiting.id&&(p.beforeAssetId||p.afterAssetId))} eyebrow={copy.evidenceEyebrow} beforeLabel={copy.evidenceBefore} afterLabel={copy.evidenceAfter} note={copy.evidenceNote}/>
              <div className="confirmation-actions">
                <button data-testid="confirm-cleaned" className="primary-button" disabled={busy} onClick={()=>confirmCleanup("cleaned")}>{copy.cleaned}</button>
                <button className="secondary-button" disabled={busy} onClick={()=>confirmCleanup("partial")}>{copy.partial}</button>
                <button className="secondary-button danger-text" disabled={busy} onClick={()=>confirmCleanup("still_present")}>{copy.present}</button>
              </div>
            </section>}
            <section className="panel">
              <div className="section-heading"><p className="eyebrow">Transparent updates</p><h2 className="title">{copy.activity}</h2></div>
              {state.events.length===0&&<div className="empty-state" role="status">{copy.noEvents}</div>}
              <ol className="timeline">{state.events.slice(-6).reverse().map(event=>(<li key={event.id}><span/><div><strong>{event.message}</strong><small>{new Date(event.occurredAt).toLocaleString(copy.localeTag)} · audit cursor {event.cursor}</small></div></li>))}</ol>
            </section>
          </>}
        </div>
      </aside>
    </div>
  </AtlasShell>;
}
