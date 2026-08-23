"use client";

import { useState } from "react";
import { ArrowLeft, Building2, Recycle, Route } from "lucide-react";
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

  return <main className="login-shell" lang={locale==="kn"?"kn":"en"}>
    <div className="login-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="brand-mark" aria-hidden="true">BW</span>
        <div style={{display:"flex",gap:8}}>
          <button type="button" className="quiet-button" onClick={()=>setLocale(locale==="en"?"kn":"en")} aria-label="Switch language">{locale==="en"?"ಕನ್ನಡ":"English"}</button>
          <a className="quiet-button" style={{textDecoration:"none"}} href="/"><ArrowLeft size={16}/>{copy.back}</a>
        </div>
      </div>
      <h1>{copy.title}</h1>
      <p>{copy.sub}</p>
      <form onSubmit={submit} noValidate>
        <label><span>{copy.name}</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={60}/></label>
        <label><span>{copy.phone}</span><input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="numeric" maxLength={12} placeholder="9876543210"/></label>
        <label><span>{copy.role}</span></label>
        <div className="login-roles" role="radiogroup" aria-label={copy.role}>
          {roleMeta.map(item=>{
            const Icon=item.icon;
            return <button type="button" key={item.id} role="radio" aria-checked={role===item.id} className={role===item.id?"active":""} onClick={()=>setRole(item.id)}>
              <Icon size={18}/><span>{copy.roles[item.id]}<small lang={locale==="kn"?"en":"kn"}>{locale==="kn"?item.hint.en:item.hint.kn}</small></span>
            </button>;
          })}
        </div>
        {error&&<p className="danger-text" role="alert" style={{margin:0,fontSize:12}}>{error}</p>}
        <button type="submit" className="primary-button wide-button">{copy.submit}</button>
      </form>
    </div>
  </main>;
}
