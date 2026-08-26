import { optimizeRoutes, type OptimizeOptions, type WorkStop } from "../domain/optimizer";
import type { RoutePlan } from "../domain/types";
import { createDemoState, SYNTHETIC_SOURCE, toWorkStops } from "../data/demo";
import { makeCitizenReport } from "../domain/simulate";
import { binStatusFor, driftUserLocation, householdDump } from "../domain/simulate";
import { pointAtDistance } from "../domain/road-graph";
import { getRoadNetwork, realRoadTrip } from "./road-network";
import type { DemoEvent, DemoState, WasteSignal } from "../domain/types";

type UploadedAsset={contentType:string;bytes:Uint8Array;role:"citizen"|"collector"|"system";storedAt:string;storage:"memory"};
type StoreGlobal=typeof globalThis&{__wasteDemoState?:DemoState;__wasteIdempotency?:Map<string,unknown>;__wasteUploads?:Map<string,UploadedAsset>;__wasteDayEngine?:ReturnType<typeof setInterval>;__wasteResetGeneration?:number};
const root=globalThis as StoreGlobal;
const IDEMPOTENCY_LIMIT=200;
const UPLOAD_LIMIT=120;
const EVENT_LIMIT=250;

export function getState(){
  if(root.__wasteDemoState) return root.__wasteDemoState;
  const initial=createDemoState();
  initial.route=withRealRoadGeometry(initial,initial.route);
  root.__wasteDemoState=initial;
  return initial;
}

// ─── End-to-end day-cycle engine ─────────────────────────────────────────────
// One vehicle runs one collection round per simulated day on the ACO + A*
// real-road plan. Households continuously add waste (per-bin %/h rates plus
// instant dumps); when the truck reaches a stop it HALTS for a few seconds
// before the bin is emptied; bins that hit 100% raise an overflow alert which
// is dispatched as top priority and re-orders the route. After the trip the
// truck parks at the depot while the night is fast-forwarded, then the next
// day's route is planned from the new fill levels.
const ENGINE_INTERVAL_MS=1000;
const TRAVEL_SIM_SECONDS_PER_WALL=10;   // x10 demo time while driving (25 km/h)
const OVERNIGHT_SIM_SECONDS_PER_WALL=14400; // 4 sim-hours per wall second at depot
const TRUCK_SPEED_KMH=25;
const DWELL_WALL_MS=4000;               // truck halts this long before emptying a stop
const DUMP_INTERVAL_WALL_MS=12000;      // a resident dumps waste roughly every 12s
const OVERFLOW_FILL_PERCENT=100;        // overflow alert threshold
const OVERFLOW_REPLAN_COOLDOWN_MS=15000; // batch overflow reroutes into one per window
const USER_DRIFT_WALL_MS=40000;         // the mock citizen wanders roughly every 40s
let lastDumpWallMs=0;let dumpSeq=0;
let lastOverflowReplanWallMs=0;
let lastUserDriftWallMs=Date.now();let userDriftSeq=0;
// Bins that already raised an overflow alert; cleared when the bin is emptied
// or the demo resets so a new episode can alert again.
const alertedOverflowIds=new Set<string>();

function plusSeconds(iso:string,seconds:number){return new Date(Date.parse(iso)+seconds*1000).toISOString()}

function growBins(state:DemoState,simHours:number){
  for(const bin of state.bins){
    if(bin.status==="offline") continue;
    // Whole numbers only: round the accumulated growth before the clamp.
    bin.fillPercent=Math.min(100,Math.round(bin.fillPercent+(bin.fillRatePerHour??4)*simHours));
    bin.status=binStatusFor(bin.fillPercent);
  }
}

function engineEvent(state:DemoState,type:string,entityId:string,message:string){append(state,type,entityId,message)}

function append(state:DemoState,type:string,entityId:string,message:string){const cursor=(state.events.at(-1)?.cursor??0)+1;const item:DemoEvent={id:`evt-api-${cursor}-${crypto.randomUUID().slice(0,8)}`,cursor,type,entityId,version:1,occurredAt:state.now,message};state.events.push(item);if(state.events.length>EVENT_LIMIT)state.events.splice(0,state.events.length-EVENT_LIMIT);return item}

// Labelled synthetic evidence used when the autonomous day-cycle engine
// services a report stop without a human collector. The demo never shows a
// cleanup confirmation without evidence, so the engine attaches clearly
// labelled placeholder images instead of skipping the proof stage.
const DEMO_EVIDENCE:{id:string;caption:string}[]=[
  {id:"evidence/demo-before",caption:"SYNTHETIC DEMO EVIDENCE · BEFORE · auto-serviced by day-cycle engine"},
  {id:"evidence/demo-after",caption:"SYNTHETIC DEMO EVIDENCE · AFTER · auto-serviced by day-cycle engine"},
];
function ensureDemoEvidence(){
  for(const item of DEMO_EVIDENCE){
    if(root.__wasteUploads?.has(item.id)) continue;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#dcebe1"/><rect x="14" y="14" width="612" height="392" fill="none" stroke="#176b48" stroke-width="3" stroke-dasharray="10 7"/><text x="320" y="200" font-family="sans-serif" font-size="26" font-weight="700" fill="#14241c" text-anchor="middle">Synthetic demo evidence</text><text x="320" y="240" font-family="sans-serif" font-size="17" fill="#5d6c64" text-anchor="middle">${item.caption.split(" · ").slice(0,2).join(" · ")}</text><text x="320" y="272" font-family="sans-serif" font-size="15" fill="#5d6c64" text-anchor="middle">No camera capture — engine-serviced stop</text></svg>`;
    registerUploadedAsset(item.id,{contentType:"image/svg+xml",bytes:new TextEncoder().encode(svg),role:"system",storedAt:new Date().toISOString(),storage:"memory"});
  }
}

// ─── Routing helpers ─────────────────────────────────────────────────────────
// Every plan leaves the store wearing real OSM geometry: the A* runs over the
// baked OpenStreetMap snapshot synchronously at plan time, so the blue line on
// the map follows real streets from the very first frame (the old async
// enhancer could swap paths mid-trip and make the line jump under the truck).
function withRealRoadGeometry(state:DemoState,plan:RoutePlan):RoutePlan{
  try{
    const network=getRoadNetwork();
    if(network.wayCount===0) return plan;
    let applied=false;
    const entries=plan.routes.map(route=>{
      const vehicle=state.vehicles.find(v=>v.id===route.vehicleId);
      if(!vehicle||route.stops.length<1) return null;
      const points=[vehicle.location,...route.stops.map(s=>s.location),vehicle.location];
      const trip=realRoadTrip(network,points);
      if(trip.path.length<2||trip.distanceKm<=0) return null;
      applied=true;
      return {vehicleId:route.vehicleId,path:trip.path,distanceKm:trip.distanceKm,stopPoints:route.stops.map(s=>s.location),stopDistancesKm:trip.stopDistancesKm};
    });
    if(!applied) return plan;
    const clean=entries.filter((entry):entry is NonNullable<typeof entry>=>entry!==null);
    // Post-pass: replace the Haversine estimates on each stop with the exact
    // routed leg lengths (and ETAs at the demo's 20 km/h planning speed) so
    // the numbers match the roads actually drawn on the map.
    const enrichedRoutes=plan.routes.map(route=>{
      const entry=clean.find(e=>e.vehicleId===route.vehicleId);
      if(!entry) return route;
      let prev=0,totalDistance=0,totalMinutes=0;
      const stops=route.stops.map((stop,index)=>{
        const cumulative=entry.stopDistancesKm[index]??prev;
        const leg=Math.max(0,cumulative-prev);
        prev=cumulative; totalDistance+=leg; totalMinutes+=leg/20*60+stop.serviceMinutes;
        return {...stop,distanceKm:Number(leg.toFixed(2)),etaMinutes:Math.round(totalMinutes)};
      });
      return {...route,stops,totalDistanceKm:Number(totalDistance.toFixed(2)),totalMinutes:Math.round(totalMinutes)};
    });
    return {...plan,routes:enrichedRoutes,roadPathByVehicle:clean,roadPath:clean[0]?.path??[],roadDistanceKm:clean[0]?.distanceKm??0,roadGeometrySource:"osm_overpass",totalDistanceKm:Number(enrichedRoutes.reduce((s,r)=>s+r.totalDistanceKm,0).toFixed(2)),totalMinutes:enrichedRoutes.reduce((s,r)=>s+r.totalMinutes,0)};
  }catch{ /* network unavailable: keep the synthetic grid geometry */ }
  return plan;
}

// ─── Road-distance matrix ────────────────────────────────────────────────────
// Exact shortest-path km between work stops, measured over the OSM snapshot
// and fed to the ACO so ordering minimises ROAD distance. Stop coordinates
// never move, so the stop-to-stop block is cached by id-set and computed
// incrementally (a few A* legs per engine tick) to avoid blocking.
type MatrixGlobal=typeof globalThis&{__wasteMatrixJob?:{key:string;betweenStops:Record<string,number>;pairs:[WorkStop,WorkStop][];index:number}};
const matrixRoot=globalThis as MatrixGlobal;
function matrixKey(stops:WorkStop[]){return stops.map(s=>s.id).sort().join("|")}

function ensureMatrixJob(stops:WorkStop[]){
  const key=matrixKey(stops);
  if(matrixRoot.__wasteMatrixJob?.key===key) return;
  if(!stops.length){matrixRoot.__wasteMatrixJob=undefined;return}
  const pairs:[WorkStop,WorkStop][]=[];
  for(let i=0;i<stops.length;i++){
    for(let j=i+1;j<stops.length;j++){
      pairs.push([stops[i],stops[j]]);
    }
  }
  matrixRoot.__wasteMatrixJob={key,betweenStops:{},pairs,index:0};
}

// Runs up to `budget` A* legs of the pending matrix job. Cheap enough to call
// every engine tick; a ~14-stop matrix completes in a couple of seconds.
function advanceMatrixJob(budget=6){
  const job=matrixRoot.__wasteMatrixJob;
  if(!job||job.index>=job.pairs.length) return;
  try{
    const network=getRoadNetwork();
    for(let done=0;done<budget&&job.index<job.pairs.length;done++,job.index++){
      const [a,b]=job.pairs[job.index];
      const forward=realRoadTrip(network,[a.location,b.location]);
      const backward=realRoadTrip(network,[b.location,a.location]);
      job.betweenStops[`${a.id}>${b.id}`]=forward.distanceKm;
      job.betweenStops[`${b.id}>${a.id}`]=backward.distanceKm;
    }
  }catch{ /* network unavailable */ }
}

function roadMatrixFor(state:DemoState,work:WorkStop[]):OptimizeOptions["roadDistanceMatrix"]{
  try{
    const network=getRoadNetwork();
    if(network.wayCount===0||!work.length) return undefined;
    const job=matrixRoot.__wasteMatrixJob;
    const betweenStops=job?.key===matrixKey(work)?job.betweenStops:{};
    // Fresh origin row per replan: the truck moves between plans.
    const fromVehicle:Record<string,Record<string,number>>={};
    for(const vehicle of state.vehicles){
      if(vehicle.status==="offline"||!work.length) continue;
      const row:Record<string,number>={};
      for(const stop of work){
        row[stop.id]=realRoadTrip(network,[vehicle.location,stop.location]).distanceKm;
      }
      fromVehicle[vehicle.id]=row;
    }
    return {fromVehicle,betweenStops};
  }catch{ return undefined }
}

function planRoutes(state:DemoState,trigger:string,options?:OptimizeOptions):RoutePlan{
  const work=toWorkStops(state);
  ensureMatrixJob(work);
  return withRealRoadGeometry(state,optimizeRoutes(state.vehicles,work,trigger,state.seed,state.route,{...options,roadDistanceMatrix:roadMatrixFor(state,work)}));
}

// Re-plan in the middle of a live trip: keeps the truck's progress meaningful
// by anchoring the same fraction of the way to the current next stop on the
// new path, so the vehicle never teleports when the route changes.
function replanMidTrip(state:DemoState,trigger:string,options?:OptimizeOptions):RoutePlan{
  const dc=state.dayCycle;
  const leadBefore=state.route.roadPathByVehicle[0];
  const stopsBefore=leadBefore?.stopDistancesKm.length??0;
  const targetBefore=leadBefore?(leadBefore.stopDistancesKm[Math.min(dc.nextStopIndex,Math.max(0,stopsBefore-1))]??leadBefore.distanceKm):0;
  const fraction=targetBefore>0?Math.min(1,dc.progressKm/targetBefore):1;
  const plan=planRoutes(state,trigger,options);
  if(dc.phase!=="at_depot"){
    const leadAfter=plan.roadPathByVehicle[0];
    const stopsAfter=leadAfter?.stopDistancesKm.length??0;
    const targetAfter=leadAfter?(leadAfter.stopDistancesKm[Math.min(dc.nextStopIndex,Math.max(0,stopsAfter-1))]??leadAfter.distanceKm):0;
    dc.progressKm=fraction*targetAfter;
  }
  return plan;
}

// ─── Overflow alerts (top priority) ──────────────────────────────────────────
// The bin the truck is currently heading toward (or halted at), if any.
function currentTargetBin(state:DemoState){
  const dc=state.dayCycle;
  const stops=state.route.routes[0]?.stops??[];
  if(!stops.length) return null;
  const stop=stops[Math.min(dc.nextStopIndex,stops.length-1)];
  if(!stop||stop.kind!=="bin") return null;
  return state.bins.find(bin=>bin.id===stop.workId)??null;
}

function handleOverflows(state:DemoState){
  // Never reshuffle while the truck is halted mid-service: the stop being
  // emptied must be the one that gets collected when dwell ends.
  if(state.dayCycle.phase==="servicing") return;
  const fullBins=state.bins.filter(bin=>bin.status!=="offline"&&bin.fillPercent>=OVERFLOW_FILL_PERCENT);
  if(!fullBins.length) return;
  for(const bin of fullBins){
    if(alertedOverflowIds.has(bin.id)) continue;
    alertedOverflowIds.add(bin.id);
    bin.overflowedAt=state.now;
    engineEvent(state,"alert.bin.overflow",bin.id,`OVERFLOW ALERT: ${bin.label} at 100% - dispatched as top priority.`);
    engineEvent(state,"notification.citizen",bin.id,`A bin near ${bin.locality} overflowed. A truck has been re-routed to it first.`);
    state.lastAction=`Overflow alert - ${bin.label} rerouted at top priority`;
  }
  // If the truck already targets an overflowed bin, let it finish that leg;
  // every other full bin is re-pinned to the front right after it arrives.
  const target=currentTargetBin(state);
  if(target&&(target.fillPercent>=OVERFLOW_FILL_PERCENT||target.overflowedAt)) return;
  // Cooldown: one overflow re-plan per window so consecutive fills batch into
  // a single reroute instead of resetting the truck's leg every second.
  const nowMs=Date.now();
  if(nowMs-lastOverflowReplanWallMs<OVERFLOW_REPLAN_COOLDOWN_MS) return;
  lastOverflowReplanWallMs=nowMs;
  state.route=replanMidTrip(state,"bin_overflow_alert",{forceFirstWorkIds:fullBins.map(bin=>bin.id)});
  if(state.dayCycle.phase==="en_route"){
    // The new plan starts at the vehicle's current location with the most
    // critical bin pinned first - retarget and restart the leg.
    state.dayCycle.nextStopIndex=0;
    state.dayCycle.progressKm=0;
  }
  engineEvent(state,"route.revised",state.route.id,"Route revised: overflowed bins moved to the front of the round.");
}

// ─── Mock citizen live location ──────────────────────────────────────────────
// The mock citizen wanders slowly around Whitefield. Every move updates the
// state's userLocation and — while the truck is driving with this round's
// handover still pending — re-runs ACO + A* so the vehicle follows the citizen.
// Servicing/at-depot phases skip the mid-trip replan: the daily plan already
// starts from the newest position.
function maybeDriftUser(state:DemoState){
  if(!state.userLocation) return;
  const nowMs=Date.now();
  if(nowMs-lastUserDriftWallMs<USER_DRIFT_WALL_MS) return;
  lastUserDriftWallMs=nowMs;
  const user=state.userLocation;
  const step=driftUserLocation(user.location,userDriftSeq++);
  user.location=step.location;user.updatedAt=state.now;
  engineEvent(state,"citizen.location_updated",user.id,`Mock citizen moved ~${step.meters} m within Whitefield; live GPS updated.`);
  if(state.dayCycle.phase!=="en_route") return;
  const stops=state.route.routes[0]?.stops??[];
  const pendingPickup=stops.find(s=>s.kind==="pickup"&&s.status!=="collected"&&s.status!=="blocked"&&s.status!=="skipped");
  if(!pendingPickup) return;
  state.route=replanMidTrip(state,"citizen_location_update");
  engineEvent(state,"route.revised",state.route.id,"Route recomputed for the citizen's updated live location.");
}

function serviceCurrentStop(state:DemoState){
  const dc=state.dayCycle;
  const stops=state.route.routes[0]?.stops??[];
  const stop=stops[dc.nextStopIndex];
  if(!stop) return;
  stop.status="collected";
  if(stop.kind==="bin"){
    const bin=state.bins.find(b=>b.id===stop.workId);
    if(bin){
      const litres=Math.round(bin.capacityLitres*bin.fillPercent/100);
      bin.fillPercent=0;bin.status="available";bin.lastUpdatedAt=state.now;delete bin.overflowedAt;alertedOverflowIds.delete(bin.id);
      state.vehicles[0].loadLitres=Math.min(state.vehicles[0].capacityLitres,state.vehicles[0].loadLitres+litres);
      dc.litresCollectedToday+=litres;dc.binsServicedToday++;dc.binsServicedTotal++;
      engineEvent(state,"bin.collected",bin.id,`Emptied ${bin.label}: ${litres} L collected after the halt; bin reset to 0%.`);
    }
  } else if(stop.kind==="signal"){
    state.signals=state.signals.map(s=>s.id===stop.workId?{...s,status:"collected"}:s);
    engineEvent(state,"signal.collected",stop.workId,`Citizen pickup at ${stop.label} completed.`);
  } else if(stop.kind==="pickup"){
    // The citizen handed over household waste at their live location: load it,
    // mark today's handover done so the stop drops out of later replans.
    const litres=stop.volumeLitres;
    state.vehicles[0].loadLitres=Math.min(state.vehicles[0].capacityLitres,state.vehicles[0].loadLitres+litres);
    dc.litresCollectedToday+=litres;
    if(state.userLocation)state.userLocation.servedOnDay=dc.day;
    engineEvent(state,"signal.collected",stop.workId,`Citizen handover completed at ${state.userLocation?.label??"the citizen's live location"}; ~${litres} L household waste loaded.`);
  } else {
    // Report stops keep the same evidence lifecycle as manual collection:
    // the engine records an accepted proof with labelled synthetic evidence
    // instead of silently marking the report cleaned.
    ensureDemoEvidence();
    const [beforeAssetId,afterAssetId]=DEMO_EVIDENCE.map(e=>e.id);
    state.proofs.unshift({id:`proof-auto-${crypto.randomUUID().slice(0,8)}`,reportId:stop.workId,stopId:stop.id,capturedAt:state.now,status:"accepted",beforeAssetId,afterAssetId,gps:stop.location,gpsMode:"demo",checklist:{segregated:true,areaSwept:true,accessClear:true},note:"Auto-serviced by the demo day-cycle engine; before/after images are labelled synthetic evidence, not camera captures.",source:SYNTHETIC_SOURCE});
    state.reports=state.reports.map(r=>r.id===stop.workId?{...r,status:"cleaned"}:r);
    engineEvent(state,"cleanup.proof_accepted",stop.workId,`Reported waste at ${stop.label} collected by the city crew (auto-serviced); labelled synthetic evidence attached — awaiting citizen confirmation.`);
    engineEvent(state,"notification.citizen",stop.workId,`Cleanup completed near you with verified evidence - confirm once the street looks clean.`);
  }
}

function engineTick(){
  const state=structuredClone(getState());
  const dc=state.dayCycle;
  advanceMatrixJob(); // keep the road-distance matrix warm for the next replan
  // Residents dump waste day and night, in every phase - an instant fill jump
  // on top of the continuous trickle, logged for the audit feed.
  if(Date.now()-lastDumpWallMs>=DUMP_INTERVAL_WALL_MS){
    lastDumpWallMs=Date.now();
    const dump=householdDump(state,dumpSeq++);
    if(dump){
      const after=Math.round(state.bins.find(b=>b.id===dump.binId)?.fillPercent??0);
      engineEvent(state,"waste.dumped",dump.binId,`Resident dumped ~${dump.litres} L at ${dump.binLabel}; bin now at ${after}%.`);
    }
  }
  maybeDriftUser(state);
  handleOverflows(state);
  const pathEntry=state.route.roadPathByVehicle[0];
  const routeStops=state.route.routes[0]?.stops??[];
  if(!pathEntry||pathEntry.distanceKm<=0){setState(state);return}

  if(dc.phase==="en_route"){
    const kmPerTick=(TRUCK_SPEED_KMH*TRAVEL_SIM_SECONDS_PER_WALL)/3600;
    state.now=plusSeconds(state.now,TRAVEL_SIM_SECONDS_PER_WALL);
    growBins(state,TRAVEL_SIM_SECONDS_PER_WALL/3600); // households keep adding waste
    const nextStopKm=pathEntry.stopDistancesKm[dc.nextStopIndex];
    if(nextStopKm!==undefined&&dc.progressKm+kmPerTick>=nextStopKm){
      // Arrived: HALT first (dwell), empty the stop only when dwell ends.
      dc.progressKm=nextStopKm;dc.phase="servicing";dc.dwellUntilWallMs=Date.now()+DWELL_WALL_MS;
      const stop=routeStops[dc.nextStopIndex];
      if(stop&&stop.status==="pending")stop.status="arrived";
      state.vehicles[0].status="collecting";
      state.lastAction=`Halting at stop ${dc.nextStopIndex+1} of ${routeStops.length}${stop?` - ${stop.label}`:""}`;
      engineEvent(state,"stop.arrived",stop?.id??"stop","Truck halted at the stop; emptying in progress.");
    } else {
      dc.progressKm+=kmPerTick;
      state.vehicles[0].status="en_route";
      if(dc.progressKm>=pathEntry.distanceKm){
        // Returned to the depot - shift complete, truck parks until tomorrow.
        dc.progressKm=pathEntry.distanceKm;dc.phase="at_depot";dc.nextStopIndex=0;
        dc.nextDepartureInMinutes=16*60;
        state.vehicles[0].status="available";
        state.lastAction=`Day ${dc.day} complete; ${dc.binsServicedToday} bins, ${dc.litresCollectedToday} L; parked at depot`;
        engineEvent(state,"day.completed","scenario-mahadevapura",`Truck returned to depot. Day ${dc.day}: ${dc.binsServicedToday} bins serviced, ${dc.litresCollectedToday} L collected.`);
      }
    }
    const at=pointAtDistance(pathEntry.path,dc.progressKm);
    if(at){state.vehicles[0].location=at.location;state.vehicles[0].heading=at.bearing;state.vehicles[0].lastSeenAt=state.now}
  } else if(dc.phase==="servicing"){
    // The halt is over: NOW the dustbin gets emptied, then the truck moves on.
    if(Date.now()>=dc.dwellUntilWallMs){
      serviceCurrentStop(state);
      dc.phase="en_route";dc.nextStopIndex++;
      state.vehicles[0].status="en_route";
      state.lastAction=`Next stop ${Math.min(dc.nextStopIndex+1,routeStops.length)} of ${routeStops.length}`;
    }
  } else if(dc.phase==="at_depot"){

    // Overnight fast-forward: waste accumulates, countdown to the next shift.
    state.now=plusSeconds(state.now,OVERNIGHT_SIM_SECONDS_PER_WALL);
    growBins(state,OVERNIGHT_SIM_SECONDS_PER_WALL/3600);
    dc.nextDepartureInMinutes=Math.max(0,dc.nextDepartureInMinutes-OVERNIGHT_SIM_SECONDS_PER_WALL/60);
    const added=Math.round(state.bins.reduce((sum,b)=>sum+b.capacityLitres*(b.fillRatePerHour??4)/100,0)*4);
    handleOverflows(state);
    state.lastAction=`Depot; next collection in ${Math.floor(dc.nextDepartureInMinutes/60)}h ${dc.nextDepartureInMinutes%60}m (overnight fast-forward)`;
    if(dc.nextDepartureInMinutes<=0){
      // New day: plan a fresh route from the overnight bin fills.
      dc.day++;dc.phase="en_route";dc.progressKm=0;dc.nextStopIndex=0;
      dc.litresCollectedToday=0;dc.binsServicedToday=0;dc.dayStartedAt=state.now;dc.nextDepartureInMinutes=0;
      state.vehicles[0].loadLitres=0;state.vehicles[0].status="en_route";
      state.route=planRoutes(state,"daily_cycle");
      state.lastAction=`Day ${dc.day}; route planned for ${state.route.routes[0]?.stops.length??0} stops from overnight demand`;
      engineEvent(state,"day.started","scenario-mahadevapura",`Day ${dc.day}: households added ~${added} L overnight; new route planned for ${state.route.routes[0]?.stops.length??0} stops.`);
    }
  }
  setState(state);
}

export function startDayEngine(){
  if(root.__wasteDayEngine) return;
  root.__wasteDayEngine=setInterval(()=>{try{engineTick()}catch{ /* keep the demo alive on tick errors */ }},ENGINE_INTERVAL_MS);
}
// Only run the live engine inside the Node server runtime — never during
// `next build` static analysis, where a ticking interval would be discarded
// anyway and could leave build workers holding timers.
if(process.env.NEXT_PHASE!=="phase-production-build"&&process.env.NEXT_RUNTIME!=="edge"){
  startDayEngine();
}

export function setState(state:DemoState){root.__wasteDemoState=state;return state}

export function reset(){
  alertedOverflowIds.clear();
  matrixRoot.__wasteMatrixJob=undefined;
  lastUserDriftWallMs=Date.now();
  const generation=(root.__wasteResetGeneration??0)+1;
  root.__wasteResetGeneration=generation;
  const next=createDemoState();
  next.route=withRealRoadGeometry(next,next.route);
  // Fresh scenario: drop demo-scoped uploads so orphaned evidence cannot be
  // referenced by the reset state; event cursors keep climbing so sync
  // clients stay correctly ordered across resets.
  root.__wasteUploads=new Map();
  next.events[0]={...next.events[0],id:`evt-api-reset-${generation}`,cursor:(getState().events.at(-1)?.cursor??0)+1};
  return setState(next);
}
export function tick(seconds=30){const state=structuredClone(getState());state.now=plusSeconds(state.now,seconds);state.tick=(state.tick??0)+1;append(state,"demo.ticked","scenario-mahadevapura",`Simulation advanced ${seconds} seconds (tick ${state.tick}).`);return setState(state)}
export function createSignal(input:{type:"have_waste"|"waste_outside";category:string;amountBand:"small"|"medium"|"large";location:{lat:number;lng:number}}){const state=structuredClone(getState());const signal:WasteSignal={id:`sig-api-${crypto.randomUUID().slice(0,8)}`,type:input.type,category:input.category,amountBand:input.amountBand,locality:"Whitefield",location:input.location,status:"queued",createdAt:state.now,etaMinutes:9,source:SYNTHETIC_SOURCE};state.signals.unshift(signal);append(state,"signal.created",signal.id,"Citizen signal received.");state.route=replanMidTrip(state,"new_citizen_signal");append(state,"route.revised",state.route.id,"Route recomputed after citizen demand.");setState(state);return {signal,etaMinutes:9,route:state.route}}

export function createReport(input:{title:string;category:string;location:{lat:number;lng:number};hygiene:"none"|"low"|"moderate"|"high"|"severe";obstruction:"none"|"partial"|"significant"|"traffic_lane";photoAssetId:string}){if(!hasUploadedAsset(input.photoAssetId,"citizen"))throw new Error("REPORT_ASSET_NOT_FOUND");const state=structuredClone(getState());const id=`rep-api-${crypto.randomUUID().slice(0,8)}`;const report=makeCitizenReport({id,title:input.title,category:input.category,location:input.location,photoUrl:input.photoAssetId,hygiene:input.hygiene==="none"?"low":input.hygiene,obstruction:input.obstruction,now:state.now,source:SYNTHETIC_SOURCE});state.reports.unshift(report);append(state,"report.submitted",id,"Citizen report submitted with persisted photo and priority audit.");append(state,"priority.updated",id,`Priority calculated at ${report.priority.audit.effectiveScore}.`);state.route=replanMidTrip(state,"new_garbage_report");append(state,"route.revised",state.route.id,"Route revised after report.");setState(state);return {report,priority:report.priority,route:state.route}}
export function reoptimize(trigger="manual"){const state=structuredClone(getState());state.route=replanMidTrip(state,trigger);append(state,"route.revised",state.route.id,`Route revised: ${trigger}.`);setState(state);return state.route}
export function publish(){const state=structuredClone(getState());state.route={...state.route,status:"published",version:state.route.version+1};append(state,"route.published",state.route.id,"Route revision published to collectors.");setState(state);return state.route}
export function actOnStop(stopId:string,action:"arrived"|"blocked"|"collected"){
  const state=structuredClone(getState());
  let workId="";let found=false;let kind="unknown";let previous="";
  state.route.routes=state.route.routes.map(route=>({...route,stops:route.stops.map(stop=>{
    if(stop.id!==stopId)return stop;
    found=true;workId=stop.workId;kind=stop.kind;previous=stop.status;
    // Lifecycle guards: collected only after arriving; arrived only from an
    // un-started stop; blocked allowed until the work is done, never after.
    if(action==="collected"&&previous!=="arrived")throw new Error("INVALID_STATUS_TRANSITION");
    if(action==="arrived"&&!(["pending","en_route"] as string[]).includes(previous))throw new Error("INVALID_STATUS_TRANSITION");
    if(action==="blocked"&&(["collected","skipped","blocked"] as string[]).includes(previous))throw new Error("INVALID_STATUS_TRANSITION");
    return {...stop,status:action};
  })}));
  if(!found)throw new Error("NOT_FOUND");
  if(action==="collected"){
    state.signals=state.signals.map(s=>s.id===workId?{...s,status:"collected"}:s);
    if(kind==="bin"){
      // Manual collection must have the same physical effect as the engine:
      // empty the bin, load the truck, and move the day-cycle counters.
      const bin=state.bins.find(b=>b.id===workId);
      const vehicle=state.vehicles[0];const dc=state.dayCycle;
      if(bin&&vehicle&&dc){
        const litres=Math.round(bin.capacityLitres*bin.fillPercent/100);
        bin.fillPercent=0;bin.status="available";bin.lastUpdatedAt=state.now;delete bin.overflowedAt;alertedOverflowIds.delete(bin.id);
        vehicle.loadLitres=Math.min(vehicle.capacityLitres,vehicle.loadLitres+litres);
        dc.litresCollectedToday+=litres;dc.binsServicedToday++;dc.binsServicedTotal++;
        append(state,"bin.collected",bin.id,`Collector emptied ${bin.label}: ${litres} L loaded; bin reset to 0%.`);
      }
    }
    const report=state.reports.find(r=>r.id===workId);
    if(report)state.proofs.unshift({id:`proof-api-${crypto.randomUUID().slice(0,8)}`,reportId:workId,stopId,capturedAt:state.now,status:"pending_sync",note:"Collection recorded; before/after evidence is still required.",source:SYNTHETIC_SOURCE});
    if(kind==="signal")append(state,"signal.collected",workId,"Citizen pickup recorded by the collector.");
  }
  if(action==="blocked"){const blocked=workId;state.route=replanMidTrip(state,"blocked_access");state.route.unassigned.push({id:blocked,reason:"Collector reported blocked access; dispatch review required"});append(state,"route.revised",state.route.id,"Route suffix revised after blocked access.")}
  append(state,`route_stop.${action}`,stopId,`Collector marked stop ${action}.`);
  const citizenFacing=state.signals.some(s=>s.id===workId)||state.reports.some(r=>r.id===workId);
  if(citizenFacing){append(state,"notification.citizen",workId,action==="collected"?"Truck collected waste near you - confirm the cleanup once it looks clean.":"The collector could not access the site near you. BBMP dispatch has been notified.")}
  setState(state);
  return {stopId,workId,action,proofRequired:action==="collected"&&state.reports.some(r=>r.id===workId),report:state.reports.find(r=>r.id===workId)};
}

export function acceptProof(stopId:string,input:{beforeAssetId:string;afterAssetId:string;gps:{lat:number;lng:number};gpsMode:"captured"|"demo";checklist:Record<string,boolean>}){const state=structuredClone(getState());const proof=state.proofs.find(p=>p.stopId===stopId&&p.status==="pending_sync");if(!proof)throw new Error("PROOF_NOT_PENDING");if(!input.beforeAssetId||!input.afterAssetId||!Object.values(input.checklist).every(Boolean))throw new Error("PROOF_INCOMPLETE");if(!hasUploadedAsset(input.beforeAssetId,"collector")||!hasUploadedAsset(input.afterAssetId,"collector"))throw new Error("PROOF_ASSET_NOT_FOUND");proof.status="accepted";proof.beforeAssetId=input.beforeAssetId;proof.afterAssetId=input.afterAssetId;proof.gps=input.gps;proof.gpsMode=input.gpsMode;proof.checklist=input.checklist;proof.note=`Before/after evidence accepted at ${input.gps.lat.toFixed(4)}, ${input.gps.lng.toFixed(4)} (${input.gpsMode==="demo"?"labelled demo stop coordinate":"device-captured GPS"}) with checklist.`;state.reports=state.reports.map(r=>r.id===proof.reportId?{...r,status:"cleaned"}:r);append(state,"cleanup.proof_accepted",proof.reportId,`Cleanup proof accepted after persisted evidence, ${input.gpsMode==="demo"?"labelled demo coordinates":"device-captured GPS"}, and checklist validation.`);setState(state);return {proof,report:state.reports.find(r=>r.id===proof.reportId)}}
export function confirmReport(reportId:string,outcome:"cleaned"|"partial"|"still_present"){const state=structuredClone(getState());const report=state.reports.find(r=>r.id===reportId);if(!report)throw new Error("NOT_FOUND");if(report.status!=="cleaned")throw new Error("INVALID_STATUS_TRANSITION");report.status=outcome==="cleaned"?"confirmed":"reopened";append(state,outcome==="cleaned"?"report.confirmed":"report.reopened",reportId,outcome==="cleaned"?"Citizen confirmed cleanup.":"Citizen reopened incomplete cleanup.");if(outcome!=="cleaned")state.route=replanMidTrip(state,"citizen_reopened");setState(state);return report}
export function idempotent<T>(key:string,work:()=>T):T{const cache=root.__wasteIdempotency??=new Map();const cached=cache.get(key);if(cached!==undefined){/* LRU: refresh recency so active keys are never evicted */cache.delete(key);cache.set(key,cached);return cached as T}const value=work();cache.set(key,value);if(cache.size>IDEMPOTENCY_LIMIT){const oldest=cache.keys().next().value;if(oldest!==undefined)cache.delete(oldest)}return value}
export function hasUploadedAsset(id:string,role?:UploadedAsset["role"]){const cache=root.__wasteUploads;const asset=cache?.get(id);if(!asset)return false;if(role&&role!=="system"&&asset.role!==role&&asset.role!=="system")return false;/* LRU touch */if(cache){cache.delete(id);cache.set(id,asset)}return asset.bytes.byteLength>0}
export function getUploadedAsset(id:string){return root.__wasteUploads?.get(id)??null}
export function registerUploadedAsset(id:string,asset:UploadedAsset){const cache=root.__wasteUploads??=new Map();if(cache.has(id))cache.delete(id);cache.set(id,asset);while(cache.size>UPLOAD_LIMIT){const oldest=cache.keys().next().value;if(oldest===undefined)break;cache.delete(oldest)}}





