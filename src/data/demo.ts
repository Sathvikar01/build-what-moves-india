import { calculatePriority } from "../domain/priority";
import { optimizeRoutes, type WorkStop } from "../domain/optimizer";
import { recommendBins, type PlacementCandidateInput } from "../domain/placement";
import type { DemoState, GarbageReport, SmartBin, SourceMeta, Vehicle, WasteSignal } from "../domain/types";
import { FOCUS } from "./locations";

export const DEMO_NOW = "2026-08-21T12:00:00.000Z";
export const SYNTHETIC_SOURCE: SourceMeta = { kind:"synthetic_demo", label:"Deterministic hackathon scenario · seed 4242", isSynthetic:true };
export const OSM_SOURCE: SourceMeta = { kind:"openstreetmap", label:"OpenStreetMap contributors", isSynthetic:false, license:"ODbL 1.0", url:"https://www.openstreetmap.org/copyright" };

const vehicles:Vehicle[]=[
  {id:"veh-01",label:"KA-01-AF-2147",type:"auto_tipper",location:{lat:12.9685,lng:77.7358},heading:82,status:"en_route",capacityLitres:4200,loadLitres:1100,lastSeenAt:"2026-08-21T11:59:42.000Z",routeId:"route-4242",source:SYNTHETIC_SOURCE},
];

// Seed fills sit in the 40-80% band so bins hover around 70-80% (never 100%)
// by the time the truck reaches them; overflow is reserved for real episodes
// (a dump pushing a bin to 100%), which raise the top-priority alert.
const bins:SmartBin[]=[
  ["bin-01","ITPL Gate public bin","Whitefield",12.9853,77.7375,78,"filling"],["bin-02","Hope Farm junction","Whitefield",12.9668,77.7492,72,"filling"],
  ["bin-03","Kundalahalli market","Kundalahalli",12.9691,77.7132,76,"filling"],["bin-04","Graphite India Road","Dodda Nekkundi",12.9810,77.6987,54,"available"],
  ["bin-05","Marathahalli bridge","Marathahalli",12.9562,77.7019,80,"filling"],["bin-06","Bellandur central","Bellanduru",12.9250,77.6750,63,"available"],
  ["bin-07","Panathur main road","Panathur",12.9350,77.7060,74,"filling"],["bin-08","Hoodi circle","Hoodi",12.9914,77.7161,41,"available"],
  ["bin-09","Varthur lake road","Varthur",12.9392,77.7445,47,"available"],["bin-10","AECS Layout","Kundalahalli",12.9638,77.7127,0,"offline"],
].map(([id,label,locality,lat,lng,fill,status],index)=>({id:id as string,label:label as string,locality:locality as string,location:{lat:lat as number,lng:lng as number},capacityLitres:1100,fillPercent:fill as number,status:status as SmartBin["status"],accepted:["wet","dry"],lastUpdatedAt:status==="offline"?"2026-08-21T10:34:00.000Z":"2026-08-21T11:58:00.000Z",fillRatePerHour:1.5+(index%3),source:SYNTHETIC_SOURCE}));

const report = (id:string,title:string,category:string,locality:string,lat:number,lng:number,hours:number,litres:number,area:number,people:number,hygiene:"low"|"moderate"|"high"|"severe",obstruction:"none"|"partial"|"significant"|"traffic_lane",corroboration:number,fill:number,demand:number):GarbageReport=>({
  id,title,category,locality,location:{lat,lng},status:"acknowledged",createdAt:new Date(Date.parse(DEMO_NOW)-hours*3600000).toISOString(),source:SYNTHETIC_SOURCE,
  priority:calculatePriority({reportId:id,observedAt:new Date(Date.parse(DEMO_NOW)-hours*3600000).toISOString(),calculatedAt:DEMO_NOW,garbageAmountLitres:litres,affectedAreaSqM:area,peopleAffected:people,hygieneRisk:hygiene,obstruction,reportAgeHours:hours,populationDensityPerKm2:locality==="Whitefield"?21800:18600,buildingDensityPerKm2:locality==="Whitefield"?6400:5100,corroboratingReports:corroboration,nearbyBinFillFraction:fill,activeCitizenDemand24h:demand,verifiedSpecialWaste:"none",trafficLaneBlocked:obstruction==="traffic_lane"}),
});

const reports:GarbageReport[]=[
  report("rep-101","Overflow beside ITPL Gate","overflow","Whitefield",12.9842,77.7388,18,460,340,620,"high","partial",3,.94,5),
  report("rep-102","Roadside pile blocking service lane","roadside_dumping","Marathahalli",12.9561,77.7030,9,380,210,420,"moderate","traffic_lane",2,.97,4),
  report("rep-103","Mixed waste near apartment cluster","open_dump","Kundalahalli",12.9682,77.7164,27,300,180,780,"high","significant",2,.88,5),
  report("rep-104","Missed collection near ORR","missed_collection","Bellanduru",12.9240,77.6790,6,160,90,290,"moderate","partial",1,.64,3),
  report("rep-105","Garbage beside storm-water drain","drain_blockage","Dodda Nekkundi",12.9782,77.6969,34,220,120,350,"severe","significant",3,.53,2),
  report("rep-106","Small dry-waste pile","open_dump","Hoodi",12.9901,77.7180,3,60,30,75,"low","none",0,.38,1),
];

const signals:WasteSignal[]=[
  ["sig-01","waste_outside","wet","medium","Whitefield",12.9711,77.7482,9],["sig-02","have_waste","dry","small","Whitefield",12.9741,77.7424,14],
  ["sig-03","waste_outside","mixed","large","Kundalahalli",12.9698,77.7140,11],["sig-04","have_waste","wet","medium","Marathahalli",12.9557,77.6998,16],
  ["sig-05","have_waste","dry","small","Bellanduru",12.9271,77.6782,20],["sig-06","waste_outside","mixed","medium","Dodda Nekkundi",12.9790,77.6956,18],
].map(([id,type,category,amountBand,locality,lat,lng,eta])=>({id:id as string,type:type as WasteSignal["type"],category:category as string,amountBand:amountBand as WasteSignal["amountBand"],locality:locality as string,location:{lat:lat as number,lng:lng as number},status:"queued" as const,createdAt:"2026-08-21T11:35:00.000Z",etaMinutes:eta as number,source:SYNTHETIC_SOURCE}));

function workStops():WorkStop[]{
  const reportStops=reports.slice(0,5).map(r=>({id:r.id,kind:"report" as const,label:r.title,locality:r.locality,location:r.location,volumeLitres:Math.max(220,r.priority.audit.factors[0].rawValue as number),serviceMinutes:8,priorityScore:r.priority.audit.effectiveScore,binFill:(r.priority.audit.factors.find(f=>f.key==="nearbyBinFill")?.normalizedValue??0),citizenDemand:(r.priority.audit.factors.find(f=>f.key==="activeCitizenDemand")?.normalizedValue??0),reportSeverity:r.priority.audit.effectiveScore/100,urbanDensity:r.priority.audit.factors.find(f=>f.key==="density")?.normalizedValue??.5,priorityFactors:r.priority.audit.factors.map(f=>({key:f.key,contribution:f.contribution,explanation:f.explanation}))}));
  const binStops=bins.filter(b=>b.fillPercent>=80).map(b=>({id:b.id,kind:"bin" as const,label:b.label,locality:b.locality,location:b.location,volumeLitres:b.capacityLitres*b.fillPercent/100,serviceMinutes:6,priorityScore:b.fillPercent,binFill:b.fillPercent/100,citizenDemand:.35,reportSeverity:.25,urbanDensity:.72}));
  return [...reportStops,...binStops];
}

const placementCandidates:PlacementCandidateInput[]=[
  {id:"p1",label:"Hope Farm bus interchange",locality:"Whitefield",location:{lat:12.9661,lng:77.7498},population:.88,buildingDensity:.84,coverageGap:.91,citizenDemand:.76,reportHotspot:.72,poiActivity:.95,roadAccess:.92,pedestrianAccess:.78,publicLand:null,insideBoundary:true,excluded:false},
  {id:"p2",label:"Kundalahalli market approach",locality:"Kundalahalli",location:{lat:12.9680,lng:77.7137},population:.91,buildingDensity:.88,coverageGap:.82,citizenDemand:.89,reportHotspot:.83,poiActivity:.86,roadAccess:.84,pedestrianAccess:.77,publicLand:null,insideBoundary:true,excluded:false},
  {id:"p3",label:"Dodda Nekkundi transit edge",locality:"Dodda Nekkundi",location:{lat:12.9781,lng:77.6979},population:.74,buildingDensity:.79,coverageGap:.86,citizenDemand:.58,reportHotspot:.81,poiActivity:.65,roadAccess:.9,pedestrianAccess:.61,publicLand:.6,insideBoundary:true,excluded:false},
  {id:"p4",label:"Bellandur Central Mall service road",locality:"Bellanduru",location:{lat:12.9265,lng:77.6769},population:.83,buildingDensity:.92,coverageGap:.79,citizenDemand:.71,reportHotspot:.68,poiActivity:.9,roadAccess:.78,pedestrianAccess:.88,publicLand:null,insideBoundary:true,excluded:false},
  {id:"p5",label:"Panathur main road junction",locality:"Panathur",location:{lat:12.9343,lng:77.7084},population:.77,buildingDensity:.81,coverageGap:.94,citizenDemand:.66,reportHotspot:.59,poiActivity:.71,roadAccess:.87,pedestrianAccess:.57,publicLand:null,insideBoundary:true,excluded:false},
  {id:"p6",label:"Hoodi Circle public edge",locality:"Hoodi",location:{lat:12.9920,lng:77.7168},population:.7,buildingDensity:.74,coverageGap:.83,citizenDemand:.49,reportHotspot:.43,poiActivity:.82,roadAccess:.91,pedestrianAccess:.75,publicLand:.7,insideBoundary:true,excluded:false},
  {id:"p7",label:"Varthur market road",locality:"Varthur",location:{lat:12.9404,lng:77.7452},population:.72,buildingDensity:.67,coverageGap:.9,citizenDemand:.55,reportHotspot:.62,poiActivity:.78,roadAccess:.8,pedestrianAccess:.69,publicLand:null,insideBoundary:true,excluded:false},
  {id:"p8",label:"Unsafe highway median",locality:"Marathahalli",location:{lat:12.9560,lng:77.6990},population:.9,buildingDensity:.9,coverageGap:.9,citizenDemand:.9,reportHotspot:.9,poiActivity:.9,roadAccess:.1,pedestrianAccess:.1,publicLand:null,insideBoundary:true,excluded:true},
];

export function createDemoState():DemoState{
  const route={...optimizeRoutes(vehicles,workStops(),"seed_reset",4242),id:"route-4242",status:"active" as const};
  return {seed:4242,now:DEMO_NOW,tick:0,vehicles:structuredClone(vehicles),bins:structuredClone(bins),signals:structuredClone(signals),reports:structuredClone(reports),route,recommendations:recommendBins(placementCandidates,6),proofs:[],dumps:[],events:[{id:"evt-1",cursor:1,type:"demo.reset",entityId:"scenario-mahadevapura",version:1,occurredAt:DEMO_NOW,message:"Deterministic Mahadevapura scenario loaded with seed 4242."}],lastAction:"Scenario ready",dayCycle:{day:1,phase:"en_route",progressKm:0,nextStopIndex:0,dwellUntilWallMs:0,dayStartedAt:DEMO_NOW,litresCollectedToday:0,binsServicedToday:0,binsServicedTotal:0,nextDepartureInMinutes:0}};
}

export function toWorkStops(state:DemoState):WorkStop[]{
  const factor=(r:GarbageReport,key:string)=>r.priority.audit.factors.find(f=>f.key===key)?.normalizedValue??0;
  return [...state.reports.filter(r=>!["confirmed","cleaned"].includes(r.status)).map(r=>({id:r.id,kind:"report" as const,label:r.title,locality:r.locality,location:r.location,volumeLitres:Number(r.priority.audit.factors.find(f=>f.key==="garbageAmount")?.rawValue??200),serviceMinutes:8,priorityScore:r.priority.audit.effectiveScore,binFill:factor(r,"nearbyBinFill"),citizenDemand:factor(r,"activeCitizenDemand"),reportSeverity:r.priority.audit.effectiveScore/100,urbanDensity:factor(r,"density"),priorityFactors:r.priority.audit.factors.map(f=>({key:f.key,contribution:f.contribution,explanation:f.explanation}))})),...state.signals.filter(s=>s.status!=="collected").map(s=>({id:s.id,kind:"signal" as const,label:s.type==="waste_outside"?"Waste ready outside":"Citizen pickup request",locality:s.locality,location:s.location,volumeLitres:s.amountBand==="large"?300:s.amountBand==="medium"?160:70,serviceMinutes:5,priorityScore:s.type==="waste_outside"?72:55,binFill:.45,citizenDemand:1,reportSeverity:s.type==="waste_outside"?.65:.35,urbanDensity:.88})),...state.bins.filter(b=>b.fillPercent>=80).map(b=>({id:b.id,kind:"bin" as const,label:b.label,locality:b.locality,location:b.location,volumeLitres:b.capacityLitres*b.fillPercent/100,serviceMinutes:6,priorityScore:b.fillPercent,binFill:b.fillPercent/100,citizenDemand:.35,reportSeverity:.25,urbanDensity:.72}))];
}
