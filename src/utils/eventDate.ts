const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
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
  if (isNaN(day) || day < 1 || day > 31) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let eventDate = new Date(now.getFullYear(), monthIndex, day);

  const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
  if (eventDate.getTime() - today.getTime() > sixMonthsMs) {
    eventDate = new Date(now.getFullYear() - 1, monthIndex, day);
  }

  return eventDate < today;
}

/**
 * Extract the month abbreviation from a date string like "Feb 22".
 * Returns "" for "TBA" or unparseable strings.
 */
export function parseMonth(dateStr: string): string {
  const parts = dateStr.trim().split(/\s+/);
  return parts.length >= 2 && parts[0] in MONTHS ? parts[0] : "";
}

/**
 * Extract the day number from a date string like "Feb 22".
 * Returns "" for "TBA" or unparseable strings.
 */
export function parseDay(dateStr: string): string {
  const parts = dateStr.trim().split(/\s+/);
  return parts.length >= 2 && !isNaN(parseInt(parts[1], 10)) ? parts[1] : "";
}

export const ON_SALE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
};

export function formatOnSaleDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", ON_SALE_DATE_FORMAT);
}

/**
 * Returns true if an event should be shown as upcoming.
 * Uses isoDate for dated events (reliable ISO comparison) and passes TBA events
 * (no isoDate) through as upcoming. Hidden events always return false.
 */
export function isUpcomingByIso(
  event: { isoDate?: string; hidden?: boolean },
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (event.hidden) return false;
  if (!event.isoDate) return true;
  return event.isoDate >= today;
}

/**
 * Formats a 24-hour "HH:MM" string for display.
 * "18:00" → "6 PM", "19:30" → "7:30 PM", "00:00" → "12 AM".
 */
export function formatDisplayTime(hhmm: string): string {
  const parts = hhmm.split(":");
  const h = parseInt(parts[0] ?? "", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0
    ? `${hour} ${period}`
    : `${hour}:${String(m).padStart(2, "0")} ${period}`;
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
