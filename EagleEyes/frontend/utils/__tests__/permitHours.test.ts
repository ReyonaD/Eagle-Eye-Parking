import {
  formatPermitHours,
  summarizePermitHours,
  isAnyTimePermit,
  buildPermitHoursIndex,
  lookupPermitHours,
  PermitHours,
} from '../permitHours';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const everyDay = (slots: { startTime: string; endTime: string }[]) => DAYS.map((day) => ({ day, timeSlots: slots }));

const anyTime: PermitHours = { name: 'Eagle', dailyTimeSlots: everyDay([{ startTime: '00:00', endTime: '23:59' }]) };
const evening: PermitHours = {
  name: 'Evening',
  dailyTimeSlots: everyDay([
    { startTime: '00:00', endTime: '07:00' },
    { startTime: '15:30', endTime: '23:59' },
  ]),
};

describe('formatPermitHours', () => {
  it('shows an all-day permit as "Any time" daily', () => {
    expect(formatPermitHours(anyTime)).toEqual([{ days: 'Daily', hours: 'Any time' }]);
  });

  it('joins midnight-to-morning and afternoon-to-midnight into one overnight window', () => {
    expect(formatPermitHours(evening)).toEqual([{ days: 'Daily', hours: '3:30 PM – 7:00 AM' }]);
  });

  it('groups consecutive days with the same hours', () => {
    const weekdays: PermitHours = {
      name: 'Night',
      dailyTimeSlots: DAYS.slice(0, 5).map((day) => ({ day, timeSlots: [{ startTime: '17:30', endTime: '23:59' }] })),
    };
    expect(formatPermitHours(weekdays)).toEqual([
      { days: 'Mon–Fri', hours: '5:30 PM – midnight' },
      { days: 'Sat–Sun', hours: 'Not allowed' },
    ]);
  });
});

describe('summarizePermitHours / isAnyTimePermit', () => {
  it('summarizes in one line', () => {
    expect(summarizePermitHours(anyTime)).toBe('Any time');
    expect(summarizePermitHours(evening)).toBe('Daily 3:30 PM – 7:00 AM');
  });

  it('detects permits allowed around the clock', () => {
    expect(isAnyTimePermit(anyTime)).toBe(true);
    expect(isAnyTimePermit(evening)).toBe(false);
  });
});

describe('buildPermitHoursIndex / lookupPermitHours', () => {
  const fs: PermitHours = { name: 'F/S', dailyTimeSlots: anyTime.dailyTimeSlots };
  const a37: PermitHours = { name: 'A37', dailyTimeSlots: evening.dailyTimeSlots };
  const index = buildPermitHoursIndex([fs, a37, { name: 'Empty', dailyTimeSlots: [] }]);

  it('finds a permit by raw name, normalized name, or per-space code', () => {
    expect(lookupPermitHours(index, 'F/S')).toBe(fs);
    expect(lookupPermitHours(index, 'Faculty and Staff')).toBe(fs);
    expect(lookupPermitHours(index, 'A37')).toBe(a37);
  });

  it('skips permits without hours and unknown labels', () => {
    expect(lookupPermitHours(index, 'Empty')).toBeNull();
    expect(lookupPermitHours(index, 'Zip Car')).toBeNull();
    expect(lookupPermitHours(index, null)).toBeNull();
  });
});
