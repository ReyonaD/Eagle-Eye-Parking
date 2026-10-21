// What's currently happening on each lot - closures, campus events, and
// reported hazards - derived from the published alerts feed, so the map can
// restyle a lot and pin the matching category icon on it.

import { AlertVisual, getEventVisual, getHazardVisual, getCategoryLabel } from './alertVisuals';
import { getEventRange, parseUTC } from './eventDates';

// Alert.lot_name is a single column; an event can affect several lots (e.g. a
// gameday), so those are stored joined with this separator. A hazard's single
// lot name parses back as a one-item list, so every reader can treat it the same.
const LOT_NAME_SEPARATOR = '; ';

export function parseLotNames(lotName?: string | null): string[] {
  if (!lotName) return [];
  return lotName.split(';').map((name) => name.trim()).filter(Boolean);
}

export function joinLotNames(names: string[]): string {
  return names.join(LOT_NAME_SEPARATOR);
}

// Human-readable list for display ("Lot 20, Lot 24").
export function formatLotNames(lotName?: string | null): string | undefined {
  const names = parseLotNames(lotName);
  return names.length ? names.join(', ') : undefined;
}

// Event category that means "this lot is closed", not just "busier than usual".
export const CLOSURE_CATEGORY = 'Lot Closure';
// Closures were first saved under this name; they still close their lots.
const LEGACY_CLOSURE_CATEGORY = 'Closure';

export function isClosureCategory(category?: string | null): boolean {
  const value = String(category || '').toLowerCase();
  return value === CLOSURE_CATEGORY.toLowerCase() || value === LEGACY_CLOSURE_CATEGORY.toLowerCase();
}

// A closed lot is drawn neutral gray (no blue tint) with diagonal stripes
// over it, in the same gray as its border (see getStripeSegments in
// utils/geo.ts), instead of a badge.
export const CLOSED_FILL_COLOR = '#A3A3A3';
export const CLOSED_STROKE_COLOR = '#737373';
export const CLOSED_STRIPE_COLOR = CLOSED_STROKE_COLOR;
export const CLOSED_STRIPE_WIDTH = 1;

// A published hazard has no end time - it stays on the map/lots until an
// admin deactivates it once it's over.
export function isHazardActive(hazard: any): boolean {
  return !hazard.deactivated_at;
}

export type LotStatusEvent = {
  alert: any;
  start: Date;
  end: Date;
  // true = in progress now; false = starts later today
  active: boolean;
  // saved with no end date (TBD / permanent)
  openEnded: boolean;
};

export type LotStatus = {
  closure: LotStatusEvent | null;
  events: LotStatusEvent[];
  hazards: any[];
};

function isClosure(eventItem: any) {
  return isClosureCategory(eventItem.category);
}

// Keyed by lot name (the same name LotPickerModal hands back), so every polygon
// sharing a name - e.g. Lot 20's separate zones - picks up the same status.
export function buildLotStatuses(hazards: any[], events: any[], now: Date = new Date()): Record<string, LotStatus> {
  const statuses: Record<string, LotStatus> = {};
  const statusFor = (name: string) => {
    if (!statuses[name]) statuses[name] = { closure: null, events: [], hazards: [] };
    return statuses[name];
  };

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  (events || []).forEach((eventItem) => {
    const { start, end, openEnded } = getEventRange(eventItem);
    if (end < now || start > endOfToday) return;
    const entry: LotStatusEvent = { alert: eventItem, start, end, active: start <= now, openEnded };

    parseLotNames(eventItem.lot_name).forEach((name) => {
      const status = statusFor(name);
      if (isClosure(eventItem)) {
        // An in-progress closure outranks one that only starts later today.
        if (!status.closure || (entry.active && !status.closure.active)) status.closure = entry;
      } else {
        status.events.push(entry);
      }
    });
  });

  (hazards || []).forEach((hazard) => {
    if (!isHazardActive(hazard)) return;
    parseLotNames(hazard.lot_name).forEach((name) => statusFor(name).hazards.push(hazard));
  });

  return statuses;
}

export function isLotClosed(status?: LotStatus | null): boolean {
  return !!status?.closure?.active;
}

export function getActiveEvent(status?: LotStatus | null): LotStatusEvent | undefined {
  return status?.events.find((e) => e.active);
}

// Icons to pin on the lot, most important first: closure, events, then
// hazards. One icon per category so three snow reports don't show three
// snowflakes; capped so the badge stays readable on a small lot.
export function getLotStatusIcons(status?: LotStatus | null, max = 3): AlertVisual[] {
  if (!status) return [];
  const visuals: AlertVisual[] = [];
  const seen = new Set<string>();
  const add = (visual: AlertVisual) => {
    if (seen.has(visual.icon)) return;
    seen.add(visual.icon);
    visuals.push(visual);
  };

  if (status.closure) add(getEventVisual(status.closure.alert.category));
  status.events.forEach((e) => add(getEventVisual(e.alert.category)));
  status.hazards.forEach((h) => add(getHazardVisual(h.category)));
  return visuals.slice(0, max);
}

export type LotStatusItem = {
  key: string;
  visual: AlertVisual;
  title: string;
  detail: string;
};

const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// One row per closure/event/hazard on the lot, most important first - what the
// map's lot sheet and the Lots tab's detail screen list under the lot name.
// Closures/events are named by their kind ("Closure", "Gameday"), not the
// alert's title; hazards keep their reported title.
export function getLotStatusItems(status?: LotStatus | null): LotStatusItem[] {
  if (!status) return [];
  const items: LotStatusItem[] = [];
  const eventItem = (e: LotStatusEvent): LotStatusItem => ({
    key: `event-${e.alert.id}`,
    visual: getEventVisual(e.alert.category),
    title: getCategoryLabel('event', e.alert.category),
    detail: e.active
      ? (e.openEnded ? 'Until further notice' : `Until ${formatTime(e.end)}`)
      : `Starts ${formatTime(e.start)}`,
  });
  if (status.closure) items.push(eventItem(status.closure));
  status.events.forEach((e) => items.push(eventItem(e)));
  status.hazards.forEach((h) => items.push({
    key: `hazard-${h.id}`,
    visual: getHazardVisual(h.category),
    title: h.title,
    detail: `${getCategoryLabel('hazard', h.category)} · reported ${formatTime(parseUTC(h.created_at))}`,
  }));
  return items;
}

export type LotTakeover = {
  // 'Closed', or the event's category ('Gameday', 'Concert', ...)
  label: string;
  visual: AlertVisual;
  // 'Until 5:00 PM', 'Until Oct 24, 5:00 PM', or 'Until further notice'
  until: string;
};

// A closure or an event in progress takes over the lot: screens then show just
// its name and what's going on, not permits/occupancy. Hazards alone don't.
export function getLotTakeover(status?: LotStatus | null): LotTakeover | null {
  const closed = isLotClosed(status);
  const entry = closed ? status!.closure! : getActiveEvent(status);
  if (!entry) return null;

  let until = 'Until further notice';
  if (!entry.openEnded) {
    const endsToday = entry.end.toDateString() === new Date().toDateString();
    until = endsToday
      ? `Until ${formatTime(entry.end)}`
      : `Until ${entry.end.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${formatTime(entry.end)}`;
  }
  return {
    label: closed ? 'Closed' : getCategoryLabel('event', entry.alert.category),
    visual: getEventVisual(entry.alert.category),
    until,
  };
}

// Restyles a map lot for its current situation. A closed lot goes dark gray
// (its occupancy no longer matters); a lot with an event in progress keeps its
// occupancy fill but is outlined in that event's color.
export function applyLotStatus(lot: any, status?: LotStatus | null): any {
  if (!status) return lot;

  if (isLotClosed(status)) {
    return {
      ...lot,
      lotStatus: status,
      status: 'Closed',
      fillColor: CLOSED_FILL_COLOR,
      strokeColor: CLOSED_STROKE_COLOR,
    };
  }

  const activeEvent = getActiveEvent(status);
  return {
    ...lot,
    lotStatus: status,
    strokeColor: activeEvent ? getEventVisual(activeEvent.alert.category).iconColor : lot.strokeColor,
  };
}
