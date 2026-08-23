import { describe, expect, it } from "vitest";
import { getRoadNetwork, realRoadTrip } from "./road-network";

describe("real OSM road snapshot", () => {
  // Generous vitest timeout for loaded CI machines — the strict performance
  // assertions below are what actually guard A* speed.
  it("loads the baked Mahadevapura network and routes real road trips fast", { timeout: 30000 }, async () => {
    const started = Date.now();
    const network = await getRoadNetwork();
    expect(network.wayCount).toBeGreaterThan(5000);
    expect(network.nodes.size).toBeGreaterThan(20000);

    const routeStart = Date.now();
    const trip = realRoadTrip(network, [
      { lat: 12.9685, lng: 77.7358 }, // Whitefield (veh-01 origin)
      { lat: 12.9691, lng: 77.7132 }, // Kundalahalli market
      { lat: 12.9685, lng: 77.7358 }, // return home
    ]);
    expect(trip.path.length).toBeGreaterThan(20); // follows actual street segments
    expect(trip.stopDistancesKm.length).toBe(1);
    expect(trip.stopDistancesKm[0]).toBeGreaterThan(0);
    expect(Date.now() - routeStart).toBeLessThan(5000); // heap A* must stay fast
    expect(Date.now() - started).toBeLessThan(10000);
  });
});
