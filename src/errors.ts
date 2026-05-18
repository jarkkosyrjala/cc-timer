export class CcTimerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CcTimerError";
  }
}

// Original, Queen-adjacent parody lines for error preludes.
export const ERROR_PRELUDE_LINES = [
  "Caught in a landslide, no escape from reality.",
  "I'm just a poor boy, I need no sympathy.",
  "Because I'm easy come, easy go.",
  "Any way the wind blows doesn't really matter to me, to me.",
  "Put a gun against his head, pulled my trigger, now he's dead.",
  "But now I've gone and thrown it all away.",
  "Mama, ooh, didn't mean to make you cry.",
  "Carry on, carry on as if nothing really matters.",
  "Too late, my time has come.",
  "Sends shivers down my spine, body's aching all the time.",
  "Gotta leave you all behind and face the truth.",
  "I sometimes wish I'd never been born at all.",
  "Scaramouche, Scaramouche, will you do the Fandango?",
  "Thunderbolt and lightning, very, very frightening me.",
  "But I'm just a poor boy, nobody loves me.",
  "Spare him his life from this monstrosity.",
  "Easy come, easy go, will you let me go?",
  "No, no, no, no, no, no, no.",
  "Oh, mamma mia, mamma mia.",
  "Mamma mia, let me go.",
  "So you think you can stone me and spit in my eye?",
  "So you think you can love me and leave me to die?",
  "Oh, baby, can't do this to me, baby.",
  "Just gotta get out, just gotta get right outta here.",
  "Nothing really matters, anyone can see",
  "Nothing really matters to me",
] as const;

export function getRandomErrorPrelude(): string {
  const index = Math.floor(Math.random() * ERROR_PRELUDE_LINES.length);
  return ERROR_PRELUDE_LINES[index] ?? ERROR_PRELUDE_LINES[0];
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withPrelude(message: string): string {
  return `${getRandomErrorPrelude()}\n${message}`;
}

function ensureErrorLabel(message: string): string {
  return message.startsWith("[Error]") ? message : `[Error] ${message}`;
}

export function formatCliError(err: unknown): string {
  return withPrelude(ensureErrorLabel(toMessage(err)));
}

export function formatWorkerError(message: string): string {
  return withPrelude(
    message.startsWith("worker:") ? message : `worker: ${message}`,
  );
}
