/**
 * Detached worker entrypoint. Sleeps until a job's dueAt, then dispatches.
 * Invoked by `startWorker` as: node worker.js <jobId> <schedulerToken>
 */
import { dispatchJob } from "./dispatch.js";
import { formatWorkerError } from "../errors.js";
import { getJob, updateJob } from "../state/jobStore.js";

const MAX_TIMEOUT_MS = 2_147_000_000; // just under setTimeout's signed-32-bit cap

function sleepChunked(
  totalMs: number,
  isCanceled: () => Promise<boolean>,
): Promise<void> {
  return new Promise((resolve) => {
    let remaining = Math.max(0, totalMs);
    const tick = async () => {
      if (remaining <= 0) return resolve();
      if (await isCanceled()) return resolve();
      const slice = Math.min(remaining, MAX_TIMEOUT_MS, 60_000);
      remaining -= slice;
      setTimeout(tick, slice);
    };
    void tick();
  });
}

async function main(): Promise<void> {
  const [, , jobId, token] = process.argv;
  if (!jobId || !token) {
    process.stderr.write(`${formatWorkerError("worker: missing jobId or token")}\n`);
    process.exit(2);
  }

  const initial = await getJob(jobId);
  if (!initial) {
    process.stderr.write(`${formatWorkerError(`worker: job ${jobId} not found`)}\n`);
    process.exit(2);
  }
  if (initial.schedulerToken !== token) {
    process.stderr.write(
      `${formatWorkerError(`worker: token mismatch for ${jobId}`)}\n`,
    );
    process.exit(2);
  }

  // Stamp the PID into the job so cancel can find us.
  await updateJob(jobId, (j) => ({ ...j, schedulerPid: process.pid }));

  const dueMs = new Date(initial.dueAt).getTime() - Date.now();
  await sleepChunked(dueMs, async () => {
    const cur = await getJob(jobId);
    return !cur || cur.status !== "pending";
  });

  const current = await getJob(jobId);
  if (!current || current.status !== "pending") {
    process.exit(0);
  }

  try {
    const results = await dispatchJob(current);
    const errors = results.filter(
      (r) => r.error || (r.exitCode !== 0 && r.exitCode !== null),
    );
    await updateJob(jobId, (j) => ({
      ...j,
      status: errors.length ? "failed" : "dispatched",
      dispatchedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: errors.length
        ? errors
            .map(
              (e) =>
                e.error ??
                `exit ${e.exitCode}${e.signal ? ` signal ${e.signal}` : ""}`,
            )
            .join("; ")
        : undefined,
    }));
  } catch (err) {
    await updateJob(jobId, (j) => ({
      ...j,
      status: "failed",
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }));
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `${formatWorkerError(
      `worker: ${err instanceof Error ? err.message : String(err)}`,
    )}\n`,
  );
  process.exit(1);
});
