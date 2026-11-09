import { matchScore, rankLotMatches } from '../lotSearch';

const lot = (name: string, tag: string, distance: number) => ({ name, tag, distance });
const LOTS = [
  lot('Lot 200', '200', 100),
  lot('Lot 20', '20', 500),
  lot('Lot 2', '2', 900),
  lot('Union Circle Garage', 'UCG', 300),
  lot('HSG', 'HSG', 200),
  lot('Lot 52', '52', 400),
];
const names = (query: string) => rankLotMatches(LOTS, query).map((l) => l.name);

describe('matchScore', () => {
  it('ranks exact, prefix, word-prefix and contains matches', () => {
    expect(matchScore(lot('Lot 20', '20', 0), '20')).toBe(0);
    expect(matchScore(lot('Lot 20', '20', 0), '2')).toBe(1);
    expect(matchScore(lot('Union Circle Garage', 'UCG', 0), 'circle')).toBe(2);
    expect(matchScore(lot('Lot 52', '52', 0), '2')).toBe(3);
  });

  it('returns null for no match or an empty query', () => {
    expect(matchScore(lot('Lot 20', '20', 0), 'xyz')).toBeNull();
    expect(matchScore(lot('Lot 20', '20', 0), '  ')).toBeNull();
  });
});

describe('rankLotMatches', () => {
  it('puts the exact lot first, ahead of closer partial matches', () => {
    expect(names('20')).toEqual(['Lot 20', 'Lot 200']);
  });

  it('breaks ties by distance', () => {
    expect(names('2')).toEqual(['Lot 2', 'Lot 200', 'Lot 20', 'Lot 52']);
  });

  it('ignores case, spaces and the "Lot" prefix', () => {
    expect(names('lot 20')).toEqual(['Lot 20', 'Lot 200']);
    expect(names('LOT20')).toEqual(['Lot 20', 'Lot 200']);
  });

  it('matches names and short codes', () => {
    expect(names('union')).toEqual(['Union Circle Garage']);
    expect(names('ucg')).toEqual(['Union Circle Garage']);
  });

  it('returns nothing when no lot matches', () => {
    expect(names('xyz')).toEqual([]);
  });
});
