import type { GeoPoint } from "../domain/types";

/**
 * The geography used by the pilot. These are human-readable place labels and
 * coordinates from OpenStreetMap, kept separate from the synthetic operations
 * scenario so the demo never implies that telemetry is an official live feed.
 */
export const MAHADEVAPURA_CENTER: GeoPoint = { lat: 12.965, lng: 77.716 };

export const MAHADEVAPURA_LOCATIONS = {
  whitefield: { label: "Whitefield", locality: "Whitefield", location: { lat: 12.9698, lng: 77.7499 } },
  kundalahalli: { label: "Kundalahalli", locality: "Kundalahalli", location: { lat: 12.9705, lng: 77.7151 } },
  doddanekkundi: { label: "Dodda Nekkundi", locality: "Dodda Nekkundi", location: { lat: 12.9794, lng: 77.6947 } },
  marathahalli: { label: "Marathahalli", locality: "Marathahalli", location: { lat: 12.9569, lng: 77.7011 } },
  bellandur: { label: "Bellanduru", locality: "Bellanduru", location: { lat: 12.9256, lng: 77.6762 } },
  hoodi: { label: "Hoodi", locality: "Hoodi", location: { lat: 12.991, lng: 77.7165 } },
  varthur: { label: "Varthur", locality: "Varthur", location: { lat: 12.9389, lng: 77.7462 } },
  panathur: { label: "Panathur", locality: "Panathur", location: { lat: 12.9354, lng: 77.7079 } },
  itplGate: { label: "ITPL Gate", locality: "Whitefield", location: { lat: 12.9842, lng: 77.7388 } },
  kundalahalliMarket: { label: "Kundalahalli market", locality: "Kundalahalli", location: { lat: 12.9691, lng: 77.7132 } },
  marathahalliServiceLane: { label: "Marathahalli service lane", locality: "Marathahalli", location: { lat: 12.9561, lng: 77.703 } },
} as const;

export const LOCATION_SOURCE = {
  label: "OpenStreetMap contributors",
  attribution: "© OpenStreetMap contributors",
  url: "https://www.openstreetmap.org/copyright",
} as const;

/** Backwards-compatible alias for the deterministic demo scenario. */
export const FOCUS = Object.fromEntries(
  Object.entries(MAHADEVAPURA_LOCATIONS)
    .filter(([key]) => ["whitefield", "kundalahalli", "doddanekkundi", "marathahalli", "bellandur", "hoodi", "varthur", "panathur"].includes(key))
    .map(([key, value]) => [key, value.location]),
) as {
  whitefield: GeoPoint;
  kundalahalli: GeoPoint;
  doddanekkundi: GeoPoint;
  marathahalli: GeoPoint;
  bellandur: GeoPoint;
  hoodi: GeoPoint;
  varthur: GeoPoint;
  panathur: GeoPoint;
};
