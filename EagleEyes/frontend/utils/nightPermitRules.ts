// Night-time lot access from UNT's official day/night permit chart (daytime access
// still comes from ParkZen). NIGHT_PERMITS_BY_GROUP = permits allowed in each lot group at night.

import { A_RESERVED, RESIDENT_RESERVED, consolidatePermits } from './permits';

// Chart code -> app permit name; codes without a live permit keep the chart's name.
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

// Permit name -> chart code, for showing short codes (e.g. Lots tab badges).
export const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_NAME).map(([code, name]) => [name, code])
);

// Each group's own code is listed first, since the first entry is the badge shown.
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

// A group's own permit; finding it in a lot's daytime permits identifies the group.
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

// Day rules: Mon-Fri 7am-5:30pm. Everything else is night.
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
