import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectTasks } from "../src/commands/loadTasks.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-timer-loadtasks-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("collectTasks", () => {
  it("collects positional tasks", async () => {
    const got = await collectTasks({ positional: ["a", "b"], taskFlags: [] });
    expect(got).toEqual(["a", "b"]);
  });

  it("collects repeated --task", async () => {
    const got = await collectTasks({ positional: [], taskFlags: ["x", "y"] });
    expect(got).toEqual(["x", "y"]);
  });

  it("reads tasks from file ignoring blanks and comments", async () => {
    const filePath = path.join(tmpDir, "tasks.txt");
    await fs.writeFile(
      filePath,
      ["# header", "", "task one", "  # comment", "   ", "task two"].join("\n"),
    );
    const got = await collectTasks({ positional: [], taskFlags: [], filePath });
    expect(got).toEqual(["task one", "task two"]);
  });

  it("combines sources in positional -> flags -> file order", async () => {
    const filePath = path.join(tmpDir, "t.txt");
    await fs.writeFile(filePath, "f1\nf2\n");
    const got = await collectTasks({
      positional: ["p1", "p2"],
      taskFlags: ["t1"],
      filePath,
    });
    expect(got).toEqual(["p1", "p2", "t1", "f1", "f2"]);
  });

  it("reports a clear error for missing file", async () => {
    await expect(
      collectTasks({
        positional: [],
        taskFlags: [],
        filePath: path.join(tmpDir, "nope.txt"),
      }),
    ).rejects.toThrow(/Task file not found/);
  });
});
