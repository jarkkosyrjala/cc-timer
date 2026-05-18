import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ClaudeCommand, newAgentCommand } from "../claude/adapter.js";
import { JobRecord } from "../state/schema.js";

export interface DispatchResult {
  command: ClaudeCommand;
  task: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}

async function runOne(
  claudeBin: string,
  cmd: ClaudeCommand,
  cwd: string,
  logFd: number,
): Promise<{
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const child = spawn(claudeBin, cmd.args, {
        cwd,
        detached: false,
        stdio: ["ignore", logFd, logFd],
        shell: false,
      });
      child.on("error", (err) => {
        resolve({ exitCode: null, signal: null, error: err.message });
      });
      child.on("exit", (code, signal) => {
        resolve({ exitCode: code, signal });
      });
    } catch (err) {
      resolve({
        exitCode: null,
        signal: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * Dispatch every task in a job. Runs one `claude --bg` per task, sequentially.
 * Failures are recorded but do not stop subsequent dispatches.
 */
export async function dispatchJob(job: JobRecord): Promise<DispatchResult[]> {
  await fs.mkdir(path.dirname(job.logFile), { recursive: true });
  const logHandle = await fs.open(job.logFile, "a");
  const results: DispatchResult[] = [];
  try {
    const header = `\n--- dispatch ${new Date().toISOString()} job=${job.id} ---\n`;
    await logHandle.writeFile(header);
    const fd = logHandle.fd;

    const extra = job.claudeArgs ?? [];
    for (const task of job.tasks) {
      const cmd = newAgentCommand(task, extra);
      const r = await runOne(job.claudeBin, cmd, job.cwd, fd);
      results.push({ command: cmd, task, ...r });
    }
    return results;
  } finally {
    await logHandle.close();
  }
}
