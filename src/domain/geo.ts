import type { GeoPoint } from "./types";

// Shared straight-line distance with the demo's labelled ×1.25 road factor.
// Lives here so optimizer and placement can share it without
// import cycles.
export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const r = 6371; const rad = Math.PI / 180; const dLat = (b.lat-a.lat)*rad; const dLng=(b.lng-a.lng)*rad;
  const q = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 2*r*Math.asin(Math.sqrt(q))*1.25;
}
