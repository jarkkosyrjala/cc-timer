#!/usr/bin/env node
import { Command, Option } from "commander";
import { createRequire } from "node:module";
import { runCancel } from "./commands/cancel.js";
import { runList } from "./commands/list.js";
import { runSchedule } from "./commands/schedule.js";
import { formatCliError } from "./errors.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

function die(err: unknown): never {
  process.stderr.write(`${formatCliError(err)}\n`);
  process.exit(1);
}

/**
 * Split argv at the first standalone `--` separator. Everything after is
 * collected as passthrough args for the underlying `claude` invocation.
 * Commander would otherwise consume `--` and stuff the tail into positional
 * args, which collides with our [tasks...] argument.
 */
function splitPassthrough(argv: string[]): {
  head: string[];
  claudeArgs: string[];
} {
  const idx = argv.indexOf("--");
  if (idx === -1) return { head: argv, claudeArgs: [] };
  return { head: argv.slice(0, idx), claudeArgs: argv.slice(idx + 1) };
}

function buildProgram(claudeArgs: string[]): Command {
  const program = new Command();
  program
    .name("cc-timer")
    .description(
      "Schedule Claude Code background agents after a delay or at a specific time.",
    )
    .version(packageJson.version)
    .showHelpAfterError();

  // Default action: schedule new agents.
  program
    .argument("[delay]", 'Relative delay like "2h" or "1d2h30m"')
    .argument("[tasks...]", "One or more task prompts")
    .option(
      "--task <text>",
      "Add one task (repeatable)",
      (val: string, prev: string[]) => {
        prev.push(val);
        return prev;
      },
      [] as string[],
    )
    .option("--file <path>", "Read tasks from a text file")
    .option(
      "--at <time>",
      'Schedule at an exact local time, e.g. "17:30" or "2026-05-19 09:00"',
    )
    .option(
      "--dry-run",
      "Show the planned schedule without creating a job",
      false,
    )
    .option(
      "--claude-bin <path-or-name>",
      "Claude CLI executable name or path",
      "claude",
    )
    .option(
      "--cwd <path>",
      "Working directory for dispatched commands",
      process.cwd(),
    )
    .option("--log-file <path>", "Explicit log output file")
    .option("--json", "Machine-readable JSON output", false)
    .action(async (delay: string | undefined, tasks: string[], options) => {
      try {
        const res = await runSchedule({
          delay,
          at: options.at,
          positional: tasks ?? [],
          taskFlags: options.task ?? [],
          file: options.file,
          dryRun: Boolean(options.dryRun),
          claudeBin: options.claudeBin,
          claudeArgs,
          cwd: options.cwd,
          logFile: options.logFile,
          json: Boolean(options.json),
        });
        process.stdout.write(res.output + "\n");
      } catch (err) {
        die(err);
      }
    });

  program
    .command("list")
    .description("List pending jobs.")
    .option("--verbose", "Show task text, PID, and dispatch details", false)
    .option("--json", "Machine-readable JSON output", false)
    .option("--all", "Include dispatched/canceled history", false)
    .action(async (options) => {
      try {
        const out = await runList({
          verbose: Boolean(options.verbose),
          json: Boolean(options.json),
          all: Boolean(options.all),
        });
        process.stdout.write(out + "\n");
      } catch (err) {
        die(err);
      }
    });

  program
    .command("cancel <id>")
    .description("Cancel a pending job.")
    .option("--json", "Machine-readable JSON output", false)
    .action(async (id: string, options) => {
      try {
        const res = await runCancel({ id, json: Boolean(options.json) });
        process.stdout.write(res.output + "\n");
      } catch (err) {
        die(err);
      }
    });

  // Use Option marker for noisier `--task` defaults so commander treats it as an array.
  void Option;
  return program;
}

const { head, claudeArgs } = splitPassthrough(process.argv);
const program = buildProgram(claudeArgs);
program.parseAsync(head).catch(die);
