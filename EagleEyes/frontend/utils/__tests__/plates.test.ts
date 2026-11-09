import {
  formatPlateInput,
  formatStateInput,
  isValidPlateNumber,
  isValidPlateState,
  looksUnusualForTexas,
} from '../plates';

describe('formatPlateInput', () => {
  it('uppercases and drops spaces, dashes and symbols', () => {
    expect(formatPlateInput('abc-1234')).toBe('ABC1234');
    expect(formatPlateInput(' ab c 12!')).toBe('ABC12');
  });

  it('stops at 8 characters', () => {
    expect(formatPlateInput('ABCDE12345')).toBe('ABCDE123');
  });
});

describe('formatStateInput', () => {
  it('keeps two uppercase letters', () => {
    expect(formatStateInput('tx')).toBe('TX');
    expect(formatStateInput('t1x9a')).toBe('TX');
  });
});

describe('isValidPlateNumber', () => {
  it.each(['ABC1234', 'ABC123', 'ABCD12', 'A12BCD', 'AB1234', 'A12345', '1ABC234', 'EAGLE1'])('accepts %s', (plate) => {
    expect(isValidPlateNumber(plate)).toBe(true);
  });

  it.each(['A', 'ABC 1234', 'ABC-1234', 'ABCDE12345', ''])('rejects %p', (plate) => {
    expect(isValidPlateNumber(plate)).toBe(false);
  });
});

describe('isValidPlateState', () => {
  it('accepts real US state codes only', () => {
    expect(isValidPlateState('TX')).toBe(true);
    expect(isValidPlateState('DC')).toBe(true);
    expect(isValidPlateState('ZZ')).toBe(false);
    expect(isValidPlateState('tx')).toBe(false);
  });
});

describe('looksUnusualForTexas', () => {
  it('flags non-standard Texas plates', () => {
    expect(looksUnusualForTexas('TX', 'EAGLE1')).toBe(true);
  });

  it('accepts the standard Texas format and other states', () => {
    expect(looksUnusualForTexas('TX', 'ABC1234')).toBe(false);
    expect(looksUnusualForTexas('CA', 'EAGLE1')).toBe(false);
  });

  it('does not flag empty or invalid input (validation handles that)', () => {
    expect(looksUnusualForTexas('TX', '')).toBe(false);
    expect(looksUnusualForTexas('TX', 'A')).toBe(false);
  });
});
