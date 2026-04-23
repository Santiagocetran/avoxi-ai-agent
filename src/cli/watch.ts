/**
 * `pnpm watch`
 *
 * Long-running daemon — watches the on-call window in near-real-time.
 *
 * Cadence (cron, configurable):
 *   - Every 5 min during an on-call window → run a micro-audit on the
 *     last N minutes of CDRs and emit alerts for any UNANSWERED call
 *     that hasn't been seen before (storage/audit-log dedupes).
 *   - Outside on-call hours → idle (cheap heartbeat only).
 *
 * This replaces the manual "missed-call report in WhatsApp" flow
 * described in SW-lead-recomendations.md.
 *
 * STATUS: SKELETON.
 */

export {};
