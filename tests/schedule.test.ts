import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSchedule } from "../src/commands/schedule.js";
import { listJobs } from "../src/state/jobStore.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-sched-"));
  process.env.CC_TIMER_HOME = tmpDir;
  // Worker script is not needed for dry-run, and a no-op script is fine for jobs we never wait on.
  const noopWorker = path.join(tmpDir, "noop-worker.cjs");
  await fs.writeFile(noopWorker, "// no-op worker\nprocess.exit(0);\n");
  process.env.CC_TIMER_WORKER = noopWorker;
});

afterEach(async () => {
  delete process.env.CC_TIMER_HOME;
  delete process.env.CC_TIMER_WORKER;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("runSchedule", () => {
  it("dry-run prints plan and creates no job", async () => {
    const res = await runSchedule({
      delay: "45m",
      positional: ["task one"],
      taskFlags: [],
      dryRun: true,
      claudeBin: "claude",
      cwd: tmpDir,
      json: false,
    });
    expect(res.dryRun).toBe(true);
    expect(res.output).toMatch(
      /\[Dry run\] Would schedule 1 task to run in 45 minutes/,
    );
    expect(res.output).toMatch(/claude --bg "task one"/);
    expect(await listJobs()).toEqual([]);
  });

  it('creates a pending job for "2h" with three tasks', async () => {
    const res = await runSchedule({
      delay: "2h",
      positional: ["a", "b", "c"],
      taskFlags: [],
      dryRun: false,
      claudeBin: "claude",
      cwd: tmpDir,
      json: true,
    });
    expect(res.dryRun).toBe(false);
    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].tasks).toEqual(["a", "b", "c"]);
    expect(jobs[0].status).toBe("pending");
    expect(jobs[0].delaySeconds).toBe(7200);
    const parsed = JSON.parse(res.output);
    expect(parsed.tasks).toEqual(["a", "b", "c"]);
  });

  it("schedules an exact local time with --at", async () => {
    const now = new Date(2026, 4, 18, 10, 0, 0);
    const res = await runSchedule({
      at: "17:30",
      positional: ["task"],
      taskFlags: [],
      dryRun: true,
      claudeBin: "claude",
      cwd: tmpDir,
      json: true,
      now,
    });
    const parsed = JSON.parse(res.output);
    const due = new Date(parsed.dueAt);
    expect(due.getHours()).toBe(17);
    expect(due.getMinutes()).toBe(30);
    expect(due.getDate()).toBe(18);
  });

  it("errors when no tasks are provided", async () => {
    await expect(
      runSchedule({
        delay: "1h",
        positional: [],
        taskFlags: [],
        dryRun: true,
        claudeBin: "claude",
        cwd: tmpDir,
        json: false,
      }),
    ).rejects.toThrow(/No tasks provided/);
  });

  it("errors when both delay and --at are given", async () => {
    await expect(
      runSchedule({
        delay: "1h",
        at: "17:30",
        positional: ["t"],
        taskFlags: [],
        dryRun: true,
        claudeBin: "claude",
        cwd: tmpDir,
        json: false,
      }),
    ).rejects.toThrow(/either a positional delay or --at/);
  });

  it("forwards --claudeArgs in dry-run preview and stores them on the job", async () => {
    const dry = await runSchedule({
      delay: "30m",
      positional: ["work"],
      taskFlags: [],
      claudeArgs: ["--model", "opus"],
      dryRun: true,
      claudeBin: "claude",
      cwd: tmpDir,
      json: false,
    });
    expect(dry.output).toMatch(/claude --model opus --bg work/);

    const real = await runSchedule({
      delay: "30m",
      positional: ["work"],
      taskFlags: [],
      claudeArgs: ["--model", "opus"],
      dryRun: false,
      claudeBin: "claude",
      cwd: tmpDir,
      json: true,
    });
    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].claudeArgs).toEqual(["--model", "opus"]);
    expect(JSON.parse(real.output).id).toBe(jobs[0].id);
  });

  it("forwards multi-token args like `--model opus` verbatim", async () => {
    const res = await runSchedule({
      delay: "10m",
      positional: ["work"],
      taskFlags: [],
      claudeArgs: ["--model", "opus", "--verbose"],
      dryRun: true,
      claudeBin: "claude",
      cwd: tmpDir,
      json: false,
    });
    expect(res.output).toMatch(/claude --model opus --verbose --bg work/);
  });

  it("rejects reserved --bg in claudeArgs", async () => {
    await expect(
      runSchedule({
        delay: "10m",
        positional: ["work"],
        taskFlags: [],
        claudeArgs: ["--bg"],
        dryRun: true,
        claudeBin: "claude",
        cwd: tmpDir,
        json: false,
      }),
    ).rejects.toThrow(/Cannot forward --bg/);
  });

  it("rejects --bg=val form in claudeArgs", async () => {
    await expect(
      runSchedule({
        delay: "10m",
        positional: ["work"],
        taskFlags: [],
        claudeArgs: ["--bg=true"],
        dryRun: true,
        claudeBin: "claude",
        cwd: tmpDir,
        json: false,
      }),
    ).rejects.toThrow(/Cannot forward --bg/);
  });

  it("combines sources from --file", async () => {
    const filePath = path.join(tmpDir, "tasks.txt");
    await fs.writeFile(filePath, "f1\nf2\n");
    const res = await runSchedule({
      delay: "1h",
      positional: ["p1"],
      taskFlags: ["t1"],
      file: filePath,
      dryRun: true,
      claudeBin: "claude",
      cwd: tmpDir,
      json: true,
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.tasks).toEqual(["p1", "t1", "f1", "f2"]);
  });
});
