import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCancel } from "../src/commands/cancel.js";
import { createJob, getJob, updateJob } from "../src/state/jobStore.js";
import { JobRecord } from "../src/state/schema.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-cancel-"));
  process.env.CC_TIMER_HOME = tmpDir;
});

afterEach(async () => {
  delete process.env.CC_TIMER_HOME;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function fixture(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: "ct_x",
    kind: "new-agent",
    status: "pending",
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 10_000).toISOString(),
    delaySeconds: 10,
    cwd: tmpDir,
    claudeBin: "claude",
    tasks: ["a"],
    schedulerToken: "tok",
    logFile: path.join(tmpDir, "logs", "ct_x.log"),
    ...overrides,
  };
}

describe("runCancel", () => {
  it("cancels a pending job", async () => {
    await createJob(fixture());
    const res = await runCancel({ id: "ct_x", json: false });
    expect(res.status).toBe("canceled");
    expect((await getJob("ct_x"))?.status).toBe("canceled");
  });

  it("reports info for already-dispatched job", async () => {
    await createJob(fixture());
    await updateJob("ct_x", (j) => ({ ...j, status: "dispatched" }));
    const res = await runCancel({ id: "ct_x", json: false });
    expect(res.status).toBe("already-dispatched");
    expect(res.output).toMatch(/already dispatched/);
  });

  it("reports info for already-canceled job", async () => {
    await createJob(fixture({ status: "canceled" }));
    const res = await runCancel({ id: "ct_x", json: false });
    expect(res.status).toBe("already-canceled");
  });

  it("errors for unknown id", async () => {
    await expect(runCancel({ id: "nope", json: false })).rejects.toThrow(
      /Unknown job id/,
    );
  });
});
