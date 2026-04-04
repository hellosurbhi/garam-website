/** Compute the UTC offset string (±HH:MM) for a date/time in America/New_York. */
export function nyOffset(isoDate: string, time: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, h, min);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value])
  );
  const nyUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const offsetMin = Math.round((nyUtc - utcGuess) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
