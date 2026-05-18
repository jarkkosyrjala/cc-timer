import { listJobs } from "../state/jobStore.js";
import {
  formatDurationShort,
  formatLocalTimestamp,
} from "../time/formatDuration.js";

export interface ListOptions {
  verbose: boolean;
  json: boolean;
  all: boolean;
  now?: Date;
}

const MESSAGE_PREVIEW_MAX = 48;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatMessagePreview(tasks: string[]): string {
  const [firstTask = "", ...rest] = tasks;
  if (!firstTask) return "";

  const suffix = rest.length > 0 ? ` (+${rest.length} more)` : "";
  return `${truncate(firstTask, MESSAGE_PREVIEW_MAX - suffix.length)}${suffix}`;
}

export async function runList(opts: ListOptions): Promise<string> {
  const all = await listJobs();
  const filtered = opts.all ? all : all.filter((j) => j.status === "pending");
  const now = (opts.now ?? new Date()).getTime();

  if (opts.json) {
    return JSON.stringify(
      filtered.map((j) => ({
        id: j.id,
        status: j.status,
        dueAt: j.dueAt,
        dueInSeconds: Math.max(
          0,
          Math.round((new Date(j.dueAt).getTime() - now) / 1000),
        ),
        tasks: j.tasks,
        schedulerPid: j.schedulerPid,
      })),
      null,
      2,
    );
  }

  if (filtered.length === 0) {
    return opts.all ? "No jobs." : "No pending jobs.";
  }

  if (opts.verbose) {
    const blocks: string[] = [];
    for (const j of filtered) {
      const lines: string[] = [];
      lines.push(j.id);
      lines.push(`  Status: ${j.status}`);
      if (j.schedulerPid != null) lines.push(`  PID: ${j.schedulerPid}`);
      lines.push(
        `  Dispatch time: ${formatLocalTimestamp(new Date(j.dueAt))} local time`,
      );
      lines.push("  Tasks:");
      for (const t of j.tasks) lines.push(`  - ${t}`);
      if (j.error) lines.push(`  Error: ${j.error}`);
      blocks.push(lines.join("\n"));
    }
    return blocks.join("\n\n");
  }

  const header = [
    "ID",
    "Due In",
    "Dispatch Time",
    "Message",
    "Tasks",
    "Status",
  ];
  const rows = filtered.map((j) => {
    const dueInSec = Math.round((new Date(j.dueAt).getTime() - now) / 1000);
    return [
      j.id,
      dueInSec > 0 ? formatDurationShort(dueInSec) : "now",
      formatLocalTimestamp(new Date(j.dueAt)),
      formatMessagePreview(j.tasks),
      String(j.tasks.length),
      j.status,
    ];
  });

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => pad(c, widths[i]))
      .join("  ")
      .trimEnd();

  return [fmt(header), ...rows.map(fmt)].join("\n");
}
