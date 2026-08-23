"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CircleMarker, LayerGroup, Map as LeafletMap, Marker, Polyline } from "leaflet";
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "../config/map";
import { MAHADEVAPURA_CENTER } from "../data/locations";
import { pointAtDistance, slicePath } from "../domain/road-graph";
import { haversineKm } from "../domain/geo";
import type { GeoPoint } from "../domain/types";
import { DEMO_TIME_SCALE, TRUCK_SPEED_KMH, type TripStatus } from "./trip-status";

export type MapMarker = {
  id: string;
  label: string;
  location: GeoPoint;
  kind: "vehicle" | "bin" | "report" | "signal" | "recommendation" | "user";
  detail?: string;
  overflow?: boolean; // bin at 100% — drawn red with a pulse
};

export type VehicleRoadPath = { vehicleId: string; path: GeoPoint[]; stopDistancesKm?: number[]; stopPoints?: GeoPoint[] };

// Mock citizen position near Whitefield (demo seed area). The pilot's scenario
// geography is Mahadevapura, so "my location" is spawned inside the pilot zone
// and clearly labelled as mock.
export const MOCK_USER_LOCATION: GeoPoint = { lat: 12.9722, lng: 77.7465 };

type MapStatus = "loading" | "ready" | "error";
type RoutePath = { points: GeoPoint[]; totalKm: number; stops: number[] };

const TRUCK_SVG = `<div class="truck-marker"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 19.5 21 12 16.6 4.5 21Z" fill="#0e5035" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg></div>`;

type VehicleEntry = { marker: Marker; bearing: number; lastLocation: GeoPoint | null };

export function BengaluruMap({ markers, route = [], vehiclePaths, geometrySource = "synthetic_grid", tripStatus, height = 420, userLocation }: { markers: MapMarker[]; route?: GeoPoint[]; vehiclePaths?: VehicleRoadPath[]; geometrySource?: "osm_overpass" | "synthetic_grid"; tripStatus?: TripStatus | null; height?: number | string; userLocation?: GeoPoint | null }) {
  // `route`/`vehiclePaths` come from the backend plan (ACO sequence → A* roads):
  // each path starts at the vehicle's current location, visits its stops in
  // ACO order, and returns to the origin. The map never re-plans.
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const staticLayerRef = useRef<LayerGroup | null>(null);
  const vehicleLayerRef = useRef<LayerGroup | null>(null);
  const routeLayerRef = useRef<(Polyline | CircleMarker)[]>([]);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const hasFittedRef = useRef(false);
  const staticMarkersRef = useRef(new Map<string, CircleMarker>());
  const vehiclesRef = useRef(new Map<string, VehicleEntry>());
  const pathsRef = useRef(new Map<string, RoutePath>());
  const [status, setStatus] = useState<MapStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [mapVersion, setMapVersion] = useState(0);
  const id = useId();

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    hasFittedRef.current = false;

    (async () => {
      try {
        const L = await import("leaflet");
        if (disposed || !ref.current) return;
        leafletRef.current = L;
        const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(
          [MAHADEVAPURA_CENTER.lat, MAHADEVAPURA_CENTER.lng],
          13,
        );
        mapRef.current = map;
        staticLayerRef.current = L.layerGroup().addTo(map);
        vehicleLayerRef.current = L.layerGroup().addTo(map);
        userLayerRef.current = L.layerGroup().addTo(map);

        const tiles = L.tileLayer(MAP_TILE_URL, { maxZoom: 19, attribution: MAP_ATTRIBUTION });
        tiles.on("tileerror", () => setStatus("error"));
        tiles.on("load", () => setStatus("ready"));
        tiles.addTo(map);
        setStatus("ready");
        setMapVersion((version) => version + 1);
      } catch {
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      staticLayerRef.current = null;
      vehicleLayerRef.current = null;
      routeLayerRef.current = [];
      userLayerRef.current = null;
      leafletRef.current = null;      staticMarkersRef.current.clear();
      vehiclesRef.current.clear();
      pathsRef.current.clear();
    };
  }, [retryKey]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const staticLayer = staticLayerRef.current;
    const vehicleLayer = vehicleLayerRef.current;
    if (!L || !map || !staticLayer || !vehicleLayer) return;

    // Per-vehicle road loops from the backend plan; fall back to the single
    // `route` polyline when no vehicle mapping is provided.
    pathsRef.current.clear();
    // Slice metric: OSM distances are pure sphere (÷1.25 of the road-factor
    // Haversine); grid distances keep the ×1.25 road factor.
    const roadFactor = geometrySource === "osm_overpass" ? 1.25 : 1;
    const pathTotal = (points: GeoPoint[]) => {
      let total = 0;
      for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]) / roadFactor;
      return total;
    };
    const toRoutePath = (points: GeoPoint[], stops?: number[]): RoutePath | null =>
      points.length > 1 ? { points, totalKm: pathTotal(points), stops: stops ?? [] } : null;
    if (vehiclePaths && vehiclePaths.length > 0) {
      for (const entry of vehiclePaths) {
        const converted = toRoutePath(entry.path, entry.stopDistancesKm);
        if (converted) pathsRef.current.set(entry.vehicleId, converted);
      }
    }
    const fallbackPath = toRoutePath(route);
    if (fallbackPath && pathsRef.current.size === 0) pathsRef.current.set("__route__", fallbackPath);

    // Point-to-point rendering: traveled part dimmed, the current leg to the
    // next stop bold blue (white casing, Google-style), upcoming legs lighter.
    for (const line of routeLayerRef.current) line.removeFrom(map);
    routeLayerRef.current = [];
    const leadPath = vehiclePaths?.[0] ? pathsRef.current.get(vehiclePaths[0].vehicleId) ?? fallbackPath : fallbackPath;
    const draw = (points: GeoPoint[], color: string, weight: number, opacity: number, dashed = false) => {
      if (points.length < 2) return;
      const latlngs = points.map((point) => [point.lat, point.lng] as [number, number]);
      const line = L.polyline(latlngs, { color, weight, opacity, dashArray: dashed ? "6 8" : undefined }).addTo(map);
      routeLayerRef.current.push(line);
    };
    if (leadPath) {
      if (tripStatus) {
        const total = leadPath.totalKm;
        const progress = Math.min(tripStatus.progressKm, total);
        // One continuous blue traversal line anchored at the truck: everything
        // from its current position through the remaining stops back to base.
        draw(slicePath(leadPath.points, 0, progress, roadFactor), "#7d9187", 4, 0.55);            // traveled (dimmed)
        draw(slicePath(leadPath.points, progress, total, roadFactor), "#fff", 9, 0.9);            // casing
        draw(slicePath(leadPath.points, progress, total, roadFactor), "#146bd1", 5.5, 0.95);      // route from vehicle
        draw(slicePath(leadPath.points, progress, Math.min(tripStatus.nextStopKm ?? total, total), roadFactor), "#0b57c2", 7.5, 1); // leg to next stop
      } else {
        draw(leadPath.points, "#fff", 9, 0.9);
        draw(leadPath.points, "#146bd1", 5.5, 0.95);
      }
    }

    // Pulse a target ring on the stop the truck is heading toward / halting at,
    // so "the route to the point where the dustbin is" reads instantly.
    const leadEntry = vehiclePaths?.[0];
    const nextPoint = tripStatus?.nextStopIndex != null ? leadEntry?.stopPoints?.[Math.min(tripStatus.nextStopIndex, (leadEntry.stopPoints.length ?? 1) - 1)] : undefined;
    if (nextPoint && tripStatus && tripStatus.nextStopIndex !== null) {
      const ring = L.circleMarker([nextPoint.lat, nextPoint.lng], {
        radius: 14,
        color: "#146bd1",
        weight: 3,
        opacity: 0.9,
        fillColor: "#146bd1",
        fillOpacity: 0.15,
        className: "next-stop-ring",
      }).addTo(map);
      routeLayerRef.current.push(ring);
    }

    // These mirror the :root tokens in app/globals.css (--green, --amber, --red, --focus, --recommendation).
    const colors = { vehicle: "#176b48", bin: "#bd6b19", report: "#b43d34", signal: "#146bd1", recommendation: "#6d4aa2", user: "#146bd1" } as const;

    const statics = staticMarkersRef.current;
    const vehicles = vehiclesRef.current;
    const seenStatic = new Set<string>();
    const seenVehicles = new Set<string>();

    markers.forEach((marker) => {
      if (marker.kind === "user") return;
      const popup = `${marker.label}${marker.detail ? ` · ${marker.detail}` : ""}`;
      if (marker.kind === "vehicle") {
        seenVehicles.add(marker.id);
        const existing = vehicles.get(marker.id);
        if (existing) {
          existing.marker.bindPopup(popup);
          existing.lastLocation = marker.location; // easing target follows the server engine
          // With reduced motion the easing loop is off — snap instead.
          if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            existing.marker.setLatLng([marker.location.lat, marker.location.lng]);
          }
          return;
        }
        const truck = L.marker([marker.location.lat, marker.location.lng], {
          icon: L.divIcon({ className: "truck-wrap", html: TRUCK_SVG, iconSize: [26, 26], iconAnchor: [13, 13] }),
          zIndexOffset: 600,
        }).bindPopup(popup).addTo(vehicleLayer);
        vehicles.set(marker.id, { marker: truck, bearing: 0, lastLocation: marker.location });
        return;
      }
      // Bins, reports, signals, recommendations never move on their own.
      seenStatic.add(marker.id);
      const overflow = marker.overflow === true;
      const popupText = overflow ? `OVERFLOW · ${popup}` : popup;
      const existing = statics.get(marker.id);
      if (existing) {
        existing.setLatLng([marker.location.lat, marker.location.lng]);
        existing.setStyle({ fillColor: overflow ? "#b43d34" : colors[marker.kind], className: overflow ? "overflow-bin" : "" });
        existing.bindPopup(popupText);
        return;
      }
      statics.set(marker.id, L.circleMarker([marker.location.lat, marker.location.lng], {
        radius: marker.kind === "recommendation" ? 7 : 6,
        color: "#fff",
        weight: 3,
        fillColor: overflow ? "#b43d34" : colors[marker.kind],
        fillOpacity: 1,
        className: overflow ? "overflow-bin" : undefined,
      }).bindPopup(popupText).addTo(staticLayer));
    });

    for (const [key, marker] of statics) if (!seenStatic.has(key)) { marker.remove(); statics.delete(key); }
    for (const [key, entry] of vehicles) if (!seenVehicles.has(key)) { entry.marker.remove(); vehicles.delete(key); }

    const userLayer = userLayerRef.current;
    if (userLayer) {
      userLayer.clearLayers();
      if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({ className: "user-dot-wrap", html: '<span class="user-dot"><i></i></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          zIndexOffset: 500,
        }).bindPopup("You are here (mock demo location · Whitefield)").addTo(userLayer);
      }
    }

    if (!hasFittedRef.current && (markers.length > 0 || route.length > 0)) {
      const points = [
        ...markers.map((marker) => [marker.location.lat, marker.location.lng] as [number, number]),
        ...(userLocation ? ([[userLocation.lat, userLocation.lng]] as [number, number][]) : []),
        ...route.map((point) => [point.lat, point.lng] as [number, number]),
      ];
      map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 14 });
      hasFittedRef.current = true;
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [markers, route, vehiclePaths, geometrySource, tripStatus, userLocation, mapVersion]);

  // The server day-cycle engine owns progress; the map plays it smoothly.
  // Between polls the truck is DEAD-RECKONED along the actual route polyline
  // at the demo speed, so it visibly drives from one dustbin to the next,
  // pauses while a stop is being emptied, and snaps onto the server position
  // whenever a re-plan moves the path under it.
  const animRef = useRef<{ vehicleId: string; points: GeoPoint[]; serverProgressKm: number; totalKm: number; moving: boolean; localKm: number } | null>(null);
  useEffect(() => {
    const lead = vehiclePaths?.[0];
    const path = pathsRef.current.get(lead?.vehicleId ?? "");
    if (lead && path && tripStatus && tripStatus.nextStopIndex !== null) {
      const prev = animRef.current;
      const sameTrip = prev?.vehicleId === lead.vehicleId && prev.points === path.points;
      animRef.current = {
        vehicleId: lead.vehicleId,
        points: path.points,
        serverProgressKm: tripStatus.progressKm,
        totalKm: path.totalKm,
        moving: !tripStatus.servicing,
        // Keep the local playhead when only the poll refreshed; reset it when
        // the geometry changed under us (re-plan / new day).
        localKm: sameTrip ? prev.localKm : tripStatus.progressKm,
      };
    } else {
      animRef.current = null;
    }
  }, [vehiclePaths, tripStatus, mapVersion]);

  useEffect(() => {
    const vehicles = vehiclesRef.current;
    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    let frame = 0;
    let lastTs = 0;
    const EASE = 0.06; // fraction of remaining distance covered per frame (fallback glide)
    const SPEED_KM_PER_SEC = TRUCK_SPEED_KMH * DEMO_TIME_SCALE / 3600;
    const SNAP_KM = 0.25; // beyond this the plan changed — snap instead of drive
    const loop = (ts: number) => {
      const dt = lastTs ? Math.min(0.25, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const anim = animRef.current;
      const leadEntry = anim ? vehicles.get(anim.vehicleId) : undefined;
      if (leadEntry && anim && anim.points.length > 1) {
        // Lead vehicle: advance along the polyline itself.
        if (!anim.moving || Math.abs(anim.localKm - anim.serverProgressKm) > SNAP_KM) {
          anim.localKm = anim.serverProgressKm;
        } else {
          anim.localKm = Math.min(anim.totalKm, anim.localKm + SPEED_KM_PER_SEC * dt);
          // Never run ahead of what the engine has simulated.
          if (anim.localKm > anim.serverProgressKm + 1) anim.localKm = anim.serverProgressKm;
        }
        const at = pointAtDistance(anim.points, anim.localKm);
        if (at) {
          leadEntry.marker.setLatLng([at.location.lat, at.location.lng]);
          leadEntry.bearing = at.bearing;
        }
        const arrow = leadEntry.marker.getElement()?.querySelector<HTMLElement>(".truck-marker svg");
        if (arrow) arrow.style.transform = `rotate(${leadEntry.bearing}deg)`;
      }
      for (const [id, entry] of vehicles) {
        if (leadEntry && id === anim?.vehicleId) continue;
        // Fallback for any other vehicle: ease toward its latest position.
        const current = entry.marker.getLatLng();
        const target = entry.lastLocation;
        if (!target) continue;
        const dLat = target.lat - current.lat;
        const dLng = target.lng - current.lng;
        const moved = Math.hypot(dLat, dLng);
        if (moved < 1e-7) continue;
        if (moved > 0.01) {
          // Big jump (new day / re-plan): snap and reset the heading.
          entry.marker.setLatLng([target.lat, target.lng]);
          entry.bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;
        } else {
          entry.marker.setLatLng([current.lat + dLat * EASE, current.lng + dLng * EASE]);
          const raw = (Math.atan2(dLng, dLat) * 180) / Math.PI;
          const delta = ((raw - entry.bearing + 540) % 360) - 180; // shortest arc
          entry.bearing = entry.bearing + delta * 0.1;
        }
        const svg = entry.marker.getElement()?.querySelector(".truck-marker svg") as HTMLElement | null;
        if (svg) svg.style.transform = `rotate(${entry.bearing}deg)`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mapVersion]);

  return (
    <section className="map-frame" data-geometry={geometrySource} aria-labelledby={`${id}-title`} aria-busy={status === "loading"}>
      <strong className="sr-only" id={`${id}-title`}>Mahadevapura operations map</strong>
      <div id={id} ref={ref} style={{ height }} className="leaflet-map" role="img" aria-label="Interactive map of vehicles, bins, reports, your location, and route stops in Mahadevapura" />
      {tripStatus && (
        <div className="route-status" role="status">
          <span className="route-status-blue" aria-hidden="true" />
          <strong>{tripStatus.label}</strong>
          <span>·</span>
          <strong>{tripStatus.remainingKm} km</strong>
          <span>·</span>
          <strong>{tripStatus.servicing ? "emptying" : `${tripStatus.etaToNextMinutes} min to next stop`}</strong>
          <small>{tripStatus.totalKm} km trip · {tripStatus.sub}</small>
        </div>
      )}
      {status === "loading" && <div className="map-loading" role="status">Loading map…</div>}
      {status === "error" && (
        <div className="map-fallback" role="status">
          <strong>Map tiles are unavailable.</strong>
          <span>Use the location list below or try loading the map again.</span>
          <button className="secondary-button" type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry map</button>
        </div>
      )}
      <details className="map-access-list">
        <summary>All map locations</summary>
        <ul>
          {userLocation && (
            <li key="mock-user-location"><span className="legend-swatch user" /><span><b>you</b>, Your mock location · Whitefield (demo)</span></li>
          )}
          {markers.map((marker) => (
            marker.kind === "user" ? null : (
              <li key={marker.id}><span className={`legend-swatch ${marker.kind}`} /><span><b>{marker.kind}</b>, {marker.label}{marker.detail ? `, ${marker.detail}` : ""}</span></li>
            )
          ))}
        </ul>
      </details>
    </section>
  );
}
