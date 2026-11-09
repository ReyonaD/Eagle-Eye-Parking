// License plate input helpers, shared by Profile Setting and Note to Admin.
// Mirrors the backend's normalization in app/schemas.py.

export const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]);

// US plates are at most 8 characters; spaces/dashes are decoration, not part of the number.
export const MAX_PLATE_LENGTH = 8;

export const formatPlateInput = (text: string) =>
  text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_PLATE_LENGTH);

export const formatStateInput = (text: string) =>
  text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

export const isValidPlateNumber = (plate: string) => /^[A-Z0-9]{2,8}$/.test(plate);

export const isValidPlateState = (state: string) => US_STATE_CODES.has(state);

// Standard Texas plates are 3 letters + 4 numbers (ABC1234). Vanity and older plates
// differ, so this is only a hint, never a blocker.
export const looksUnusualForTexas = (state: string, plate: string) =>
  state === 'TX' && isValidPlateNumber(plate) && !/^[A-Z]{3}\d{4}$/.test(plate);

export const TEXAS_PLATE_HINT = 'Standard Texas plates are 3 letters + 4 numbers (e.g. ABC1234). Double-check unless this is a vanity plate.';
