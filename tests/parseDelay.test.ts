import { describe, expect, it } from "vitest";
import { parseDelay } from "../src/time/parseDelay.js";

describe("parseDelay", () => {
  it("parses 30s", () => {
    expect(parseDelay("30s")).toMatchObject({ ms: 30_000, seconds: 30 });
  });

  it("parses 30m", () => {
    expect(parseDelay("30m")).toMatchObject({ ms: 30 * 60_000, seconds: 1800 });
  });

  it("parses 1h", () => {
    expect(parseDelay("1h")).toMatchObject({ ms: 3_600_000, seconds: 3600 });
  });

  it("parses 2h55m compound", () => {
    expect(parseDelay("2h55m").seconds).toBe(2 * 3600 + 55 * 60);
  });

  it("parses 1d2h30m compound", () => {
    expect(parseDelay("1d2h30m").seconds).toBe(86400 + 2 * 3600 + 30 * 60);
  });

  it('parses verbose form "2 hours 30 minutes"', () => {
    expect(parseDelay("2 hours 30 minutes").seconds).toBe(9000);
  });

  it('parses "2hr 5min"', () => {
    expect(parseDelay("2hr 5min").seconds).toBe(2 * 3600 + 5 * 60);
  });

  it("rejects empty input", () => {
    expect(() => parseDelay("")).toThrow(/Invalid delay/);
  });

  it("rejects unknown units", () => {
    expect(() => parseDelay("2x")).toThrow(/Invalid delay/);
  });

  it("rejects zero", () => {
    expect(() => parseDelay("0s")).toThrow(/greater than zero/);
  });

  it("rejects duplicate units", () => {
    expect(() => parseDelay("1h 2h")).toThrow(/Duplicate unit/);
  });

  it("rejects garbage between tokens", () => {
    expect(() => parseDelay("2h foo 3m")).toThrow(/Invalid delay/);
  });

  it("preserves input", () => {
    expect(parseDelay(" 2h ").input).toBe("2h");
  });
});
