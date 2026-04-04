/** Compute the UTC offset string (±HH:MM) for a date/time in America/New_York. */
export function nyOffset(isoDate: string, time: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });

  function offsetAtUtcMs(utcMs: number): number {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
    );
    const zonedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    return Math.round((zonedAsUtc - utcMs) / 60000);
  }

  // Treat the local wall-clock time as UTC, then refine to find the actual offset.
  const localAsUtc = Date.UTC(y, m - 1, d, h, min);
  const offsetMin1 = offsetAtUtcMs(localAsUtc);
  const resolvedUtc = localAsUtc - offsetMin1 * 60_000;
  const offsetMin = offsetAtUtcMs(resolvedUtc);

  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
