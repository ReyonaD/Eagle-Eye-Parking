import {
  parseLotNames,
  joinLotNames,
  isClosureCategory,
  buildLotStatuses,
  isLotClosed,
  isLotNameClosed,
  findEventConflicts,
  findActiveClosures,
  getLotTakeover,
  CLOSURE_CATEGORY,
} from '../lotStatus';

// A published event as the backend returns it (timestamps in UTC ISO format).
const event = (id: number, category: string, lots: string, start: Date, end: Date | null = null) => ({
  id,
  title: `EVENT ${id}`,
  category,
  lot_name: lots,
  event_start: start.toISOString(),
  event_end: end ? end.toISOString() : null,
  created_at: start.toISOString(),
});

// Monday, Nov 9 2026, local time
const at = (hour: number, minute = 0, day = 9) => new Date(2026, 10, day, hour, minute);
const NOW = at(10);

describe('lot names', () => {
  it('round-trips several lots through one column', () => {
    expect(parseLotNames(joinLotNames(['Lot 20', 'Lot 24']))).toEqual(['Lot 20', 'Lot 24']);
  });

  it('treats empty or missing names as no lots', () => {
    expect(parseLotNames(null)).toEqual([]);
    expect(parseLotNames(' ; ')).toEqual([]);
  });

  it('recognizes the current and legacy closure categories', () => {
    expect(isClosureCategory('Lot Closure')).toBe(true);
    expect(isClosureCategory('closure')).toBe(true);
    expect(isClosureCategory('Gameday')).toBe(false);
  });
});

describe('buildLotStatuses', () => {
  it('closes a lot while a closure is in progress', () => {
    const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9), at(17))], NOW);
    expect(isLotClosed(statuses['Lot 20'])).toBe(true);
  });

  it('does not close a lot for a closure that starts later today', () => {
    const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(15), at(17))], NOW);
    expect(statuses['Lot 20'].closure?.active).toBe(false);
    expect(isLotClosed(statuses['Lot 20'])).toBe(false);
  });

  it('ignores closures that already ended or start on a later day', () => {
    const statuses = buildLotStatuses([], [
      event(1, CLOSURE_CATEGORY, 'Lot 20', at(6), at(8)),
      event(2, CLOSURE_CATEGORY, 'Lot 24', at(9, 0, 10), at(17, 0, 10)),
    ], NOW);
    expect(statuses['Lot 20']).toBeUndefined();
    expect(statuses['Lot 24']).toBeUndefined();
  });

  it('applies a multi-lot closure to every listed lot', () => {
    const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20; Lot 24', at(9), at(17))], NOW);
    expect(isLotClosed(statuses['Lot 20'])).toBe(true);
    expect(isLotClosed(statuses['Lot 24'])).toBe(true);
  });

  it('keeps an open-ended closure in effect', () => {
    const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9))], NOW);
    expect(isLotClosed(statuses['Lot 20'])).toBe(true);
    expect(statuses['Lot 20'].closure?.openEnded).toBe(true);
  });

  it('prefers an in-progress closure over one starting later', () => {
    const statuses = buildLotStatuses([], [
      event(1, CLOSURE_CATEGORY, 'Lot 20', at(15), at(17)),
      event(2, CLOSURE_CATEGORY, 'Lot 20', at(9), at(12)),
    ], NOW);
    expect(statuses['Lot 20'].closure?.alert.id).toBe(2);
  });

  it('lists regular events separately from closures', () => {
    const statuses = buildLotStatuses([], [event(1, 'Gameday', 'Lot 20', at(9), at(17))], NOW);
    expect(isLotClosed(statuses['Lot 20'])).toBe(false);
    expect(statuses['Lot 20'].events).toHaveLength(1);
  });

  it('only shows hazards that have not been deactivated', () => {
    const statuses = buildLotStatuses([
      { id: 1, lot_name: 'Lot 20', deactivated_at: null },
      { id: 2, lot_name: 'Lot 20', deactivated_at: '2026-11-08T00:00:00' },
    ], [], NOW);
    expect(statuses['Lot 20'].hazards.map((h) => h.id)).toEqual([1]);
  });
});

describe('getLotTakeover', () => {
  it('labels a closed lot "Closed" until further notice when open-ended', () => {
    const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9))], NOW);
    expect(getLotTakeover(statuses['Lot 20'])).toMatchObject({ label: 'Closed', until: 'Until further notice' });
  });

  it('does not take over a lot that only has hazards', () => {
    const statuses = buildLotStatuses([{ id: 1, lot_name: 'Lot 20' }], [], NOW);
    expect(getLotTakeover(statuses['Lot 20'])).toBeNull();
  });
});

describe('isLotNameClosed', () => {
  const statuses = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9), at(17))], NOW);
  const lots = [
    { name: 'Lot 20', lotStatus: statuses['Lot 20'] },
    { name: 'Lot 24', lotStatus: undefined },
  ];

  it('matches lot names case-insensitively', () => {
    expect(isLotNameClosed(lots, 'lot 20')).toBe(true);
  });

  it('is false for open lots and missing names', () => {
    expect(isLotNameClosed(lots, 'Lot 24')).toBe(false);
    expect(isLotNameClosed(lots, null)).toBe(false);
  });
});

describe('findEventConflicts', () => {
  const closure = event(1, CLOSURE_CATEGORY, 'Lot 20; Lot 24', at(9), at(17));
  const concert = event(2, 'Concert', 'Lot 20', at(18), at(22));

  it('flags a regular event that overlaps a closure on a shared lot', () => {
    const conflicts = findEventConflicts([closure], {
      category: 'Gameday', lotNames: ['Lot 24'], start: at(16), end: at(20),
    });
    expect(conflicts.map((c) => c.alert.id)).toEqual([1]);
    expect(conflicts[0].lotNames).toEqual(['Lot 24']);
  });

  it('does not flag back-to-back events', () => {
    expect(findEventConflicts([closure], {
      category: 'Gameday', lotNames: ['Lot 20'], start: at(17), end: at(20),
    })).toEqual([]);
  });

  it('does not flag events on other lots', () => {
    expect(findEventConflicts([closure], {
      category: 'Gameday', lotNames: ['Lot 50'], start: at(10), end: at(12),
    })).toEqual([]);
  });

  it('ignores other regular events when saving a regular event', () => {
    expect(findEventConflicts([concert], {
      category: 'Gameday', lotNames: ['Lot 20'], start: at(19), end: at(21),
    })).toEqual([]);
  });

  it('flags every overlapping event when saving a closure, including open-ended ones', () => {
    const conflicts = findEventConflicts([closure, concert], {
      category: CLOSURE_CATEGORY, lotNames: ['Lot 20'], start: at(20), end: null,
    });
    expect(conflicts.map((c) => c.alert.id)).toEqual([2]);
  });

  it('leaves out the event being edited', () => {
    expect(findEventConflicts([closure], {
      category: CLOSURE_CATEGORY, lotNames: ['Lot 20'], start: at(9), end: at(17), excludeId: 1,
    })).toEqual([]);
  });

  it('matches lot names case-insensitively', () => {
    expect(findEventConflicts([closure], {
      category: 'Gameday', lotNames: ['lot 20'], start: at(10), end: at(11),
    })).toHaveLength(1);
  });
});

describe('findActiveClosures', () => {
  const events = [
    event(1, CLOSURE_CATEGORY, 'Lot 20', at(9), at(17)),
    event(2, 'Closure', 'Lot 24', at(9)),
    event(3, CLOSURE_CATEGORY, 'Lot 50', at(15), at(17)),
    event(4, 'Gameday', 'Lot 60', at(9), at(17)),
  ];

  it('finds closures in effect right now, including the legacy category', () => {
    expect(findActiveClosures(events, 'Lot 20', NOW).map((e) => e.id)).toEqual([1]);
    expect(findActiveClosures(events, 'Lot 24', NOW).map((e) => e.id)).toEqual([2]);
  });

  it('ignores future closures and non-closure events', () => {
    expect(findActiveClosures(events, 'Lot 50', NOW)).toEqual([]);
    expect(findActiveClosures(events, 'Lot 60', NOW)).toEqual([]);
  });

  it('returns nothing without a lot', () => {
    expect(findActiveClosures(events, null, NOW)).toEqual([]);
  });
});
