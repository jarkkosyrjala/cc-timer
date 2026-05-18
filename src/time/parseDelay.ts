import { CcTimerError } from "../errors.js";

export interface ParsedDelay {
  ms: number;
  seconds: number;
  input: string;
}

const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
};

const TOKEN_RE = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;

/**
 * Parse a human-readable relative delay (e.g. "2h", "1d2h30m", "2 hours 5 minutes").
 * Rejects empty input, unknown units, duplicate units, and non-positive durations.
 */
export function parseDelay(raw: string): ParsedDelay {
  if (raw == null) {
    throw new CcTimerError(
      '[Error] Invalid delay "". Try values like "45m", "2h", or "2h55m".',
    );
  }
  const input = String(raw).trim();
  if (!input) {
    throw new CcTimerError(
      '[Error] Invalid delay "". Try values like "45m", "2h", or "2h55m".',
    );
  }

  const tokens: { value: number; unit: string }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(input)) !== null) {
    // Reject content between tokens that isn't whitespace.
    const gap = input.slice(lastIndex, m.index);
    if (gap.trim() !== "") {
      throw new CcTimerError(
        `[Error] Invalid delay "${raw}". Try values like "45m", "2h", or "2h55m".`,
      );
    }
    tokens.push({ value: Number(m[1]), unit: m[2].toLowerCase() });
    lastIndex = m.index + m[0].length;
  }
  // Trailing content must be empty/whitespace.
  if (input.slice(lastIndex).trim() !== "") {
    throw new CcTimerError(
      `[Error] Invalid delay "${raw}". Try values like "45m", "2h", or "2h55m".`,
    );
  }
  if (tokens.length === 0) {
    throw new CcTimerError(
      `[Error] Invalid delay "${raw}". Try values like "45m", "2h", or "2h55m".`,
    );
  }

  const seen = new Set<string>();
  let totalMs = 0;
  for (const tok of tokens) {
    const factor = UNIT_TO_MS[tok.unit];
    if (factor === undefined) {
      throw new CcTimerError(
        `[Error] Invalid delay "${raw}". Unknown unit "${tok.unit}". Try values like "45m", "2h", or "2h55m".`,
      );
    }
    // Canonicalize each unit family to detect duplicates like "1h 2h".
    const family = String(factor);
    if (seen.has(family)) {
      throw new CcTimerError(
        `[Error] Invalid delay "${raw}". Duplicate unit "${tok.unit}".`,
      );
    }
    seen.add(family);
    totalMs += tok.value * factor;
  }

  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    throw new CcTimerError(
      `[Error] Invalid delay "${raw}". Delay must be greater than zero.`,
    );
  }

  return {
    ms: Math.round(totalMs),
    seconds: Math.round(totalMs / 1000),
    input,
  };
}
