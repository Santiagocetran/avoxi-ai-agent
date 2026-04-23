# Paradigm shift — from infra monitor to journey auditor

This repo started as a generic VoIP infra-monitoring dashboard (API health,
CDR failure rates, trunks, DIDs). After discussion with the GrupoWellness
SW team we concluded that wasn't the right target, and we rebuilt.

## Why the pivot

1. **The real problems happen on the mobile app, not the web panel.** The
   agents we need to observe aren't interacting with a web dashboard whose
   logs we could scrape. Avoxi's API is the only observable surface that
   catches the actual failure modes.
2. **The failure mode that matters is "missed call during on-call hours"**,
   not "API latency" or "trunk saturation". That's call-level, not
   infra-level.
3. **The manual workflow we're replacing is: on-call agent reports a miss
   in WhatsApp → tech team looks the Call ID up in Avoxi → writes back.**
   An auditor that does this automatically — and keeps a historical record
   — is the concrete value.

## Concrete differences

| Aspect | Old skeleton | New skeleton |
|---|---|---|
| Unit of analysis | Aggregate metrics over a window | Individual calls (every CDR in the window) |
| Primary Avoxi surface | `/cdr`, `/trunks`, `/numbers`, `/active-calls` (partly invented) | `/cdrs`, `/agents`, `/agents/timeline`, `/live/*`, `/alerts/*` (verified against OpenAPI spec) |
| Missed-call detection | Failure rate thresholds | Per-call: `status === UNANSWERED` during on-call windows, classified by reason |
| Recordings | Not touched | Downloadable via 24 h CDR URL, behind a privacy gate |
| Transcription | — | Optional, provider-agnostic, redacted |
| Output | Severity badge (CRITICAL/WARNING/INFO) | Per-call journey + periodic report |
| Persistence | None (in-memory) | SQLite audit log + dedupe |
| Replaces | — | Manual WhatsApp missed-call report + manual Call-ID lookup |

## What we kept

- Multi-provider LLM plumbing (kimi / openai / gemini / claude).
- Function-calling agent loop shape.
- Web dashboard with SSE live feed.
- dotenv-based configuration.

## What we deleted

- `get_system_health`, `get_cdr_summary`, `get_active_calls`, `get_trunks`,
  `get_dids` tools and their supporting AvoxiConfig shape.
- The severity classifier and its thresholds.
- The previous system prompt (infra-oriented).
- The in-memory dashboard store keyed on "check results".

## What this unlocks

- Automated on-call reports with per-call journeys (no WhatsApp roundtrip).
- Searchable history: "show me every call from +54911… in the last month".
- Audited recording analysis, once privacy review lands.
- A clean foundation to add agent-quality metrics later (first-response
  time, abandonment in queue, etc.) from the same CDR stream.
