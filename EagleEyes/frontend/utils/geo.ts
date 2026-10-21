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

/** Spacing in meters between the diagonal stripes drawn over a closed lot. */
export const CLOSED_LOT_STRIPE_SPACING_METERS = 7;

/**
 * Diagonal (45°) hatch lines clipped to a lot's polygon, as line segments.
 * Neither map library can pattern-fill a polygon, so a closed lot's stripes are
 * drawn as separate lines. Spacing is in meters on the ground (not pixels), so
 * the set of lines doesn't change while the user zooms - only when a closure
 * starts or ends.
 */
export function getStripeSegments(
  polygon: LatLng[],
  spacingMeters: number = CLOSED_LOT_STRIPE_SPACING_METERS,
): [LatLng, LatLng][] {
  if (polygon.length < 3) return [];

  // Flatten to meters from a whole-degree origin (the same one for every lot
  // on campus, so the zones of one lot - e.g. Lot 20's - get stripes that line
  // up), then rotate 45° so every stripe is a line of constant u.
  const origin = { latitude: Math.round(polygon[0].latitude), longitude: Math.round(polygon[0].longitude) };
  const metersPerLat = 110540;
  const metersPerLng = 111320 * Math.cos((origin.latitude * Math.PI) / 180);
  const toUV = (p: LatLng) => {
    const x = (p.longitude - origin.longitude) * metersPerLng;
    const y = (p.latitude - origin.latitude) * metersPerLat;
    return { u: (x - y) / Math.SQRT2, v: (x + y) / Math.SQRT2 };
  };
  const toLatLng = (u: number, v: number): LatLng => {
    const x = (u + v) / Math.SQRT2;
    const y = (v - u) / Math.SQRT2;
    return { latitude: origin.latitude + y / metersPerLat, longitude: origin.longitude + x / metersPerLng };
  };

  const points = polygon.map(toUV);
  const us = points.map((p) => p.u);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);

  const segments: [LatLng, LatLng][] = [];
  for (let u = Math.ceil(minU / spacingMeters) * spacingMeters; u < maxU; u += spacingMeters) {
    // Where this stripe crosses the polygon's edges; half-open on each edge so
    // a stripe through a vertex isn't counted twice.
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a.u <= u && u < b.u) || (b.u <= u && u < a.u)) {
        crossings.push(a.v + ((u - a.u) / (b.u - a.u)) * (b.v - a.v));
      }
    }
    crossings.sort((p, q) => p - q);
    // Inside the polygon between every other pair of crossings.
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      segments.push([toLatLng(u, crossings[i]), toLatLng(u, crossings[i + 1])]);
    }
  }
  return segments;
}
