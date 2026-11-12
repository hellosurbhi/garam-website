/** Compute the UTC offset string (±HH:MM) for a local date/time in an IANA zone. */
export function offsetForZone(
  isoDate: string,
  time: string,
  timeZone: string,
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function offsetAtUtcMs(utcMs: number): number {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const zonedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((zonedAsUtc - utcMs) / 60000);
  }

  // Treat the local wall-clock time as UTC, then refine to find the actual offset.
  const localAsUtc = Date.UTC(y, m - 1, d, h, min);
  // WHY test the offsets either side of the day: in the hour that repeats
  // at fall back both are correct, and refining from localAsUtc alone
  // picked the first 01:30 in New York but the second in London, so the
  // same rule meant different things by zone. RFC 5545 3.3.5 says a
  // repeated local time means its first occurrence: the larger offset.
  const fits = [
    offsetAtUtcMs(localAsUtc - 86_400_000),
    offsetAtUtcMs(localAsUtc + 86_400_000),
  ].filter((o) => offsetAtUtcMs(localAsUtc - o * 60_000) === o);
  // A skipped time fits neither; it keeps the refinement below, and the
  // write tier (src/data/eventsSnapshot.ts) refuses such show times, so
  // none is ever published.
  const offsetMin =
    fits.length > 0
      ? Math.max(...fits)
      : offsetAtUtcMs(localAsUtc - offsetAtUtcMs(localAsUtc) * 60_000);

  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Compute the UTC offset string (±HH:MM) for a date/time in America/New_York. */
export function nyOffset(isoDate: string, time: string): string {
  return offsetForZone(isoDate, time, "America/New_York");
}

/** "YYYY-MM-DDTHH:MM" wall clock in `timeZone` for a UTC instant. */
export function isoToLocal(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** UTC ISO instant for a wall clock in `timeZone`. */
export function localToIso(local: string, timeZone: string): string {
  const [date, time] = local.split("T");
  // WHY UTC when no zone is picked yet: the write tier then reports the
  // missing zone on both fields, so this value is never published.
  const offset = timeZone ? offsetForZone(date, time, timeZone) : "+00:00";
  return new Date(`${date}T${time}:00${offset}`).toISOString();
}

/**
 * True when the clocks skip `local` ("YYYY-MM-DDTHH:MM") in `timeZone` at
 * spring forward. WHY a round trip: a skipped time is the one wall clock
 * that does not come back as itself; a repeated fall back time does, as
 * its first occurrence (offsetForZone).
 */
export function isSkippedLocalTime(local: string, timeZone: string): boolean {
  return isoToLocal(localToIso(local, timeZone), timeZone) !== local;
}
