# Avoxi API — what we use

Base URL: `https://genius.avoxi.com/api/v2`
Docs:     <https://genius.avoxi.com/api/v2/api-docs/>
Spec:     `https://genius.avoxi.com/api/v2/api-docs-standalone.swagger` (OpenAPI 3.0.3)

Auth: `Authorization: Bearer <AVOXI_API_TOKEN>` — long-lived, per-service-provider token.

## Endpoints we call

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/cdrs` | **Primary** — list Call Detail Records | Carries journey fields: `avoxi_call_id`, `status`, `forwarded_to[]`, `agent_actions[]`, `voicemail_details`, `forward_destination`, `call_recording_url` (valid 24 h). Up to 10 000 rows per page. |
| GET | `/agents` | List agents, map `user_id → name / team` | — |
| GET | `/agents/timeline` | Who was on shift per interval | Marked "Coming Soon" by Avoxi — client must tolerate 404. |
| GET | `/live/teams` | Real-time team stats | Refreshed every 5 s. Used by `cli/watch`. |
| GET | `/live/team/{team_id}` | Live calls for one team | Refreshed every 5 s. |
| GET | `/alerts/logs` | Avoxi-native incident log | Cross-reference against our missed calls. |
| GET | `/alerts/logs/history` | Histogram of past alerts | For trend charts. |
| GET | `/numbers` | DID metadata (friendly name, country) | — |
| GET | `/entitlements` | Self-check at startup | Confirm token scope. |

## Endpoints we explicitly DO NOT use

From the previous paradigm — these are not relevant to journey auditing
and remain out of scope:

- `/sip_uris*`, `/trunks*`
- `/numbers/test*`
- `/inventory/*`, `/products/*`, `/regions/*`, `/countries`
- `/orders*`, `/port*`, `/quotes*`, `/billing/*`
- `/cases*`, `/document*`, `/broadcasts*`
- `/sms_message`
- `/extension/*`, `/data_centers`, `/addons`

## Things to know

- **No journey endpoint.** Journeys are rebuilt client-side from CDR
  fields — see `docs/ARCHITECTURE.md` and `src/domain/journey.ts`.
- **Recording URL is short-lived (24 h).** Download eagerly if you need
  the bytes; never try to re-use a URL later.
- **`agent_actions` is the closest thing to a hop log.** Events
  observed in examples: `handled`, plus (likely) `rang`, `declined` —
  confirm against live data; treat unknown events as `other`.
- **Status vocabulary is small:** `ANSWERED`, `UNANSWERED`, `VOICEMAIL`.
  The missed-call classifier wraps this with finer-grained reasons.
