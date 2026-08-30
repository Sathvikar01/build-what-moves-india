"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Recycle, Route } from "lucide-react";
import { useAuth, type DemoRole } from "../../src/components/auth";
import { useDemo } from "../../src/components/demo-provider";
import { uiCopy } from "../../src/data/copy";

const roleMeta: { id: DemoRole; icon: typeof Recycle; hint: { en: string; kn: string } }[] = [
  { id: "citizen", icon: Recycle, hint: { en: "Report waste and track cleanup", kn: "ತ್ಯಾಜ್ಯ ವರದಿ ಮಾಡಿ ಮತ್ತು ಸ್ವಚ್ಛಗೊಳಿಸುವಿಕೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ" } },
  { id: "bbmp", icon: Building2, hint: { en: "Operate the control room", kn: "ನಿಯಂತ್ರಣ ಕೊಠಡಿ ನಿರ್ವಹಿಸಿ" } },
  { id: "collector", icon: Route, hint: { en: "Follow your route and submit proof", kn: "ನಿಮ್ಮ ಮಾರ್ಗವನ್ನು ಹಿಂಬಾಲಿಸಿ ಮತ್ತು ಪುರಾವೆ ಸಲ್ಲಿಸಿ" } },
];

const roleHome: Record<DemoRole, string> = { citizen: "/citizen", bbmp: "/bbmp", collector: "/collector" };

export default function LoginPage(){
  const { locale, setLocale } = useDemo(); const copy = uiCopy[locale].login;
  const { login } = useAuth();
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [role,setRole]=useState<DemoRole>("citizen"); const [error,setError]=useState("");

  function submit(e: React.FormEvent){
    e.preventDefault();
    const digits=phone.replace(/\D/g,"");
    if(!name.trim()){setError(copy.errors.name);return}
    if(digits.length!==10){setError(copy.errors.phone);return}
    login({name:name.trim(),phone:digits,role});
    const next=new URLSearchParams(window.location.search).get("next");
    window.location.href=next&&next.startsWith("/")?next:roleHome[role];
  }

  // Split gate: deep-green editorial stage on the left, sign-in desk on the right.
  return <main className="gate-page" lang={locale==="kn"?"kn":"en"}>
    <section className="gate-stage" aria-hidden="true">
      <p className="gate-kicker">Mahadevapura pilot · wards 28–50</p>
      <p className="gate-statement">Report a pile. Watch the route change. <em>Confirm the street is clean.</em></p>
      <div className="gate-meta">
        <span>Seed 4242</span>
        <span>Synthetic operations</span>
        <span>Real Bengaluru geography</span>
      </div>
      <span className="gate-kannada" lang="kn">ಸ್ವಚ್ಛ ಬೆಂಗಳೂರು</span>
    </section>
    <section className="gate-desk">
      <header className="gate-top">
        <Link className="brand" href="/" aria-label="Bengaluru Smart Waste home">
          <span className="brand-mark" aria-hidden="true">BW</span>
          <span><strong>Bengaluru Smart Waste</strong><small>Sign in</small></span>
        </Link>
        <div className="gate-top-actions">
          <button type="button" className="quiet-button" onClick={()=>setLocale(locale==="en"?"kn":"en")} aria-label="Switch language">{locale==="en"?"ಕನ್ನಡ":"English"}</button>
          <Link className="quiet-button" style={{textDecoration:"none"}} href="/"><ArrowLeft size={16}/>{copy.back}</Link>
        </div>
      </header>
      <form className="gate-form" onSubmit={submit} noValidate>
        <div className="gate-heading">
          <p className="eyebrow">Choose your desk</p>
          <h1>{copy.title}</h1>
          <p>{copy.sub}</p>
        </div>
        <div className="role-segment" role="radiogroup" aria-label={copy.role}>
          {roleMeta.map(item=>{
            const Icon=item.icon;
            return <button type="button" key={item.id} role="radio" aria-checked={role===item.id} className={role===item.id?"active":""} onClick={()=>setRole(item.id)}>
              <Icon size={17} aria-hidden="true"/><span>{copy.roles[item.id]}</span>
            </button>;
          })}
        </div>
        <label className="gate-field"><span>{copy.name}</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={60}/></label>
        <label className="gate-field"><span>{copy.phone}</span><input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="numeric" maxLength={12} placeholder="9876543210"/></label>
        {error&&<p className="gate-error danger-text" role="alert">{error}</p>}
        <button type="submit" className="gate-submit">{copy.submit}<ArrowRight size={18} aria-hidden="true"/></button>
      </form>
    </section>
  </main>;
}
