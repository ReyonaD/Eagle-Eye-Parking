import {
  isNightWindow,
  getEffectivePermits,
  NIGHT_PERMITS_BY_GROUP,
  DAY_HOURS_LABEL,
  NIGHT_HOURS_LABEL,
} from '../nightPermitRules';
import { A_RESERVED, RESIDENT_RESERVED } from '../permits';

// Nov 9 2026 is a Monday; Nov 14 is a Saturday (local time)
const monday = (hour: number, minute = 0) => new Date(2026, 10, 9, hour, minute);

describe('isNightWindow', () => {
  it.each([
    [monday(6, 59), true],
    [monday(7, 0), false],
    [monday(12, 0), false],
    [monday(17, 29), false],
    [monday(17, 30), true],
    [monday(23, 0), true],
  ])('weekday %s -> night: %s', (date, expected) => {
    expect(isNightWindow(date)).toBe(expected);
  });

  it('treats all of the weekend as night', () => {
    expect(isNightWindow(new Date(2026, 10, 14, 12, 0))).toBe(true);
    expect(isNightWindow(new Date(2026, 10, 15, 9, 0))).toBe(true);
  });
});

describe('getEffectivePermits', () => {
  it('leaves daytime permits unchanged', () => {
    expect(getEffectivePermits(A_RESERVED, ['A24'], false)).toEqual(['A24']);
  });

  it('uses the chart for an A-Reserved lot at night, with its own permit first', () => {
    const night = getEffectivePermits(A_RESERVED, ['A24'], true);
    expect(night).toBe(NIGHT_PERMITS_BY_GROUP.A);
    expect(night[0]).toBe(A_RESERVED);
    expect(night).toContain('Eagle');
  });

  it('infers the lot group from its daytime permits', () => {
    expect(getEffectivePermits(null, ['Eagle'], true)).toContain('Evening');
    expect(getEffectivePermits(null, ['F/S'], true)[0]).toBe('Faculty and Staff');
  });

  it('restricts Resident Reserved lots at night', () => {
    expect(getEffectivePermits(RESIDENT_RESERVED, [], true)).toEqual([RESIDENT_RESERVED, 'All Access', 'Board of Regents']);
  });

  it('keeps daytime permits when the lot group is unknown', () => {
    expect(getEffectivePermits(null, ['Zip Car'], true)).toEqual(['Zip Car']);
  });
});

describe('labels', () => {
  it('describes the day and night windows', () => {
    expect(DAY_HOURS_LABEL).toBe('7 AM – 5:30 PM');
    expect(NIGHT_HOURS_LABEL).toBe('5:30 PM – 7 AM');
  });
});
