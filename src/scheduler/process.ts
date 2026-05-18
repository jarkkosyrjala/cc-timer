import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate the worker script regardless of whether we're running from src (tsx)
 * or dist (compiled). The CC_TIMER_WORKER env var lets tests inject a script.
 */
export function resolveWorkerScript(): string {
  if (process.env.CC_TIMER_WORKER) return process.env.CC_TIMER_WORKER;
  return path.resolve(__dirname, "worker.js");
}

export interface StartWorkerOptions {
  jobId: string;
  schedulerToken: string;
  logFile: string;
  workerScript?: string;
  /** Override the node executable used to run the worker (tests). */
  nodeBin?: string;
}

export interface StartWorkerResult {
  pid: number;
}

export async function startWorker(
  opts: StartWorkerOptions,
): Promise<StartWorkerResult> {
  const workerScript = opts.workerScript ?? resolveWorkerScript();
  await fs.mkdir(path.dirname(opts.logFile), { recursive: true });
  const logHandle = await fs.open(opts.logFile, "a");
  try {
    const child = spawn(
      opts.nodeBin ?? process.execPath,
      [workerScript, opts.jobId, opts.schedulerToken],
      {
        detached: true,
        stdio: ["ignore", logHandle.fd, logHandle.fd],
        windowsHide: true,
        env: { ...process.env },
      },
    );
    if (!child.pid) {
      throw new Error("Failed to start scheduler worker (no PID)");
    }
    child.unref();
    return { pid: child.pid };
  } finally {
    await logHandle.close();
  }
}

/** Best-effort check whether a PID is alive on the current host. */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EPERM") return true;
    return false;
  }
}

/** Send SIGTERM, escalate to SIGKILL after a grace period. */
export async function terminateProcess(
  pid: number,
  graceMs = 1500,
): Promise<boolean> {
  if (!isProcessAlive(pid)) return false;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }
  const start = Date.now();
  while (Date.now() - start < graceMs) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
  return !isProcessAlive(pid);
}
