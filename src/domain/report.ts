/**
 * Report aggregation — pure transforms over persisted audit records.
 *
 * Builds the data object consumed by prompts/audit-report.ts and the
 * dashboard views. No I/O — storage access is up to the caller.
 *
 *   summarise(records, window, schedule): ReportStats
 *
 *   interface ReportStats {
 *     window:             { from: string; to: string };
 *     total_calls:        number;
 *     on_call_calls:      number;  // calls that arrived during on-call windows
 *     unanswered:         number;
 *     voicemail:          number;
 *     answered:           number;
 *     missed_by_reason:   Record<MissedReason, number>;
 *     worst_hours:        Array<{ hour_bucket: string; missed: number }>;
 *     recurring_numbers:  Array<{ from: string; count: number }>;
 *     trend_vs_previous:  { delta_missed_pct: number };
 *   }
 *
 * STATUS: SKELETON.
 */

export {};
