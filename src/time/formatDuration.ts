/**
 * Format a duration in seconds as "1d 2h 30m 5s" with up to 2 leading non-zero units.
 * Used in user-facing feedback like "in 2 hours" or "Due In 1h 12m".
 */
export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s === 0) return "0s";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [
    { v: d, u: "d" },
    { v: h, u: "h" },
    { v: m, u: "m" },
    { v: sec, u: "s" },
  ];
  const out: string[] = [];
  let started = false;
  for (const p of parts) {
    if (!started && p.v === 0) continue;
    started = true;
    if (out.length < 2) out.push(`${p.v}${p.u}`);
  }
  return out.join(" ");
}

/**
 * Verbose long form used in success messages, e.g. "2 hours", "1 hour 30 minutes".
 */
export function formatDurationLong(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s === 0) return "0 seconds";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
  if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  if (sec) parts.push(`${sec} ${sec === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

/**
 * Local timestamp formatted as "YYYY-MM-DD HH:mm:ss".
 */
export function formatLocalTimestamp(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
