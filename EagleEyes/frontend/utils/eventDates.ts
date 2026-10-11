//Shared date helpers for anything built on Alert's event_start/event_end
//(campus events, and "notes to admin" since those share the same alert_type='event' rows).

//backend stores timestamps in UTC without a "Z" suffix; append it before
//parsing so comparisons and displayed times use the device's local time
export const parseUTC = (isoString: string) =>
  new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : `${isoString}Z`);

export const toLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDateString = () => toLocalDateString(new Date());

//the date picker hands back "YYYY-MM-DD" (react-native-calendars' dateString);
//parse as local midnight, not UTC, so the chosen calendar day never shifts
export const isoToLocalDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

//"YYYY-MM-DD" -> "Mon D, YYYY"
export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[Number(month) - 1] ?? '';
  return `${m} ${Number(day)}, ${year}`;
};

//stand-in end for an event/note saved with no end date (TBD / permanent /
//until further notice). Far enough out that every "has it ended yet?" check
//treats it as ongoing, but still a 4-digit year so "YYYY-MM-DD" string
//comparisons keep working.
export const OPEN_ENDED_END = new Date(9999, 11, 31, 23, 59, 59);

//events created before event_start/event_end existed only have created_at;
//treat those as a single-day event on their submission date. A row with a
//start but no end was saved with "No end date", so it's open-ended.
export const getEventRange = (eventItem: any): { start: Date; end: Date; openEnded: boolean } => {
  if (eventItem.event_start) {
    const start = parseUTC(eventItem.event_start);
    if (!eventItem.event_end) return { start, end: OPEN_ENDED_END, openEnded: true };
    return { start, end: parseUTC(eventItem.event_end), openEnded: false };
  }
  const createdDay = parseUTC(eventItem.created_at);
  return { start: createdDay, end: createdDay, openEnded: false };
};

//"All day" is stored as local midnight -> 11:59 PM (or midnight with no end)
const isStartOfDay = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
const isEndOfDay = (d: Date) => d.getHours() === 23 && d.getMinutes() === 59;
export const isAllDayRange = (range: { start: Date; end: Date; openEnded: boolean }) =>
  isStartOfDay(range.start) && (range.openEnded || isEndOfDay(range.end));

//sets a local date to the all-day start/end boundary
export const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
export const endOfDay = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 0, 0); return c; };

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

//time-of-day summary for a card: "9:00 AM – 5:00 PM", "All day",
//"9:00 AM – No end date", "All day · No end date"
export const formatEventTimes = (eventItem: any): string => {
  const range = getEventRange(eventItem);
  const { start, end, openEnded } = range;
  if (isAllDayRange(range)) return openEnded ? 'All day · No end date' : 'All day';
  if (openEnded) return `${fmtTime(start)} – No end date`;
  if (start.getTime() === end.getTime()) return fmtTime(start);
  return `${fmtTime(start)} – ${fmtTime(end)}`;
};

//handleSaveEvent folds a "When: ..." schedule line onto the front of the
//description; strip it back off before reusing the text for a new event,
//since that schedule describes the OLD occurrence, not the new one
export const stripScheduleFromDescription = (description: string): string => {
  if (!description.startsWith('When: ')) return description;
  const splitAt = description.indexOf('\n\n');
  return splitAt === -1 ? '' : description.slice(splitAt + 2);
};

export type NoteBucket = 'pending' | 'active' | 'expired';

//a "Note to Admin"'s lane: its commuter-provided timeline (event_start/
//event_end) wins over acknowledgement - once the window has passed it's
//Expired regardless, otherwise it's Active once acknowledged, or still
//waiting on review. Shared by the Notes screen and the admin badge count,
//so both always agree on what counts as "needs review."
export const classifyNote = (note: any): NoteBucket => {
  const { end } = getEventRange(note);
  if (end.getTime() < Date.now()) return 'expired';
  return note.acknowledged_at ? 'active' : 'pending';
};
