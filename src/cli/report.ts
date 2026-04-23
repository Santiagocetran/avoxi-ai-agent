/**
 * `pnpm report [--from=<iso>] [--to=<iso>] [--format=md|json|html]`
 *
 * Periodic report generator (daily / weekly / monthly).
 *
 * Consumes:
 *   - storage/audit-log.ts      → persisted per-call audit records
 *   - domain/report.ts          → aggregation + trend logic
 *   - prompts/audit-report.ts   → LLM narrative
 *
 * Output: a single self-contained report artifact saved under ./reports/.
 *
 * STATUS: SKELETON.
 */

export {};
