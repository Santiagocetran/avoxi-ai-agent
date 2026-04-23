/**
 * Single entry point.
 *
 *   pnpm audit [--since=<iso>] [--until=<iso>]
 *
 * Default window when flags are absent: the previous on-call shift
 * (derived from config.schedule).
 *
 * Flow
 *   1. loadConfig()
 *   2. resolve [since, until]
 *   3. audit.auditWindow(since, until, config)
 *   4. write the narrative to stdout
 *
 * Exit codes: 0 = ok, 1 = config or runtime error. Kept deliberately
 * thin — entry points are not where complexity lives.
 *
 * STATUS: SKELETON.
 */

export {};
