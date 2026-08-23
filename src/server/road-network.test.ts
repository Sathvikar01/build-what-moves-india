import { describe, expect, it } from "vitest";
import { aStarOnNetwork, buildRoadNetwork, nearestNode, realRoadTrip, type OverpassWay, type RoadNetwork } from "./road-network";

// Two real-ish streets sharing a junction:
//   Way A (residential): (0,0) → (0,0.01)      [east-west street]
//   Way B (residential): (0,0.01) → (0.01,0.01) [north-south street]
//   Way C (footway):     (0,0) → (0.01,0)       [must be ignored]
//   Way D (oneway):      (0.01,0.01) → (0.01,0) [one-directional]
const ways: OverpassWay[] = [
  { type: "way" as const, id: 1, tags: { highway: "residential" }, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }] },
  { type: "way" as const, id: 2, tags: { highway: "residential" }, geometry: [{ lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }] },
  { type: "way" as const, id: 3, tags: { highway: "footway" }, geometry: [{ lat: 0, lon: 0 }, { lat: 0.01, lon: 0 }] },
  { type: "way" as const, id: 4, tags: { highway: "residential", oneway: "yes" }, geometry: [{ lat: 0.01, lon: 0.01 }, { lat: 0.01, lon: 0 }] },
];

describe("buildRoadNetwork", () => {
  it("indexes drivable ways only and shares junction nodes", () => {
    const network = buildRoadNetwork(ways);
    expect(network.wayCount).toBe(3); // footway excluded
    expect(network.nodes.size).toBe(4); // corners of the square
    const junction = "0.000000,0.010000";
    expect(network.edges.get(junction)!.length).toBe(2); // one bidirectional edge per street
  });

  it("makes oneway edges directional", () => {
    const network = buildRoadNetwork(ways);
    const from = "0.010000,0.010000";
    const to = "0.010000,0.000000";
    const reachableForward = (network.edges.get(from) ?? []).some(e => e.to === to);
    const reachableBackward = (network.edges.get(to) ?? []).some(e => e.to === from);
    expect(reachableForward).toBe(true);
    expect(reachableBackward).toBe(false);
  });
});

describe("nearestNode + aStarOnNetwork", () => {
  const network: RoadNetwork = buildRoadNetwork(ways);

  it("snaps to the closest indexed road node", () => {
    expect(nearestNode(network, { lat: 0.0008, lng: 0 })).toBe("0.000000,0.000000");
  });

  it("routes around the block through the junction, keeping exact endpoints", () => {
    const path = aStarOnNetwork(network, { lat: 0, lng: 0.0004 }, { lat: 0.0096, lng: 0.01 });
    expect(path[0]).toEqual({ lat: 0, lng: 0.0004 });
    expect(path.at(-1)).toEqual({ lat: 0.0096, lng: 0.01 });
    expect(path.some(p => p.lat.toFixed(6) === "0.000000" && p.lng.toFixed(6) === "0.010000")).toBe(true);
  });

  it("returns a straight fallback when no road connects the endpoints", () => {
    const empty = buildRoadNetwork([]);
    const path = aStarOnNetwork(empty, { lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(path).toEqual([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]);
  });
});

describe("realRoadTrip", () => {
  it("builds a round trip that starts and ends at the origin with stop distances", () => {
    const network = buildRoadNetwork(ways);
    const origin = { lat: 0, lng: 0 };
    const stop = { lat: 0.01, lng: 0.01 };
    const trip = realRoadTrip(network, [origin, stop, origin]);
    expect(trip.path[0]).toEqual(origin);
    expect(trip.path.at(-1)).toEqual(origin);
    expect(trip.stopDistancesKm.length).toBe(1);
    expect(trip.stopDistancesKm[0]).toBeGreaterThan(0);
    expect(trip.stopDistancesKm[0]).toBeLessThan(5);
  });
});
