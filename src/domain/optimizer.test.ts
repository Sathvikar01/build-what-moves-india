import { describe,expect,it } from "vitest";import { createDemoState,toWorkStops } from "../data/demo";import { optimizeRoutes,type WorkStop } from "./optimizer";import type { RoutePlan } from "./types";import { SYNTHETIC_SOURCE } from "../data/demo";

const stripTimestamp=(plan:RoutePlan):Omit<RoutePlan,"generatedAt">=>{const {generatedAt,...rest}=plan;void generatedAt;return rest}

describe("five-colony ACO-inspired routing",()=>{
  it("replays deterministically for seed 4242",()=>{
    const state=createDemoState();
    const a=optimizeRoutes(state.vehicles,toWorkStops(state),"test",4242);
    const b=optimizeRoutes(state.vehicles,toWorkStops(state),"test",4242);
    expect(stripTimestamp(a)).toEqual(stripTimestamp(b));
    expect(Object.values(a.weights).reduce((s,x)=>s+x,0)).toBeCloseTo(1,6);
  });

  it("has no duplicate work and explains all five signals",()=>{
    const state=createDemoState();
    const plan=optimizeRoutes(state.vehicles,toWorkStops(state),"test",4242);
    const stops=plan.routes.flatMap(r=>r.stops);
    expect(new Set(stops.map(s=>s.workId)).size).toBe(stops.length);
    for(const stop of stops){
      expect(stop.contributions).toHaveLength(5);
      expect(stop.reasonCodes.length).toBeGreaterThanOrEqual(2);
      expect(stop.distanceSource).toBe("haversine_road_estimate");
      expect(stop.explanation).toContain("Prioritized because");
    }
  });

  it("turns a new citizen signal into routable work",()=>{
    const state=createDemoState();
    state.signals.unshift({id:"sig-citizen-test",type:"waste_outside",category:"mixed",amountBand:"medium",locality:"Whitefield",location:{lat:12.97,lng:77.75},status:"queued",createdAt:state.now,source:state.signals[0].source});
    expect(toWorkStops(state).some(s=>s.id==="sig-citizen-test")).toBe(true);
  });
});

describe("overflow-priority routing",()=>{
  it("pins an overflowed bin to the front of the lead route",()=>{
    const state=createDemoState();
    state.bins[8].fillPercent=100;
    const plan=optimizeRoutes(state.vehicles,toWorkStops(state),"bin_overflow_alert",4242,void 0,{forceFirstWorkIds:[state.bins[8].id]});
    const lead=plan.routes[0];
    expect(lead.stops.length).toBeGreaterThan(0);
    expect(lead.stops[0].workId).toBe(state.bins[8].id);
    expect(lead.stops[0].reasonCodes).toContain("overflow_priority");
    expect(lead.stops[0].locked).toBe(true);
  });

  it("keeps deterministic output when options are passed",()=>{
    const state=createDemoState();
    state.bins[8].fillPercent=100;
    const work=toWorkStops(state);
    const a=optimizeRoutes(state.vehicles,work,"bin_overflow_alert",4242,void 0,{forceFirstWorkIds:["bin-09"]});
    const b=optimizeRoutes(state.vehicles,work,"bin_overflow_alert",4242,void 0,{forceFirstWorkIds:["bin-09"]});
    expect(stripTimestamp(a)).toEqual(stripTimestamp(b));
  });

  it("seeds every bin below the overflow threshold (70-80% band before collection)",()=>{
    const state=createDemoState();
    for(const bin of state.bins){
      if(bin.status==="offline") continue;
      expect(bin.fillPercent).toBeLessThan(100);
      expect(bin.fillPercent).toBeLessThanOrEqual(80);
    }
  });

  it("orders stops by shortest ROAD distance when a matrix is given",()=>{
    const vehicle={
      id:"veh-01",label:"KA-01-AF-2147",type:"auto_tipper" as const,
      location:{lat:12.9685,lng:77.7358},heading:82,status:"en_route" as const,
      capacityLitres:4200,loadLitres:0,lastSeenAt:"2026-08-21T11:59:42.000Z",source:SYNTHETIC_SOURCE,
    };
    const makeStop=(id:string,lat:number,lng:number):WorkStop=>({
      id,kind:"bin",label:id,locality:"Whitefield",location:{lat,lng},
      volumeLitres:100,serviceMinutes:2,priorityScore:50,binFill:.5,citizenDemand:.5,
      reportSeverity:.5,urbanDensity:.5,
    });
    // Haversine says stop X (right next to the depot) is closer; the road
    // matrix says Y is one street away while X needs a 6 km detour.
    const nearHav=makeStop("stop-hav-near",12.9686,77.7359); // ~10 m from depot
    const farHav=makeStop("stop-road-near",12.9600,77.7300);
    const matrix={
      fromVehicle:{"veh-01":{"stop-hav-near":6,"stop-road-near":1}},
      betweenStops:{"stop-hav-near>stop-road-near":7,"stop-road-near>stop-hav-near":7},
    };
    const withMatrix=optimizeRoutes([vehicle],[nearHav,farHav],"matrix_test",4242,void 0,{roadDistanceMatrix:matrix});
    expect(withMatrix.routes[0].stops.map(s=>s.workId)).toEqual(["stop-road-near","stop-hav-near"]);
    // Without the matrix the Haversine fallback prefers the near-depot stop.
    const withoutMatrix=optimizeRoutes([vehicle],[nearHav,farHav],"matrix_test",4242,void 0,{});
    expect(withoutMatrix.routes[0].stops.map(s=>s.workId)).toEqual(["stop-hav-near","stop-road-near"]);
  });
});
