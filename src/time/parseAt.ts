import { CcTimerError } from "../errors.js";

export interface ParsedAt {
  dueAt: Date;
  input: string;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i;
const HOUR_ONLY_RE = /^(\d{1,2})(?:\s*(am|pm))?$/i;
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function normalizeHour(raw: string, hour: number, ampm?: string): number {
  if (ampm) {
    if (hour < 1 || hour > 12) {
      throw new CcTimerError(`[Error] Invalid time "${raw}".`);
    }
    if (ampm === "pm" && hour !== 12) return hour + 12;
    if (ampm === "am" && hour === 12) return 0;
    return hour;
  }

  if (hour > 23) {
    throw new CcTimerError(`[Error] Invalid time "${raw}".`);
  }
  return hour;
}

function buildNextOccurrence(
  raw: string,
  now: Date,
  hour: number,
  minute: number,
): ParsedAt {
  if (minute > 59) {
    throw new CcTimerError(`[Error] Invalid time "${raw}".`);
  }

  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0,
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return { dueAt: candidate, input: String(raw).trim() };
}

/**
 * Parse an exact local time string into a future Date.
 * Accepts "HH:mm", "h:mm am/pm", "YYYY-MM-DD HH:mm[:ss]".
 * "HH:mm" resolves to the next future occurrence (today or tomorrow).
 */
export function parseAt(raw: string, now: Date = new Date()): ParsedAt {
  if (raw == null) {
    throw new CcTimerError(
      '[Error] Invalid time "". Try "17:30" or "2026-05-19 09:00".',
    );
  }
  const input = String(raw).trim();
  if (!input) {
    throw new CcTimerError(
      '[Error] Invalid time "". Try "17:30" or "2026-05-19 09:00".',
    );
  }

  const dt = DATETIME_RE.exec(input);
  if (dt) {
    const [, y, mo, d, h, mi, s] = dt;
    const due = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      s ? Number(s) : 0,
      0,
    );
    if (
      isNaN(due.getTime()) ||
      due.getFullYear() !== Number(y) ||
      due.getMonth() !== Number(mo) - 1 ||
      due.getDate() !== Number(d) ||
      due.getHours() !== Number(h) ||
      due.getMinutes() !== Number(mi)
    ) {
      throw new CcTimerError(`[Error] Invalid time "${raw}".`);
    }
    if (due.getTime() <= now.getTime()) {
      throw new CcTimerError(`[Error] Time "${raw}" is in the past.`);
    }
    return { dueAt: due, input };
  }

  const t = TIME_RE.exec(input);
  if (t) {
    const hour = normalizeHour(raw, Number(t[1]), t[3]?.toLowerCase());
    return buildNextOccurrence(raw, now, hour, Number(t[2]));
  }

  const hourOnly = HOUR_ONLY_RE.exec(input);
  if (hourOnly) {
    const hour = normalizeHour(raw, Number(hourOnly[1]), hourOnly[2]?.toLowerCase());
    return buildNextOccurrence(raw, now, hour, 0);
  }

  throw new CcTimerError(
    `[Error] Invalid time "${raw}". Try "17:30", "3pm", or "2026-05-19 09:00".`,
  );
}
