import type { AdaptiveWeights, GeoPoint, RouteContribution, RoutePlan, RouteSignalName, RouteStop, Vehicle } from "./types";
import { haversineKm } from "./geo";
import { pathLengthKm, routeOnRoads } from "./road-graph";

export { haversineKm };

export interface WorkStop {
  id: string; kind: "bin" | "signal" | "report"; label: string; locality: string; location: GeoPoint;
  volumeLitres: number; serviceMinutes: number; priorityScore: number; binFill: number; citizenDemand: number;
  reportSeverity: number; urbanDensity: number; priorityFactors?: { key: string; contribution: number; explanation: string }[];
}

export interface OptimizeOptions {
  // Work ids that must be serviced first — overflow alerts are pinned to the
  // front of the lead vehicle's route before the colony builds solutions.
  forceFirstWorkIds?: string[];
  // Exact shortest-path ROAD distances (km) measured over the OSM snapshot.
  // Any missing entry falls back to the labelled Haversine estimate, so
  // client-side optimistic calls without network access keep working.
  roadDistanceMatrix?: RoadDistanceMatrix;
}

export interface RoadDistanceMatrix {
  // vehicleId -> stopId -> road km from the vehicle's current location.
  fromVehicle: Record<string, Record<string, number>>;
  // "fromStopId>toStopId" -> road km (oneway-aware, so both directions stored).
  betweenStops: Record<string, number>;
}

// Resolves the km travelled between two points of a round. `fromId` is null
// when `from` is the vehicle's live location.
export type LegKm = (args: { from: GeoPoint; fromId: string | null; vehicleId: string; to: WorkStop }) => number;

const haversineLegKm: LegKm = ({ from, to }) => haversineKm(from, to.location);

function makeLegKm(matrix: RoadDistanceMatrix | undefined): LegKm {
  if (!matrix) return haversineLegKm;
  return ({ from, fromId, vehicleId, to }) => {
    if (fromId !== null) {
      const road = matrix.betweenStops[`${fromId}>${to.id}`];
      if (road !== undefined) return road;
    } else {
      const road = matrix.fromVehicle[vehicleId]?.[to.id];
      if (road !== undefined) return road;
    }
    return haversineKm(from, to.location);
  };
}

const BASE: AdaptiveWeights = { smartBinFill: .24, citizenDemand: .22, reportSeverity: .24, urbanDensity: .15, travelEfficiency: .15 };
const NAMES: RouteSignalName[] = ["smartBinFill", "citizenDemand", "reportSeverity", "urbanDensity", "travelEfficiency"];
const LABELS: Record<RouteSignalName, string> = { smartBinFill: "Bin pressure", citizenDemand: "Citizen demand", reportSeverity: "Report severity", urbanDensity: "Urban density", travelEfficiency: "Travel efficiency" };

// ─── ACO hyper-parameters ────────────────────────────────────────────────────
// Classic ant-colony settings: τ^α·η^β transition rule with pseudo-random-
// proportional selection (ACO_Q0), per-iteration evaporation (ACO_RHO),
// iteration-best + elitist deposit, and a 2-opt local-search pass on the best
// solution. Everything is driven by one seeded RNG, so plans stay
// deterministic for a given seed.
const ACO_ITERATIONS = 24;      // construction + evaporation rounds
const ACO_ANTS = 10;            // ants per round
const ACO_ALPHA = 1;            // pheromone exponent τ^α
const ACO_BETA = 2.4;           // heuristic exponent η^β
const ACO_Q0 = 0.18;            // probability of exploiting the best edge
const ACO_RHO = 0.3;            // pheromone evaporation factor per round
const TAU_MIN = 0.05;           // pheromone floor so edges never fully die
const ELITIST_WEIGHT = 2;       // extra deposit weight for the global best
const STAGNATION_LIMIT = 8;     // early exit after this many flat rounds

class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next() { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 4294967296; }
}

function adaptive(stops: WorkStop[], previous?:AdaptiveWeights): AdaptiveWeights {
  const mean = (key: "binFill"|"citizenDemand"|"reportSeverity"|"urbanDensity") => stops.length ? stops.reduce((s,x)=>s+x[key],0)/stops.length : 0;
  const urgencies = { smartBinFill: mean("binFill"), citizenDemand: mean("citizenDemand"), reportSeverity: mean("reportSeverity"), urbanDensity: mean("urbanDensity"), travelEfficiency: .35 };
  const raw = Object.fromEntries(NAMES.map(k=>[k, Math.min(.5, Math.max(.05, BASE[k]*(1+.6*urgencies[k])))])) as unknown as AdaptiveWeights;
  const sum = NAMES.reduce((s,k)=>s+raw[k],0); const target=Object.fromEntries(NAMES.map(k=>[k, raw[k]/sum])) as unknown as AdaptiveWeights;
  if(!previous) return target;
  const limited=Object.fromEntries(NAMES.map(k=>[k,previous[k]+Math.max(-.15,Math.min(.15,target[k]-previous[k]))])) as unknown as AdaptiveWeights;
  const limitedSum=NAMES.reduce((s,k)=>s+limited[k],0);return Object.fromEntries(NAMES.map(k=>[k,limited[k]/limitedSum])) as unknown as AdaptiveWeights;
}

function signals(stop: WorkStop, distance: number) {
  return { smartBinFill: stop.binFill, citizenDemand: stop.citizenDemand, reportSeverity: stop.reportSeverity, urbanDensity: stop.urbanDensity, travelEfficiency: 1/(1+distance/3) };
}

type Candidate = { routes: { vehicle: Vehicle; stops: WorkStop[] }[]; score: number };

// Solution quality: collected multi-signal value minus travel cost, minus a
// hard penalty for work left unassigned.
function scoreRoutes(routes:{vehicle:Vehicle;stops:WorkStop[]}[], weights:AdaptiveWeights, unassigned:number, legKm:LegKm){
  let score=0;
  for(const {vehicle,stops} of routes){
    let from=vehicle.location; let fromId:string|null=null;
    for(const stop of stops){
      const leg=legKm({from,fromId,vehicleId:vehicle.id,to:stop});
      const sig=signals(stop,leg);
      score+=NAMES.reduce((sum,k)=>sum+sig[k]*weights[k]*100,0)-leg*1.8;
      from=stop.location; fromId=stop.id;
    }
  }
  return score-unassigned*35;
}

// Incremental feasibility state for one vehicle's partial route. Mirrors the
// demo's operating constraints: capacity, 45 km route distance, ≤8 stops and
// a 480-minute shift at 20 km/h average.
interface WalkState { from:GeoPoint; fromId:string|null; vehicleId:string; distanceKm:number; serviceMinutes:number; loadLitres:number }
function canAppend(state:WalkState, vehicle:Vehicle, stop:WorkStop, stopCount:number, legKm:LegKm){
  if(stopCount>=8) return false;
  if(state.loadLitres+stop.volumeLitres>vehicle.capacityLitres) return false;
  const leg=legKm({from:state.from,fromId:state.fromId,vehicleId:state.vehicleId,to:stop});
  const minutesSoFar=state.serviceMinutes+state.distanceKm/20*60;
  if(state.distanceKm+leg>45) return false;
  return minutesSoFar+leg/20*60+stop.serviceMinutes<=480;
}

// One ant constructs a solution: pinned overflow stops first, then the
// previously-committed stop (locked), then classic ACO transitions until no
// feasible work remains.
function construct(vehicles:Vehicle[], allStops:WorkStop[], weights:AdaptiveWeights, pheromone:Map<string,number>, rng:SeededRandom, locked:Record<string,string[]>, forcedFirst:string[], legKm:LegKm):Candidate{
  const remaining=[...allStops];
  const routes=vehicles.filter(v=>v.status!=="offline").map(vehicle=>({vehicle,stops:[]as WorkStop[]}));
  const lead=routes[0];
  if(lead){
    for(const id of forcedFirst){
      const index=remaining.findIndex(s=>s.id===id);
      if(index<0) continue;
      const [stop]=remaining.splice(index,1);
      lead.stops.push(stop);
    }
  }
  for(const route of routes){
    let location=route.vehicle.location;
    const walk={from:location,fromId:null as string|null,vehicleId:route.vehicle.id,distanceKm:0,serviceMinutes:0,loadLitres:route.vehicle.loadLitres};
    for(const id of locked[route.vehicle.id]??[]){
      const index=remaining.findIndex(s=>s.id===id);
      if(index<0) continue;
      const [stop]=remaining.splice(index,1);
      walk.distanceKm+=legKm({from:walk.from,fromId:walk.fromId,vehicleId:route.vehicle.id,to:stop}); walk.serviceMinutes+=stop.serviceMinutes;
      walk.loadLitres+=stop.volumeLitres; walk.from=stop.location; walk.fromId=stop.id; location=stop.location;
      route.stops.push(stop);
    }
    while(remaining.length){
      const feasible=remaining.filter(s=>canAppend(walk,route.vehicle,s,route.stops.length,legKm));
      if(!feasible.length) break;
      const probs=feasible.map(s=>{
        const leg=legKm({from:location,fromId:walk.fromId,vehicleId:route.vehicle.id,to:s});
        const sig=signals(s,leg);
        const global=NAMES.reduce((sum,k)=>sum+sig[k]*weights[k],0);
        // Desirability: weighted signals blended with the raw priority score,
        // discounted by ROAD travel distance so nearby urgent work wins.
        const eta=(.7*global+.3*(s.priorityScore/100))/(1+leg/2);
        const tau=pheromone.get(edgeKey(location,s))??1;
        return Math.max(1e-9,Math.pow(tau,ACO_ALPHA)*Math.pow(.05+eta,ACO_BETA));
      });
      // Pseudo-random-proportional rule: exploit the strongest edge with
      // probability q0, otherwise roulette over τ·η.
      const chosen=rng.next()<ACO_Q0?feasible[probs.indexOf(Math.max(...probs))]:roulette(feasible,probs,rng);
      walk.distanceKm+=legKm({from:walk.from,fromId:walk.fromId,vehicleId:route.vehicle.id,to:chosen}); walk.serviceMinutes+=chosen.serviceMinutes;
      walk.loadLitres+=chosen.volumeLitres; walk.from=chosen.location; walk.fromId=chosen.id; location=chosen.location;
      route.stops.push(chosen); remaining.splice(remaining.indexOf(chosen),1);
    }
  }
  return {routes,score:scoreRoutes(routes,weights,remaining.length,legKm)};
}

function roulette<T>(items:T[], weights:number[], rng:SeededRandom):T{
  const total=weights.reduce((a,b)=>a+b,0); let pick=rng.next()*total;
  for(let i=0;i<items.length;i++){ pick-=weights[i]; if(pick<=0) return items[i]; }
  return items[items.length-1];
}

const edgeKey=(from:GeoPoint,to:WorkStop)=>`${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.id}`;

// Deposit pheromone along an ordered solution, scaled by its quality.
function deposit(pheromone:Map<string,number>,candidate:Candidate,weight:number){
  const boost=weight*(1+Math.max(0,candidate.score)/500);
  for(const {vehicle,stops} of candidate.routes){
    let from=vehicle.location;
    for(const stop of stops){
      const key=edgeKey(from,stop);
      pheromone.set(key,(pheromone.get(key)??1)+boost);
      from=stop.location;
    }
  }
}

// Evaporate every tracked edge by (1-ρ) with a floor, so stale trails decay
// once the work mix changes instead of dominating forever.
function evaporate(pheromone:Map<string,number>){
  for(const [key,value] of pheromone) pheromone.set(key,Math.max(TAU_MIN,value*(1-ACO_RHO)));
}

// Local search on the incumbent, two deterministic moves:
//   2-opt     — reverse a segment of a vehicle's stop order;
//   or-opt    — relocate a single stop to a better position (kills zigzags).
// Both only accept feasible, score-raising changes, and neither touches the
// protected prefix (pinned overflow stops / committed legs).
function localSearch(best:Candidate,weights:AdaptiveWeights,protectedPrefixes:number[],legKm:LegKm):Candidate{
  let current=best;
  for(let pass=0;pass<6;pass++){
    let improved=false;
    current.routes.forEach((route,routeIndex)=>{
      const from=protectedPrefixes[routeIndex]??0;
      for(let i=from;i<route.stops.length-1;i++){
        for(let j=i+1;j<route.stops.length;j++){
          const reversed=[...route.stops.slice(0,i),...route.stops.slice(i,j+1).reverse(),...route.stops.slice(j+1)];
          if(!sequenceFeasible(route.vehicle,reversed,legKm)) continue;
          const candidateRoutes=current.routes.map(r=>r===route?{...r,stops:reversed}:r);
          const score=scoreRoutes(candidateRoutes,weights,0,legKm);
          if(score>current.score){ current={routes:candidateRoutes,score}; improved=true; }
        }
      }
      // or-opt: pull stop i out and re-insert it later in the route.
      for(let i=from;i<route.stops.length;i++){
        const without=[...route.stops.slice(0,i),...route.stops.slice(i+1)];
        for(let j=i+1;j<without.length+1;j++){
          const moved=[...without.slice(0,j),route.stops[i],...without.slice(j)];
          if(!sequenceFeasible(route.vehicle,moved,legKm)) continue;
          const candidateRoutes=current.routes.map(r=>r===route?{...r,stops:moved}:r);
          const score=scoreRoutes(candidateRoutes,weights,0,legKm);
          if(score>current.score){ current={routes:candidateRoutes,score}; improved=true; }
        }
      }
    });
    if(!improved) break;
  }
  return current;
}

function sequenceFeasible(vehicle:Vehicle,stops:WorkStop[],legKm:LegKm){
  const walk={from:vehicle.location,fromId:null as string|null,vehicleId:vehicle.id,distanceKm:0,serviceMinutes:0,loadLitres:vehicle.loadLitres};
  for(const index in stops){
    const stop=stops[index];
    if(!canAppend(walk,vehicle,stop,Number(index),legKm)) return false;
    walk.distanceKm+=legKm({from:walk.from,fromId:walk.fromId,vehicleId:vehicle.id,to:stop}); walk.serviceMinutes+=stop.serviceMinutes;
    walk.loadLitres+=stop.volumeLitres; walk.from=stop.location; walk.fromId=stop.id;
  }
  return true;
}

export function optimizeRoutes(vehicles: Vehicle[], stops: WorkStop[], trigger="scheduled_refresh", seed=4242, previous?:RoutePlan, options?:OptimizeOptions): RoutePlan {
  const weights=adaptive(stops,previous?.weights);
  const rng=new SeededRandom(seed);
  const pheromone=new Map<string,number>();
  const locked=Object.fromEntries((previous?.routes??[]).map(route=>[route.vehicleId,route.stops.filter((stop,index)=>index===0&&(stop.status==="collected"||stop.status==="arrived"||stop.status==="en_route")).map(stop=>stop.workId)]));
  const forcedFirst=(options?.forceFirstWorkIds??[]).filter(id=>stops.some(s=>s.id===id));
  const matrix=options?.roadDistanceMatrix;
  const legKm=makeLegKm(matrix);
  let best:Candidate|undefined;
  let stagnant=0;
  for(let iteration=0;iteration<ACO_ITERATIONS;iteration++){
    let roundBest:Candidate|undefined;
    for(let ant=0;ant<ACO_ANTS;ant++){
      const candidate=construct(vehicles,stops,weights,pheromone,rng,locked,forcedFirst,legKm);
      if(!roundBest||candidate.score>roundBest.score) roundBest=candidate;
      if(!best||candidate.score>best.score) best=candidate;
    }
    deposit(pheromone,roundBest!,1);
    if(best&&best!==roundBest) deposit(pheromone,best,ELITIST_WEIGHT); else if(best) deposit(pheromone,best,1);
    evaporate(pheromone);
    if(iteration>=2&&best){
      const searched=localSearch(best,weights,best.routes.map((_,routeIndex)=>routeIndex===0?forcedFirst.length:0),legKm);
      if(searched.score>best.score){ best=searched; stagnant=0; } else stagnant++;
      if(stagnant>=STAGNATION_LIMIT) break;
    }
  }
  if(!best) best={routes:vehicles.map(vehicle=>({vehicle,stops:[]as WorkStop[]})),score:0};
  const assigned=new Set(best.routes.flatMap(r=>r.stops.map(s=>s.id)));
  const unavailable=vehicles.every(v=>v.status==="offline");
  // Road geometry for the ACO decision: each vehicle gets a full round trip on
  // the A* street grid — current location → ACO-ordered stops → back to origin
  // — plus the cumulative distance of every stop along that path so the map
  // can animate stop-and-go collection and honest ETAs.
  const roadPathByVehicle=best.routes.filter(r=>r.stops.length>0).map(r=>{
    const vehicle=vehicles.find(v=>v.id===r.vehicle.id);
    const origin=vehicle?.location??r.stops[0].location;
    const path=routeOnRoads([origin,...r.stops.map(s=>s.location),origin]);
    const total=pathLengthKm(path);
    const pending=new Map<string,number>(r.stops.map(s=>[`${s.location.lat.toFixed(6)},${s.location.lng.toFixed(6)}`,0]));
    const stopDistances:number[]=[]; let cum=0;
    for(let i=1;i<path.length;i++){
      cum+=haversineKm(path[i-1],path[i]);
      const key=`${path[i].lat.toFixed(6)},${path[i].lng.toFixed(6)}`;
      const hits=pending.get(key);
      if(hits!==undefined&&hits<1){pending.set(key,hits+1);stopDistances.push(Number(cum.toFixed(3)))}
    }
    // Any stop the A* dedupe skipped still needs a sane, monotonically
    // increasing distance — interpolate toward the end instead of the old
    // blanket "90% of the trip" guess.
    let last=stopDistances.at(-1)??0;
    while(stopDistances.length<r.stops.length){
      last=Math.min(total*.98,last+Math.max(.05,total*.02));
      stopDistances.push(Number(last.toFixed(3)));
    }
    for(let i=1;i<stopDistances.length;i++) if(stopDistances[i]<=stopDistances[i-1]) stopDistances[i]=Number((stopDistances[i-1]+.01).toFixed(3));
    return {vehicleId:r.vehicle.id,path,distanceKm:Number(total.toFixed(3)),stopPoints:r.stops.map(s=>s.location),stopDistancesKm:stopDistances};
  });
  const leadRoad=roadPathByVehicle[0];
  const vehicleRoutes=best.routes.map(({vehicle,stops:rawStops})=>{
    let from=vehicle.location,fromId=null as string|null,totalDistance=0,totalMinutes=0,load=vehicle.loadLitres;
    const routeStops:RouteStop[]=rawStops.map((stop,index)=>{
      const distance=legKm({from,fromId,vehicleId:vehicle.id,to:stop});
      const sig=signals(stop,distance); totalDistance+=distance; totalMinutes+=distance/20*60+stop.serviceMinutes; load+=stop.volumeLitres;
      const contributions:RouteContribution[]=NAMES.map(k=>({signal:k,label:LABELS[k],value:Number(sig[k].toFixed(3)),weight:Number(weights[k].toFixed(3)),contribution:Number((sig[k]*weights[k]*100).toFixed(1))}));
      const top=[...contributions].sort((a,b)=>b.contribution-a.contribution).slice(0,2);
      const isForced=forcedFirst.includes(stop.id)&&rawStops.findIndex(s=>s.id===stop.id)<forcedFirst.length;
      const explanation=isForced
        ?`Prioritized because the bin hit 100% and triggered an overflow alert; dispatched ahead of the normal sequence. The stop adds ${distance.toFixed(1)} km and remains within vehicle capacity.`
        :`Prioritized because ${top[0].label.toLowerCase()} contributed ${top[0].contribution} points and ${top[1].label.toLowerCase()} contributed ${top[1].contribution}. The stop adds ${distance.toFixed(1)} km and remains within vehicle capacity.`;
      const isLocked=(locked[vehicle.id]??[]).includes(stop.id);
      const topCodes=top.map(c=>`signal_${c.signal}`);
      const reasonCodes=isForced?["overflow_priority",...topCodes]:topCodes;
      const result:RouteStop={id:`stop-${stop.id}`,workId:stop.id,kind:stop.kind,label:stop.label,locality:stop.locality,location:stop.location,sequence:index+1,etaMinutes:Math.round(totalMinutes),serviceMinutes:stop.serviceMinutes,volumeLitres:stop.volumeLitres,status:isLocked?"en_route":"pending",priorityScore:stop.priorityScore,contributions,explanation:`${explanation} Travel uses ${matrix?"shortest-path OSM road distances":"a labelled Haversine x 1.25 road estimate"} at 20 km/h; projected load is ${Math.round(load/vehicle.capacityLitres*100)}%.`,distanceKm:Number(distance.toFixed(2)),locked:isLocked||isForced,distanceSource:"haversine_road_estimate",reasonCodes,capacityImpact:{volumeLitres:stop.volumeLitres,projectedLoadLitres:load,utilizationPercent:Number((load/vehicle.capacityLitres*100).toFixed(1))},priorityFactors:stop.priorityFactors??[]};
      from=stop.location; fromId=stop.id; return result;
    });
    return {vehicleId:vehicle.id,stops:routeStops,totalDistanceKm:Number(totalDistance.toFixed(2)),totalMinutes:Math.round(totalMinutes),projectedLoadLitres:load};
  });
  return {id:`route-${seed}-${trigger.replace(/\W/g,"-")}`,version:(previous?.version??0)+1,status:"proposed",algorithm:"multi-signal-aco-inspired-v1",seed,trigger,generatedAt:new Date().toISOString(),weights,routes:vehicleRoutes,unassigned:stops.filter(s=>!assigned.has(s.id)).map(s=>({id:s.id,reason:unavailable?"No available vehicle":"No feasible capacity, 45 km route-distance, 8-stop, or 480-minute shift slot"})),totalDistanceKm:Number(vehicleRoutes.reduce((s,r)=>s+r.totalDistanceKm,0).toFixed(2)),totalMinutes:vehicleRoutes.reduce((s,r)=>s+r.totalMinutes,0),fallbackUsed:stops.length>0&&assigned.size===0,distanceMode:"haversine_road_estimate",roadPath:leadRoad?.path??[],roadDistanceKm:leadRoad?.distanceKm??0,roadPathByVehicle,roadGeometrySource:"synthetic_grid"};
}
