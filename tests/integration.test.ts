import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCancel } from "../src/commands/cancel.js";
import { ERROR_PRELUDE_LINES } from "../src/errors.js";
import { runSchedule } from "../src/commands/schedule.js";
import { getJob, listJobs } from "../src/state/jobStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tmpDir: string;
let fakeClaude: string;
let recordFile: string;

async function waitUntil(
  cond: () => Promise<boolean>,
  timeoutMs = 10_000,
  intervalMs = 50,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-int-"));
  process.env.CC_TIMER_HOME = tmpDir;

  recordFile = path.join(tmpDir, "invocations.log");

  // Fake claude: writes its full argv to recordFile.
  fakeClaude = path.join(
    tmpDir,
    process.platform === "win32" ? "fake-claude.cmd" : "fake-claude",
  );
  if (process.platform === "win32") {
    await fs.writeFile(
      fakeClaude,
      `@echo off\r\necho %* >> "${recordFile}"\r\n`,
      "utf8",
    );
  } else {
    const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(recordFile)}, JSON.stringify(args) + '\\n');
process.exit(0);
`;
    await fs.writeFile(fakeClaude, script, "utf8");
    await fs.chmod(fakeClaude, 0o755);
  }

  // Point CC_TIMER_WORKER at the built worker if available, else compile on demand.
  // Easiest: build now (idempotent) so the integration test can spawn a real worker.
  spawnSync("npx", ["tsc"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "ignore",
  });
  process.env.CC_TIMER_WORKER = path.resolve(
    __dirname,
    "..",
    "dist",
    "scheduler",
    "worker.js",
  );
});

afterEach(async () => {
  delete process.env.CC_TIMER_HOME;
  delete process.env.CC_TIMER_WORKER;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("integration", () => {
  it("prefixes CLI failures with a random parody prelude", () => {
    const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");
    const res = spawnSync("node", [cliPath], {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      encoding: "utf8",
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[Error] Missing delay. Provide a delay like "45m" or use --at "17:30".');
    expect(ERROR_PRELUDE_LINES.some((line) => res.stderr.includes(line))).toBe(true);
  });

  it("dispatches tasks after a short delay (sequential, in order)", async () => {
    const res = await runSchedule({
      delay: "2s",
      positional: ["alpha", "beta"],
      taskFlags: [],
      dryRun: false,
      claudeBin: fakeClaude,
      cwd: tmpDir,
      json: true,
    });
    const id = JSON.parse(res.output).id as string;

    const done = await waitUntil(async () => {
      const job = await getJob(id);
      return Boolean(
        job && (job.status === "dispatched" || job.status === "failed"),
      );
    }, 15_000);
    expect(done).toBe(true);

    const job = await getJob(id);
    expect(job?.status).toBe("dispatched");

    const recorded = (await fs.readFile(recordFile, "utf8")).trim().split("\n");
    expect(recorded).toHaveLength(2);
    expect(JSON.parse(recorded[0])).toEqual(["--bg", "alpha"]);
    expect(JSON.parse(recorded[1])).toEqual(["--bg", "beta"]);
  }, 20_000);

  it("forwards passthrough claudeArgs to the spawned claude process", async () => {
    const res = await runSchedule({
      delay: "2s",
      positional: ["alpha"],
      taskFlags: [],
      claudeArgs: ["--model", "opus", "--verbose"],
      dryRun: false,
      claudeBin: fakeClaude,
      cwd: tmpDir,
      json: true,
    });
    const id = JSON.parse(res.output).id as string;

    const done = await waitUntil(async () => {
      const job = await getJob(id);
      return Boolean(
        job && (job.status === "dispatched" || job.status === "failed"),
      );
    }, 15_000);
    expect(done).toBe(true);

    const recorded = (await fs.readFile(recordFile, "utf8")).trim().split("\n");
    expect(recorded).toHaveLength(1);
    expect(JSON.parse(recorded[0])).toEqual([
      "--model",
      "opus",
      "--verbose",
      "--bg",
      "alpha",
    ]);
  }, 20_000);

  it("canceled job does not dispatch", async () => {
    const res = await runSchedule({
      delay: "3s",
      positional: ["should-not-run"],
      taskFlags: [],
      dryRun: false,
      claudeBin: fakeClaude,
      cwd: tmpDir,
      json: true,
    });
    const id = JSON.parse(res.output).id as string;

    // Give the worker a moment to stamp its PID, then cancel.
    await waitUntil(async () => {
      const job = await getJob(id);
      return Boolean(job && job.schedulerPid);
    }, 5_000);

    const cancelRes = await runCancel({ id, json: false });
    expect(cancelRes.status).toBe("canceled");

    // Wait past the dispatch time.
    await new Promise((r) => setTimeout(r, 4_000));

    const job = await getJob(id);
    expect(job?.status).toBe("canceled");

    // Fake claude should never have been invoked.
    const exists = await fs
      .stat(recordFile)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      const content = await fs.readFile(recordFile, "utf8");
      expect(content.trim()).toBe("");
    }
  }, 15_000);

  it("dry run creates no job and invokes no fake claude", async () => {
    await runSchedule({
      delay: "1s",
      positional: ["nope"],
      taskFlags: [],
      dryRun: true,
      claudeBin: fakeClaude,
      cwd: tmpDir,
      json: false,
    });
    expect(await listJobs()).toEqual([]);
    const exists = await fs
      .stat(recordFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});
