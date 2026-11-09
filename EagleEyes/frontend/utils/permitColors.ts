// Color for each permit type, shared by every screen that shows permits.
// Official colors sampled from UNT's permit chart:
// https://transportation.unt.edu/images/unt_parking_permits_2024_2025_updated.pdf

import { normalizePermit, STREET_PARKING, PREMIUM_PARKING } from './permits';

export interface PermitCardStyle {
  bg: string;
  text: string;
  label: string;
  // Only needed for a fill close to white, so the chip doesn't disappear
  // against the app's own white/light-gray card backgrounds.
  border?: string;
}

export const PERMIT_CARD_STYLES: Record<string, PermitCardStyle> = {
  'Eagle': { bg: '#CDA357', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'A-Reserved': { bg: '#2E6643', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Faculty and Staff': { bg: '#3D5AA3', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Resident': { bg: '#DC8542', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Resident Reserved': { bg: '#DC8542', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Visitor': { bg: '#AC3376', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'Motorcycle': { bg: '#637BB5', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  // From the official UNT permit chart:
  'Hall Director': { bg: '#00AEEF', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Business/Vendor': { bg: '#7030A0', text: '#fff', label: 'rgba(255,255,255,0.7)' },
  'HSG-Commuter': { bg: '#A6A6A6', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Union Circle Garage': { bg: '#A6A6A6', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)' },
  'Evening': { bg: '#FFFFFF', text: '#1a1a1a', label: 'rgba(26,26,26,0.65)', border: '#1a1a1a' },

  // "RM" on the official chart, confirmed against real UNT signage — a
  // magenta close to "Visitor"'s color, but kept distinct as its own entry.
  'Remote': { bg: '#E166A7', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  // Not on the chart; dark navy so it doesn't look unstyled.
  'Night': { bg: '#1B2A4A', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  [STREET_PARKING]: { bg: '#1B998B', text: '#fff', label: 'rgba(255,255,255,0.7)' },

  // Paid parking, not a permit tier: premiumparking.com's brand red.
  [PREMIUM_PARKING]: { bg: '#D6332A', text: '#fff', label: 'rgba(255,255,255,0.7)' },
};

export const DEFAULT_PERMIT_CARD_STYLE: PermitCardStyle = {
  bg: '#6B7280',
  text: '#fff',
  label: 'rgba(255,255,255,0.7)',
};

export function getPermitCardStyle(permitType: string): PermitCardStyle {
  const trimmed = (permitType || '').trim();
  // Normalize raw codes ("A01", "Lot 16 Resident Reserve", "F/S") to their shared color.
  const canonical = normalizePermit(trimmed) || trimmed;
  return PERMIT_CARD_STYLES[canonical] || DEFAULT_PERMIT_CARD_STYLE;
}
