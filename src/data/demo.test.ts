import { describe, expect, it } from "vitest";
import { createDemoState, toWorkStops } from "./demo";

describe("mock user live-location pickup", () => {
  it("seeds a labelled mock live position for the citizen", () => {
    const state = createDemoState();
    expect(state.userLocation).toBeDefined();
    expect(state.userLocation?.locality).toBe("Whitefield");
    expect(state.userLocation?.source.isSynthetic).toBe(true);
    expect(state.userLocation?.servedOnDay).toBeUndefined();
  });

  it("enters the plan as a normal-priority pickup work stop", () => {
    const state = createDemoState();
    const stops = toWorkStops(state);
    const pickup = stops.find(s => s.kind === "pickup");
    expect(pickup).toBeDefined();
    expect(pickup?.id).toBe("user-pickup");
    expect(pickup?.location).toEqual(state.userLocation!.location);
    // Same weight band as a have_waste citizen signal: ACO orders it by the
    // usual density/distance trade-off instead of pinning it first.
    expect(pickup?.priorityScore).toBe(55);
    expect(pickup?.citizenDemand).toBe(1);
  });

  it("is included in the seeded route from day one", () => {
    const state = createDemoState();
    const stops = state.route.routes[0]?.stops ?? [];
    expect(stops.some(s => s.kind === "pickup")).toBe(true);
  });

  it("drops out of later replans for the rest of the day once serviced", () => {
    const state = createDemoState();
    state.userLocation!.servedOnDay = state.dayCycle.day;
    expect(toWorkStops(state).some(s => s.kind === "pickup")).toBe(false);
  });

  it("is offered again on the next simulated day", () => {
    const state = createDemoState();
    state.userLocation!.servedOnDay = state.dayCycle.day;
    state.dayCycle.day += 1;
    expect(toWorkStops(state).some(s => s.kind === "pickup")).toBe(true);
  });
});
