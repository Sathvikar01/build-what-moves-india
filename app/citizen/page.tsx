"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BengaluruMap, type MapMarker } from "../../src/components/bengaluru-map";
import { tripStatusFor } from "../../src/components/trip-status";
import { useDemo } from "../../src/components/demo-provider";
import { useRequireUser } from "../../src/components/auth";
import { citizenCopy } from "../../src/data/copy";
import { sanitizeEvidence } from "../../src/client/image";
import { MOCK_USER_LOCATION } from "../../src/components/bengaluru-map";
import { EvidencePair, ReportTracker } from "../../src/components/ui-bits";

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
  const [location,setLocation]=useState<"idle"|"ready"|"locating"|"denied"|"demo">("idle");
  const [coords,setCoords]=useState<{lat:number;lng:number}>();
  const [photo,setPhoto]=useState<File>();

  useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current)},[]);

  const nearest=state.vehicles.find(v=>v.status!=="offline");
  const trip=tripStatusFor(state);
  const markers=useMemo<MapMarker[]>(()=>[
    ...state.vehicles.filter(v=>v.status!=="offline").map(v=>({id:v.id,label:v.label,location:v.location,kind:"vehicle" as const,detail:`${v.status.replaceAll("_"," ")} · synthetic`})),
    ...state.bins.slice(0,5).map(b=>({id:b.id,label:b.label,location:b.location,kind:"bin" as const,detail:`${Math.round(b.fillPercent)}% full`,overflow:b.fillPercent>=100})),
  ],[state.vehicles,state.bins]);
  // Map/list parity: the sensor list shows the same bins the map plots.
  const listedBins=state.bins.slice(0,5);
  const myReports=useMemo(()=>state.reports.filter(r=>r.id.startsWith("rep-citizen-")||r.id.startsWith("rep-api-")),[state.reports]);
  const awaiting=state.reports.find(r=>r.status==="cleaned");

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

  if(!ready) return <div className="page"><p>Loading…</p></div>;

  return <div>
    <nav>
      <button onClick={()=>setStep("signal")}>{copy.signalsTitle}</button>
      <button onClick={()=>setStep("track")}>{copy.trackerTitle}</button>
      <button onClick={()=>setStep("verify")}>{copy.activity}</button>
    </nav>
    {notice&&<p role={notice.kind==="error"?"alert":"status"}>{notice.message}</p>}

    {step==="signal"&&<>
      <section>
        <h2>What is waiting?</h2>
        <button data-testid="signal-have-waste" disabled={busy||submitting} onClick={()=>sendSignal("have_waste")}>{copy.haveWaste} — {copy.haveWasteHint}</button>
        <button data-testid="signal-outside" disabled={busy||submitting} onClick={()=>sendSignal("waste_outside")}>{copy.outside} — {copy.outsideHint}</button>
      </section>
      <section>
        <h2>See something? Show the city.</h2>
        <form onSubmit={submitReport}>
          <label>
            {photo?copy.uploadReady:copy.uploadEmpty}
            <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(file){try{setPhoto(await sanitizeEvidence(file))}catch(error){showNotice({kind:"error",message:error instanceof Error?error.message:copy.errors.imagePrepare})}}}}/>
          </label>
          <label><span>{copy.title}</span><input name="title" required maxLength={120} placeholder={copy.titlePlaceholder}/></label>
          <label><span>{copy.category}</span><select name="category" defaultValue="mixed">{Object.entries(copy.categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{copy.hygiene}</span><select name="hygiene" defaultValue="high">{Object.entries(copy.hygieneLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{copy.obstruction}</span><select name="obstruction" defaultValue="partial">{Object.entries(copy.obstructionLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <button type="button" onClick={locate}>{location==="locating"?"Finding your location…":location==="ready"?"Location captured":location==="demo"?"Demo location · Whitefield":location==="denied"?"Permission denied · use labelled demo location":"Capture my location"}</button>
          <button data-testid="report-submit" type="submit" disabled={submitting}>{submitting?copy.submitPending:copy.submit}</button>
        </form>
      </section>
    </>}

    {step==="track"&&<>
      <ReportTracker reports={myReports} stepIndexFor={status=>STEP_INDEX[status]??0} reopenedLabel={copy.trackerReopened} currentLabel={copy.stepCurrent} emptyLabel={copy.trackerEmpty} steps={copy.steps}/>
      <section>
        <h2>{copy.truck}</h2>
        {nearest
          ? <p><strong>{nearest.label}</strong> · {Math.round(nearest.loadLitres/nearest.capacityLitres*100)}% loaded · {trip?`${trip.totalKm} km route · ${trip.servicing?"emptying a stop":"heading to "}${trip.servicing?"":(trip.nextStopLabel??"the next stop")} · ETA ${trip.etaToNextMinutes} min`:"route pending"}</p>
          : <p role="status">{copy.noVehicle}</p>}
      </section>
      <section>
        <h2>{copy.bins}</h2>
        {listedBins.length===0&&<p role="status">{copy.noBins}</p>}
        <ul>
          {listedBins.map(bin=>(
            <li key={bin.id}>
              <strong>{bin.label}</strong> · {bin.locality} · {bin.fillPercent}% ({bin.status==="full"?copy.binFull:bin.status==="offline"?copy.binOffline:bin.status==="filling"?"filling":copy.binSpace})
            </li>
          ))}
        </ul>
      </section>
    </>}

    {step==="verify"&&<>
      {awaiting&&<section>
        <h2>Was {awaiting.locality} cleaned?</h2>
        <p>Collector proof was accepted. Your confirmation closes the public audit loop.</p>
        <EvidencePair proof={state.proofs.find(p=>p.reportId===awaiting.id&&(p.beforeAssetId||p.afterAssetId))} eyebrow={copy.evidenceEyebrow} beforeLabel={copy.evidenceBefore} afterLabel={copy.evidenceAfter} note={copy.evidenceNote}/>
        <div>
          <button data-testid="confirm-cleaned" disabled={busy} onClick={()=>confirmCleanup("cleaned")}>{copy.cleaned}</button>
          <button disabled={busy} onClick={()=>confirmCleanup("partial")}>{copy.partial}</button>
          <button disabled={busy} onClick={()=>confirmCleanup("still_present")}>{copy.present}</button>
        </div>
      </section>}
      <section>
        <h2>{copy.activity}</h2>
        {state.events.length===0&&<p role="status">{copy.noEvents}</p>}
        <ol>
          {state.events.slice(-6).reverse().map(event=>(
            <li key={event.id}><strong>{event.message}</strong> · {new Date(event.occurredAt).toLocaleString(copy.localeTag)} · audit cursor {event.cursor}</li>
          ))}
        </ol>
      </section>
    </>}

    <section>
      <h2>Ward map</h2>
      <BengaluruMap markers={markers} vehiclePaths={state.route.roadPathByVehicle} userLocation={state.userLocation?.location??MOCK_USER_LOCATION} height={420}/>
    </section>
  </div>;
}
