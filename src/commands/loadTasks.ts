import { promises as fs } from "node:fs";
import { CcTimerError } from "../errors.js";

export interface TaskSources {
  positional: string[];
  taskFlags: string[];
  filePath?: string;
}

/**
 * Combine task sources in the documented deterministic order:
 *   1. positional, 2. --task flags, 3. --file lines.
 * File lines: blank lines and lines starting with `#` are ignored.
 */
export async function collectTasks(sources: TaskSources): Promise<string[]> {
  const tasks: string[] = [];
  for (const t of sources.positional) {
    if (t.length) tasks.push(t);
  }
  for (const t of sources.taskFlags) {
    if (t.length) tasks.push(t);
  }
  if (sources.filePath) {
    let contents: string;
    try {
      contents = await fs.readFile(sources.filePath, "utf8");
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new CcTimerError(
          `[Error] Task file not found: ${sources.filePath}`,
        );
      }
      throw err;
    }
    for (const raw of contents.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("#")) continue;
      tasks.push(line);
    }
  }
  return tasks;
}
