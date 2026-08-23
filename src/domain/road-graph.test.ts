import { describe, expect, it } from "vitest";
import { aStarRoadPath, bearingDegrees, pathLengthKm, pointAtDistance, routeOnRoads, slicePath, snapToRoad } from "./road-graph";

describe("aStarRoadPath", () => {
  it("returns a contiguous road path whose steps follow the street grid", () => {
    const path = aStarRoadPath({ lat: 12.9690, lng: 77.7350 }, { lat: 12.9780, lng: 77.7200 });
    expect(path.length).toBeGreaterThan(2);
    const step = 0.0035;
    // Interior segments between grid nodes move along exactly one axis at a time.
    for (let i = 2; i < path.length - 1; i++) {
      const dLat = Math.abs(path[i].lat - path[i - 1].lat);
      const dLng = Math.abs(path[i].lng - path[i - 1].lng);
      expect((dLat < 1e-6 ? 0 : 1) + (dLng < 1e-6 ? 0 : 1)).toBe(1);
      expect(dLat === 0 || Math.abs(dLat - step) < 1e-4).toBe(true);
      expect(dLng === 0 || Math.abs(dLng - step) < 1e-4).toBe(true);
    }
  });

  it("keeps endpoints exactly where the traveller is and goes", () => {
    const from = { lat: 12.9725, lng: 77.7468 };
    const to = { lat: 12.9812, lng: 77.7301 };
    const path = aStarRoadPath(from, to);
    expect(path[0]).toEqual(from);
    expect(path.at(-1)).toEqual(to);
  });

  it("is no shorter than the straight-line distance", () => {
    const from = { lat: 12.9700, lng: 77.7400 };
    const to = { lat: 12.9800, lng: 77.7300 };
    const straight = pathLengthKm([from, to]);
    expect(pathLengthKm(aStarRoadPath(from, to))).toBeGreaterThan(straight);
  });

  it("degenerates gracefully for coincident points", () => {
    const point = { lat: 12.97, lng: 77.74 };
    expect(aStarRoadPath(point, snapToRoad(point))).toEqual([point, snapToRoad(point)]);
  });
});

describe("routeOnRoads", () => {
  it("threads multiple stops through one road path without duplicated nodes", () => {
    const stops = [
      { lat: 12.9690, lng: 77.7350 },
      { lat: 12.9780, lng: 77.7250 },
      { lat: 12.9660, lng: 77.7180 },
    ];
    const path = routeOnRoads(stops);
    expect(path[0]).toEqual(stops[0]);
    expect(path.at(-1)).toEqual(stops.at(-1));
    const keys = path.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns the stops untouched when fewer than two are given", () => {
    expect(routeOnRoads([])).toEqual([]);
    expect(routeOnRoads([{ lat: 1, lng: 2 }])).toEqual([{ lat: 1, lng: 2 }]);
  });
});

describe("pointAtDistance + bearingDegrees", () => {
  it("interpolates along the path and reports direction of travel", () => {
    const path = [
      { lat: 12.9700, lng: 77.7400 },
      { lat: 12.9800, lng: 77.7400 },
    ];
    const total = pathLengthKm(path);
    const mid = pointAtDistance(path, total / 2);
    expect(mid).not.toBeNull();
    expect(mid!.location.lat).toBeCloseTo(12.975, 3);
    expect(mid!.bearing).toBeCloseTo(0, 0); // heading due north
    const east = pointAtDistance([
      { lat: 12.97, lng: 77.74 },
      { lat: 12.97, lng: 77.75 },
    ], 0.2);
    expect(east!.bearing).toBeCloseTo(90, 0);
    expect(pointAtDistance(path, total * 5)!.location).toEqual(path.at(-1));
  });

  it("bearing covers the southern heading too", () => {
    expect(bearingDegrees({ lat: 12.98, lng: 77.74 }, { lat: 12.97, lng: 77.74 })).toBeCloseTo(180, 0);
  });
});

describe("slicePath", () => {
  const path = [
    { lat: 12.97, lng: 77.74 },
    { lat: 12.98, lng: 77.74 },
    { lat: 12.98, lng: 77.75 },
  ];
  it("returns the full path when the range covers it", () => {
    const total = pathLengthKm(path);
    const sliced = slicePath(path, 0, total);
    expect(sliced.length).toBe(3);
    expect(sliced[0]).toEqual(path[0]);
    expect(sliced.at(-1)).toEqual(path.at(-1));
  });
  it("interpolates cut points at exact distances", () => {
    const leg1 = pathLengthKm([path[0], path[1]]);
    const sliced = slicePath(path, leg1 / 2, leg1 + pathLengthKm([path[1], path[2]]) / 2);
    expect(sliced.length).toBe(3);
    expect(sliced[0].lat).toBeCloseTo(12.975, 3);
    expect(sliced[1]).toEqual(path[1]);
    expect(sliced.at(-1)!.lng).toBeCloseTo(77.745, 3);
  });
  it("returns empty for an inverted range", () => {
    expect(slicePath(path, 2, 1)).toEqual([]);
  });
});
