export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Straight-line distance in meters between two coordinates (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function centroid(coords: LatLng[]): LatLng {
  const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
  const lon = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
  return { latitude: lat, longitude: lon };
}

/** How close the user needs to be to a lot, on app entry, to auto-zoom to
 * it instead of falling back to the default campus view. Roughly covers the
 * Main Campus footprint. */
export const NEARBY_LOT_THRESHOLD_METERS = 1200;

/** Tight, lot-level region delta used when auto-zooming to a nearby lot (native). */
export const NEARBY_ZOOM_DELTA = 0.004;

/** Equivalent zoom level for the web map (Google's zoom scale, not a delta). */
export const NEARBY_ZOOM_LEVEL_WEB = 17;

/** Distance in meters from `origin` to the nearest of `lots` (by polygon centroid), or Infinity if none have valid coordinates. */
export function nearestLotDistance(origin: LatLng, lots: { coordinates?: LatLng[] }[]): number {
  return lots.reduce((min, lot) => {
    if (!Array.isArray(lot.coordinates) || lot.coordinates.length < 3) return min;
    const d = distanceMeters(origin, centroid(lot.coordinates));
    return d < min ? d : min;
  }, Infinity);
}

/** How many permits the Lots tab's permit picker lists under "Near you". */
export const NEARBY_PERMIT_COUNT = 5;

/**
 * Each permit paired with the distance to the closest lot that accepts it,
 * nearest first. `getPermits` returns a lot's (already consolidated) permits.
 */
export function rankPermitsByDistance<T extends { coordinates?: LatLng[] }>(
  origin: LatLng,
  lots: T[],
  getPermits: (lot: T) => string[],
): { permit: string; meters: number }[] {
  const closest = new Map<string, number>();
  lots.forEach((lot) => {
    if (!Array.isArray(lot.coordinates) || lot.coordinates.length < 3) return;
    const d = distanceMeters(origin, centroid(lot.coordinates));
    getPermits(lot).forEach((permit) => {
      const prev = closest.get(permit);
      if (prev === undefined || d < prev) closest.set(permit, d);
    });
  });
  return Array.from(closest, ([permit, meters]) => ({ permit, meters })).sort((a, b) => a.meters - b.meters);
}

/** Short walking-distance label: "250 ft" under 0.1 mi, otherwise "0.4 mi". */
export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.max(50, Math.round((meters * 3.28084) / 50) * 50)} ft`;
  return `${miles.toFixed(1)} mi`;
}
