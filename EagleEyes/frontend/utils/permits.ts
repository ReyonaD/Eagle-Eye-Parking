// Permit consolidation helpers.
//
// ParkZen returns individual reserved-space permits (e.g. "A01", "A02" ... "A90",
// or numbered "Resident Reserved" spaces). For the UI we collapse those into a
// single permit group so the emblem matches the physical parking permit.

export const A_RESERVED = 'A-Reserved';
export const RESIDENT_RESERVED = 'Resident Reserved';
export const STREET_PARKING = 'Street Parking';
// Bare, no "(Visitor)"/"(paid visitor)" suffix — ParkZen's own raw name for
// this permit carries one, but it reads as confusing jargon to a commuter,
// so every reference to this permit (badges, dropdowns, chips) should go
// through this constant rather than a raw ParkZen string, so the suffix
// never resurfaces by accident.
export const PREMIUM_PARKING = 'Premium Parking';

// Emblem (short badge label) shown for each consolidated group.
export const GROUP_EMBLEMS: Record<string, string> = {
  [A_RESERVED]: 'A',
  [RESIDENT_RESERVED]: 'RR',
  [STREET_PARKING]: 'ST',
  [PREMIUM_PARKING]: 'PP',
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

// Street-side metered/paid spots named "P<number> Lot" (e.g. "P9246 Lot"),
// billed as Premium Parking rather than a permit. Pattern confirmed against
// one real example (P9246 Lot) — flagged by a user as "I think" a premium
// parking spot, not verified against ParkZen's own permit data for it, so
// treat matches as provisional until confirmed.
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

/**
 * premiumparking.com's own per-lot payment page.
 *
 * Lots ParkZen names directly as "P<number> Lot" (e.g. "P9246 Lot") link by
 * that code as-is: https://www.premiumparking.com/P9246.
 *
 * Every other UNT lot numbered "Lot NN" maps to premiumparking.com via the
 * code "P92" + the zero-padded lot number — confirmed from "P9246 Lot"
 * being UNT's own Lot 46 (last two digits 46) — but only once the lot
 * actually lists Premium Parking as one of its accepted permits, via
 * `permitList` (the lot's own, already-normalized permit list), since most
 * numbered lots don't offer it. Union Circle Garage is the one named
 * exception, using P9201 instead of a lot-number-derived code.
 *
 * Every Frisco Landing lot (detected from `coordinates`) links to P9299.
 */
// Frisco Landing sits ~35km east of the Denton campuses (Main campus and
// Discovery Park are both around -97.15 longitude, Frisco around -96.80), so
// any lot whose polygon lies east of -97.0 is a Frisco lot.
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

  // A lot that got a name-based category (A-Reserved, etc.) has its
  // permitList already normalized, but an ordinary lot's permitList is just
  // ParkZen's raw permits, unnormalized — so "PP" or "Premium Parking
  // (paid visitor)" would never exact-match PREMIUM_PARKING directly.
  // Normalizing each entry here handles both cases the same way.
  const permits = Array.isArray(permitList) ? permitList : [];
  const hasPremiumParking = permits.some((p) => typeof p === 'string' && normalizePermit(p) === PREMIUM_PARKING);
  if (!hasPremiumParking) return null;

  if (trimmed.toLowerCase() === 'union circle garage') return 'https://www.premiumparking.com/P9201';

  // Deliberately more lenient than lotNumber() above: this needs the number
  // out of "Lot 94 - Eagle" or "Lot 94 - A Reserved" too, not just a bare
  // "Lot 94" — the physical lot's number is the same either way.
  const num = trimmed.match(/^lot\s*#?\s*(\d+)\b/i)?.[1];
  return num ? `https://www.premiumparking.com/P92${num.padStart(2, '0')}` : null;
}

/**
 * Final permit list for a lot: the lot's name category (A-Reserved, Resident Reserved,
 * Street Parking) goes first so its emblem shows before anything else, followed by the
 * consolidated ParkZen permits.
 *
 * Exception: a lot named after one specific numbered space (e.g. "Lot 16 -
 * Resident Reserved") only admits that space's own permit — "Lot 16
 * Resident Reserve", confirmed as this lot's sole raw permit in live
 * ParkZen data — not just any holder of the generic "Resident
 * Reserved"/"A-Reserved" bucket permit. So when a lot's own raw permits
 * already include one or more specific per-lot codes, those are kept as-is
 * instead of being collapsed into the generic category name, both so the
 * chip display can show the real code (via `normalizePermitPreservingCode`)
 * and so `lotMatchesPermitType` only matches the exact matching permit.
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

// Short/inconsistently-cased raw ParkZen codes that mean the same permit as a
// longer or differently-cased name shown elsewhere (dropdowns, filters).
// Keyed lowercase. The abbreviation expansions (hd, ada, dv) are confirmed
// against ParkZen's own permit records, which pair each short `name` with a
// fuller `type` — e.g. name "HD" has type "Hall Director". Only added where
// `type` is genuinely a longer name for the same permit, not where it
// describes eligibility instead (e.g. "Eagle" -> type "Commuter Student" —
// that's who's allowed to use it, not another name for it, so entries like
// that are deliberately left alone). "zip car", "premium parking" and
// "hsg-commuter" are casing/shorthand fixes (ParkZen's own dashboard name is
// "HSG-Commuter"), not type-based expansions.
// "HSR-Resident" is also deliberately not aliased to "Resident": its type is
// "Highland Street Garage Resident Students", a genuinely different permit
// from plain "Resident" (type "Resident Hall students").
const PERMIT_ALIASES: Record<string, string> = {
  'f/s': 'Faculty and Staff',
  'fs': 'Faculty and Staff',
  'hd': 'Hall Director',
  'ada': 'Americans with Disabilities Act',
  'dv': 'Disabled Veteran',
  'hsg-commuter': 'HSG-Commuter',
  'zip car': 'Zip Car',
  // stripSuffix() removes the "(paid visitor)" parenthetical before this
  // lookup runs, so the raw ParkZen name "Premium Parking (paid visitor)"
  // reaches here as just "premium parking". "pp" is the same permit under
  // its short code, for lots where ParkZen lists it that way instead.
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

/**
 * Like `normalizePermit`, but a specific numbered space (e.g. "A24", "Lot 16
 * Resident Reserve") keeps its own short code ("A24", "RR16") instead of
 * collapsing into the generic "A-Reserved"/"Resident Reserved" bucket name.
 * ParkZen's own data for a Resident Reserved space has no shorter form than
 * the full "Lot NN Resident Reserve" phrase (confirmed against its own
 * permit record — no separate code field), so "RR16" here is this app's own
 * shorthand for it, mirroring the "A24" convention ParkZen already uses for
 * A-Reserved spaces.
 *
 * For a lot's own permit list — where several distinct numbered spaces can
 * legitimately belong to one lot — collapsing them all to the same generic
 * name makes them look like duplicates. Everything else (the generic entry
 * itself, aliases, ordinary permit names) behaves exactly like
 * `normalizePermit`.
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

// A bundled lot (e.g. a "Remote"/overflow lot) can have many numbered
// A-Reserved/Resident-Reserved codes mixed in among its other permits in
// whatever order ParkZen happens to list them — scattered, not grouped by
// family, and not in the same Student/Faculty-and-Staff/rest order the
// PERMIT dropdown already uses. Sorts a lot's own permit chips by that same
// `PERMIT_PRIORITY_RANK` (an "A24"/"RR16" code ranks under its own
// A-Reserved/Resident-Reserved family), falling back to numeric order within
// a family and alphabetical order for anything unranked — same tie-break
// `buildPermitOptions` uses for the dropdown.
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

/**
 * Maps a lot's raw permit list to display labels via
 * `normalizePermitPreservingCode`, dropping exact duplicate labels (keeping
 * first-seen order), then sorting by the same priority order the PERMIT
 * dropdown uses. Used for a lot's own permit chips, where several distinct
 * numbered spaces (e.g. "A24", "A25") are expected to show separately, but
 * identical duplicate entries shouldn't repeat.
 */
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

// Dropdown order: student permits first, then faculty/staff permits, then
// everything else alphabetically. Evening, HSG-Commuter, Motorcycle and
// Premium Parking are open to more than just faculty/staff, but are grouped
// under faculty/staff here per a deliberate call (not a chart-driven
// default). Anything not listed here — ADA, Business/Vendor, Disabled
// Veteran, Street Parking, Zip Car, etc. — sorts after, alphabetically, as a
// safe fallback.
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

  // Normalized so a raw live code (e.g. "F/S") reads — and sorts — as its
  // full name ("Faculty and Staff"), same as it would inside a lot's own
  // consolidated permitList; also de-dupes in case two raw codes normalize
  // to the same name.
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
