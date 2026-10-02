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
// Confirmed against ParkZen's live A-Reserved permit-code table (A01..A95).
// Lot 27 is deliberately left out: it's already in RESIDENT_RESERVED_LOT_NUMBERS
// below per the "Lots to be changed" doc, which this file's own comment says
// takes priority over ParkZen — even though ParkZen also lists an "A27" code
// for it. That conflict needs a human call, not a silent override here.
const A_RESERVED_LOT_NUMBERS = [1, 2, 3, 4, 8, 9, 10, 24, 28, 37, 50, 83, 90, 91, 95];

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

// Short/inconsistently-cased raw ParkZen codes that mean the same permit as a
// longer or differently-cased name shown elsewhere (dropdowns, filters).
// Keyed lowercase. The abbreviation expansions (hd, ada, dv, hsg-commuter)
// are confirmed against ParkZen's own permit records, which pair each short
// `name` with a fuller `type` — e.g. name "HD" has type "Hall Director".
// Only added where `type` is genuinely a longer name for the same permit,
// not where it describes eligibility instead (e.g. "Eagle" -> type "Commuter
// Student" — that's who's allowed to use it, not another name for it, so
// entries like that are deliberately left alone). "zip car" and "premium
// parking" are casing/shorthand fixes, not type-based expansions.
// "HSR-Resident" is also deliberately not aliased to "Resident": its type is
// "Highland Street Garage Resident Students", a genuinely different permit
// from plain "Resident" (type "Resident Hall students").
const PERMIT_ALIASES: Record<string, string> = {
  'f/s': 'Faculty and Staff',
  'fs': 'Faculty and Staff',
  'hd': 'Hall Director',
  'ada': 'Americans with Disabilities Act',
  'dv': 'Disabled Veteran',
  'hsg-commuter': 'Highland Street Garage Commuter',
  'zip car': 'Zip Car',
  // stripSuffix() removes the "(paid visitor)" parenthetical before this
  // lookup runs, so the raw ParkZen name "Premium Parking (paid visitor)"
  // reaches here as just "premium parking".
  'premium parking': 'Premium Parking (Visitor)',
};

/** Returns the consolidated permit group name for a single raw permit string. */
export function normalizePermit(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const base = stripSuffix(trimmed) || trimmed;

  if (A_RESERVED_RE.test(base)) return A_RESERVED;
  if (RESIDENT_RESERVED_RE.test(base) || RR_CODE_RE.test(base)) return RESIDENT_RESERVED;
  if (A_RESERVED_ANY_RE.test(base)) return A_RESERVED;

  const alias = PERMIT_ALIASES[base.toLowerCase()];
  if (alias) return alias;

  return trimmed;
}

/** Whether a lot's permit groups include the given permit type (exact match, case-insensitive). */
/**
 * `rawPermitList` (a lot's unconsolidated ParkZen codes) is optional, but
 * needed to correctly match a specific per-lot pick like "A24" or "Lot 16
 * Resident Reserve" — those never survive into the consolidated
 * `permitList`, which only ever keeps the shared "A-Reserved"/"Resident
 * Reserved" category, so without it a user who picked a specific lot would
 * never match any lot here.
 */
export function lotMatchesPermitType(permitList: unknown, permitType: string, rawPermitList?: unknown): boolean {
  const trimmedType = permitType.trim();
  if (!trimmedType) return true;

  if (Array.isArray(permitList)) {
    const target = trimmedType.toLowerCase();
    if (permitList.some((p) => typeof p === 'string' && p.trim().toLowerCase() === target)) return true;
  }

  if (isPerLotPermitCode(trimmedType) && Array.isArray(rawPermitList)) {
    return rawPermitList.some((p) => typeof p === 'string' && p.trim() === trimmedType);
  }

  return false;
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

// ---------------------------------------------------------------------------
// Per-lot permit grouping — shared by any screen that lists live ParkZen
// permit types in a picker (Profile Setting, the Map tab's PERMIT dropdown).
// ---------------------------------------------------------------------------

// ParkZen's live /api/permits returns each A-Reserved space's specific permit
// as its raw code ("A01", "A02", ... "A95"), plus the generic, not-tied-to-
// one-lot permit as literal "A-Reserved" (confirmed against a live response —
// ParkZen does NOT resolve these to friendly "Lot NN Reserved" names the way
// it does for some other permit types). Flat and alphabetized, that's ~16
// near-identical "A0N" codes buried among a dozen unrelated permit types — so
// group them under a single "A-Reserved" row instead.
const A_RESERVED_CODE_RE = /^a\s*-?\s*(\d{2,3})$/i;
const A_RESERVED_GENERIC_VALUE = 'a-reserved';
const A_RESERVED_GROUP_LABEL = 'A-Reserved';

// Live ParkZen data names each Resident Reserved lot's permit literally
// "Lot 16 Resident Reserve" (verified against a live permit pull) — 13 of
// these plus a generic "Resident Reserved" would otherwise clutter the flat
// dropdown the same way the ungrouped "A01".."A95" codes used to.
const RESIDENT_RESERVED_LOT_RE = /^lot\s+(\d{1,3})\s+resident\s+reserved?\b/i;
const RESIDENT_RESERVED_GENERIC_VALUE = 'resident reserved';
const RESIDENT_RESERVED_GROUP_LABEL = 'Resident Reserved';

export type PermitOption =
  | { kind: 'simple'; value: string }
  | { kind: 'group'; label: string; options: { value: string; label: string }[] };

// Collapses a permit type list's per-lot codes for one group (e.g. every
// "A01".."A95" or "Lot NN Resident Reserve") into a single dropdown row that
// opens a lot picker, instead of listing each lot as its own flat entry.
function groupPerLotCodes(
  types: string[],
  lotCodeRe: RegExp,
  genericValueLower: string,
  groupLabel: string,
): { group: PermitOption | null; rest: string[] } {
  const lotEntries: { value: string; label: string; num: number }[] = [];
  const genericEntries: string[] = [];
  const rest: string[] = [];

  types.forEach((raw) => {
    const trimmed = raw.trim();
    const codeMatch = trimmed.match(lotCodeRe);
    if (codeMatch) {
      const num = parseInt(codeMatch[1], 10);
      lotEntries.push({ value: raw, label: `Lot ${String(num).padStart(2, '0')}`, num });
    } else if (trimmed.toLowerCase() === genericValueLower) {
      genericEntries.push(raw);
    } else {
      rest.push(raw);
    }
  });

  if (!lotEntries.length && !genericEntries.length) return { group: null, rest };

  lotEntries.sort((a, b) => a.num - b.num);
  return {
    group: {
      kind: 'group',
      label: groupLabel,
      options: [
        ...genericEntries.map((value) => ({ value, label: groupLabel })),
        ...lotEntries.map((e) => ({ value: e.value, label: e.label })),
      ],
    },
    rest,
  };
}

/**
 * Groups a flat list of live ParkZen permit type strings into dropdown-ready
 * options: ordinary permits stay as 'simple' rows, while A-Reserved and
 * Resident Reserved per-lot codes collapse into 'group' rows that open a
 * secondary lot picker. `extraSimple` adds entries that aren't real ParkZen
 * permit types (e.g. this app's own "Street Parking" category).
 */
export function buildPermitOptions(types: string[], extraSimple: string[] = []): PermitOption[] {
  const aReserved = groupPerLotCodes(types, A_RESERVED_CODE_RE, A_RESERVED_GENERIC_VALUE, A_RESERVED_GROUP_LABEL);
  const residentReserved = groupPerLotCodes(
    aReserved.rest,
    RESIDENT_RESERVED_LOT_RE,
    RESIDENT_RESERVED_GENERIC_VALUE,
    RESIDENT_RESERVED_GROUP_LABEL,
  );

  const options: PermitOption[] = [...residentReserved.rest, ...extraSimple].map((value) => ({ kind: 'simple', value }));
  if (aReserved.group) options.push(aReserved.group);
  if (residentReserved.group) options.push(residentReserved.group);

  return options.sort((a, b) => {
    const labelA = a.kind === 'group' ? a.label : a.value;
    const labelB = b.kind === 'group' ? b.label : b.value;
    return labelA.localeCompare(labelB);
  });
}

/** Looks up the friendly label for whatever's currently selected (e.g. "A-Reserved · Lot 01"). */
export function getPermitDisplayLabel(value: string, options: PermitOption[]): string {
  for (const opt of options) {
    if (opt.kind === 'simple' && opt.value === value) return opt.value;
    if (opt.kind === 'group') {
      const sub = opt.options.find((o) => o.value === value);
      if (!sub) continue;
      // A specific lot ("Lot 16") shortens to its own code ("RR16"/"A01")
      // instead of "Resident Reserved · Lot 16" — long enough to crowd the
      // dropdown's chevron out of the box. The generic entry's label is
      // already just the bare group name, so it's left as-is.
      const lotNumber = sub.label.match(/^Lot\s+(\d+)$/i)?.[1];
      const shortCode = GROUP_EMBLEMS[opt.label];
      return lotNumber && shortCode ? `${shortCode}${lotNumber}` : sub.label;
    }
  }
  return value;
}

/** Whether `value` is one of A-Reserved/Resident Reserved's per-lot raw codes (e.g. "A24", "Lot 16 Resident Reserve"). */
export function isPerLotPermitCode(value: string): boolean {
  const trimmed = value.trim();
  return A_RESERVED_CODE_RE.test(trimmed) || RESIDENT_RESERVED_LOT_RE.test(trimmed);
}
