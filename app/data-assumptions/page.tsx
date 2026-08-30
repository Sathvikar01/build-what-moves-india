import Link from "next/link";
import { ArrowLeft, Database, Map, Route, ShieldCheck, Trash2 } from "lucide-react";
import { priorityConfig } from "../../src/domain/priority";

const sources=[
 {title:"Pilot boundary + population",body:"Current GBA 2025 Bengaluru East City Corporation, Mahadevapura Assembly wards 28–50. Official ward report total: 408,815 people across 23 wards.",href:"https://www.bbmp.gov.in/maps/",label:"Official corporation maps"},
 {title:"Roads, place names, POIs and exclusions",body:"OpenStreetMap supplies roads, localities, building-density proxies, water, rail and highway features. © OpenStreetMap contributors, ODbL 1.0.",href:"https://www.openstreetmap.org/copyright",label:"OpenStreetMap attribution"},
 {title:"Demographic context",body:"Historical context comes from Census of India PCA 2011. Current pilot counts use the official 2025 delimitation report.",href:"https://censusindia.gov.in/nada/index.php/catalog/6763/study-description",label:"Census India PCA"},
];

export default function AssumptionsPage(){
  return <main className="docs-page">
    <header className="docs-top">
      <Link href="/"><ArrowLeft size={16}/>Back to role switch</Link>
      <span className="demo-badge">Evidence + limits</span>
    </header>
    <div className="docs-hero">
      <p className="eyebrow">Trust before spectacle</p>
      <h1>Data, assumptions and algorithm cards.</h1>
      <p>This pilot keeps real Bengaluru geography separate from clearly labelled synthetic operations. No BBMP official live vehicle or smart-bin feed is connected to this demo.</p>
    </div>
    <div className="docs-body">
      <nav className="docs-toc" aria-label="Document sections">
        <a href="#ch-sources"><i>01</i>Data sources</a>
        <a href="#ch-priority"><i>02</i>Priority model</a>
        <a href="#ch-route"><i>03</i>Route algorithm</a>
        <a href="#ch-placement"><i>04</i>Bin placement</a>
        <a href="#ch-privacy"><i>05</i>Privacy</a>
      </nav>
      <div className="docs-chapters">
        <section className="doc-chapter" id="ch-sources">
          <div className="chapter-head"><span className="chapter-no" aria-hidden="true">01</span><div><Map aria-hidden="true"/><h2>Data sources</h2></div></div>
          <dl className="source-list">
            {sources.map(s=>(
              <div className="source-item" key={s.title}>
                <dt>{s.title}<small>{s.label}</small></dt>
                <dd>{s.body}</dd>
                <a href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>
              </div>
            ))}
          </dl>
        </section>
        <section className="doc-chapter" id="ch-priority">
          <div className="chapter-head"><span className="chapter-no" aria-hidden="true">02</span><div><Database aria-hidden="true"/><h2>Priority model</h2><p className="chapter-sub">Ten observations. One additive result. Missing observations contribute zero, remain visible and reduce coverage. Coverage below 60% or missing safety fields requires manual review. Biomedical or chemical waste and traffic-lane blockage activate a separate floor of 90.</p></div></div>
          <div className="table-scroll"><table className="data-table">
            <caption>Complete priority factor configuration</caption>
            <thead><tr><th>Factor</th><th>Weight</th><th>Normalization</th></tr></thead>
            <tbody>{priorityConfig.factorDefinitions.map(f=><tr key={f.key}><th scope="row">{f.label}</th><td>{f.weight}</td><td>{f.normalization}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="doc-chapter" id="ch-route">
          <div className="chapter-head"><span className="chapter-no" aria-hidden="true">03</span><div><Route aria-hidden="true"/><h2>Route algorithm</h2><p className="chapter-sub">Five colonies, one feasible route.</p></div></div>
          <dl className="source-list method-list">
            <div className="source-item"><dt>Search</dt><dd>18 iterations · 8 ants for each of smart-bin fill, citizen demand, report severity, urban density and travel efficiency. Seed 4242.</dd></div>
            <div className="source-item"><dt>Adaptation</dt><dd>Base weights 24/22/24/15/15 respond to current urgency. Pheromone evaporates at 0.25; exploration is 0.08.</dd></div>
            <div className="source-item"><dt>Travel</dt><dd>Bundled route geometry is preferred; this demo labels the deterministic Haversine · 1.25 fallback at 20 km/h.</dd></div>
            <div className="source-item"><dt>Guardrails</dt><dd>Capacity and stop limits are enforced. Infeasible work remains visible with a reason; route explanations include all five signals.</dd></div>
          </dl>
        </section>
        <section className="doc-chapter" id="ch-placement">
          <div className="chapter-head"><span className="chapter-no" aria-hidden="true">04</span><div><Trash2 aria-hidden="true"/><h2>Bin placement</h2><p className="chapter-sub">Suitable sites, not merely busy ones. A 120 m EPSG:32643 pilot grid is scored for population, buildings, coverage gap, demand, reports, POIs, road and pedestrian access, and verified public land. Hard exclusions remove buildings, water/drains, rail/airport, unsafe highways and points within 150 m of a bin. Selected cells are diversified at 300 m.</p></div></div>
        </section>
        <section className="doc-chapter chapter-privacy" id="ch-privacy">
          <div className="chapter-head"><span className="chapter-no" aria-hidden="true">05</span><div><ShieldCheck aria-hidden="true"/><h2>Privacy and demo authorization</h2><p className="chapter-sub">Operational telemetry, citizen actions, ETAs and cleanup evidence are deterministic synthetic data. Exact citizen locations belong only in role-guarded operational detail; public views use locality or coarsened cells. Demo role headers are a judge-friendly simulation — not production identity.</p></div></div>
        </section>
      </div>
    </div>
  </main>;
}
