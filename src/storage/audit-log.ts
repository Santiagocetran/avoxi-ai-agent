/**
 * Persistence layer — SQLite (better-sqlite3 for sync simplicity).
 *
 * Tables (schema in storage/schema.sql):
 *   audit_runs         one row per CLI/watch invocation
 *   audited_calls      per-CDR row: call_id, status, missed_reason,
 *                      journey_json, audited_at, run_id
 *   notifications      per dispatched alert (channel, target, status)
 *   privacy_decisions  gate audit trail
 *
 * Surface:
 *   upsertAuditedCall(record)   → dedupe key = avoxi_call_id
 *   hasSeen(call_id)            → bool (cli/watch uses this to avoid
 *                                  re-alerting on the same missed call)
 *   listAuditedCallsInWindow(from, to)
 *   recordNotification(...)
 *   recordPrivacyDecision(...)
 *
 * SQLite chosen so the project stays single-binary deployable. Swap for
 * Postgres later by re-implementing this file only.
 *
 * STATUS: SKELETON.
 */

export {};
