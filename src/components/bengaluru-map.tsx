"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CircleMarker, LayerGroup, Map as LeafletMap, Polyline } from "leaflet";
import { MAP_ATTRIBUTION, MAP_TILE_IS_LIGHT, MAP_TILE_URL } from "../config/map";
import { MAHADEVAPURA_CENTER, MOCK_USER_LOCATION } from "../data/locations";
import type { GeoPoint } from "../domain/types";

export type MapMarker = {
  id: string;
  label: string;
  location: GeoPoint;
  kind: "vehicle" | "bin" | "report" | "signal" | "recommendation" | "user" | "pickup";
  detail?: string;
  overflow?: boolean; // bin at 100% — drawn red with a pulse
};

export type VehicleRoadPath = { vehicleId: string; path: GeoPoint[]; stopDistancesKm?: number[]; stopPoints?: GeoPoint[] };

// Mock citizen position near Whitefield (demo seed area). The pilot's scenario
// geography is Mahadevapura, so "my location" is spawned inside the pilot zone
// and clearly labelled as mock.
export { MOCK_USER_LOCATION };

type MapStatus = "loading" | "ready" | "error";

type VehicleEntry = { marker: CircleMarker };

export function BengaluruMap({ markers, route = [], vehiclePaths, height = 420, userLocation, interactive = true }: { markers: MapMarker[]; route?: GeoPoint[]; vehiclePaths?: VehicleRoadPath[]; height?: number | string; userLocation?: GeoPoint | null; interactive?: boolean }) {
  // `route` is the stop sequence from the plan; vehicles no longer move —
  // the map renders static markers and a plain route polyline.
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const staticLayerRef = useRef<LayerGroup | null>(null);
  const vehicleLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const hasFittedRef = useRef(false);
  const staticMarkersRef = useRef(new Map<string, CircleMarker>());
  const vehiclesRef = useRef(new Map<string, VehicleEntry>());
  const routeLayerRef = useRef<(Polyline | CircleMarker)[]>([]);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [mapVersion, setMapVersion] = useState(0);
  const id = useId();

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) setStatus("loading"); });
    hasFittedRef.current = false;

    (async () => {
      try {
        const L = await import("leaflet");
        if (disposed || !ref.current) return;
        leafletRef.current = L;
        // `interactive: false` (hero backgrounds) releases wheel/touch/drag so
        // the page scrolls over the map; markers stay clickable for popups.
        const map = L.map(ref.current, {
          zoomControl: interactive,
          dragging: interactive,
          scrollWheelZoom: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          boxZoom: interactive,
          keyboard: interactive,
          attributionControl: true,
        }).setView(
          [MAHADEVAPURA_CENTER.lat, MAHADEVAPURA_CENTER.lng],
          13,
        );
        mapRef.current = map;
        staticLayerRef.current = L.layerGroup().addTo(map);
        vehicleLayerRef.current = L.layerGroup().addTo(map);
        userLayerRef.current = L.layerGroup().addTo(map);

        const tiles = L.tileLayer(MAP_TILE_URL, { maxZoom: 19, attribution: MAP_ATTRIBUTION, detectRetina: true });
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
    };
  }, [retryKey, interactive]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const staticLayer = staticLayerRef.current;
    const vehicleLayer = vehicleLayerRef.current;
    if (!L || !map || !staticLayer || !vehicleLayer) return;

    for (const line of routeLayerRef.current) line.removeFrom(map);
    routeLayerRef.current = [];

    // Plain stop-sequence polyline: current location → stops.
    const points = vehiclePaths?.[0]?.path?.length ? vehiclePaths[0].path : route;
    if (points.length > 1) {
      const latlngs = points.map((point) => [point.lat, point.lng] as [number, number]);
      const line = L.polyline(latlngs, { color: "#0d9468", weight: 4, opacity: 0.85 }).addTo(map);
      routeLayerRef.current.push(line);
    }

    // These mirror the :root tokens in app/styles/tokens.css (--accent, --amber, --red, --blue, --violet, --teal).
    const colors = { vehicle: "#0d9468", bin: "#b45309", report: "#dc2626", signal: "#0d9488", recommendation: "#7c3aed", user: "#2563eb", pickup: "#0d9488" } as const;

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
          existing.marker.setLatLng([marker.location.lat, marker.location.lng]);
          return;
        }
        const dot = L.circleMarker([marker.location.lat, marker.location.lng], {
          radius: 8, color: "#ffffff", weight: 2, fillColor: colors.vehicle, fillOpacity: 1,
        }).bindPopup(popup).addTo(vehicleLayer);
        vehicles.set(marker.id, { marker: dot });
        return;
      }
      // Bins, reports, signals, recommendations never move on their own.
      seenStatic.add(marker.id);
      const overflow = marker.overflow === true;
      const popupText = overflow ? `OVERFLOW · ${popup}` : popup;
      const existing = statics.get(marker.id);
      if (existing) {
        existing.bindPopup(popupText);
        if (overflow) existing.setStyle({ color: "#dc2626", fillColor: "#dc2626" });
        return;
      }
      const dot = L.circleMarker([marker.location.lat, marker.location.lng], {
        radius: 7,
        color: overflow ? "#dc2626" : colors[marker.kind] ?? "#334155",
        weight: 2,
        fillColor: overflow ? "#dc2626" : colors[marker.kind] ?? "#334155",
        fillOpacity: 0.9,
        className: overflow ? "overflow-pulse" : undefined,
      }).bindPopup(popupText).addTo(staticLayer);
      statics.set(marker.id, dot);
    });

    for (const key of statics.keys()) if (!seenStatic.has(key)) { statics.get(key)?.remove(); statics.delete(key); }
    for (const key of vehicles.keys()) if (!seenVehicles.has(key)) { vehicles.get(key)?.marker.remove(); vehicles.delete(key); }

    // Static citizen dot: user's live/mock position, distinct from work markers.
    if (userLocation && userLayerRef.current) {
      const you = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 7, color: "#ffffff", weight: 3, fillColor: colors.user, fillOpacity: 1, className: "you-dot",
      }).bindPopup("you, Mock citizen · live location (demo)").addTo(userLayerRef.current!);
      routeLayerRef.current.push(you);
    }

    const all: [number, number][] = [
      ...markers.map((m) => [m.location.lat, m.location.lng] as [number, number]),
      ...(userLocation ? [[userLocation.lat, userLocation.lng] as [number, number]] : []),
    ];
    if (all.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true;
      map.fitBounds(L.latLngBounds(all).pad(0.25));
    }
  }, [markers, route, vehiclePaths, userLocation, mapVersion]);

  return (
    <section className="map-frame" data-basemap={MAP_TILE_IS_LIGHT ? "light" : "dark"} aria-busy={status === "loading"} data-map-id={id}>
      <div ref={ref} className="map-canvas" style={{ height: typeof height === "number" ? `${height}px` : height }} role="img" aria-label="Mahadevapura pilot map" />
      {status === "error" && (
        <div className="map-error" role="alert">
          <span>Map tiles failed to load.</span>
          <button type="button" className="quiet-button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
        </div>
      )}
      <details className="map-legend">
        <summary>Map legend</summary>
        <ul>
          {userLocation && (
            <li key="mock-user-location"><span className="legend-swatch user" /><span><b>you</b>, Your mock live location · drifts within Whitefield (demo)</span></li>
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
