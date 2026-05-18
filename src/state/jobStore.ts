import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppDir, getJobsFile, getLogsDir } from "./paths.js";
import { JobRecord, JobsFile, JobsFileSchema } from "./schema.js";

async function ensureDirs(): Promise<void> {
  await fs.mkdir(getAppDir(), { recursive: true });
  await fs.mkdir(getLogsDir(), { recursive: true });
}

async function readFile(): Promise<JobsFile> {
  const file = getJobsFile();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return JobsFileSchema.parse(parsed);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return { version: 1, jobs: [] };
    }
    throw err;
  }
}

async function atomicWrite(data: JobsFile): Promise<void> {
  await ensureDirs();
  const file = getJobsFile();
  const tmp = path.join(
    path.dirname(file),
    `.jobs.${process.pid}.${Date.now()}.tmp`,
  );
  const payload = JSON.stringify(data, null, 2);
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(payload, "utf8");
    try {
      await handle.sync();
    } catch {
      /* sync best-effort */
    }
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, file);
}

export async function listJobs(): Promise<JobRecord[]> {
  const f = await readFile();
  return f.jobs;
}

export async function getJob(id: string): Promise<JobRecord | undefined> {
  const jobs = await listJobs();
  return jobs.find((j) => j.id === id);
}

export async function createJob(job: JobRecord): Promise<void> {
  const f = await readFile();
  if (f.jobs.some((j) => j.id === job.id)) {
    throw new Error(`Job ${job.id} already exists`);
  }
  f.jobs.push(job);
  await atomicWrite(f);
}

export type JobUpdater = (job: JobRecord) => JobRecord;

export async function updateJob(
  id: string,
  updater: JobUpdater,
): Promise<JobRecord> {
  const f = await readFile();
  const idx = f.jobs.findIndex((j) => j.id === id);
  if (idx === -1) {
    throw new Error(`Job ${id} not found`);
  }
  const next = updater({ ...f.jobs[idx] });
  f.jobs[idx] = next;
  await atomicWrite(f);
  return next;
}

export async function listPending(): Promise<JobRecord[]> {
  const jobs = await listJobs();
  return jobs.filter((j) => j.status === "pending");
}
