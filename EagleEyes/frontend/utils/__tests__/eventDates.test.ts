import {
  parseUTC,
  getEventRange,
  isAllDayRange,
  startOfDay,
  endOfDay,
  classifyNote,
  stripScheduleFromDescription,
  toLocalDateString,
  isoToLocalDate,
  formatDate,
  OPEN_ENDED_END,
} from '../eventDates';

describe('parseUTC', () => {
  it('reads backend timestamps (no zone suffix) as UTC', () => {
    expect(parseUTC('2026-11-09T15:00:00').toISOString()).toBe('2026-11-09T15:00:00.000Z');
  });

  it('keeps an explicit zone', () => {
    expect(parseUTC('2026-11-09T15:00:00Z').toISOString()).toBe('2026-11-09T15:00:00.000Z');
    expect(parseUTC('2026-11-09T09:00:00-06:00').toISOString()).toBe('2026-11-09T15:00:00.000Z');
  });
});

describe('getEventRange', () => {
  it('uses event_start and event_end', () => {
    const range = getEventRange({ event_start: '2026-11-09T15:00:00', event_end: '2026-11-09T18:00:00' });
    expect(range.openEnded).toBe(false);
    expect(range.end.getTime() - range.start.getTime()).toBe(3 * 60 * 60 * 1000);
  });

  it('treats a missing end as open-ended', () => {
    const range = getEventRange({ event_start: '2026-11-09T15:00:00', event_end: null });
    expect(range.openEnded).toBe(true);
    expect(range.end).toBe(OPEN_ENDED_END);
  });

  it('falls back to created_at for old events', () => {
    const range = getEventRange({ created_at: '2026-11-09T15:00:00' });
    expect(range.start).toEqual(range.end);
    expect(range.openEnded).toBe(false);
  });
});

describe('isAllDayRange', () => {
  const day = new Date(2026, 10, 9, 13, 0);

  it('recognizes midnight to 11:59 PM, with or without an end', () => {
    expect(isAllDayRange({ start: startOfDay(day), end: endOfDay(day), openEnded: false })).toBe(true);
    expect(isAllDayRange({ start: startOfDay(day), end: OPEN_ENDED_END, openEnded: true })).toBe(true);
  });

  it('rejects ranges with specific times', () => {
    expect(isAllDayRange({ start: day, end: endOfDay(day), openEnded: false })).toBe(false);
  });
});

describe('classifyNote', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-09T18:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('is pending until an admin acknowledges it', () => {
    expect(classifyNote({ event_start: '2026-11-09T12:00:00', event_end: '2026-11-10T12:00:00' })).toBe('pending');
  });

  it('is active once acknowledged', () => {
    expect(classifyNote({
      event_start: '2026-11-09T12:00:00', event_end: '2026-11-10T12:00:00', acknowledged_at: '2026-11-09T13:00:00',
    })).toBe('active');
  });

  it('is expired once its window has passed, acknowledged or not', () => {
    expect(classifyNote({
      event_start: '2026-11-08T12:00:00', event_end: '2026-11-09T12:00:00', acknowledged_at: '2026-11-08T13:00:00',
    })).toBe('expired');
  });
});

describe('stripScheduleFromDescription', () => {
  it('removes the old schedule line', () => {
    expect(stripScheduleFromDescription('When: Nov 9, 2026 (All day)\n\nBring a jacket')).toBe('Bring a jacket');
    expect(stripScheduleFromDescription('When: Nov 9, 2026 (All day)')).toBe('');
  });

  it('leaves other descriptions alone', () => {
    expect(stripScheduleFromDescription('Bring a jacket')).toBe('Bring a jacket');
  });
});

describe('date strings', () => {
  it('round-trips a picked calendar day without shifting it', () => {
    expect(toLocalDateString(isoToLocalDate('2026-11-09'))).toBe('2026-11-09');
  });

  it('formats dates for display', () => {
    expect(formatDate('2026-11-09')).toBe('Nov 9, 2026');
    expect(formatDate('')).toBe('');
  });
});
