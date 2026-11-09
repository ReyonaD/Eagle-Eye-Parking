import {
  buildLotStatuses,
  getLotStatusIcons,
  getLotStatusItems,
  applyLotStatus,
  findEventConflicts,
  describeEventConflicts,
  CLOSURE_CATEGORY,
  CLOSED_FILL_COLOR,
} from '../lotStatus';
import { getEventVisual, getHazardVisual } from '../alertVisuals';

const event = (id: number, category: string, lots: string, start: Date, end: Date | null = null) => ({
  id,
  title: `EVENT ${id}`,
  category,
  lot_name: lots,
  event_start: start.toISOString(),
  event_end: end ? end.toISOString() : null,
});
const at = (hour: number) => new Date(2026, 10, 9, hour);
const NOW = at(10);

describe('getLotStatusIcons', () => {
  it('orders closure, then events, then hazards, one icon per category', () => {
    const status = buildLotStatuses(
      [{ id: 1, lot_name: 'Lot 20', category: 'snow' }, { id: 2, lot_name: 'Lot 20', category: 'snow' }],
      [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9), at(17)), event(2, 'Gameday', 'Lot 20', at(9), at(17))],
      NOW,
    )['Lot 20'];
    expect(getLotStatusIcons(status)).toEqual([
      getEventVisual(CLOSURE_CATEGORY),
      getEventVisual('Gameday'),
      getHazardVisual('snow'),
    ]);
  });

  it('caps the number of icons', () => {
    const status = buildLotStatuses(
      [{ id: 1, lot_name: 'Lot 20', category: 'snow' }, { id: 2, lot_name: 'Lot 20', category: 'flood' }],
      [event(1, 'Gameday', 'Lot 20', at(9), at(17)), event(2, 'Concert', 'Lot 20', at(9), at(17))],
      NOW,
    )['Lot 20'];
    expect(getLotStatusIcons(status, 2)).toHaveLength(2);
    expect(getLotStatusIcons(undefined)).toEqual([]);
  });
});

describe('getLotStatusItems', () => {
  it('names closures/events by kind and hazards by their title', () => {
    const status = buildLotStatuses(
      [{ id: 7, lot_name: 'Lot 20', category: 'snow', title: 'ICY RAMP', created_at: '2026-11-09T15:00:00' }],
      [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9))],
      NOW,
    )['Lot 20'];
    const items = getLotStatusItems(status);
    expect(items.map((i) => i.title)).toEqual([CLOSURE_CATEGORY, 'ICY RAMP']);
    expect(items[0].detail).toBe('Until further notice');
    expect(items[1].detail).toMatch(/^Snow · reported /);
  });
});

describe('applyLotStatus', () => {
  const lot = { name: 'Lot 20', status: 'Available', fillColor: '#2ECC71', strokeColor: '#27AE60' };

  it('grays out a closed lot', () => {
    const status = buildLotStatuses([], [event(1, CLOSURE_CATEGORY, 'Lot 20', at(9), at(17))], NOW)['Lot 20'];
    expect(applyLotStatus(lot, status)).toMatchObject({ status: 'Closed', fillColor: CLOSED_FILL_COLOR });
  });

  it('outlines a lot with an event in progress but keeps its occupancy color', () => {
    const status = buildLotStatuses([], [event(1, 'Gameday', 'Lot 20', at(9), at(17))], NOW)['Lot 20'];
    const styled = applyLotStatus(lot, status);
    expect(styled.fillColor).toBe('#2ECC71');
    expect(styled.strokeColor).toBe(getEventVisual('Gameday').iconColor);
  });

  it('leaves a lot alone without a status', () => {
    expect(applyLotStatus(lot, undefined)).toBe(lot);
  });
});

describe('describeEventConflicts', () => {
  it('lists each conflict with its lots and title', () => {
    const conflicts = findEventConflicts([event(1, CLOSURE_CATEGORY, 'Lot 20', at(9))], {
      category: 'Gameday', lotNames: ['Lot 20'], start: at(12), end: at(14),
    });
    const text = describeEventConflicts(conflicts);
    expect(text).toMatch(/^• Lot 20 – EVENT 1 \(/);
    expect(text).toMatch(/no end date\)$/);
  });
});
