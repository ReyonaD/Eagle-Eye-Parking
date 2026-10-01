// Single source of truth for how a hazard/event category renders — the icon,
// icon color, and icon-box background. Shared by every screen that lets
// someone pick a category (report-hazard, admin post-alert, admin events) and
// every screen that displays one (commuter alerts feed, admin hazards/events
// review), so a category always looks the same everywhere and a newly added
// category can't silently fall out of sync between "what you can pick" and
// "what icon it shows".

export type AlertVisual = {
  icon: string;
  bg: string;
  iconColor: string;
};

// Hazard categories a commuter or admin can pick when reporting/posting a hazard.
export const HAZARD_CATEGORIES: { label: string; value: string }[] = [
  { label: 'Snow', value: 'snow' },
  { label: 'Flood', value: 'flood' },
  { label: 'Traffic Jam', value: 'traffic jam' },
  { label: 'Tree Branch', value: 'tree branch' },
  { label: 'Item on Road', value: 'item on road' },
];

const HAZARD_VISUALS: Record<string, AlertVisual> = {
  snow: { icon: 'snow-outline', bg: '#DBEAFE', iconColor: '#2C5F8A' },
  flood: { icon: 'water-outline', bg: '#CFE8FB', iconColor: '#1D6FA5' },
  'traffic jam': { icon: 'car-outline', bg: '#FBDADA', iconColor: '#C0392B' },
  'tree branch': { icon: 'leaf-outline', bg: '#DCFCE7', iconColor: '#1F8A4C' },
  'item on road': { icon: 'cube-outline', bg: '#E5E7EB', iconColor: '#4B5563' },
};
const DEFAULT_HAZARD_VISUAL: AlertVisual = { icon: 'warning-outline', bg: '#FDECC8', iconColor: '#D89B1D' };

export function getHazardVisual(category?: string | null): AlertVisual {
  if (!category) return DEFAULT_HAZARD_VISUAL;
  return HAZARD_VISUALS[category.toLowerCase()] || DEFAULT_HAZARD_VISUAL;
}

// Event categories an admin can pick when scheduling a campus event.
export const EVENT_CATEGORIES: string[] = ['Gameday', 'Tailgate', 'Concert', 'Career', 'Other'];

const EVENT_VISUALS: Record<string, AlertVisual> = {
  gameday: { icon: 'american-football-outline', bg: '#FDE7D8', iconColor: '#C2560B' },
  tailgate: { icon: 'flame-outline', bg: '#FDE1DC', iconColor: '#D3452D' },
  concert: { icon: 'musical-notes-outline', bg: '#EAE0FB', iconColor: '#7C3AED' },
  career: { icon: 'briefcase-outline', bg: '#DCE7FB', iconColor: '#2755B8' },
};
const DEFAULT_EVENT_VISUAL: AlertVisual = { icon: 'megaphone-outline', bg: '#DCFCE7', iconColor: '#1F8A4C' };

export function getEventVisual(category?: string | null): AlertVisual {
  if (!category) return DEFAULT_EVENT_VISUAL;
  return EVENT_VISUALS[category.toLowerCase()] || DEFAULT_EVENT_VISUAL;
}

// Single entry point for screens that render hazards and events side by side.
export function getAlertVisual(alertType: string, category?: string | null): AlertVisual {
  return alertType === 'event' ? getEventVisual(category) : getHazardVisual(category);
}

// Human-readable category label. Hazard categories are stored lowercase
// ("traffic jam") so this looks up the matching HAZARD_CATEGORIES label;
// event categories are already stored capitalized ("Gameday") so they pass
// through as-is.
export function getCategoryLabel(alertType: string, category?: string | null): string {
  if (!category) return alertType === 'event' ? 'Event' : 'Hazard';
  if (alertType === 'event') return category;
  const match = HAZARD_CATEGORIES.find((c) => c.value === category.toLowerCase());
  return match ? match.label : category;
}
