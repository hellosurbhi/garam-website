const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Returns true if the event date string (e.g. "Feb 22", "Mar 7") is in the past.
 * Returns false for "TBA" or unparseable strings.
 *
 * Handles the no-year ambiguity: if assigning the current year would place
 * the date more than 6 months in the future, we assume it was last year
 * (covers the Dec→Jan wrap-around).
 */
export function isEventPast(dateStr: string): boolean {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length !== 2) return false;

  const monthIndex = MONTHS[parts[0]];
  if (monthIndex === undefined) return false;

  const day = parseInt(parts[1], 10);
  if (isNaN(day)) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let eventDate = new Date(now.getFullYear(), monthIndex, day);

  const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
  if (eventDate.getTime() - today.getTime() > sixMonthsMs) {
    eventDate = new Date(now.getFullYear() - 1, monthIndex, day);
  }

  return eventDate < today;
}

/** Milliseconds until the next midnight. */
export function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return midnight.getTime() - now.getTime();
}
