/**
 * Periodic-report Markdown renderer.
 *
 * Input: ReportStats (domain/report.ts) + LLM narrative (from
 * prompts/audit-report.ts). Output: a single Markdown artifact with:
 *
 *   # On-Call Audit — {from} → {to}
 *   ## Summary  (KPIs)
 *   ## Unanswered calls  (table)
 *   ## Root causes  (stacked bars in HTML mode)
 *   ## Recurring callers
 *   ## Agent coverage
 *   ## Trend vs previous period
 *   ## Appendix: per-call journeys
 *
 * STATUS: SKELETON.
 */

export {};
