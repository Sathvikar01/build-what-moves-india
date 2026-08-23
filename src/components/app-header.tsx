"use client";

import { Languages, LogOut, RotateCcw, StepForward } from "lucide-react";
import { useDemo } from "./demo-provider";
import { useAuth } from "./auth";
import { uiCopy } from "../data/copy";

export function AppHeader({role}:{role:"citizen"|"bbmp"|"collector"}){
  const {state,locale,setLocale,reset,tick}=useDemo(); const copy=uiCopy[locale];
  const {user,logout}=useAuth();
  return <header className="app-header" lang={locale==="kn"?"kn":"en"}>
    <a href="/" className="app-brand"><span className="brand-mark" aria-hidden="true">BW</span><span><strong>Bengaluru Waste Coordination</strong><small>{copy.header[role]}</small></span></a>
    <div className="app-status"><span className="demo-badge">Independent prototype · synthetic data</span><span className="freshness"><i className="status-light"/>Tick {state.tick} · {new Date(state.now).toLocaleTimeString(locale==="kn"?"kn-IN":"en-IN",{hour:"2-digit",minute:"2-digit"})}</span></div>
    <div className="app-actions">
      <button className="quiet-button" onClick={()=>setLocale(locale==="en"?"kn":"en")} aria-label="Switch language"><Languages size={17}/>{locale==="en"?"ಕನ್ನಡ":"English"}</button>
      {user
        ? <span className="user-chip">{copy.hello}, <b>{user.name.split(" ")[0]}</b><button type="button" className="icon-button" style={{width:34,minHeight:34}} onClick={()=>{logout();window.location.href="/login"}} aria-label={copy.signOut} title={copy.signOut}><LogOut size={15}/></button></span>
        : <a className="quiet-button" style={{textDecoration:"none"}} href="/login">{copy.signIn}</a>}
      {role!=="citizen"&&<button className="icon-button" onClick={tick} aria-label="Advance demo 30 seconds" title="Advance demo"><StepForward size={18}/></button>}
      {role==="bbmp"&&<button className="icon-button" onClick={reset} aria-label="Reset demo to seed 4242" title="Reset demo"><RotateCcw size={18}/></button>}
    </div>
  </header>;
}
