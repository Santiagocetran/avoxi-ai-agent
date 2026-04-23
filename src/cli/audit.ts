/**
 * `pnpm audit [--since=<iso>] [--until=<iso>]`
 *
 * One-shot batch audit entry point.
 *
 * Default window: previous on-call shift (as defined in config/schedule.yaml).
 * For Grupo Wellness that means:
 *   weekdays  →  21:00 ART (previous day) → 09:00 ART (today)
 *   weekends  →  the full Saturday/Sunday window
 *
 * Flow:
 *   1. Resolve the [since, until] window (override or schedule-derived).
 *   2. Pull every CDR in the window via avoxi/client.listCdrs().
 *   3. Classify each call with domain/missed-call.ts.
 *   4. Reconstruct each call's journey with domain/journey.ts.
 *   5. Feed the set to the LLM with prompts/audit-report.ts → produce report.
 *   6. Persist the report (storage/audit-log.ts).
 *   7. Dispatch notifications (notifier/*) for any missed calls.
 *
 * STATUS: SKELETON.
 */

export {};
