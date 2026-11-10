// Per-lot closures, events and hazards, derived from the published alerts feed.

import { AlertVisual, getEventVisual, getHazardVisual, getCategoryLabel } from './alertVisuals';
import { getEventRange, parseUTC } from './eventDates';

// Multiple lots are stored in one lot_name column, joined with this separator.
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

// Closed lots: neutral gray with diagonal stripes instead of a badge.
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

// Status for one lot. Keys are trimmed (parseLotNames), but some ParkZen names end
// in a space ("Lot 39 - Eagle "), so the lookup trims too
export function statusForLot(statuses: Record<string, LotStatus>, lotName?: string | null): LotStatus | undefined {
  return statuses[String(lotName || '').trim()];
}

export function isLotClosed(status?: LotStatus | null): boolean {
  return !!status?.closure?.active;
}

export function getActiveEvent(status?: LotStatus | null): LotStatusEvent | undefined {
  return status?.events.find((e) => e.active);
}

// Badge icons, most important first: closure, events, hazards; one per category, capped.
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

// Rows listed under a lot's name: closures/events by kind, hazards by their title.
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

// Closed lots go gray; a lot with an event in progress is outlined in the event's color.
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

// True when the lot with this name (as LotPickerModal hands it back) is closed
// right now. `lots` is LotsContext's list, already carrying each lot's status.
export function isLotNameClosed(lots: any[], lotName?: string | null): boolean {
  if (!lotName) return false;
  const wanted = lotName.trim().toLowerCase();
  return lots.some((lot) => String(lot.name || '').trim().toLowerCase() === wanted && isLotClosed(lot.lotStatus));
}

export type EventConflict = {
  alert: any;
  // the lots it shares with the event being saved
  lotNames: string[];
  start: Date;
  end: Date;
  openEnded: boolean;
  isClosure: boolean;
};

// Events that clash with one being saved: closures overlapping a regular event, or any
// event overlapping a closure. end = null means no end date. Mirrors the backend check.
export function findEventConflicts(
  events: any[],
  draft: { category: string; lotNames: string[]; start: Date; end: Date | null; excludeId?: number | null },
): EventConflict[] {
  const wanted = new Set(draft.lotNames.map((name) => name.toLowerCase()));
  if (wanted.size === 0) return [];
  const draftIsClosure = isClosureCategory(draft.category);
  const draftEnd = draft.end ?? null;

  const conflicts: EventConflict[] = [];
  (events || []).forEach((eventItem) => {
    if (draft.excludeId != null && eventItem.id === draft.excludeId) return;
    if (!eventItem.event_start) return;
    const isClosure = isClosureCategory(eventItem.category);
    if (!draftIsClosure && !isClosure) return;
    const shared = parseLotNames(eventItem.lot_name).filter((name) => wanted.has(name.toLowerCase()));
    if (shared.length === 0) return;
    const { start, end, openEnded } = getEventRange(eventItem);
    const overlaps = draft.start < end && (draftEnd === null || start < draftEnd);
    if (overlaps) conflicts.push({ alert: eventItem, lotNames: shared, start, end, openEnded, isClosure });
  });
  return conflicts;
}

// "Lot 20 – Gameday Closure (Oct 24, 9:00 AM – 5:00 PM)", one line per conflict.
export function describeEventConflicts(conflicts: EventConflict[]): string {
  const when = (d: Date) => `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${formatTime(d)}`;
  return conflicts
    .map((c) => `• ${c.lotNames.join(', ')} – ${c.alert.title} (${when(c.start)} – ${c.openEnded ? 'no end date' : when(c.end)})`)
    .join('\n');
}

// Closures in effect now on `lotName`, from a fresh events list (LotsContext can be stale).
export function findActiveClosures(events: any[], lotName?: string | null, now: Date = new Date()): any[] {
  const wanted = new Set(parseLotNames(lotName).map((name) => name.toLowerCase()));
  if (wanted.size === 0) return [];
  return (events || []).filter((eventItem) => {
    if (!eventItem.event_start || !isClosureCategory(eventItem.category)) return false;
    if (!parseLotNames(eventItem.lot_name).some((name) => wanted.has(name.toLowerCase()))) return false;
    const { start, end } = getEventRange(eventItem);
    return start <= now && now < end;
  });
}
