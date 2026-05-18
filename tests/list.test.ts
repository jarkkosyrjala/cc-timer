import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runList } from "../src/commands/list.js";
import { createJob } from "../src/state/jobStore.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-list-"));
  process.env.CC_TIMER_HOME = tmpDir;
});

afterEach(async () => {
  delete process.env.CC_TIMER_HOME;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("runList", () => {
  it("includes a message preview in the default table", async () => {
    await createJob({
      id: "ct_single",
      status: "pending",
      createdAt: "2026-05-18T12:00:00.000Z",
      dueAt: "2026-05-18T13:00:00.000Z",
      delaySeconds: 3600,
      cwd: tmpDir,
      claudeBin: "claude",
      tasks: ["Investigate the auth timeout regression"],
      schedulerToken: "token-single",
      logFile: path.join(tmpDir, "single.log"),
    });
    await createJob({
      id: "ct_multi",
      status: "pending",
      createdAt: "2026-05-18T12:05:00.000Z",
      dueAt: "2026-05-18T13:05:00.000Z",
      delaySeconds: 3900,
      cwd: tmpDir,
      claudeBin: "claude",
      tasks: ["Open the deploy logs", "Check retry metrics"],
      schedulerToken: "token-multi",
      logFile: path.join(tmpDir, "multi.log"),
    });

    const output = await runList({
      verbose: false,
      json: false,
      all: false,
      now: new Date("2026-05-18T12:00:00.000Z"),
    });

    expect(output).toContain("Message");
    expect(output).toContain("Investigate the auth timeout regression");
    expect(output).toContain("Open the deploy logs (+1 more)");
  });

  it("truncates long message previews in the default table", async () => {
    await createJob({
      id: "ct_long",
      status: "pending",
      createdAt: "2026-05-18T12:00:00.000Z",
      dueAt: "2026-05-18T13:00:00.000Z",
      delaySeconds: 3600,
      cwd: tmpDir,
      claudeBin: "claude",
      tasks: [
        "Trace the deeply nested failure path through the job scheduler and summarize each transition",
        "Capture the related stack traces for comparison",
      ],
      schedulerToken: "token-long",
      logFile: path.join(tmpDir, "long.log"),
    });

    const output = await runList({
      verbose: false,
      json: false,
      all: false,
      now: new Date("2026-05-18T12:00:00.000Z"),
    });

    expect(output).toContain(
      "Trace the deeply nested failure path… (+1 more)",
    );
  });
});
