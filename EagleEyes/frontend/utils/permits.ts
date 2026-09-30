// Permit consolidation helpers.
//
// ParkZen returns individual reserved-space permits (e.g. "A01", "A02" ... "A90",
// or numbered "Resident Reserved" spaces). For the UI we collapse those into a
// single permit group so the emblem matches the physical parking permit.

export const A_RESERVED = 'A-Reserved';
export const RESIDENT_RESERVED = 'Resident Reserved';
export const STREET_PARKING = 'Street Parking';

// Emblem (short badge label) shown for each consolidated group.
export const GROUP_EMBLEMS: Record<string, string> = {
  [A_RESERVED]: 'A',
  [RESIDENT_RESERVED]: 'RR',
  [STREET_PARKING]: 'ST',
};

// ---------------------------------------------------------------------------
// Lot-name based categories (from "Lots to be changed" doc).
// These take priority over whatever permits ParkZen lists for the lot.
// ---------------------------------------------------------------------------

// Lots named "Lot N - A Reserved"
const A_RESERVED_LOT_NUMBERS = [1, 2, 3, 4, 8, 24, 37, 50];

// Lots named "Lot N - Resident Reserved"
const RESIDENT_RESERVED_LOT_NUMBERS = [16, 17, 19, 23, 27, 29, 31, 32, 33, 42, 43, 44, 81];

// Street parking segments (all get the ST emblem)
const STREET_LOT_PREFIXES = [
  'ave d',          // Ave D - Chestnut to Mulberry
  'highland st',    // Highland St - N. Tx Blvd to Ave D / Welch to Bernard
  'kendolph',       // Kendolph - Eagle to Wilshire
  'maple',          // Maple - Welch to Bernard
  'mulberry st',    // Mulberry St - Ave D to Ave B
  'murchison',      // Murchison
  'sycamore st',    // Sycamore St - Ave D to Ave C, Sycamore St -- Motorcycle
];

function lotNumber(name: string): number | null {
  // Only a bare "Lot N" — named sections like "Lot 37 - Eagle" are left alone
  const m = name.match(/^\s*lot\s*#?\s*(\d+)\s*$/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Category a lot belongs to based on its name, or null if it isn't a special lot. */
export function getLotCategory(lotName: unknown): string | null {
  if (typeof lotName !== 'string' || !lotName.trim()) return null;
  const name = lotName.trim();
  const lower = name.toLowerCase();

  if (RESIDENT_RESERVED_RE.test(name)) return RESIDENT_RESERVED;
  if (A_RESERVED_ANY_RE.test(name)) return A_RESERVED;

  const num = lotNumber(name);
  if (num !== null) {
    if (A_RESERVED_LOT_NUMBERS.includes(num)) return A_RESERVED;
    if (RESIDENT_RESERVED_LOT_NUMBERS.includes(num)) return RESIDENT_RESERVED;
    return null;
  }

  if (STREET_LOT_PREFIXES.some((prefix) => lower.startsWith(prefix))) return STREET_PARKING;
  return null;
}

/**
 * Final permit list for a lot: the lot's name category (A-Reserved, Resident Reserved,
 * Street Parking) goes first so its emblem shows before anything else, followed by the
 * consolidated ParkZen permits.
 */
export function getLotPermitGroups(lotName: unknown, rawPermits: unknown): string[] {
  const groups = consolidatePermits(rawPermits);
  const category = getLotCategory(lotName);
  if (!category) return groups;
  return [category, ...groups.filter((g) => g !== category)];
}

// Strip trailing parenthetical notes such as "(N)" or "(Visitor)".
function stripSuffix(raw: string): string {
  return raw.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Matches: "A", "A01", "A-01", "A 1", "A37", "A-Reserved", "A Reserved 12", "AReserved-05"
const A_RESERVED_RE = /^a(\s*-?\s*reserved)?(\s*[-_#]?\s*\d{1,3}[a-z]?)?$/i;

// Matches anything mentioning "resident reserved" (with or without a number before/after),
// plus short codes like "RR", "RR01", "RR-12", "Res Reserved 3".
const RESIDENT_RESERVED_RE = /\bres(ident)?\s*-?\s*reserved?\b/i; // "Reserved" or "Reserve" (e.g. "Lot 81 Resident Reserve")
// Per-lot A permits like "Lot 3 A Reserve" / "Lot 3 - A Reserved"
const A_RESERVED_ANY_RE = /(^|[\s-])a\s*-?\s*reserved?\b/i;
const RR_CODE_RE = /^rr(\s*[-_#]?\s*\d{1,3}[a-z]?)?$/i;

/** Returns the consolidated permit group name for a single raw permit string. */
export function normalizePermit(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const base = stripSuffix(trimmed) || trimmed;

  if (A_RESERVED_RE.test(base)) return A_RESERVED;
  if (RESIDENT_RESERVED_RE.test(base) || RR_CODE_RE.test(base)) return RESIDENT_RESERVED;
  if (A_RESERVED_ANY_RE.test(base)) return A_RESERVED;

  return trimmed;
}

/** Whether a lot's permit groups include the given permit type (exact match, case-insensitive). */
export function lotMatchesPermitType(permitList: unknown, permitType: string): boolean {
  if (!permitType.trim()) return true;
  if (!Array.isArray(permitList)) return false;
  const target = permitType.trim().toLowerCase();
  return permitList.some((p) => typeof p === 'string' && p.trim().toLowerCase() === target);
}

/** Normalizes a list of raw permits and removes duplicates, keeping first-seen order. */
export function consolidatePermits(list: unknown): string[] {
  const arr = Array.isArray(list)
    ? list
    : typeof list === 'string'
      ? list.split(',')
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of arr) {
    const name = normalizePermit(p);
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
