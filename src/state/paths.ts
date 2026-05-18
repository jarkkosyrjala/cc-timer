import os from "node:os";
import path from "node:path";

/**
 * Resolve the app data directory for the current platform.
 * Honors CC_TIMER_HOME for tests and power users.
 */
export function getAppDir(): string {
  const override = process.env.CC_TIMER_HOME;
  if (override) return override;
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "cc-timer",
    );
  }
  if (platform === "win32") {
    const local =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(local, "cc-timer");
  }
  const state =
    process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(state, "cc-timer");
}

export function getJobsFile(): string {
  return path.join(getAppDir(), "jobs.json");
}

export function getLogsDir(): string {
  return path.join(getAppDir(), "logs");
}

export function getJobLogPath(id: string): string {
  return path.join(getLogsDir(), `${id}.log`);
}
