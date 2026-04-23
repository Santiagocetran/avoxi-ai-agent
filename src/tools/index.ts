/**
 * Tool catalog + dispatcher exposed to the LLM.
 *
 * Only tools the auditor actually uses are registered — no general-purpose
 * health/trunk/DID/inventory tools here (that was the previous paradigm).
 *
 * Tools:
 *   list_calls          → wraps GET /cdrs (audit-window queries)
 *   get_call_journey    → fetches one CDR and returns domain/journey.build()
 *   get_recording_url   → returns the 24 h pre-signed URL from a CDR
 *   transcribe_call     → gated by privacy/gate.ts; proxies to a transcription
 *                         service if enabled — otherwise returns
 *                         { error: 'disabled_by_policy' }
 *   list_agents         → GET /agents (name lookup)
 *   get_agent_timeline  → GET /agents/timeline (who was on shift)
 *   get_live_team       → GET /live/team/:team_id (real-time active calls)
 *   list_alert_logs     → GET /alerts/logs (Avoxi-native incidents)
 *   is_on_call          → pure; domain/schedule.ts
 *   classify_call       → pure; domain/missed-call.ts
 *
 * Each entry is an OpenAI ChatCompletionTool with a JSON Schema for its
 * arguments + a dispatch handler wired to the implementation module.
 *
 * STATUS: SKELETON.
 */

export {};
