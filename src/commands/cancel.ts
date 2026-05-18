import { CcTimerError } from "../errors.js";
import { isProcessAlive, terminateProcess } from "../scheduler/process.js";
import { getJob, updateJob } from "../state/jobStore.js";

export interface CancelOptions {
  id: string;
  json: boolean;
}

export interface CancelResult {
  output: string;
  status:
    | "canceled"
    | "already-dispatched"
    | "already-canceled"
    | "already-failed";
}

export async function runCancel(opts: CancelOptions): Promise<CancelResult> {
  const job = await getJob(opts.id);
  if (!job) {
    throw new CcTimerError(`[Error] Unknown job id "${opts.id}".`);
  }

  if (job.status === "dispatched") {
    const msg = `[Info] Job ${job.id} already dispatched. Any created Claude agents must be managed separately.`;
    return {
      output: opts.json
        ? JSON.stringify(
            { id: job.id, status: job.status, action: "noop" },
            null,
            2,
          )
        : msg,
      status: "already-dispatched",
    };
  }
  if (job.status === "canceled") {
    return {
      output: opts.json
        ? JSON.stringify(
            { id: job.id, status: job.status, action: "noop" },
            null,
            2,
          )
        : `[Info] Job ${job.id} was already canceled.`,
      status: "already-canceled",
    };
  }
  if (job.status === "failed") {
    return {
      output: opts.json
        ? JSON.stringify(
            { id: job.id, status: job.status, action: "noop" },
            null,
            2,
          )
        : `[Info] Job ${job.id} already failed; nothing to cancel.`,
      status: "already-failed",
    };
  }

  // Mark canceled before attempting termination so a racing wake-up sees the new state.
  const updated = await updateJob(job.id, (j) => ({
    ...j,
    status: "canceled",
    completedAt: new Date().toISOString(),
  }));

  if (updated.schedulerPid && isProcessAlive(updated.schedulerPid)) {
    await terminateProcess(updated.schedulerPid);
  }

  const msg = `[Success] Canceled job ${job.id}.`;
  return {
    output: opts.json
      ? JSON.stringify(
          { id: job.id, status: "canceled", action: "canceled" },
          null,
          2,
        )
      : msg,
    status: "canceled",
  };
}
