// Single source of truth for the color each permit type renders with —
// originally defined only inside the Profile screen's big permit card, now
// shared so any other screen that lists permits (the map's lot-details sheet,
// the Lots tab's lot-details modal, etc.) can color-code them the same way.
//
// The first block below (Eagle..Motorcycle) was already the app's own color
// design — untouched. The second block was added by sampling badge colors
// directly from UNT Transportation Services' official permit chart:
// https://transportation.unt.edu/images/unt_parking_permits_2024_2025_updated.pdf
// Only permit types that actually appear in this app's live permit data (see
// utils/permits.ts's PERMIT_ALIASES) got an entry — the chart also has badges
// for RM, R, RR, TF, HF and SV, which either aren't distinct permits in our
// data (RM/R fold into "Resident", RR into "Resident Reserved") or don't
// appear in it at all (TF, HF, SV), so they're skipped.

import { normalizePermit, STREET_PARKING } from './permits';

export interface PermitCardStyle {
  bg: string;
  text: string;
  label: string;
  striped?: boolean;
  // Only needed for a fill close to white, so the chip doesn't disappear
  // against the app's own white/light-gray card backgrounds.
  border?: string;
}

export const PERMIT_CARD_STYLES: Record<string, PermitCardStyle> = {
  'Eagle': { bg: '#CDA357', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'A-Reserved': { bg: '#2E6643', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Faculty and Staff': { bg: '#3D5AA3', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Resident': { bg: '#DC8542', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Resident Reserved': { bg: '#DC8542', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)', striped: true },
  'Visitor': { bg: '#AC3376', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Motorcycle': { bg: '#637BB5', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  // From the official UNT permit chart:
  'Hall Director': { bg: '#00AEEF', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Business/Vendor': { bg: '#7030A0', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Highland Street Garage Commuter': { bg: '#A6A6A6', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Union Circle Garage': { bg: '#A6A6A6', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Evening': { bg: '#FFFFFF', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)', border: '#1a1a1a' },

  // "RM" on the official chart, confirmed against real UNT signage — a
  // magenta close to "Visitor"'s color, but kept distinct as its own entry.
  'Remote': { bg: '#E166A7', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  // Not on the official chart (faculty/staff-only, separate from the
  // all-audiences "Evening" permit) — given its own dark navy so it doesn't
  // fall through to the default gray and look identical to an unstyled permit.
  'Night': { bg: '#1B2A4A', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  [STREET_PARKING]: { bg: '#1B998B', text: '#fff', label: 'rgba(255,255,255,0.7)' },
};

export const DEFAULT_PERMIT_CARD_STYLE: PermitCardStyle = {
  bg: '#6B7280',
  text: '#fff',
  label: 'rgba(255,255,255,0.7)',
};

export function getPermitCardStyle(permitType: string): PermitCardStyle {
  const trimmed = (permitType || '').trim();
  // normalizePermit already collapses any numbered "A01".."A95" code (or an
  // "A-Reserved"-ish variant) into "A-Reserved", anything mentioning
  // "Resident Reserve(d)" — e.g. "Lot 16 Resident Reserve" — into
  // "Resident Reserved", and short codes like "F/S" into their full name, so
  // a lot's raw permit string still resolves to the right shared color
  // instead of falling through to gray.
  const canonical = normalizePermit(trimmed) || trimmed;
  return PERMIT_CARD_STYLES[canonical] || DEFAULT_PERMIT_CARD_STYLE;
}
