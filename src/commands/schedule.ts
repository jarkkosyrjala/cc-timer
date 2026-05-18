import { nanoid } from "nanoid";
import {
  newAgentCommand,
  previewCommand,
  validateClaudeArgs,
} from "../claude/adapter.js";
import { CcTimerError } from "../errors.js";
import { startWorker } from "../scheduler/process.js";
import { createJob } from "../state/jobStore.js";
import { getJobLogPath } from "../state/paths.js";
import { JobRecord } from "../state/schema.js";
import {
  formatDurationLong,
  formatLocalTimestamp,
} from "../time/formatDuration.js";
import { parseAt } from "../time/parseAt.js";
import { parseDelay } from "../time/parseDelay.js";
import { collectTasks } from "./loadTasks.js";

export interface ScheduleOptions {
  delay?: string;
  at?: string;
  positional: string[];
  taskFlags: string[];
  file?: string;
  dryRun: boolean;
  claudeBin: string;
  claudeArgs?: string[];
  cwd: string;
  logFile?: string;
  json: boolean;
  now?: Date;
}

interface Plan {
  jobId: string;
  dueAt: Date;
  delaySeconds: number;
  delaySource: "delay" | "at";
  delayInput: string;
  tasks: string[];
}

async function buildPlan(opts: ScheduleOptions): Promise<Plan> {
  if (opts.claudeArgs && opts.claudeArgs.length > 0) {
    validateClaudeArgs(opts.claudeArgs);
  }
  if (opts.delay && opts.at) {
    throw new CcTimerError(
      "[Error] Use either a positional delay or --at, not both.",
    );
  }
  if (!opts.delay && !opts.at) {
    throw new CcTimerError(
      '[Error] Missing delay. Provide a delay like "45m" or use --at "17:30".',
    );
  }

  const now = opts.now ?? new Date();
  let dueAt: Date;
  let delaySeconds: number;
  let delaySource: "delay" | "at";
  let delayInput: string;
  if (opts.delay) {
    const parsed = parseDelay(opts.delay);
    dueAt = new Date(now.getTime() + parsed.ms);
    delaySeconds = parsed.seconds;
    delaySource = "delay";
    delayInput = parsed.input;
  } else {
    const parsed = parseAt(opts.at!, now);
    dueAt = parsed.dueAt;
    delaySeconds = Math.round((dueAt.getTime() - now.getTime()) / 1000);
    delaySource = "at";
    delayInput = parsed.input;
  }

  const tasks = await collectTasks({
    positional: opts.positional,
    taskFlags: opts.taskFlags,
    filePath: opts.file,
  });
  if (tasks.length === 0) {
    throw new CcTimerError(
      "[Error] No tasks provided. Add a quoted task, --task, or --file.",
    );
  }

  return {
    jobId: `ct_${nanoid(6)}`,
    dueAt,
    delaySeconds,
    delaySource,
    delayInput,
    tasks,
  };
}

interface ScheduleResult {
  output: string;
  job?: JobRecord;
  dryRun: boolean;
}

function buildSuccessOutput(plan: Plan): string {
  const count = plan.tasks.length;
  const noun = count === 1 ? "task" : "tasks";
  const dur = formatDurationLong(plan.delaySeconds);
  const dueLocal = formatLocalTimestamp(plan.dueAt);
  const lines: string[] = [];
  lines.push(
    `[Success] Scheduled ${count} ${noun} to run in ${dur} (${plan.delaySeconds} seconds).`,
  );
  lines.push(`Dispatch time: ${dueLocal} local time`);
  lines.push("Tasks:");
  for (const t of plan.tasks) lines.push(`- ${t}`);
  lines.push(
    "You can close this terminal. Agents will appear in 'claude agents' when dispatched.",
  );
  return lines.join("\n");
}

function buildDryRunOutput(plan: Plan, opts: ScheduleOptions): string {
  const count = plan.tasks.length;
  const noun = count === 1 ? "task" : "tasks";
  const dur = formatDurationLong(plan.delaySeconds);
  const dueLocal = formatLocalTimestamp(plan.dueAt);
  const lines: string[] = [];
  lines.push(
    `[Dry run] Would schedule ${count} ${noun} to run in ${dur} (${plan.delaySeconds} seconds).`,
  );
  lines.push(`Dispatch time: ${dueLocal} local time`);
  lines.push("Tasks:");
  const extra = opts.claudeArgs ?? [];
  for (const t of plan.tasks) {
    const cmd = newAgentCommand(t, extra);
    lines.push(`- ${previewCommand(opts.claudeBin, cmd)}`);
  }
  lines.push("");
  lines.push("No job was created.");
  return lines.join("\n");
}

export async function runSchedule(
  opts: ScheduleOptions,
): Promise<ScheduleResult> {
  const plan = await buildPlan(opts);

  if (opts.dryRun) {
    const output = opts.json
      ? JSON.stringify(
          {
            dryRun: true,
            dueAt: plan.dueAt.toISOString(),
            delaySeconds: plan.delaySeconds,
            tasks: plan.tasks,
          },
          null,
          2,
        )
      : buildDryRunOutput(plan, opts);
    return { output, dryRun: true };
  }

  const logFile = opts.logFile ?? getJobLogPath(plan.jobId);
  const schedulerToken = nanoid(16);
  const job: JobRecord = {
    id: plan.jobId,
    status: "pending",
    createdAt: new Date().toISOString(),
    dueAt: plan.dueAt.toISOString(),
    delaySeconds: plan.delaySeconds,
    cwd: opts.cwd,
    claudeBin: opts.claudeBin,
    tasks: plan.tasks,
    claudeArgs:
      opts.claudeArgs && opts.claudeArgs.length > 0
        ? opts.claudeArgs
        : undefined,
    schedulerToken,
    logFile,
  };
  await createJob(job);

  try {
    const { pid } = await startWorker({
      jobId: plan.jobId,
      schedulerToken,
      logFile,
    });
    job.schedulerPid = pid;
    // The worker also stamps its own PID, but recording it here in the response
    // gives the user immediate feedback.
  } catch (err) {
    throw new CcTimerError(
      `[Error] Failed to start scheduler: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const output = opts.json
    ? JSON.stringify(
        {
          id: job.id,
          dueAt: job.dueAt,
          delaySeconds: job.delaySeconds,
          tasks: job.tasks,
          status: job.status,
          schedulerPid: job.schedulerPid,
          logFile: job.logFile,
        },
        null,
        2,
      )
    : buildSuccessOutput(plan);

  return { output, job, dryRun: false };
}
