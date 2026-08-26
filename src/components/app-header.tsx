"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Languages, LogOut, RotateCcw, StepForward } from "lucide-react";
import { useDemo } from "./demo-provider";
import { useAuth } from "./auth";
import { uiCopy } from "../data/copy";

const roleHomes = { citizen: "/citizen", bbmp: "/bbmp", collector: "/collector" } as const;

export function AppHeader({role}:{role:"citizen"|"bbmp"|"collector"}){
  const {state,locale,setLocale,reset,tick,busy}=useDemo(); const copy=uiCopy[locale];
  const {user,logout}=useAuth();
  const [switcherOpen,setSwitcherOpen]=useState(false);
  const switcherRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!switcherOpen) return;
    const onClick=(event:MouseEvent)=>{if(!switcherRef.current?.contains(event.target as Node))setSwitcherOpen(false)};
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setSwitcherOpen(false)};
    document.addEventListener("mousedown",onClick);
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("mousedown",onClick);document.removeEventListener("keydown",onKey)};
  },[switcherOpen]);

  function handleLogout(){
    logout();
    // Keep the deep-link intact so sign-in returns the user to this console.
    window.location.href=`/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  function handleReset(){
    // Reset wipes the shared scenario for every viewer; confirm first and
    // ignore repeats while a request is already running.
    if(busy)return;
    if(!window.confirm(locale==="kn"?"ಡೆಮೊ ಅನ್ನು ಸೀಡ್ 4242 ಗೆ ಮರುಹೊಂದಿಸಲಾಗುತ್ತಿದೆ. ಮುಂದುವರಿಸಬೇಕೆ?":"Reset the demo scenario to seed 4242? Every console will restart from the seeded state."))return;
    reset();
  }

  return <header className="app-header" lang={locale==="kn"?"kn":"en"}>
    <Link href="/" className="app-brand"><span className="brand-mark" aria-hidden="true">BW</span><span><strong>Bengaluru Smart Waste</strong><small>{copy.header[role]}</small></span></Link>
    <div className="app-status"><span className="demo-badge">Synthetic live operations</span><span className="freshness"><i className="status-light"/>Tick {state.tick} · {new Date(state.now).toLocaleTimeString(locale==="kn"?"kn-IN":"en-IN",{hour:"2-digit",minute:"2-digit"})}</span></div>
    <div className="app-actions">
      <button className="quiet-button" onClick={()=>setLocale(locale==="en"?"kn":"en")} aria-label={locale==="en"?"Switch language to Kannada":"Switch language to English"}><Languages size={17}/>{locale==="en"?"ಕನ್ನಡ":"English"}</button>
      <div className="role-switcher" ref={switcherRef}>
        <button type="button" className="quiet-button" aria-haspopup="menu" aria-expanded={switcherOpen} onClick={()=>setSwitcherOpen(open=>!open)}><ArrowRightLeft size={16}/>{copy.header[role]}</button>
        {switcherOpen&&<div className="role-switcher-menu" role="menu">
          {(Object.keys(roleHomes) as (keyof typeof roleHomes)[]).map(id=>
            <a key={id} role="menuitem" href={roleHomes[id]} className={id===role?"active":""} onClick={()=>setSwitcherOpen(false)}>{copy.header[id]}{id===role&&<span aria-hidden="true"> ·</span>}</a>)}
        </div>}
      </div>
      {user
        ? <span className="user-chip">{copy.hello}, <b>{user.name.split(" ")[0]}</b><button type="button" className="icon-button" onClick={handleLogout} aria-label={copy.signOut} title={copy.signOut}><LogOut size={15}/></button></span>
        : <a className="quiet-button" style={{textDecoration:"none"}} href="/login">{copy.signIn}</a>}
      {role!=="citizen"&&<button className="icon-button" disabled={busy} onClick={tick} aria-label="Advance demo 30 seconds" title="Advance demo"><StepForward size={18}/></button>}
      {role==="bbmp"&&<button className="icon-button" disabled={busy} onClick={handleReset} aria-label="Reset demo to seed 4242" title="Reset demo"><RotateCcw size={18}/></button>}
    </div>
  </header>;
}
