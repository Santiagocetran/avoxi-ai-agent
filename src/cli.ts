/**
 * Single entry point. Kept deliberately thin — complexity lives in other modules.
 *
 *   pnpm audit [--since=<iso>] [--until=<iso>]
 *
 * Default window when both flags are absent: the previous completed on-call shift.
 * Exit codes: 0 = ok, 1 = config or runtime error.
 */

import { loadConfig } from './config.js';
import { previousShift } from './journey.js';
import { auditWindow } from './audit.js';

function parseArgs(argv: string[]): { since?: Date; until?: Date } {
  const result: { since?: Date; until?: Date } = {};

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--since=')) {
      result.since = new Date(arg.slice(8));
    } else if (arg.startsWith('--until=')) {
      result.until = new Date(arg.slice(8));
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Usage: pnpm audit [--since=<iso>] [--until=<iso>]');
      process.exit(1);
    }
  }

  return result;
}

async function main() {
  const config = loadConfig();
  const { since: rawSince, until: rawUntil } = parseArgs(process.argv);

  if ((rawSince === undefined) !== (rawUntil === undefined)) {
    console.error('Provide both --since and --until, or neither.');
    process.exit(1);
  }

  let since: Date, until: Date;

  if (rawSince && rawUntil) {
    if (isNaN(rawSince.getTime()) || isNaN(rawUntil.getTime())) {
      console.error('Invalid date — use ISO 8601 (e.g. 2026-04-28T21:00:00-03:00).');
      process.exit(1);
    }
    since = rawSince;
    until = rawUntil;
  } else {
    ({ since, until } = previousShift(new Date(), config.schedule));
  }

  const narrative = await auditWindow(since, until, config);
  process.stdout.write(narrative + '\n');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
