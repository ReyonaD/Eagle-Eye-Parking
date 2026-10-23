// Google Maps styles shared by the native and web maps, plus the colors of
// what the app draws on top of the map that need a different shade on a dark
// background (the lot's own occupancy colors read fine on both).

import { CLOSED_FILL_COLOR, CLOSED_STROKE_COLOR, CLOSED_STRIPE_COLOR } from './lotStatus';

export type MapTheme = 'auto' | 'light' | 'dark';

// Points of interest and transit stops crowd the lots, so both themes hide them.
const HIDDEN_FEATURES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export const LIGHT_MAP_STYLE: any[] = HIDDEN_FEATURES;

// Neutral grays keep the map subdued while brighter roads remain readable
// beneath the lot overlays.
export const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#454545' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#505050' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#c4c4c4' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#505050' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#606060' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#414141' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
  ...HIDDEN_FEATURES,
];

// How see-through a lot's fill is. On the dark map a 35% fill turns orange
// (near capacity) brownish and red (full) a dull maroon, so it's stronger there.
export function getLotFillOpacity(darkMap: boolean): number {
  return darkMap ? 0.5 : 0.35;
}

// The gray outline LotsContext gives a no-data lot - nearly invisible on a dark map.
const NO_DATA_STROKE_COLOR = '#6c6b6b';
const NO_DATA_STROKE_COLOR_DARK = '#a8a8a8';

const CLOSED_COLORS = {
  light: { fill: CLOSED_FILL_COLOR, stroke: CLOSED_STROKE_COLOR, stripe: CLOSED_STRIPE_COLOR },
  // lighter grays so a closed lot's stripes still show on a dark (or satellite) map
  dark: { fill: '#8a8a8a', stroke: '#a3a3a3', stripe: '#a3a3a3' },
};

/** Colors to draw a closed lot with, on a light or a dark map surface. */
export function getClosedLotColors(darkSurface: boolean) {
  return darkSurface ? CLOSED_COLORS.dark : CLOSED_COLORS.light;
}

/** A lot's outline color for this map surface (only the gray no-data outline changes). */
export function getLotStrokeColor(strokeColor: string, darkSurface: boolean): string {
  return darkSurface && strokeColor === NO_DATA_STROKE_COLOR ? NO_DATA_STROKE_COLOR_DARK : strokeColor;
}
