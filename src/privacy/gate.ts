/**
 * Privacy gate — the single runtime choke point.
 *
 * Every code path that wants to read a recording or a transcript MUST call
 * gate.canProcessRecording(cdr) first. The gate consults policy.ts plus
 * per-call facts (consent flag on the CDR if present, caller country,
 * retention policy, etc.) and returns either { allowed: true } or
 * { allowed: false, reason }.
 *
 * Log every decision (allow + deny) to storage/audit-log.ts for
 * accountability.
 *
 * STATUS: SKELETON.
 */

export {};
