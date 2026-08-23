"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { priorityConfig, type PriorityResult } from "../domain/priority";

function observation(value: unknown, present: boolean) {
  if (!present) return "Not observed";
  if (value && typeof value === "object") {
    const density = value as { populationDensityPerKm2?: number; buildingDensityPerKm2?: number };
    return `${density.populationDensityPerKm2?.toLocaleString("en-IN") ?? "—"} people/km² · ${density.buildingDensityPerKm2?.toLocaleString("en-IN") ?? "—"} buildings/km²`;
  }
  return String(value);
}

export function PriorityAudit({ result, compact = false }: { result: PriorityResult; compact?: boolean }) {
  const audit = result.audit;
  const definitions = new Map(priorityConfig.factorDefinitions.map((item) => [item.key, item]));
  return <section className="audit-panel" aria-labelledby="priority-audit-title">
    <div className="section-heading split-heading">
      <div><p className="eyebrow">priority-v1 · additive model</p><h2 id="priority-audit-title">Why this priority?</h2></div>
      <div className={`score-orb band-${audit.effectiveBand}`}><strong>{audit.effectiveScore.toFixed(2)}</strong><span>{audit.effectiveBand}</span></div>
    </div>
    <div className="audit-summary">
      <div><span>Model score</span><strong>{audit.modelScore.toFixed(2)}</strong></div>
      <div><span>Coverage</span><strong>{Math.round(audit.coverage * 100)}%</strong></div>
      <div><span>Factors observed</span><strong>{10 - audit.missingFactors.length}/10</strong></div>
      <div><span>Manual review</span><strong>{audit.requiresManualReview ? "Required" : "Not required"}</strong></div>
    </div>
    {audit.safetyEscalation.kind !== "none" && <div className="alert danger"><AlertTriangle size={18}/><div><strong>Safety policy escalation</strong><p>{audit.safetyEscalation.reasonCodes.join(" · ").replaceAll("_"," ")}. Effective score cannot fall below {audit.safetyEscalation.minimumEffectiveScore}.</p></div></div>}
    {audit.requiresManualReview && <div className="alert warning"><AlertTriangle size={18}/><div><strong>Manual review required</strong><p>{audit.manualReviewReasons.join(" · ")}</p></div></div>}
    {!audit.requiresManualReview && audit.safetyEscalation.kind === "none" && <div className="alert success"><CheckCircle2 size={18}/><div><strong>Complete enough for dispatch</strong><p>Safety fields are present and observed coverage is above the review threshold.</p></div></div>}
    <div className="table-scroll"><table className="data-table audit-table">
      <thead><tr><th>Factor</th><th>Observation</th><th>Normalized</th><th>Weight</th><th>Contribution</th>{!compact&&<th>Why</th>}</tr></thead>
      <tbody>{priorityConfig.factorOrder.map(key=>{const row=audit.factors.find(f=>f.key===key)!; return <tr key={key}>
        <th scope="row">{definitions.get(key)?.label ?? key}</th><td>{observation(row.rawValue,row.present)}</td><td>{row.normalizedValue.toFixed(2)}</td><td>{row.weight}</td><td><strong>{row.contribution.toFixed(2)}</strong></td>{!compact&&<td>{row.explanation}</td>}
      </tr>})}</tbody>
      <tfoot><tr><th colSpan={compact?4:4}>Σ contributions = model score</th><td><strong>{audit.modelScore.toFixed(2)}</strong></td>{!compact&&<td>Effective score differs only for a documented escalation or override.</td>}</tr></tfoot>
    </table></div>
  </section>;
}
