// When each permit may park, from ParkZen's own permit rules
// (GET /api/permit-hours -> rules.dailyTimeSlots), and how to show it.
// Most UNT permits are any time; a few (e.g. Evening, Night) only cover part
// of the day, and those are what the app calls out.

import { normalizePermit, normalizePermitPreservingCode } from './permits';

export type TimeSlot = { startTime: string; endTime: string }; // 24h "HH:MM"
export type DailyTimeSlots = { day: string; timeSlots: TimeSlot[] }[];
export type PermitHours = { name: string; type?: string | null; dailyTimeSlots: DailyTimeSlots };

// One line of a permit's schedule, e.g. { days: 'Daily', hours: '3:30 PM – 7:00 AM' }
export type PermitHoursLine = { days: string; hours: string };

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};
const END_OF_DAY = 24 * 60;
const ANY_TIME = 'Any time';

// "15:30" -> 930. ParkZen ends an all-day slot at "23:59", which means
// "through midnight", so that counts as the end of the day.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const minutes = h * 60 + m;
  return minutes >= END_OF_DAY - 1 ? END_OF_DAY : minutes;
}

function formatClock(minutes: number): string {
  if (minutes === END_OF_DAY) return 'midnight';
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h24 % 12 || 12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

function slotsFor(hours: PermitHours, day: string): [number, number][] {
  const entry = hours.dailyTimeSlots.find((d) => d.day === day);
  return (entry?.timeSlots || [])
    .map((slot): [number, number] => [toMinutes(slot.startTime), toMinutes(slot.endTime)])
    .sort((a, b) => a[0] - b[0]);
}

// One day's allowed hours as text. A day that runs from midnight to a morning
// time and again from an afternoon time to midnight is really one overnight
// window ("3:30 PM – 7:00 AM"), so it's shown that way.
function describeDay(slots: [number, number][]): string {
  if (slots.length === 0) return 'Not allowed';
  if (slots.length === 1 && slots[0][0] === 0 && slots[0][1] === END_OF_DAY) return ANY_TIME;

  const first = slots[0];
  const last = slots[slots.length - 1];
  if (slots.length >= 2 && first[0] === 0 && last[1] === END_OF_DAY) {
    const overnight = `${formatClock(last[0])} – ${formatClock(first[1])}`;
    const middle = slots.slice(1, -1).map(([start, end]) => `${formatClock(start)} – ${formatClock(end)}`);
    return [overnight, ...middle].join(', ');
  }
  return slots.map(([start, end]) => `${formatClock(start)} – ${formatClock(end)}`).join(', ');
}

/** The schedule as lines, grouping consecutive days with the same hours ("Mon–Wed", "Thu", or "Daily"). */
export function formatPermitHours(hours: PermitHours): PermitHoursLine[] {
  const perDay = WEEK.map((day) => ({ day, text: describeDay(slotsFor(hours, day)) }));
  const runs: { from: string; to: string; text: string }[] = [];
  perDay.forEach(({ day, text }) => {
    const run = runs[runs.length - 1];
    if (run && run.text === text) run.to = day;
    else runs.push({ from: day, to: day, text });
  });
  if (runs.length === 1) return [{ days: 'Daily', hours: runs[0].text }];
  return runs.map((run) => ({
    days: run.from === run.to ? DAY_SHORT[run.from] : `${DAY_SHORT[run.from]}–${DAY_SHORT[run.to]}`,
    hours: run.text,
  }));
}

/** One-line summary: "Any time", "Daily 3:30 PM – 7:00 AM", or "Mon–Wed Any time · Thu 7:00 AM – midnight · Fri–Sun Any time". */
export function summarizePermitHours(hours: PermitHours): string {
  const lines = formatPermitHours(hours);
  if (lines.length === 1 && lines[0].hours === ANY_TIME) return ANY_TIME;
  return lines.map((line) => `${line.days} ${line.hours}`).join(' · ');
}

/** True when the permit may park every day, all day - nothing worth calling out. */
export function isAnyTimePermit(hours: PermitHours): boolean {
  return WEEK.every((day) => describeDay(slotsFor(hours, day)) === ANY_TIME);
}

/**
 * Permit hours keyed by every label the app shows for a permit - ParkZen's raw
 * name ("F/S"), its normalized name ("Faculty and Staff"), and its per-lot code
 * ("A37") - so any permit chip or the account's saved permit can look it up.
 */
export function buildPermitHoursIndex(list: PermitHours[]): Record<string, PermitHours> {
  const index: Record<string, PermitHours> = {};
  (list || []).forEach((permit) => {
    if (!permit?.name || !Array.isArray(permit.dailyTimeSlots) || permit.dailyTimeSlots.length === 0) return;
    [permit.name, normalizePermit(permit.name), normalizePermitPreservingCode(permit.name)]
      .filter(Boolean)
      .forEach((key) => { if (!index[key]) index[key] = permit; });
  });
  return index;
}

export function lookupPermitHours(index: Record<string, PermitHours>, label?: string | null): PermitHours | null {
  if (!label) return null;
  return index[label] || index[normalizePermit(label)] || null;
}
