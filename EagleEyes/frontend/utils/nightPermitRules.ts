// Night-time lot-access rule, from UNT's official day/night permit chart.
// Daytime access is unchanged (still whatever ParkZen's dashboard says);
// this covers nighttime only, since ParkZen won't have that configured
// before the project closes.
//
// Chart has 21 permit types x 15 lot-groups (A, AH, E, FS, HD, HSF, HSG,
// HSR, MC, R, RM, RR, SV, UCG, VIS). NIGHT_PERMITS_BY_GROUP = which permits
// may park in each group's lots at night.
//
// Note: AH and R aren't pure supersets of their daytime list at night (e.g.
// AH permit holders lose their own AH lot but gain A-Reserved). Transcribed
// as-is from the chart — worth confirming it's not a chart typo.

import { A_RESERVED, RESIDENT_RESERVED, consolidatePermits } from './permits';

// Permit-code -> app's permit name, where one exists (live-verified, see
// permits.ts). Codes with no live equivalent use the chart's own name —
// won't match live data yet, kept for completeness.
const CODE_TO_NAME: Record<string, string> = {
  AA: 'All Access',
  A: A_RESERVED,
  AH: 'Highland Reserved',
  BR: 'Board of Regents',
  BV: 'Business/Vendor',
  DV: 'Disabled Veteran',
  E: 'Eagle',
  EVN: 'Evening',
  FS: 'Faculty and Staff',
  HD: 'Hall Director',
  HR: 'Honorary Retiree',
  HSF: 'HSG First Floor',
  HSG: 'HSG-Commuter',
  HSR: 'HSG Resident',
  MC: 'Motorcycle',
  NHT: 'Night',
  R: 'Resident',
  RM: 'Remote',
  RR: RESIDENT_RESERVED,
  TF: 'Teaching Fellow',
  UCG: 'Union Circle Garage',
};

function names(...codes: string[]): string[] {
  return codes.map((code) => CODE_TO_NAME[code]);
}

// Reverse lookup — permit name -> official chart code (A, AH, E, FS, ...),
// for anywhere that needs to display the short code instead of abbreviating
// the name itself (e.g. the Lots tab's permit badge).
export const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_NAME).map(([code, name]) => [name, code])
);

// Each group's own code is listed first — the rest of the app (lot badges,
// map pin labels) treats a permit list's first entry as "the" permit to
// show, so leading with "AA" (All Access, which is valid for nearly every
// group) made every lot's badge read "AA" at night. Membership is unchanged
// from the chart, only the order, so filtering logic (which just checks
// `.includes()`) isn't affected.
export const NIGHT_PERMITS_BY_GROUP: Record<string, string[]> = {
  A: names('A', 'AA', 'AH', 'BR', 'BV', 'DV', 'E', 'FS', 'HD', 'HR', 'HSF', 'HSG', 'HSR', 'R', 'RM', 'RR', 'TF', 'UCG'),
  AH: names('HD', 'AA', 'BR'),
  E: names('E', 'AA', 'A', 'AH', 'BR', 'BV', 'DV', 'EVN', 'FS', 'HD', 'HR', 'HSF', 'HSG', 'HSR', 'NHT', 'R', 'RM', 'RR', 'TF', 'UCG'),
  FS: names('FS', 'AA', 'A', 'AH', 'BR', 'BV', 'DV', 'E', 'EVN', 'HD', 'HR', 'HSF', 'HSG', 'HSR', 'NHT', 'R', 'RM', 'RR', 'TF', 'UCG'),
  HD: names('HD', 'AA', 'BR'),
  HSF: names('HSF', 'AA', 'BR'),
  HSG: names('HSG', 'AA', 'BR', 'HSF'),
  HSR: names('HSR', 'AA', 'BR', 'HSF', 'HSG'),
  MC: names('MC', 'AA', 'BR'),
  R: names('R', 'AA', 'BR', 'HSR'),
  RM: names('RM', 'AA', 'A', 'AH', 'BR', 'BV', 'DV', 'E', 'EVN', 'FS', 'HD', 'HR', 'HSF', 'HSG', 'HSR', 'NHT', 'R', 'RR', 'TF', 'UCG'),
  RR: names('RR', 'AA', 'BR'),
  SV: names('BV', 'AA', 'BR'),
  UCG: names('UCG', 'AA', 'BR'),
  VIS: names('BV', 'AA', 'BR'),
};

// A lot-group's "self" permit — every lot in that group must accept it by
// definition, so its presence in a lot's daytime permits infers the group.
// Unlisted groups (no live permit to key off) fall back to unchanged access.
const GROUP_MARKER_PERMIT: Record<string, string> = {
  E: 'Eagle',
  FS: 'Faculty and Staff',
  HD: 'Hall Director',
  HSG: 'HSG-Commuter',
  MC: 'Motorcycle',
  R: 'Resident',
  RM: 'Remote',
  UCG: 'Union Circle Garage',
};

// Day rules run Mon-Fri 7am-5:30pm; everything else (weeknights and all
// weekend) is night, per the official chart. Every label below is built from
// these two times, so the UI can't drift from isNightWindow.
const DAY_START_MINUTES = 7 * 60;
const NIGHT_START_MINUTES = 17 * 60 + 30;

// 420 -> "7 AM", 1050 -> "5:30 PM"
function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h24 % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** "7 AM – 5:30 PM" (weekdays only) */
export const DAY_HOURS_LABEL = `${formatClock(DAY_START_MINUTES)} – ${formatClock(NIGHT_START_MINUTES)}`;
/** "5:30 PM – 7 AM" (plus all weekend) */
export const NIGHT_HOURS_LABEL = `${formatClock(NIGHT_START_MINUTES)} – ${formatClock(DAY_START_MINUTES)}`;
export const DAY_WINDOW_DESCRIPTION = `Mon–Fri, ${DAY_HOURS_LABEL}`;
export const NIGHT_WINDOW_DESCRIPTION = `Mon–Fri ${NIGHT_HOURS_LABEL}, and all weekend`;

/** Mon-Fri 5:30pm-7am, and all day Sat/Sun, per the official chart. */
export function isNightWindow(date: Date = new Date()): boolean {
  const day = date.getDay(); // 0 Sun - 6 Sat
  if (day === 0 || day === 6) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < DAY_START_MINUTES || minutes >= NIGHT_START_MINUTES;
}

function inferLotGroup(category: string | null, dayPermits: string[]): string | null {
  if (category === A_RESERVED) return 'A';
  if (category === RESIDENT_RESERVED) return 'RR';

  const normalized = consolidatePermits(dayPermits);
  for (const [group, marker] of Object.entries(GROUP_MARKER_PERMIT)) {
    if (normalized.includes(marker)) return group;
  }
  return null;
}

/** Day: dayPermits unchanged. Night: the chart's list for the lot's inferred group, if any. */
export function getEffectivePermits(
  category: string | null,
  dayPermits: string[],
  night: boolean,
): string[] {
  if (!night) return dayPermits;

  const group = inferLotGroup(category, dayPermits);
  return group ? (NIGHT_PERMITS_BY_GROUP[group] || dayPermits) : dayPermits;
}
