import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createJob,
  getJob,
  listJobs,
  listPending,
  updateJob,
} from "../src/state/jobStore.js";
import { getJobsFile } from "../src/state/paths.js";
import { JobRecord } from "../src/state/schema.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-jobstore-"));
  process.env.CC_TIMER_HOME = tmpDir;
});

afterEach(async () => {
  delete process.env.CC_TIMER_HOME;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function fixture(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: "ct_test1",
    kind: "new-agent",
    status: "pending",
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 60_000).toISOString(),
    delaySeconds: 60,
    cwd: tmpDir,
    claudeBin: "claude",
    tasks: ["t1", "t2"],
    schedulerToken: "tok-abc",
    logFile: path.join(tmpDir, "logs", "ct_test1.log"),
    ...overrides,
  };
}

describe("jobStore", () => {
  it("starts empty", async () => {
    expect(await listJobs()).toEqual([]);
    expect(await listPending()).toEqual([]);
  });

  it("creates and retrieves a job", async () => {
    const job = fixture();
    await createJob(job);
    expect(await getJob("ct_test1")).toMatchObject({
      id: "ct_test1",
      status: "pending",
    });
    expect(await listPending()).toHaveLength(1);
  });

  it("rejects duplicate creates", async () => {
    await createJob(fixture());
    await expect(createJob(fixture())).rejects.toThrow(/already exists/);
  });

  it("updates a job", async () => {
    await createJob(fixture());
    const updated = await updateJob("ct_test1", (j) => ({
      ...j,
      status: "canceled",
    }));
    expect(updated.status).toBe("canceled");
    expect(await listPending()).toHaveLength(0);
  });

  it("writes atomically (no .tmp files remain)", async () => {
    await createJob(fixture());
    const dir = path.dirname(getJobsFile());
    const entries = await fs.readdir(dir);
    const tmps = entries.filter(
      (e) => e.startsWith(".jobs.") && e.endsWith(".tmp"),
    );
    expect(tmps).toEqual([]);
  });
});
