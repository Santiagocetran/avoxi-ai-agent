# avoxi-ai-agent

**An agent that audits Avoxi's call journey via the v2 API — detects
unanswered calls during on-call hours and (optionally, policy-gated)
audits recorded calls.**

This document is both the project README and the final analysis report
for the paradigm change described in `major-changes.md`. The skeleton in
this repo is the concrete implementation of that analysis.

---

## 1. Analysis — why this paradigm

### 1.1 The original brief

The first version of this project (see `git log`, commits up to
`100618b`) was an **infra-monitoring dashboard** — generic VoIP health
checks against Avoxi, severity badges (CRITICAL/WARNING/INFO), and a
web UI that polled a "system health" metric.

### 1.2 What the SW team told us

After review with the GrupoWellness software team (captured in
`SW-lead-recomendations.md`):

- The failures that actually hurt the business happen on the **mobile
  app**. There is no web console to scrape.
- The **concrete operational pain** is a manual flow: the on-call agent
  sees a missed call, pings a WhatsApp group, the tech team looks up the
  Call ID in the Avoxi panel, and replies with context.
- The right unit of analysis is **one call**, not "aggregate health over
  a 5-minute window". The SW lead explicitly named the **"Call Journey"**
  — the per-call record of hold, queue, agent routing — as the object
  we should be operating on.
- Recording analysis (transcription, content audit) is valuable but
  **needs a privacy review before implementation**.

### 1.3 The pivot

The previous skeleton's assumptions didn't survive contact with those
requirements, so we're rebuilding:

> **"An agent that checks Avoxi's call journey via API to detect
> unanswered calls and audit recorded calls."**

Everything in this repo is shaped around that single sentence.

See `docs/PARADIGM-SHIFT.md` for the full before/after diff.

### 1.4 What the Avoxi v2 API actually offers

We audited the live OpenAPI spec at
`https://genius.avoxi.com/api/v2/api-docs/` (downloaded as
`api-docs-standalone.swagger`, OpenAPI 3.0.3, 100 paths). Key findings:

- **There is no `GET /call-journey/{id}` endpoint.** The journey does
  not exist as a first-class resource.
- **`GET /cdrs`** is where the journey lives, implicitly. Each CDR
  carries:
  - `avoxi_call_id` — the Call ID we need to automate lookup on.
  - `status` — `ANSWERED | UNANSWERED | VOICEMAIL`.
  - `forwarded_to[]` — which routing buckets the call entered
    (`SIP`, `Queue`, `Agent`, …), in order.
  - `agent_actions[]` — per-agent events (`handled`, etc.) with user
    ID, name, and timestamp. **These are the journey steps.**
  - `voicemail_details.prior_extension_called` — who/what was rung last
    before the call fell through to voicemail.
  - `forward_destination` — the final hop before termination.
  - `call_recording_url` — pre-signed URL valid **24 hours** — the
    bridge to the recording-audit capability.
- **`GET /agents`** and **`GET /agents/timeline`** (the timeline
  endpoint is still "Coming Soon" per Avoxi) give us the rotation state
  we need to say "this call came in while nobody was on duty".
- **`GET /live/teams`** and **`GET /live/team/{team_id}`** give a
  real-time view (refreshed every 5 s) for the `watch` daemon.
- **`GET /alerts/logs`** lets us cross-reference with Avoxi's own
  incident stream.

So the design locks onto: **poll `/cdrs` continuously, reconstruct the
journey locally, classify against an on-call calendar, and escalate.**

### 1.5 Scope decisions

| Decision | Rationale |
|---|---|
| Journey is reconstructed **client-side** from CDR fields. | The Avoxi v2 API does not expose a single journey endpoint. |
| Recordings are handled behind a **single privacy gate** (`src/privacy/gate.ts`) with **`enabled: false`** defaults. | SW-lead flagged audio as requiring legal review. We ship off-by-default so the rest of the system is usable today. |
| **SQLite** persistence (via `better-sqlite3`), not Postgres/Redis. | Single-binary deploy; one file to back up; swappable later. |
| Keep the **multi-provider LLM** layer from the old skeleton. | It was already working, and call audit is one more task on the same function-calling loop. |
| **Drop** infra metrics: trunks, DIDs, SIP failure rates, active-call dashboards. | Not the problem we're solving; belongs to Avoxi's own console. |

---

## 2. Proposed architecture

```
                   ┌───────────────────────────────────────────────┐
                   │  Entry points (choose one)                    │
                   │                                               │
                   │    pnpm audit      one-shot batch audit       │
                   │    pnpm watch      cron daemon (on-call)      │
                   │    pnpm inspect    single-call deep audit     │
                   │    pnpm report     periodic aggregate report  │
                   │    pnpm dashboard  web UI + SSE live feed     │
                   └────────────────────────┬──────────────────────┘
                                            │
                                            ▼
                                 config.ts · loads .env + config/*.yaml
                                            │
                ┌───────────────────────────┼────────────────────────────┐
                ▼                           ▼                            ▼
         llm/index.ts              agent.ts  (multi-turn)        domain/schedule.ts
     (kimi/openai/gemini/claude)          │                   (on-call window logic)
                                          │
                                          ▼
                          ┌─────────────────────────────────┐
                          │  tools/  (exposed to the LLM)   │
                          │                                 │
                          │  list_calls        (/cdrs)      │
                          │  get_call_journey  (/cdrs + →)  │
                          │  get_recording_url              │
                          │  transcribe_call   (gated)      │
                          │  list_agents       (/agents)    │
                          │  get_agent_timeline             │
                          │  get_live_team                  │
                          │  list_alert_logs                │
                          │  is_on_call  · classify_call    │
                          └────────────────┬────────────────┘
                                           │
                                           ▼
                              avoxi/client.ts  ──►  AVOXI v2 API
                                           │              │
                                           ▼              ▼
                     domain/journey.build()     privacy/gate.ts ──► avoxi/recording.ts
                     domain/missed-call.classify()                        │
                                           │                              ▼
                                           │                 (only if gate.allowed)
                                           ▼                        transcription
                                  storage/audit-log (SQLite)               │
                                           │                               │
                                 ┌─────────┴─────────┐                     │
                                 ▼                   ▼                     │
                          notifier/slack      dashboard/store ◄────────────┘
                          notifier/email      (SSE broadcast)
                          notifier/webhook
                          notifier/whatsapp
```

### 2.1 Data flow per call

```
  AVOXI /cdrs
       │
       ▼
  AvoxiCdr ─► domain/journey.build()    ─► JourneyTimeline
           ─► domain/missed-call.classify(cdr, schedule, agents)
                                        ─► { missed: bool, reason: MissedReason }
       │
       ▼
  storage/audit-log.upsertAuditedCall()   (dedupe on avoxi_call_id)
       │
       ├─ if missed AND new ──► notifier/* ──► (Slack, WhatsApp, …)
       │
       └─ always ──► dashboard/store ──► SSE to web UI
```

### 2.2 Module responsibilities

| Layer | Module | Responsibility |
|---|---|---|
| HTTP | `src/avoxi/` | Typed client + endpoint constants + OpenAPI-derived models. No business logic. |
| Pure domain | `src/domain/` | Schedule, missed-call classifier, journey reconstruction, report aggregation. Fully offline-testable. |
| Privacy | `src/privacy/` | One gate, one policy, one place for legal to audit. |
| Persistence | `src/storage/` | SQLite: runs, audited calls, notifications, privacy decisions. |
| LLM | `src/llm/` + `src/agent.ts` | Provider adapters + the multi-turn tool-calling loop (unchanged concept from previous skeleton). |
| Function-calling tools | `src/tools/` | Thin adapters that expose `avoxi/` + `domain/` to the LLM. |
| Prompts | `src/prompts/` | Task-specific system/user prompts (watch, inspect, report). |
| Notifications | `src/notifier/` | Slack / email / webhook / WhatsApp fan-out. |
| Entry points | `src/cli/`, `src/dashboard/` | Thin composition layers. No business logic. |
| Reports | `src/report/` | Markdown + HTML renderers for periodic artifacts. |

See `docs/ARCHITECTURE.md` for the durable architecture reference.

---

## 3. File tree

```
avoxi-ai-agent/
├── README.md                       ← this document
├── major-changes.md                ← the brief that drove this rebuild
├── SW-lead-recomendations.md       ← the SW lead's context
├── package.json                    ← scripts: audit · watch · inspect · report · dashboard
├── tsconfig.json
├── .env.example                    ← every env var documented
├── .gitignore
│
├── config/
│   ├── schedule.yaml               ← on-call windows (ART default, Grupo Wellness)
│   ├── privacy.yaml                ← recordings/transcription policy; OFF by default
│   └── agents.yaml                 ← local agent directory + rotation groups
│
├── docs/
│   ├── ARCHITECTURE.md             ← layered design reference
│   ├── AVOXI-API.md                ← which endpoints we use, which we don't, why
│   ├── ON-CALL-SCHEDULE.md         ← schedule semantics + how to change it
│   ├── PRIVACY.md                  ← recording/transcription governance
│   └── PARADIGM-SHIFT.md           ← before/after, and what we deleted
│
├── web/
│   └── index.html                  ← dashboard SPA shell (SSE-driven)
│
└── src/
    ├── agent.ts                    ← multi-turn LLM + tool-dispatch loop
    ├── config.ts                   ← env + YAML loader, one read at startup
    │
    ├── cli/
    │   ├── audit.ts                ← pnpm audit   — batch audit of a window
    │   ├── watch.ts                ← pnpm watch   — cron daemon during on-call
    │   ├── inspect.ts              ← pnpm inspect — single Call-ID deep audit
    │   └── report.ts               ← pnpm report  — daily/weekly rollup
    │
    ├── dashboard/
    │   ├── server.ts               ← pnpm dashboard — HTTP + SSE
    │   ├── store.ts                ← in-memory snapshot + SSE fan-out
    │   └── views.ts                ← server-side response formatting
    │
    ├── llm/
    │   ├── index.ts                ← provider factory
    │   ├── provider-openai.ts      ← kimi · openai · gemini (one impl)
    │   └── provider-claude.ts      ← Anthropic adapter
    │
    ├── prompts/
    │   ├── system.ts               ← base identity + guard-rails
    │   ├── missed-call.ts          ← batch summary prompt (watch)
    │   ├── journey-audit.ts        ← single-call narrative (inspect)
    │   └── audit-report.ts         ← periodic report (report)
    │
    ├── avoxi/
    │   ├── client.ts               ← typed HTTP client over /cdrs, /agents, /live, /alerts
    │   ├── auth.ts                 ← bearer-token handling + startup scope check
    │   ├── endpoints.ts            ← URL constants (one diff per Avoxi change)
    │   ├── types.ts                ← AvoxiCdr, AgentAction, AvoxiAgent, …
    │   └── recording.ts            ← the only module that downloads audio (gated)
    │
    ├── domain/
    │   ├── schedule.ts             ← on-call window predicates (tz-aware, pure)
    │   ├── missed-call.ts          ← classifier: missed? + MissedReason
    │   ├── journey.ts              ← AvoxiCdr → JourneyTimeline (the key fn)
    │   └── report.ts               ← aggregation + trends for periodic reports
    │
    ├── tools/
    │   ├── index.ts                ← tool catalog + dispatcher (LLM-facing)
    │   ├── call-list.ts            ← list_calls
    │   ├── call-journey.ts         ← get_call_journey
    │   ├── recording.ts            ← get_recording_url
    │   ├── transcription.ts        ← transcribe_call  (privacy-gated)
    │   ├── agents.ts               ← list_agents + get_agent_timeline
    │   ├── live.ts                 ← get_live_team
    │   ├── alerts.ts               ← list_alert_logs
    │   └── schedule.ts             ← is_on_call + classify_call (pure)
    │
    ├── privacy/
    │   ├── policy.ts               ← declarative policy from config/privacy.yaml
    │   └── gate.ts                 ← the single runtime choke point
    │
    ├── storage/
    │   ├── audit-log.ts            ← SQLite access layer
    │   └── schema.sql              ← tables: audit_runs · audited_calls ·
    │                                 notifications · privacy_decisions
    │
    ├── notifier/
    │   ├── index.ts                ← dispatcher
    │   ├── slack.ts
    │   ├── email.ts
    │   ├── webhook.ts
    │   └── whatsapp.ts             ← optional — replaces the manual group chat
    │
    └── report/
        ├── render-markdown.ts
        └── render-html.ts
```

All `.ts` files are doc-header-only skeletons for now — implementation
comes next. Each file names its responsibility, surface, and external
dependencies so any contributor can pick one up in isolation.

---

## 4. Operating modes

| Mode | Command | Purpose |
|---|---|---|
| Batch audit | `pnpm audit [--since=<iso>] [--until=<iso>]` | Audit a window (default: previous on-call shift) and produce a report. |
| Watch daemon | `pnpm watch` | Long-running; polls `/cdrs` during on-call windows and alerts on new unanswered calls. Replaces the manual WhatsApp flow. |
| Inspect | `pnpm inspect <avoxi_call_id>` | Replaces the "look it up on the Avoxi panel" step. Prints a full journey + LLM audit. |
| Report | `pnpm report [--from] [--to] [--format=md\|html]` | Daily/weekly/monthly rollup for stakeholders. |
| Dashboard | `pnpm dashboard` | Web UI at `http://localhost:3000` with SSE live feed + historical browse. |

---

## 5. Environment

Required to start the agent at all:

- `AVOXI_API_TOKEN` — bearer token with scope for CDRs, agents, live, alerts.
- `LLM_PROVIDER` + the matching `*_API_KEY`.

Recommended:

- `COMPANY_NAME=Grupo Wellness`
- `SLACK_WEBHOOK_URL` (or another notifier)

Privacy flags (all default **off**):

- `RECORDINGS_ENABLED`
- `TRANSCRIPTION_ENABLED`
- `TRANSCRIPTION_PROVIDER`

See `.env.example` for the complete list and `docs/PRIVACY.md` for the
governance model.

---

## 6. Roadmap

| Milestone | Scope |
|---|---|
| **M1 — skeleton** (this commit) | File tree + architecture + policy documents. No runtime code. |
| **M2 — read path** | `avoxi/client.ts`, `domain/journey.ts`, `domain/missed-call.ts`, `domain/schedule.ts`, `storage/`, `cli/audit.ts`. Validates end-to-end against real Avoxi traffic without any LLM. |
| **M3 — LLM audit** | Port/rewrite the agent loop + tools + prompts. `cli/inspect` and `cli/report` become useful. |
| **M4 — watch + notifier** | Cron daemon + Slack/WhatsApp. This is the piece that replaces the manual WhatsApp flow. |
| **M5 — dashboard** | Web UI with live SSE feed and historical browse. |
| **M6 — recording audit** | Flip privacy flags on after legal review. Implement `transcription.ts` + redaction pipeline. |

---

## 7. Why not just subscribe to Avoxi's own alerts?

Avoxi has `/alerts/logs` — we use it, but as an input, not the system
of record. Two reasons:

1. **Avoxi's alerts are infra-oriented** (trunk down, API errors). They
   don't fire on "a customer called at 03:17 ART during the weeknight
   on-call window and nobody picked up" — because that's not a
   malfunction from Avoxi's point of view.
2. **We want on-call-aware classification.** The same missed call
   at 14:00 on a Tuesday is "expected; business hours, not our
   problem" and at 03:17 on Wednesday is "page the on-call tech". Only
   our schedule knows this.

Avoxi's alerts are cross-referenced in reports ("this gap coincides with
Avoxi incident #abc123") but never drive detection on their own.
