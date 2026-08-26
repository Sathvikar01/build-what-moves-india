"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

// ─── Loading skeleton ────────────────────────────────────────────────────────
export function SkeletonBlock({rows=3,label="Loading live scenario…"}:{rows?:number;label?:string}){
  return <div className="skeleton-block" role="status" aria-live="polite" aria-label={label}>
    {Array.from({length:rows},(_,index)=><span key={index} className={`skeleton-line skeleton-${index%3}`} style={{width:`${88-index*17}%`}}/>)}
  </div>;
}

// ─── Inline toast ────────────────────────────────────────────────────────────
export type ToastNotice={kind:"success"|"error";message:string};
export function Toast({notice,onDone}: {notice?:ToastNotice;onDone?:()=>void}){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    if(timer.current)clearTimeout(timer.current);
    if(notice?.kind==="success")timer.current=setTimeout(()=>onDone?.(),6000);
    return()=>{if(timer.current)clearTimeout(timer.current)};
  },[notice,onDone]);
  if(!notice)return null;
  return <div className={notice.kind==="error"?"toast-inline toast-error":"toast-inline"} role={notice.kind==="error"?"alert":"status"}><CheckCircle2 size={18}/>{notice.message}</div>;
}

// ─── Before/after evidence pair ──────────────────────────────────────────────
export function EvidencePair({proof,eyebrow,beforeLabel,afterLabel,note}:{proof?:{beforeAssetId?:string;afterAssetId?:string;note?:string}|null;eyebrow:string;beforeLabel:string;afterLabel:string;note:string}){
  if(!proof||(!proof.beforeAssetId&&!proof.afterAssetId))return null;
  return <figure className="evidence-pair">
    <figcaption className="eyebrow">{eyebrow}</figcaption>
    <div className="evidence-grid">
      {proof.beforeAssetId&&<figure><img src={`/api/uploads/${encodeURIComponent(proof.beforeAssetId)}`} alt={`${beforeLabel}: stored cleanup evidence`} loading="lazy"/><figcaption>{beforeLabel}</figcaption></figure>}
      {proof.afterAssetId&&<figure><img src={`/api/uploads/${encodeURIComponent(proof.afterAssetId)}`} alt={`${afterLabel}: stored cleanup evidence`} loading="lazy"/><figcaption>{afterLabel}</figcaption></figure>}
    </div>
    <small>{note}</small>
  </figure>;
}

// ─── Citizen report status tracker ───────────────────────────────────────────
const STEP_COUNT=5;
export function ReportTracker({reports,stepIndexFor,reopenedLabel,currentLabel,emptyLabel,steps}:{reports:{id:string;title:string;locality:string;status:string;createdAt:string}[];stepIndexFor:(status:string)=>number;reopenedLabel:string;currentLabel:string;emptyLabel:string;steps:readonly string[]}){
  const [expanded,setExpanded]=useState<string|null>(null);
  if(reports.length===0)return <section className="panel tracker-panel"><div className="section-heading"><p className="eyebrow">Your requests</p><h2>My reports</h2></div><div className="empty-state" role="status">{emptyLabel}</div></section>;
  return <section className="panel tracker-panel">
    <div className="section-heading"><p className="eyebrow">Your requests</p><h2>My reports</h2></div>
    <ol className="tracker-list">
      {reports.map(report=>{
        const index=Math.min(stepIndexFor(report.status),STEP_COUNT-1);
        const done=report.status==="confirmed";
        const reopened=report.status==="reopened";
        return <li key={report.id} className={done?"tracker-row done":reopened?"tracker-row reopened":"tracker-row"}>
          <button type="button" className="tracker-head" aria-expanded={expanded===report.id} onClick={()=>setExpanded(expanded===report.id?null:report.id)}>
            <strong>{report.title}</strong>
            <span>{report.locality} · {report.status.replaceAll("_"," ")}</span>
            {reopened&&<em className="tracker-flag">{reopenedLabel}</em>}
            <b aria-hidden="true">{expanded===report.id?"−":"+"}</b>
          </button>
          {expanded===report.id&&<ol className="stepper" aria-label={currentLabel}>
            {steps.slice(0,STEP_COUNT).map((label,step)=>(
              <li key={label} className={step<index?"stepper-step done":step===index?done?"stepper-step done current":"stepper-step current":"stepper-step"} aria-current={step===index&&!done?"step":undefined}>
                <i/><span>{label}</span>
              </li>
            ))}
          </ol>}
        </li>;
      })}
    </ol>
  </section>;
}

// ─── Empty state helper ──────────────────────────────────────────────────────
export function EmptyState({children}:{children:ReactNode}){return <div className="empty-state" role="status">{children}</div>}
