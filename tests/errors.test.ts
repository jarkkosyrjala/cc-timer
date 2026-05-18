import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ERROR_PRELUDE_LINES,
  formatCliError,
  formatWorkerError,
  getRandomErrorPrelude,
} from "../src/errors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error formatting", () => {
  it("chooses the first prelude when Math.random returns 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomErrorPrelude()).toBe(ERROR_PRELUDE_LINES[0]);
  });

  it("chooses the last prelude when Math.random is near 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(getRandomErrorPrelude()).toBe(
      ERROR_PRELUDE_LINES[ERROR_PRELUDE_LINES.length - 1],
    );
  });

  it("formats CLI errors with a prelude and [Error] label", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(formatCliError(new Error("boom"))).toBe(
      `${ERROR_PRELUDE_LINES[0]}\n[Error] boom`,
    );
  });

  it("preserves an existing [Error] label on CcTimerError-style messages", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(formatCliError(new Error("[Error] already labeled"))).toBe(
      `${ERROR_PRELUDE_LINES[0]}\n[Error] already labeled`,
    );
  });

  it("formats worker errors with a prelude and worker tag", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(formatWorkerError("missing token")).toBe(
      `${ERROR_PRELUDE_LINES[0]}\nworker: missing token`,
    );
  });
});

