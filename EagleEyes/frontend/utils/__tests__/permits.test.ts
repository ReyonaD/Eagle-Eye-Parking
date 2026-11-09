import {
  normalizePermit,
  normalizePermitPreservingCode,
  getLotCategory,
  getLotPermitGroups,
  lotMatchesPermitType,
  getPremiumParkingLink,
  buildPermitOptions,
  getPermitDisplayLabel,
  dedupePermitLabels,
  isPerLotPermitCode,
  A_RESERVED,
  RESIDENT_RESERVED,
  STREET_PARKING,
  PREMIUM_PARKING,
} from '../permits';

describe('normalizePermit', () => {
  it.each([
    ['A01', A_RESERVED],
    ['A-Reserved', A_RESERVED],
    ['Lot 16 Resident Reserve', RESIDENT_RESERVED],
    ['RR12', RESIDENT_RESERVED],
    ['F/S', 'Faculty and Staff'],
    ['Premium Parking (paid visitor)', PREMIUM_PARKING],
    ['PP', PREMIUM_PARKING],
    ['Eagle', 'Eagle'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizePermit(raw)).toBe(expected);
  });

  it('keeps HSR-Resident distinct from Resident', () => {
    expect(normalizePermit('HSR-Resident')).toBe('HSR-Resident');
  });

  it('returns an empty string for non-strings and blanks', () => {
    expect(normalizePermit(undefined)).toBe('');
    expect(normalizePermit('   ')).toBe('');
  });
});

describe('normalizePermitPreservingCode', () => {
  it('keeps specific per-space codes', () => {
    expect(normalizePermitPreservingCode('A24')).toBe('A24');
    expect(normalizePermitPreservingCode('A-05')).toBe('A05');
    expect(normalizePermitPreservingCode('Lot 9 Resident Reserve')).toBe('RR09');
  });

  it('falls back to the normal group name otherwise', () => {
    expect(normalizePermitPreservingCode('F/S')).toBe('Faculty and Staff');
  });
});

describe('getLotCategory', () => {
  it.each([
    ['Lot 24', A_RESERVED],
    ['Lot 16', RESIDENT_RESERVED],
    ['Lot 27', RESIDENT_RESERVED],
    ['Lot 20', null],
    ['Lot 37 - Eagle', null],
    ['Ave D - Chestnut to Mulberry', STREET_PARKING],
    ['P9246 Lot', PREMIUM_PARKING],
    ['', null],
  ])('%s -> %s', (name, expected) => {
    expect(getLotCategory(name)).toBe(expected);
  });
});

describe('getLotPermitGroups', () => {
  it('puts the lot category first, then the consolidated permits', () => {
    expect(getLotPermitGroups('Lot 24', ['A24', 'F/S'])).toEqual(['A24', 'Faculty and Staff']);
    expect(getLotPermitGroups('Lot 2', ['F/S', 'A-Reserved'])).toEqual([A_RESERVED, 'Faculty and Staff']);
  });

  it('just consolidates permits for ordinary lots', () => {
    expect(getLotPermitGroups('Lot 20', ['F/S', 'FS', 'Eagle'])).toEqual(['Faculty and Staff', 'Eagle']);
  });
});

describe('lotMatchesPermitType', () => {
  it('matches exactly, ignoring case', () => {
    expect(lotMatchesPermitType(['Eagle', 'Faculty and Staff'], 'eagle')).toBe(true);
  });

  it('does not match on substrings', () => {
    expect(lotMatchesPermitType(['HSR-Resident', RESIDENT_RESERVED], 'Resident')).toBe(false);
  });

  it('matches a specific per-space pick using the raw permit list', () => {
    expect(lotMatchesPermitType([A_RESERVED], 'A24', ['A24', 'A25'])).toBe(true);
    expect(lotMatchesPermitType([A_RESERVED], 'A30', ['A24', 'A25'])).toBe(false);
  });

  it('matches every lot when no permit is chosen', () => {
    expect(lotMatchesPermitType([], '  ')).toBe(true);
  });
});

describe('getPremiumParkingLink', () => {
  it('uses the code in "P<number> Lot" names', () => {
    expect(getPremiumParkingLink('P9246 Lot')).toBe('https://www.premiumparking.com/P9246');
  });

  it('builds P92 + lot number for lots that accept Premium Parking', () => {
    expect(getPremiumParkingLink('Lot 46', ['PP'])).toBe('https://www.premiumparking.com/P9246');
    expect(getPremiumParkingLink('Lot 5 - Eagle', ['Premium Parking (paid visitor)'])).toBe('https://www.premiumparking.com/P9205');
  });

  it('has no link for lots without Premium Parking', () => {
    expect(getPremiumParkingLink('Lot 46', ['Eagle'])).toBeNull();
  });

  it('handles Union Circle Garage and Frisco lots', () => {
    expect(getPremiumParkingLink('Union Circle Garage', ['PP'])).toBe('https://www.premiumparking.com/P9201');
    const frisco = [{ latitude: 33.1, longitude: -96.8 }, { latitude: 33.11, longitude: -96.81 }];
    expect(getPremiumParkingLink('Lot F1', [], frisco)).toBe('https://www.premiumparking.com/P9299');
  });
});

describe('buildPermitOptions', () => {
  const options = buildPermitOptions(['Zip Car', 'A02', 'A01', 'F/S', 'Eagle', 'Lot 16 Resident Reserve', 'A-Reserved']);

  it('groups per-space codes into one row each, sorted by lot', () => {
    const aGroup = options.find((o) => o.kind === 'group' && o.label === A_RESERVED);
    expect(aGroup).toEqual({
      kind: 'group',
      label: A_RESERVED,
      options: [
        { value: 'A-Reserved', label: A_RESERVED },
        { value: 'A01', label: 'Lot 01' },
        { value: 'A02', label: 'Lot 02' },
      ],
    });
  });

  it('orders student permits first, then faculty/staff, then the rest alphabetically', () => {
    const labels = options.map((o) => (o.kind === 'group' ? o.label : o.value));
    expect(labels).toEqual(['Eagle', RESIDENT_RESERVED, 'Faculty and Staff', A_RESERVED, 'Zip Car']);
  });

  it('shows short codes for a specific lot pick', () => {
    expect(getPermitDisplayLabel('A01', options)).toBe('A01');
    expect(getPermitDisplayLabel('Lot 16 Resident Reserve', options)).toBe('RR16');
    expect(getPermitDisplayLabel('Eagle', options)).toBe('Eagle');
  });
});

describe('dedupePermitLabels', () => {
  it('drops duplicates and sorts in dropdown order', () => {
    expect(dedupePermitLabels(['A25', 'Faculty and Staff', 'A24', 'A24', 'Eagle'])).toEqual([
      'Eagle', 'Faculty and Staff', 'A24', 'A25',
    ]);
  });
});

describe('isPerLotPermitCode', () => {
  it('recognizes per-space codes only', () => {
    expect(isPerLotPermitCode('A24')).toBe(true);
    expect(isPerLotPermitCode('Lot 16 Resident Reserve')).toBe(true);
    expect(isPerLotPermitCode('A-Reserved')).toBe(false);
    expect(isPerLotPermitCode('Eagle')).toBe(false);
  });
});
