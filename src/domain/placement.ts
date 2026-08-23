import type { GeoPoint, PlacementFeature, PlacementRecommendation, SourceKind } from "./types";
import { haversineKm } from "./optimizer";

export interface PlacementCandidateInput { id:string; label:string; locality:string; location:GeoPoint; population:number; buildingDensity:number; coverageGap:number; citizenDemand:number; reportHotspot:number; poiActivity:number; roadAccess:number; pedestrianAccess:number; publicLand:number|null; insideBoundary:boolean; excluded:boolean }
const CONFIG=[
  ["population","Population density",.22,"official"],["buildingDensity","Building density",.18,"openstreetmap"],["coverageGap","Existing-bin coverage gap",.15,"derived"],
  ["citizenDemand","Citizen demand",.12,"synthetic_demo"],["reportHotspot","Report hotspot",.10,"synthetic_demo"],["poiActivity","Public activity",.08,"openstreetmap"],
  ["roadAccess","Collection-road access",.08,"openstreetmap"],["pedestrianAccess","Pedestrian access",.05,"openstreetmap"],["publicLand","Verified public land",.02,"official"],
] as const;

export function recommendBins(candidates:PlacementCandidateInput[],limit=6):PlacementRecommendation[]{
  const scored=candidates.filter(c=>c.insideBoundary&&!c.excluded).map(c=>{
    const features:PlacementFeature[]=CONFIG.map(([key,label,weight,source])=>{const raw=c[key as keyof PlacementCandidateInput] as number|null; const value=raw===null?0:Number(raw); return {key,label,raw,value,weight,contribution:Number((value*weight*100).toFixed(2)),source:source as SourceKind};});
    const score=Number(features.reduce((s,f)=>s+f.contribution,0).toFixed(2)); const unknown=c.publicLand===null;
    const confidence=Number(Math.max(0,Math.min(1,.55*(unknown?.88:1)+.25*.9+.2*.82)).toFixed(2)); const top=[...features].sort((a,b)=>b.contribution-a.contribution).slice(0,3);
    return {id:`rec-${c.id}`,rank:0,label:c.label,locality:c.locality,location:c.location,score,confidence,features,reasons:top.map(f=>`${f.label} contributes ${f.contribution.toFixed(1)} points.`),warnings:unknown?["Land ownership is not verified; BBMP field validation is required."]:[],requiresFieldValidation:unknown};
  }).sort((a,b)=>b.score-a.score);
  const selected:PlacementRecommendation[]=[];
  for(const candidate of scored){ if(selected.every(s=>haversineKm(s.location,candidate.location)*1000>=300)){ selected.push({...candidate,rank:selected.length+1}); if(selected.length===limit) break; } }
  return selected;
}
