import { haversineKm } from "./geo";
import type { GeoPoint } from "./types";

// Synthetic road-network router for the demo. A* runs over a labelled street
// grid covering the Mahadevapura pilot area, so vehicles follow road-like
// (Manhattan) paths instead of flying over buildings. This is clearly
// synthetic geography logic — real deployment would swap in OSRM/Valhalla.

const STEP = 0.0035; // ~390 m block size
export const ROAD_BOUNDS = { minLat: 12.91, maxLat: 13.0, minLng: 77.66, maxLng: 77.775 };

type NodeKey = `${number},${number}`;
const round = (value: number) => Math.round(value / STEP) * STEP;

function nodeKey(lat: number, lng: number): NodeKey {
  return `${round(lat).toFixed(4)},${round(lng).toFixed(4)}` as NodeKey;
}

export function snapToRoad(point: GeoPoint): GeoPoint {
  return { lat: round(point.lat), lng: round(point.lng) };
}

function neighbors(key: NodeKey): NodeKey[] {
  const [latStr, lngStr] = key.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  return ([
    [lat + STEP, lng], [lat - STEP, lng], [lat, lng + STEP], [lat, lng - STEP],
  ] as const)
    .filter(([nLat, nLng]) => nLat >= ROAD_BOUNDS.minLat && nLat <= ROAD_BOUNDS.maxLat && nLng >= ROAD_BOUNDS.minLng && nLng <= ROAD_BOUNDS.maxLng)
    .map(([nLat, nLng]) => nodeKey(nLat, nLng));
}

function keyToGeo(key: NodeKey): GeoPoint {
  const [lat, lng] = key.split(",").map(Number);
  return { lat, lng };
}

// Heuristic: Manhattan distance on the grid (admissible for 4-connected edges
// whose weights are straight-line distances).
function heuristicKm(a: NodeKey, b: NodeKey): number {
  const [aLat, aLng] = a.split(",").map(Number);
  const [bLat, bLng] = b.split(",").map(Number);
  return Math.abs(aLat - bLat) * 111 + Math.abs(aLng - bLng) * 111 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
}

export function aStarRoadPath(from: GeoPoint, to: GeoPoint): GeoPoint[] {
  const start = nodeKey(from.lat, from.lng);
  const goal = nodeKey(to.lat, to.lng);
  if (start === goal) return [from, to];

  const gScore = new Map<NodeKey, number>([[start, 0]]);
  const cameFrom = new Map<NodeKey, NodeKey>();
  const open = new Set<NodeKey>([start]);
  const fScore = new Map<NodeKey, number>([[start, heuristicKm(start, goal)]]);

  while (open.size > 0) {
    let current: NodeKey | undefined;
    let best = Infinity;
    for (const key of open) {
      const score = fScore.get(key) ?? Infinity;
      if (score < best) { best = score; current = key; }
    }
    if (!current) break;
    if (current === goal) {
      const path: GeoPoint[] = [from];
      let walk: NodeKey | undefined = current;
      const chain: NodeKey[] = [];
      while (walk && walk !== start) { chain.unshift(walk); walk = cameFrom.get(walk); }
      for (const key of chain) path.push(keyToGeo(key));
      path.push(to);
      return path;
    }
    open.delete(current);
    const currentGeo = keyToGeo(current);
    for (const neighbor of neighbors(current)) {
      const tentative = (gScore.get(current) ?? Infinity) + haversineKm(currentGeo, keyToGeo(neighbor));
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        fScore.set(neighbor, tentative + heuristicKm(neighbor, goal));
        open.add(neighbor);
      }
    }
  }
  // Grid unreachable (outside bounds): fall back to a straight segment.
  return [from, to];
}

// Road path through a sequence of stops (A* per leg), deduplicating shared nodes.
export function routeOnRoads(stops: GeoPoint[]): GeoPoint[] {
  if (stops.length < 2) return [...stops];
  const path: GeoPoint[] = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const leg = aStarRoadPath(stops[i - 1], stops[i]);
    for (const point of leg.slice(1)) {
      const last = path.at(-1);
      if (!last || Math.abs(last.lat - point.lat) > 1e-6 || Math.abs(last.lng - point.lng) > 1e-6) path.push(point);
    }
  }
  return path;
}

export function pathLengthKm(path: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineKm(path[i - 1], path[i]);
  return total;
}

// Position at a given travelled distance (km) along the path, plus the bearing
// of the segment being travelled — used by the map to move and rotate trucks.
export function pointAtDistance(path: GeoPoint[], distanceKm: number): { location: GeoPoint; bearing: number } | null {
  if (path.length < 2) return null;
  let remaining = Math.max(0, distanceKm);
  for (let i = 1; i < path.length; i++) {
    const segKm = haversineKm(path[i - 1], path[i]);
    if (remaining <= segKm) {
      const t = segKm === 0 ? 0 : remaining / segKm;
      const from = path[i - 1];
      const to = path[i];
      const bearing = bearingDegrees(from, to);
      return { location: { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t }, bearing };
    }
    remaining -= segKm;
  }
  const last = path.at(-1)!;
  const prev = path.at(-2)!;
  return { location: last, bearing: bearingDegrees(prev, last) };
}

export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const rad = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Sub-path between two travelled distances, in the same km metric that
// produced those distances. roadFactor 1 = grid/Haversine-road units (×1.25,
// what pathLengthKm and the optimizer produce); 1.25 = pure sphere units
// (real OSM edge lengths). Endpoints are interpolated so slices join.
export function slicePath(points: GeoPoint[], fromKm: number, toKm: number, roadFactor = 1): GeoPoint[] {
  if (points.length < 2 || toKm <= fromKm) return [];
  const km = (a: GeoPoint, b: GeoPoint) => haversineKm(a, b) / roadFactor;
  const out: GeoPoint[] = [];
  let cum = 0;
  let started = false;
  for (let i = 1; i < points.length; i++) {
    const segKm = km(points[i - 1], points[i]);
    const segEnd = cum + segKm;
    if (!started && segEnd >= fromKm) {
      const t = segKm === 0 ? 0 : Math.max(0, (fromKm - cum)) / segKm;
      out.push({ lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t, lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t });
      started = true;
    }
    if (started) {
      if (segEnd >= toKm) {
        const t = segKm === 0 ? 1 : Math.min(1, (toKm - cum) / segKm);
        out.push({ lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t, lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t });
        return out;
      }
      out.push(points[i]);
    }
    cum = segEnd;
  }
  return out.length ? out : [];
}
