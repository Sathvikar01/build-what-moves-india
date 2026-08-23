import { LOCATION_SOURCE } from "../data/locations";

/**
 * OSM is a good default for local demos and prototypes. A deployed app should
 * set these public variables to a contracted tile provider or an in-house
 * proxy so usage, caching, and availability follow that provider's terms.
 */
export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || LOCATION_SOURCE.attribution;
