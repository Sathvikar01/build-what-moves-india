"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { optimizeRoutes } from "../domain/optimizer";
import { createDemoState, SYNTHETIC_SOURCE, toWorkStops } from "../data/demo";
import { MOCK_USER_LOCATION } from "./bengaluru-map";
import { appendEvents, makeCitizenReport } from "../domain/simulate";
import type { DemoState, WasteSignal } from "../domain/types";

type Locale = "en" | "kn";
type DemoContextValue = {
  state: DemoState; locale: Locale; setLocale: (locale:Locale)=>void; reset:()=>void; tick:()=>void;
  lastError: string | null; clearError: ()=>void;
  busy: boolean;
  signal:(type:WasteSignal["type"],location?:{lat:number;lng:number})=>void; report:(input:{title:string;category:string;hygiene:"low"|"moderate"|"high"|"severe";obstruction:"none"|"partial"|"significant"|"traffic_lane";location?:{lat:number;lng:number};photoUrl?:string})=>void;
  reoptimize:(trigger?:string)=>void; publishRoute:()=>void; selectReport:(id:string)=>void;
  stopAction:(action:"arrived"|"collected"|"blocked")=>void; acceptProof:(input:{stopId?:string;beforeAssetId:string;afterAssetId:string;gps:{lat:number;lng:number};gpsMode:"captured"|"demo";checklist:Record<string,boolean>})=>Promise<boolean>; confirmCleanup:(outcome:"cleaned"|"partial"|"still_present")=>void;
};

const DemoContext=createContext<DemoContextValue|null>(null);

function preferredLocale():Locale{
  if(typeof window==="undefined") return "en";
  return window.localStorage.getItem("bsw-locale")==="kn"?"kn":"en";
}

export function DemoProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<DemoState>(()=>createDemoState());
  const [locale,setLocale]=useState<Locale>(preferredLocale);
  const [busy,setBusy]=useState(false);
  const [lastError,setLastError]=useState<string|null>(null);
  const appliedSyncKey=useRef<string|null>(null);
  const inflight=useRef(0);
  useEffect(()=>{document.documentElement.lang=locale;localStorage.setItem("bsw-locale",locale)},[locale]);
  const role=()=>window.location.pathname.startsWith("/bbmp")?"bbmp":window.location.pathname.startsWith("/collector")?"collector":"citizen";

  const syncFromApi=useCallback(async()=>{
    // Skip a poll while a mutation is in flight so optimistic updates are not
    // clobbered by a stale snapshot; the mutation re-syncs when it completes.
    if(inflight.current>0) return;
    try{
      const response=await fetch("/api/state",{headers:{"x-demo-role":role()}});
      if(!response.ok){setLastError("Live sync failed. Showing the last known state.");return}
      const body=await response.json() as {data:DemoState;meta?:{cursor?:number}};
      const cursor=body.meta?.cursor??body.data.events.at(-1)?.cursor??null;
      // The day-cycle engine advances state every second without appending
      // events, so the dedupe key covers the cursor AND the simulation clock.
      const syncKey=`${cursor??-1}:${body.data.now}:${body.data.dayCycle?.phase??"-"}:${body.data.dayCycle?.progressKm??0}`;
      if(syncKey===appliedSyncKey.current) return;
      appliedSyncKey.current=syncKey;
      setLastError(null);
      setState(body.data);
    }catch{setLastError("Live sync failed. Showing the last known state.")}
  },[]);

  const push=useCallback(async(path:string,body:unknown,asRole:"citizen"|"bbmp"|"collector")=>{
    inflight.current++;
    try{
      const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json","x-demo-role":asRole,"idempotency-key":`${asRole}-${Date.now()}-${Math.random().toString(36).slice(2)}`},body:JSON.stringify(body)});
      if(!response.ok) setLastError("The last action could not be saved to the demo server. Re-syncing.");
      await syncFromApi();
    }catch{setLastError("The last action could not reach the demo server. Re-syncing.");await syncFromApi()}
    finally{inflight.current--}
  },[syncFromApi]);

  useEffect(()=>{
    // Defer the first sync off the commit phase (lint: set-state-in-effect).
    queueMicrotask(()=>void syncFromApi());
    const timer=setInterval(()=>void syncFromApi(),2000);
    return()=>clearInterval(timer);
  },[syncFromApi]);

  const reset=useCallback(()=>{setState(createDemoState());appliedSyncKey.current=null;void push("/api/demo/reset",{},"bbmp")},[push]);
  const reoptimize=useCallback((trigger="manual_reoptimization")=>{setState(prev=>{const route=optimizeRoutes(prev.vehicles,toWorkStops(prev),trigger,prev.seed,prev.route);return {...prev,route,lastAction:"Route update available",events:appendEvents(prev,[{type:"route.revised",entityId:route.id,message:`Route revised because of ${trigger.replaceAll("_"," ")}.`}])};});void push("/api/routing/optimize",{trigger},"bbmp")},[push]);

  const tick=useCallback(()=>{
    // The server day-cycle engine owns vehicles/bins; the manual button only
    // nudges the local clock until the next poll re-syncs authoritatively.
    setState(prev=>({...prev,tick:prev.tick+1,now:new Date(Date.parse(prev.now)+30000).toISOString(),lastAction:"Live telemetry advanced 30 seconds",events:appendEvents(prev,[{type:"demo.ticked",entityId:"scenario-mahadevapura",message:`Simulation advanced to tick ${prev.tick+1}.`}])}));
    void push("/api/demo/tick",{seconds:30},role()==="collector"?"collector":"bbmp");
  },[push]);

  const signal=useCallback((type:WasteSignal["type"],location?:{lat:number;lng:number})=>{
    const at=location??MOCK_USER_LOCATION;
    setState(prev=>{
      const id=`sig-citizen-${prev.signals.length+1}`;
      const created:WasteSignal={id,type,category:"mixed",amountBand:type==="waste_outside"?"medium":"small",locality:"Whitefield",location:{...at},status:"queued",createdAt:prev.now,etaMinutes:9,source:SYNTHETIC_SOURCE};
      const next={...prev,signals:[created,...prev.signals],lastAction:type==="waste_outside"?"Waste-outside signal received · route recalculated":"Waste request received · route recalculated"};
      const route=optimizeRoutes(next.vehicles,toWorkStops(next),type==="waste_outside"?"new_waste_outside_signal":"new_citizen_signal",next.seed,prev.route);
      return {...next,route,events:appendEvents(prev,[
        {type:"signal.created",entityId:id,message:"Citizen signal received and included in demand pressure."},
        {type:"route.revised",entityId:route.id,message:"Route recalculated after new citizen demand."},
      ])};
    });
    void push("/api/signals",{type,category:"mixed",amountBand:type==="waste_outside"?"medium":"small",location:{...at}},"citizen");
  },[push]);

  const report=useCallback((input:{title:string;category:string;hygiene:"low"|"moderate"|"high"|"severe";obstruction:"none"|"partial"|"significant"|"traffic_lane";location?:{lat:number;lng:number};photoUrl?:string})=>{
    setState(prev=>{
      const id=`rep-citizen-${prev.reports.length+1}`;
      const created=makeCitizenReport({id,title:input.title,category:input.category,location:input.location??{lat:12.9716,lng:77.7507},photoUrl:input.photoUrl,hygiene:input.hygiene,obstruction:input.obstruction,now:prev.now,source:SYNTHETIC_SOURCE});
      const next={...prev,reports:[created,...prev.reports],selectedReportId:id,lastAction:`Report ${id} submitted · priority ${created.priority.audit.effectiveScore}`};
      const route=optimizeRoutes(next.vehicles,toWorkStops(next),"new_garbage_report",next.seed,prev.route);
      return {...next,route,events:appendEvents(prev,[
        {type:"report.submitted",entityId:id,message:"Citizen report scored with ten visible factors."},
        {type:"priority.updated",entityId:id,message:`Priority calculated at ${created.priority.audit.effectiveScore}.`},
        {type:"route.revised",entityId:route.id,message:"Route update available after new report."},
      ])};
    });
    void push("/api/reports",{title:input.title,category:input.category,location:input.location??{lat:12.9716,lng:77.7507},hygiene:input.hygiene,obstruction:input.obstruction,photoAssetId:input.photoUrl},"citizen");
  },[push]);

  const publishRoute=useCallback(()=>{setState(prev=>({...prev,route:{...prev.route,status:"published",version:prev.route.version+1},lastAction:"Route revision published to collectors",events:appendEvents(prev,[{type:"route.published",entityId:prev.route.id,message:"Route revision published to assigned collectors."}])}));void push("/api/routing/publish",{},"bbmp")},[push]);
  const selectReport=useCallback((id:string)=>setState(prev=>({...prev,selectedReportId:id})),[]);

  const stopAction=useCallback((action:"arrived"|"collected"|"blocked")=>{
    // Resolve the target stop from current state (never inside a state updater)
    // and mirror the server's status-transition rules optimistically.
    const primary=state.route.routes[0];
    const target=primary?.stops.find(s=>s.status!=="collected"&&s.status!=="blocked");
    if(!target) return;
    if(action==="collected"&&target.status!=="arrived") return;
    if(action==="arrived"&&!["pending","en_route"].includes(target.status)) return;
    const affectedWork=target.workId;
    setState(prev=>{
      const routes=prev.route.routes.map((r,ri)=>{
        if(ri!==0) return r;
        let handled=false;
        return {...r,stops:r.stops.map(s=>{if(handled||s.id!==target.id) return s;handled=true;return {...s,status:action};})};
      });
      let proofs=prev.proofs;
      if(action==="collected"&&prev.reports.some(r=>r.id===affectedWork)){
        proofs=[{id:`proof-${prev.proofs.length+1}-${Date.now()}`,reportId:affectedWork,stopId:target.id,capturedAt:prev.now,status:"pending_sync" as const,note:"Collection recorded. Before/after evidence, GPS and checklist still required.",source:SYNTHETIC_SOURCE},...proofs];
      }
      let route={...prev.route,routes};
      if(action==="blocked"&&affectedWork){
        route=optimizeRoutes(prev.vehicles,toWorkStops(prev).filter(work=>work.id!==affectedWork),"blocked_access",prev.seed,route);
        route.unassigned=[...route.unassigned,{id:affectedWork,reason:"Collector reported blocked access; dispatch review required"}];
      }
      const citizenFacing=prev.signals.some(s=>s.id===affectedWork)||prev.reports.some(r=>r.id===affectedWork);
      return {...prev,proofs,route,selectedReportId:affectedWork||prev.selectedReportId,lastAction:action==="arrived"?"Collector arrived on site":action==="collected"?"Collection recorded · cleanup proof required":"Blocked stop removed from the route suffix",events:appendEvents(prev,[
        {type:`route_stop.${action}`,entityId:affectedWork||prev.route.id,message:`Collector marked stop ${action}.`},
        ...(action==="collected"&&citizenFacing?[{type:"notification.citizen",entityId:affectedWork,message:"Truck collected waste near you — confirm the cleanup once it looks clean."}]:[]),
        ...(action==="blocked"&&citizenFacing?[{type:"notification.citizen",entityId:affectedWork,message:"The collector could not access the site near you. BBMP dispatch has been notified."}]:[]),
      ])};
    });
    void push(`/api/collector/stops/${target.id}/action`,{action},"collector");
  },[push,state.route.routes]);

  const acceptProof=useCallback(async(input:{beforeAssetId:string;afterAssetId:string;gps:{lat:number;lng:number};gpsMode:"captured"|"demo";checklist:Record<string,boolean>})=>{
    const proof=state.proofs.find(p=>p.status==="pending_sync"||p.status==="submitted");
    if(!proof){setState(prev=>({...prev,lastAction:"No cleanup proof is waiting"}));return false}
    try{
      const response=await fetch(`/api/collector/stops/${proof.stopId}/proof`,{method:"POST",headers:{"content-type":"application/json","x-demo-role":"collector","idempotency-key":`collector-proof-${proof.id}`},body:JSON.stringify(input)});
      if(!response.ok)throw new Error("Cleanup proof could not be accepted.");
      await syncFromApi();
      return true;
    }catch{setState(prev=>({...prev,lastAction:"Proof upload failed · evidence remains queued and the report is not cleaned"}));return false}
  },[state.proofs,syncFromApi]);

  const confirmCleanup=useCallback((outcome:"cleaned"|"partial"|"still_present")=>{
    const target=state.reports.find(r=>r.id===state.selectedReportId&&r.status==="cleaned")??state.reports.find(r=>r.status==="cleaned");
    if(!target){setState(prev=>({...prev,lastAction:"No verified cleanup is awaiting confirmation"}));return}
    const targetId=target.id;
    setState(prev=>{
      const reports=prev.reports.map(r=>r.id===targetId?{...r,status:(outcome==="cleaned"?"confirmed":"reopened") as typeof r.status}:r);
      const next={...prev,reports,lastAction:outcome==="cleaned"?"Cleanup confirmed · case closed":"Issue reopened and returned to priority queue"};
      const route=outcome==="cleaned"?next.route:optimizeRoutes(next.vehicles,toWorkStops(next),"citizen_reopened_report",next.seed,next.route);
      return {...next,route,events:appendEvents(prev,[{type:outcome==="cleaned"?"report.confirmed":"report.reopened",entityId:targetId,message:outcome==="cleaned"?"Citizen verified cleanup.":"Citizen reported incomplete cleanup; report reopened."}])};
    });
    void push(`/api/reports/${targetId}/confirmation`,{outcome},"citizen");
  },[push,state.reports]);

  const value=useMemo(()=>({state,locale,setLocale,reset,tick,lastError,busy,clearError:()=>setLastError(null),signal,report,reoptimize,publishRoute,selectReport,stopAction,acceptProof,confirmCleanup}),[state,locale,reset,tick,lastError,busy,signal,report,reoptimize,publishRoute,selectReport,stopAction,acceptProof,confirmCleanup]);
  return <DemoContext.Provider value={value}>
    {lastError&&<div className="sync-error" role="alert"><span>{lastError}</span><button type="button" className="quiet-button" onClick={()=>setLastError(null)}>Dismiss</button></div>}
    {children}
  </DemoContext.Provider>;
}

export function useDemo(){const value=useContext(DemoContext); if(!value) throw new Error("useDemo must be used within DemoProvider"); return value;}
