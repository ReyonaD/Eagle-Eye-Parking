import { distanceMeters, centroid, nearestLotDistance, nearestCampus, formatDistance, getStripeSegments } from '../geo';

const UNT = { latitude: 33.211, longitude: -97.1475 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(UNT, UNT)).toBe(0);
  });

  it('measures about 111 km per degree of latitude', () => {
    const north = { latitude: UNT.latitude + 1, longitude: UNT.longitude };
    expect(distanceMeters(UNT, north)).toBeGreaterThan(110_000);
    expect(distanceMeters(UNT, north)).toBeLessThan(112_000);
  });
});

describe('centroid / nearestLotDistance', () => {
  const square = [
    { latitude: 33.21, longitude: -97.15 },
    { latitude: 33.21, longitude: -97.149 },
    { latitude: 33.211, longitude: -97.149 },
    { latitude: 33.211, longitude: -97.15 },
  ];

  it('finds the middle of a polygon', () => {
    const c = centroid(square);
    expect(c.latitude).toBeCloseTo(33.2105, 6);
    expect(c.longitude).toBeCloseTo(-97.1495, 6);
  });

  it('measures to the nearest lot and ignores invalid ones', () => {
    expect(nearestLotDistance(centroid(square), [{ coordinates: square }, { coordinates: [] }])).toBeCloseTo(0, 6);
    expect(nearestLotDistance(UNT, [])).toBe(Infinity);
  });
});

describe('formatDistance', () => {
  it('uses feet under 0.1 mile and miles above', () => {
    expect(formatDistance(10)).toBe('50 ft');
    expect(formatDistance(76)).toBe('250 ft');
    expect(formatDistance(1609.344 * 0.4)).toBe('0.4 mi');
  });
});

describe('getStripeSegments', () => {
  it('draws stripes inside a lot', () => {
    const lot = [
      { latitude: 33.21, longitude: -97.15 },
      { latitude: 33.21, longitude: -97.149 },
      { latitude: 33.211, longitude: -97.149 },
      { latitude: 33.211, longitude: -97.15 },
    ];
    const segments = getStripeSegments(lot);
    expect(segments.length).toBeGreaterThan(5);
    for (const [a, b] of segments) {
      for (const p of [a, b]) {
        expect(p.latitude).toBeGreaterThanOrEqual(33.21 - 1e-6);
        expect(p.latitude).toBeLessThanOrEqual(33.211 + 1e-6);
      }
    }
  });

  it('returns nothing for invalid polygons', () => {
    expect(getStripeSegments([UNT, UNT])).toEqual([]);
  });
});

describe('nearestCampus', () => {
  it('picks the campus the user is on', () => {
    expect(nearestCampus(UNT)).toBe('Main campus');
    expect(nearestCampus({ latitude: 33.2535, longitude: -97.1530 })).toBe('Discovery Park');
    expect(nearestCampus({ latitude: 33.1870, longitude: -96.8040 })).toBe('Frisco Landing');
  });
});
