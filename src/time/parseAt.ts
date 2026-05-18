import { CcTimerError } from "../errors.js";

export interface ParsedAt {
  dueAt: Date;
  input: string;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i;
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

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
    let hour = Number(t[1]);
    const minute = Number(t[2]);
    const ampm = t[3]?.toLowerCase();
    if (ampm) {
      if (hour < 1 || hour > 12) {
        throw new CcTimerError(`[Error] Invalid time "${raw}".`);
      }
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
    } else if (hour > 23) {
      throw new CcTimerError(`[Error] Invalid time "${raw}".`);
    }
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
    return { dueAt: candidate, input };
  }

  throw new CcTimerError(
    `[Error] Invalid time "${raw}". Try "17:30", "5:30pm", or "2026-05-19 09:00".`,
  );
}
