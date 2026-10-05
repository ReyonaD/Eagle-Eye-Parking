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

//events created before event_start/event_end existed only have created_at;
//treat those as a single-day event on their submission date
export const getEventRange = (eventItem: any): { start: Date; end: Date } => {
  if (eventItem.event_start) {
    const start = parseUTC(eventItem.event_start);
    const end = eventItem.event_end ? parseUTC(eventItem.event_end) : start;
    return { start, end };
  }
  const createdDay = parseUTC(eventItem.created_at);
  return { start: createdDay, end: createdDay };
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
