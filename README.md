# cc-timer

`cc-timer` is a cross-platform CLI for scheduling Claude Code background agents to start after delay or at an exact
local time. It is handy when you want work to begin when a fresh Claude quota is available—like sending the night shift at 03:00 or when you want to resume a stalled session later instead of babysitting the terminal.

```bash
cc-timer "2h10m" "Explore if this is this the real life? "
```

## Why use it?

- Schedule one or more `claude --bg <task>` invocations after a delay.
- Target either relative delays (`45m`, `2h55m`, `1d2h30m`) or exact local times (`17:30`, `2026-05-19 09:00`).
- Let the timer run in a detached worker process so you can close the terminal.
- Keep pending jobs in a JSON state file so they can be listed or canceled later.
- Work the same way on macOS, Linux, and Windows without shell-specific tricks.

## Install

Install globally from npm:

```bash
npm install -g cc-timer
```

Verify that the command is on your `PATH`:

```bash
cc-timer --help
```

Run it without installing:

```bash
npx cc-timer "45m" "Confirm if this is just fantasy"
```

### From source

```bash
git clone <repo-url> cc-timer && cd cc-timer
npm install
npm run build
npm install -g .   # or: npm link
```

## Quick start

Schedule a single task:

```bash
cc-timer "45m" "Investigate this landslide, why no escape from reality"
```

```text
[Success] Scheduled 1 task to run in 45 minutes (2700 seconds).
Dispatch time: 2026-05-18 15:42:00 local time
Tasks:
- Investigate this landslide, why no escape from reality
You can close this terminal. Agents will appear in 'claude agents' when dispatched.
```

Schedule multiple tasks for the same dispatch time:

```bash
cc-timer "2h" \
  "Open your eyes, look up to the logs and see" \
  "Audit if I'm just a poor boy" \
  "Acknowledge I need no sympathy"
```

Each task becomes its own `claude --bg "<task>"` invocation, dispatched sequentially when the timer fires.

## Time formats

### Relative delays

The first positional argument is treated as a delay.

| Unit family | Accepted tokens                 |
| ----------- | ------------------------------- |
| seconds     | `s`, `sec`, `second`, `seconds` |
| minutes     | `m`, `min`, `minute`, `minutes` |
| hours       | `h`, `hr`, `hour`, `hours`      |
| days        | `d`, `day`, `days`              |

Examples:

```bash
cc-timer 30s "Scale because I'm easy come, easy go"
cc-timer 30m "Calibrate little high, little low"
cc-timer 2h55m "Decouple any way the wind blows doesn't really matter to me, to me"
cc-timer 1d2h30m "Report mama, just killed a man"
cc-timer "2 hours 30 minutes" "Execute: put a gun against his head"
```

### Exact local times

Use `--at` for absolute times:

- ```bash
  cc-timer --at 17:30 "Confirm: pulled my trigger, now he's dead"
  ```
- ```bash
  cc-timer --at 5:30pm "Initialize: Mama, life had just begun"
  ```
- ```bash
  cc-timer --at "2026-05-19 09:00" "Reset but now I've gone and thrown it all away"
  ```

- `HH:mm` schedules the next future occurrence; if the time has already passed today, it rolls to tomorrow.
- Explicit datetimes must be in the future.
- All times are interpreted in the local timezone.

## Task input

Tasks are combined from three sources in this deterministic order:

1. Positional arguments.
2. Repeated `--task <text>` flags.
3. Lines read from `--file <path>` (in file order).

```bash
cc-timer "2h" \
  --task "Defer if I'm not back again this time tomorrow" \
  --task "Carry on, carry on as if nothing really matters"

cc-timer "2h" --file night-shift-prompts.txt

cc-timer "2h" \
  "Expire too late, my time has come" \
  --task "Sends shivers down my spine, body's aching all the time" \
  --file extras.txt
```

In task files, blank lines and lines beginning with `#` are ignored.

## Forwarding flags to `claude`

Anything after a standalone `--` is forwarded verbatim to the underlying `claude` invocation. Use this to pass model selection, verbosity, or any other Claude CLI flag without `cc-timer` needing first-class support for it.

```bash
cc-timer "45m" "Shutdown: goodbye, everybody, I've got to go" -- --model opus --verbose
```

Forwarded args are applied to every task in the batch and stored with the job, so they survive the wait-and-dispatch flow even if the terminal is closed.

`--bg` is the only reserved flag. `cc-timer` always dispatches with `claude --bg`, so forwarding `--bg` would duplicate it. Other Claude CLI flags—such as `--model`, `--verbose`, and `--resume`—pass through untouched.

## Continuing from a stalled session

To pick up from an existing Claude Code session later, forward `--resume <id>` through the passthrough:

```bash
cc-timer "30m" "Disconnect, gotta leave you all behind and face the truth" -- --resume <session-id>
```

Note that Claude Code starts a **new** background agent that forks from the resumed session's state. It does not inject a prompt into the original session.

Use this when the original session is stalled, idle, or finished. If the target session is still actively working, the result will be a second parallel agent rather than a follow-up message.

There is currently no supported way to inject a prompt into an already-running background session; `cc-timer` schedules new agents only.

Claude Code accepts both the session UUID and the human-readable session name. Run `/status` inside the target session to look up either.

## Dry run

Preview the schedule without creating a job:

```bash
cc-timer "2h" \
  "Ping mama, ooh (any way the wind blows)" \
  "Respawn I don't wanna die" \
  --dry-run
```

## Listing pending jobs

```bash
cc-timer list
```

```bash
cc-timer list --verbose
cc-timer list --json
cc-timer list --all          # include dispatched/canceled history
```

## Canceling

```bash
cc-timer cancel ct_9f2aXY
```

```text
[Success] Canceled job ct_9f2aXY.
```

Cancellation marks the job state before terminating the worker, so a wake-up that races with the cancel still sees the canceled state and skips dispatch. Already-dispatched jobs only report that they have already started—`cc-timer` does not manage Claude agents after launch.

## Options reference

`cc-timer [delay] [tasks...]` — schedule new agents.

| Option                        | Description                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| `--task <text>`               | Add one task. Repeatable.                                        |
| `--file <path>`               | Read tasks from a text file, one per line.                       |
| `--at <time>`                 | Use an exact local time instead of `delay`.                      |
| `--dry-run`                   | Print the plan without creating a job.                           |
| `--claude-bin <path-or-name>` | Override the `claude` executable. Default: `claude`.             |
| `--cwd <path>`                | Working directory for dispatched commands. Default: current dir. |
| `--log-file <path>`           | Explicit log output file.                                        |
| `--json`                      | Machine-readable JSON output.                                    |

Anything after a standalone `--` is forwarded verbatim to `claude`.

```bash
cc-timer 45m "Revert I sometimes wish I'd never been born at all" -- --model opus
```

`--bg` is reserved and will be rejected; everything else, including future Claude CLI flags, is passed through untouched.

Other commands:

- `cc-timer list [--verbose] [--all] [--json]`
- `cc-timer cancel <id> [--json]`

## State and logs

`cc-timer` stores job records and dispatch logs in a platform-appropriate app directory:

- macOS: `~/Library/Application Support/cc-timer/`
- Linux: `${XDG_STATE_HOME:-~/.local/state}/cc-timer/`
- Windows: `%LOCALAPPDATA%\cc-timer\`

Layout:

```text
jobs.json
logs/
  <jobId>.log
```

Set `CC_TIMER_HOME` to override the location. The tests use this hook as well.

## Development

```bash
npm install
npm run build       # compile TypeScript -> dist/
npm test            # run the full test suite (vitest)
npm run dev -- ...  # run the CLI from source via tsx
```

Source layout: `src/{cli.ts, commands/, scheduler/, time/, state/, claude/, errors.ts, index.ts}` and `tests/`.

## Cross-platform notes

- The worker is launched via `child_process.spawn` with `detached: true` and `child.unref()`.
- Cancellation sends `SIGTERM` and escalates to `SIGKILL` after a short grace period; on Windows, Node's `process.kill` is used.
- Tasks are passed as structured argv, not concatenated shell strings, so quoting and special characters survive intact.
