export const CALENDAR_VIEW_KEY = 'studyflow_calendar_view';

export type CalendarView = 'week' | 'month';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (private window, site data blocked)
  }
}

/**
 * Week or Month on the Timetable is a choice about this device (a phone may suit Week, a laptop Month), so it is kept in its own
 * entry, like the theme, and is left alone when someone signs out. Reading or writing never throws: with storage blocked or full the
 * choice simply lasts until the page is closed.
 */
export function readCalendarView(storage: StorageLike | null = browserStorage()): CalendarView {
  try {
    return storage?.getItem(CALENDAR_VIEW_KEY) === 'month' ? 'month' : 'week';
  } catch {
    return 'week';
  }
}

export function saveCalendarView(view: CalendarView, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(CALENDAR_VIEW_KEY, view);
  } catch {
    /* storage unavailable or full: nothing else to do */
  }
}
