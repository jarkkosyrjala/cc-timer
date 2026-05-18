/**
 * Wrapper around the Claude Code CLI. Centralized so command names can evolve
 * without affecting the rest of the codebase.
 */
import { CcTimerError } from "../errors.js";

export interface ClaudeCommand {
  args: string[];
}

/**
 * Flags cc-timer supplies itself. Forwarding one via `--` would produce a
 * duplicate on the spawned `claude` argv, so we reject early with guidance.
 */
const RESERVED_FLAGS: Record<string, string> = {
  "--bg": "cc-timer always dispatches via `claude --bg`.",
};

/**
 * Validate user-supplied passthrough args. Bare value tokens (no leading `--`)
 * are accepted untouched so things like `--model opus` work.
 */
export function validateClaudeArgs(args: readonly string[]): void {
  for (const tok of args) {
    const head = tok.startsWith("--") ? tok.split("=", 1)[0] : tok;
    const reason = RESERVED_FLAGS[head];
    if (reason) {
      throw new CcTimerError(
        `[Error] Cannot forward ${head} to claude — ${reason} Remove it from the args after \`--\`.`,
      );
    }
  }
}

/** `claude [extra...] --bg <task>` */
export function newAgentCommand(
  task: string,
  extra: readonly string[] = [],
): ClaudeCommand {
  return { args: [...extra, "--bg", task] };
}

/**
 * Shell-quoted preview string used purely for dry-run output. The real dispatch
 * path uses structured arguments, not this string.
 */
export function previewCommand(claudeBin: string, cmd: ClaudeCommand): string {
  const quote = (s: string): string => {
    if (s === "" || /[\s"'`$\\!*?()<>|&;{}\[\]]/.test(s)) {
      return `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
    }
    return s;
  };
  return [claudeBin, ...cmd.args.map(quote)].join(" ");
}
