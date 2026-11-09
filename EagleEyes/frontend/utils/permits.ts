// Permit helpers: collapse ParkZen's per-space permits (A01..A95, numbered
// Resident Reserved) into the permit groups shown in the UI.

export const A_RESERVED = 'A-Reserved';
export const RESIDENT_RESERVED = 'Resident Reserved';
export const STREET_PARKING = 'Street Parking';
// Display name without ParkZen's "(paid visitor)" suffix; always use this constant.
export const PREMIUM_PARKING = 'Premium Parking';

// Emblem (short badge label) shown for each consolidated group.
export const GROUP_EMBLEMS: Record<string, string> = {
  [A_RESERVED]: 'A',
  [RESIDENT_RESERVED]: 'RR',
  [STREET_PARKING]: 'ST',
  [PREMIUM_PARKING]: 'PP',
};

// Lot-name categories (from the "Lots to be changed" doc); these override ParkZen's permits.

// "Lot N - A Reserved" lots. Lot 27 is left out: the doc lists it as Resident Reserved.
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

// Street-side paid spots named "P<number> Lot" (e.g. "P9246 Lot"), billed as Premium Parking.
const PREMIUM_PARKING_LOT_RE = /^p\d+\s+lot$/i;

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
  if (PREMIUM_PARKING_LOT_RE.test(name)) return PREMIUM_PARKING;
  return null;
}

// premiumparking.com payment page for a lot:
// - "P<number> Lot" lots use that code (P9246)
// - "Lot NN" lots that accept Premium Parking use P92 + NN (Union Circle Garage: P9201)
// - Frisco Landing lots (east of -97.0 longitude) use P9299
const FRISCO_MIN_LONGITUDE = -97.0;
const FRISCO_PREMIUM_PARKING_URL = 'https://www.premiumparking.com/P9299';

export function isFriscoLot(coordinates: unknown): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  return coordinates.every((c) => typeof c?.longitude === 'number' && c.longitude > FRISCO_MIN_LONGITUDE);
}

export function getPremiumParkingLink(lotName: unknown, permitList: unknown = [], coordinates: unknown = []): string | null {
  // Every Frisco Landing lot pays through the same Premium Parking location.
  if (isFriscoLot(coordinates)) return FRISCO_PREMIUM_PARKING_URL;
  if (typeof lotName !== 'string') return null;
  const trimmed = lotName.trim();

  if (PREMIUM_PARKING_LOT_RE.test(trimmed)) {
    const code = trimmed.match(/^([A-Za-z]+\d+)\b/)?.[1];
    return code ? `https://www.premiumparking.com/${code.toUpperCase()}` : null;
  }

  // Normalize each entry: ordinary lots still carry raw ParkZen names ("PP", "Premium Parking (paid visitor)").
  const permits = Array.isArray(permitList) ? permitList : [];
  const hasPremiumParking = permits.some((p) => typeof p === 'string' && normalizePermit(p) === PREMIUM_PARKING);
  if (!hasPremiumParking) return null;

  if (trimmed.toLowerCase() === 'union circle garage') return 'https://www.premiumparking.com/P9201';

  // Looser than lotNumber(): also reads "Lot 94 - Eagle" / "Lot 94 - A Reserved".
  const num = trimmed.match(/^lot\s*#?\s*(\d+)\b/i)?.[1];
  return num ? `https://www.premiumparking.com/P92${num.padStart(2, '0')}` : null;
}

/**
 * Final permit list for a lot: its name category first (for the emblem), then the
 * consolidated ParkZen permits. Specific per-space codes (e.g. "Lot 16 Resident
 * Reserve") are kept as-is so only that exact permit matches the lot.
 */
export function getLotPermitGroups(lotName: unknown, rawPermits: unknown): string[] {
  const category = getLotCategory(lotName);
  if (!category) return consolidatePermits(rawPermits);

  const arr = Array.isArray(rawPermits)
    ? rawPermits
    : typeof rawPermits === 'string'
      ? rawPermits.split(',')
      : [];
  const specificCodes = [...new Set(
    arr.filter((p): p is string => typeof p === 'string' && isPerLotPermitCode(p.trim())).map((p) => p.trim()),
  )];
  if (specificCodes.length > 0) {
    const rest = consolidatePermits(arr.filter((p) => !specificCodes.includes(typeof p === 'string' ? p.trim() : p)));
    return [...specificCodes, ...rest.filter((g) => g !== category)];
  }

  const groups = consolidatePermits(rawPermits);
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

// Raw ParkZen codes that mean the same permit as a longer name (keyed lowercase).
// Only true synonyms: "HSR-Resident" is a different permit from "Resident".
const PERMIT_ALIASES: Record<string, string> = {
  'f/s': 'Faculty and Staff',
  'fs': 'Faculty and Staff',
  'hd': 'Hall Director',
  'ada': 'Americans with Disabilities Act',
  'dv': 'Disabled Veteran',
  'hsg-commuter': 'HSG-Commuter',
  'zip car': 'Zip Car',
  // "pp" is ParkZen's short code for Premium Parking (suffix already stripped).
  'premium parking': PREMIUM_PARKING,
  'pp': PREMIUM_PARKING,
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

/**
 * Whether a lot accepts the given permit (case-insensitive). Pass `rawPermitList` to
 * match a specific per-space pick like "A24", which the consolidated list drops.
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

/**
 * Like normalizePermit, but a specific numbered space keeps its own short code
 * ("A24", "RR16") so several spaces in one lot don't look like duplicates.
 */
export function normalizePermitPreservingCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const base = stripSuffix(trimmed) || trimmed;

  const aCode = base.match(A_RESERVED_CODE_RE);
  if (aCode) return `A${aCode[1]}`;

  const rrLot = base.match(RESIDENT_RESERVED_LOT_RE);
  if (rrLot) return `RR${String(parseInt(rrLot[1], 10)).padStart(2, '0')}`;

  return normalizePermit(raw);
}

// Sorts a lot's permit chips in dropdown order (PERMIT_PRIORITY_RANK); per-space codes
// rank with their family, then numerically, then alphabetically.
function sortPermitLabelsByPriority(labels: string[]): string[] {
  const sortKey = (label: string): [number, number, string] => {
    const aMatch = label.match(/^A(\d{2,3})$/i);
    if (aMatch) return [PERMIT_PRIORITY_RANK[A_RESERVED] ?? Infinity, parseInt(aMatch[1], 10), label];
    const rrMatch = label.match(/^RR(\d{2,3})$/i);
    if (rrMatch) return [PERMIT_PRIORITY_RANK[RESIDENT_RESERVED] ?? Infinity, parseInt(rrMatch[1], 10), label];
    return [PERMIT_PRIORITY_RANK[label] ?? Infinity, 0, label];
  };

  return [...labels].sort((a, b) => {
    const [rankA, numA, labelA] = sortKey(a);
    const [rankB, numB, labelB] = sortKey(b);
    if (rankA !== rankB) return rankA - rankB;
    if (numA !== numB) return numA - numB;
    return labelA.localeCompare(labelB);
  });
}

/** A lot's permit chip labels: per-space codes kept, exact duplicates dropped, priority-sorted. */
export function dedupePermitLabels(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of arr) {
    const label = normalizePermitPreservingCode(p) || (typeof p === 'string' ? p.trim() : '');
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return sortPermitLabelsByPriority(out);
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

// Permit picker grouping (Profile Setting, Map tab PERMIT dropdown).

// ParkZen lists each A-Reserved space as its raw code ("A01".."A95"); grouped into one row.
const A_RESERVED_CODE_RE = /^a\s*-?\s*(\d{2,3})$/i;
const A_RESERVED_GENERIC_VALUE = 'a-reserved';
const A_RESERVED_GROUP_LABEL = 'A-Reserved';

// Each Resident Reserved lot's permit ("Lot 16 Resident Reserve"); grouped into one row.
const RESIDENT_RESERVED_LOT_RE = /^lot\s+(\d{1,3})\s+resident\s+reserved?\b/i;
const RESIDENT_RESERVED_GENERIC_VALUE = 'resident reserved';
const RESIDENT_RESERVED_GROUP_LABEL = 'Resident Reserved';

export type PermitOption =
  | { kind: 'simple'; value: string }
  | { kind: 'group'; label: string; options: { value: string; label: string }[] };

// Dropdown order: student permits, then faculty/staff, then everything else alphabetically.
const PERMIT_PRIORITY_ORDER = [
  // Student
  'Eagle', 'Resident', RESIDENT_RESERVED, 'Remote',
  // Faculty and Staff
  'Faculty and Staff', A_RESERVED,
  'Night', 'Evening', 'Motorcycle', PREMIUM_PARKING, 'HSG-Commuter',
  'HSR-Resident', 'Hall Director', 'Union Circle Garage',
];
const PERMIT_PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  PERMIT_PRIORITY_ORDER.map((name, i) => [name, i])
);

// Collapses one family's per-lot codes into a single row that opens a lot picker.
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
 * Turns live ParkZen permit names into dropdown options: plain permits as 'simple' rows,
 * per-lot codes as 'group' rows. `extraSimple` adds app-only entries (e.g. "Street Parking").
 */
export function buildPermitOptions(types: string[], extraSimple: string[] = []): PermitOption[] {
  const aReserved = groupPerLotCodes(types, A_RESERVED_CODE_RE, A_RESERVED_GENERIC_VALUE, A_RESERVED_GROUP_LABEL);
  const residentReserved = groupPerLotCodes(
    aReserved.rest,
    RESIDENT_RESERVED_LOT_RE,
    RESIDENT_RESERVED_GENERIC_VALUE,
    RESIDENT_RESERVED_GROUP_LABEL,
  );

  // Normalized so raw codes read and sort as their full names; also de-dupes.
  const simpleValues = new Set<string>();
  for (const raw of [...residentReserved.rest, ...extraSimple]) {
    simpleValues.add(normalizePermit(raw) || raw);
  }
  const options: PermitOption[] = [...simpleValues].map((value) => ({ kind: 'simple', value }));
  if (aReserved.group) options.push(aReserved.group);
  if (residentReserved.group) options.push(residentReserved.group);

  return options.sort((a, b) => {
    const labelA = a.kind === 'group' ? a.label : a.value;
    const labelB = b.kind === 'group' ? b.label : b.value;
    const rankA = PERMIT_PRIORITY_RANK[labelA] ?? Infinity;
    const rankB = PERMIT_PRIORITY_RANK[labelB] ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
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
      // A specific lot shows its short code ("RR16"/"A01") so the label fits the dropdown.
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
