# avoxi-ai-agent — Project Report

**GrupoWellness Software Team / April 2026**

---

## What It Is

An AI-powered VoIP operations monitoring agent for GrupoWellnessLatina. It connects to the **AVOXI telephony API** and uses an **LLM with function-calling** (tool use) to autonomously diagnose call quality issues, detect anomalies, and report health status in plain language.

Three operating modes:

| Mode | Command | Description |
|---|---|---|
| **CLI** | `pnpm query "…"` | Ad-hoc question answered once and exit |
| **Monitor** | `pnpm monitor` | Background cron daemon, prints to stdout |
| **Dashboard** | `pnpm dashboard` | Web UI + cron daemon at `http://localhost:3000` |

---

## Directory Tree

```
avoxi-ai-agent/
├── .env.example               ← all configurable variables with defaults
├── .gitignore                 ← excludes node_modules/, dist/, .env
├── package.json               ← deps + pnpm scripts
├── tsconfig.json              ← TypeScript: ES2022, NodeNext, strict
├── README.md                  ← usage docs
├── PROJECT_REPORT.md          ← this file
├── web/
│   └── index.html             ← single-page dashboard UI (vanilla JS, no framework)
└── src/
    ├── agent.ts               ← core multi-turn LLM loop (max 8 rounds)
    ├── cli.ts                 ← entry point: pnpm query "<question>"
    ├── monitor.ts             ← entry point: pnpm monitor (cron daemon → stdout)
    ├── config.ts              ← env var loader & validator
    ├── llm.ts                 ← LLM client factory (Kimi / OpenAI / Gemini / Claude)
    ├── llm-claude.ts          ← Anthropic SDK adapter (skeleton — see below)
    ├── prompts/
    │   └── system.ts          ← system prompt + health-check instructions
    ├── tools/
    │   ├── avoxi.ts           ← AVOXI API client + TypeScript data models
    │   └── index.ts           ← tool schemas (JSON Schema) + dispatcher
    └── dashboard/
        ├── server.ts          ← Express-style HTTP server + SSE + cron loop
        └── store.ts           ← in-memory state: status, history, activity feed
```

---

## Full Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Entry points  (pick one)                                       │
│                                                                 │
│   pnpm query      →  cli.ts             one-shot, stdout        │
│   pnpm monitor    →  monitor.ts         cron loop, stdout       │
│   pnpm dashboard  →  dashboard/server   cron loop + web UI      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              config.ts  ──  loads .env, validates required vars
                           │
                           ▼
              llm.ts  ──  builds the LLM client
              │
              ├─ kimi   / openai / gemini  →  openai SDK
              └─ claude                   →  ClaudeAdapter [SKELETON]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  agent.ts  —  multi-turn loop (max 8 rounds)                    │
│                                                                 │
│  1. send [system prompt + user query] to LLM                    │
│  2. LLM returns tool call  →  dispatch to tools/index.ts        │
│  3. append result, repeat until LLM returns plain text          │
│                                                                 │
│  callbacks: onToolCall / onToolResult                           │
│    · monitor    →  print to stdout                              │
│    · dashboard  →  push event to store → broadcast via SSE      │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
     tools/index.ts  ──  dispatches to avoxi.ts
     │
     ├─ get_system_health    ├─ get_active_calls
     ├─ get_cdr_summary      ├─ get_trunks
     ├─ get_cdrs             └─ get_dids
     │
     └──▶  AVOXI REST API v2  (auth: X-API-Key)
```

**Dashboard data flow (when using `pnpm dashboard`)**

```
agent callbacks
      │  push events
      ▼
dashboard/store.ts  ──  holds current severity, last 50 checks, last 30 tool events
      │  SSE broadcast
      ▼
dashboard/server.ts  ──  GET /events (SSE)  ·  GET /api/status  ·  GET /api/history
      │
      ▼
web/index.html  ──  live status badge · agent activity feed · check history table
```

---

## LLM Providers

| Provider | Type | Default Model | Base URL | SDK |
|---|---|---|---|---|
| **Kimi** (Moonshot AI) | Cloud | `moonshot-v1-32k` | `https://api.moonshot.cn/v1` | `openai` |
| **OpenAI** | Cloud | `gpt-4o` | `https://api.openai.com/v1` | `openai` |
| **Gemini** (Google) | Cloud | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta/openai/` | `openai` |
| **Claude** (Anthropic) | Cloud | `claude-sonnet-4-6` | Anthropic API | `@anthropic-ai/sdk` *(adapter)* |

Switch via `LLM_PROVIDER=kimi|openai|gemini|claude` in `.env`.

Kimi, OpenAI, and Gemini all speak the OpenAI-compatible wire format — they share the same `openai` SDK. Claude uses the Anthropic SDK which has a different message format; `src/llm-claude.ts` provides a thin adapter that normalises it to look like an OpenAI client so `agent.ts` needs zero changes.

### Claude Adapter Status (SKELETON)

`src/llm-claude.ts` defines the `ClaudeAdapter` class with pseudo-code comments explaining what each conversion step needs to do:

| Step | OpenAI format | Anthropic format |
|---|---|---|
| Tool definitions | `parameters` (JSON Schema) | `input_schema` |
| Tool results | `role: "tool"` messages | Content blocks inside `role: "user"` |
| Stop reason | `finish_reason: "stop"` / `"tool_calls"` | `stop_reason: "end_turn"` / `"tool_use"` |

To complete it: `pnpm add @anthropic-ai/sdk`, then implement `_convertTools()`, `_convertMessages()`, and `_convertResponse()` inside the adapter.

---

## Dashboard UI

### What it shows

| Section | Content |
|---|---|
| **Status badge** | Current severity (CRITICAL / WARNING / INFO / UNKNOWN) — color-coded, pulses on active alerts |
| **Last check summary** | Full LLM response text from the most recent health check |
| **Live activity feed** | Real-time stream of every tool call the agent makes and its results |
| **Check history table** | Last 50 checks with timestamp, severity, and one-line summary |
| **Connection indicator** | SSE live / reconnecting |

### How it works

1. `pnpm dashboard` starts `src/dashboard/server.ts`
2. The server runs the same monitor loop as `pnpm monitor` (same cron, same agent)
3. Instead of printing to stdout, it pushes events to `src/dashboard/store.ts`
4. Any browser tab open at `http://localhost:3000` subscribes to `GET /events` (SSE)
5. The store broadcasts each tool call and check result via SSE in real time
6. `web/index.html` receives SSE events and updates the UI without page reload

### REST endpoints

| Endpoint | Method | Returns |
|---|---|---|
| `/` | GET | Dashboard HTML page |
| `/api/status` | GET | `{ severity, lastCheckAt }` |
| `/api/history` | GET | Array of last 50 `CheckResult` objects |
| `/events` | GET | SSE stream (text/event-stream) |

### SSE event types

| Event type | Payload | When sent |
|---|---|---|
| `snapshot` | Full `DashboardState` | On SSE connect (initial load) |
| `check_result` | `CheckResult` | After each completed health check |
| `activity` | `ActivityEvent` | On every tool call, tool result, check start/end |

### No external notification dependencies

The dashboard is self-contained: no Slack, no email, no webhooks needed. Any team member opens a browser — they see the current state and live activity. Multiple tabs can be open simultaneously; all receive the same SSE stream.

---

## Available Tools (Function Calls)

| Tool | What it does |
|---|---|
| `get_system_health` | Probes AVOXI API availability and measures latency |
| `get_cdr_summary` | Aggregates up to 1,000 CDRs: failure rate, short-call rate, avg duration, SIP code breakdown |
| `get_cdrs` | Fetches raw Call Detail Records with filters (date range, disposition, DID, direction) |
| `get_active_calls` | Returns all currently active calls in real time |
| `get_trunks` | Lists SIP trunks with status and concurrent call counts |
| `get_dids` | Lists DID phone numbers with status and assignment |

---

## Data Models

### Cdr (Call Detail Record)

```typescript
{
  call_id: string
  start_time: string           // ISO 8601
  end_time: string
  duration_seconds: number
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  did_number: string
  disposition: 'answered' | 'no-answer' | 'busy' | 'failed' | 'cancelled'
  sip_response_code: number
  short_call: boolean
  recording_url: string | null
}
```

### ActiveCall

```typescript
{
  call_id: string
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  did_number: string
  started_at: string           // ISO 8601
  duration_seconds: number
  trunk_id: string
}
```

### Trunk

```typescript
{
  id: string
  name: string
  status: 'active' | 'inactive' | 'error'
  concurrent_calls: number
  max_concurrent_calls: number
  region: string
}
```

### Did (Phone Number)

```typescript
{
  number: string
  status: 'active' | 'suspended' | 'porting'
  trunk_id: string | null
  label: string | null
  country: string
}
```

---

## Alert Severity Thresholds (configurable via `.env`)

| Severity | Condition |
|---|---|
| **CRITICAL** | Failure rate ≥ 40% · Trunk down · >50% DIDs suspended · API unreachable |
| **WARNING** | Failure rate 15–40% · Short-call rate ≥ 20% · Trunk >80% capacity · API latency > 2s |
| **INFO** | Everything within normal range |

Output format:

```
[SEVERITY] Brief headline
- Metric: value (threshold: X)
- Affected: component name / phone number / trunk
- Action: what to do next
```

---

## SIP Response Code Reference

| Code | Meaning |
|---|---|
| 200 | OK — call answered |
| 403 | Forbidden — auth/permissions issue |
| 404 | Not Found — wrong number or routing |
| 408 | Request Timeout — network issue |
| 480 | Temporarily Unavailable — destination unreachable |
| 500 | Server Error — AVOXI or carrier internal error |
| 503 | Service Unavailable — trunk overloaded or down |
| 603 | Decline — call explicitly rejected |

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `openai` | ^4.52.0 | LLM client — used by Kimi, OpenAI, Gemini (compatible endpoints) |
| `node-cron` | ^3.0.3 | Cron scheduler (monitor daemon + dashboard loop) |
| `dotenv` | ^16.4.5 | `.env` file loading |
| `chalk` | ^5.3.0 | Colored terminal output (CLI + monitor) |
| `zod` | ^3.23.8 | Schema validation (available, not yet wired) |
| `tsx` | dev | Run TypeScript directly without compile step |

**To add when completing Claude adapter:**
```bash
pnpm add @anthropic-ai/sdk
```

---

## Scripts

```bash
pnpm query "your question"   # ad-hoc CLI query
pnpm monitor                 # background cron monitor (stdout)
pnpm dashboard               # web dashboard at http://localhost:3000
pnpm build                   # compile TypeScript → dist/
pnpm typecheck               # type-check without emitting
```

---

## Environment Variables

Copy `.env.example` → `.env` and fill in credentials. `.env` is gitignored.

| Variable | Required | Default | Description |
|---|---|---|---|
| `AVOXI_API_KEY` | yes | — | AVOXI admin API key |
| `AVOXI_ACCOUNT_ID` | yes | — | AVOXI account ID |
| `LLM_PROVIDER` | no | `kimi` | `kimi` \| `openai` \| `gemini` \| `claude` |
| `KIMI_API_KEY` | if kimi | — | Moonshot AI API key |
| `KIMI_MODEL` | no | `moonshot-v1-32k` | Kimi model name |
| `OPENAI_API_KEY` | if openai | — | OpenAI API key |
| `OPENAI_MODEL` | no | `gpt-4o` | OpenAI model name |
| `GEMINI_API_KEY` | if gemini | — | Google AI Studio API key |
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | Gemini model name |
| `CLAUDE_API_KEY` | if claude | — | Anthropic API key |
| `CLAUDE_MODEL` | no | `claude-sonnet-4-6` | Claude model name |
| `MONITOR_CRON` | no | `*/5 * * * *` | Cron schedule |
| `DASHBOARD_PORT` | no | `3000` | Dashboard web server port |
| `FAILURE_RATE_CRITICAL` | no | `40` | Critical threshold (%) |
| `FAILURE_RATE_WARNING` | no | `15` | Warning threshold (%) |
| `SHORT_CALL_WARNING` | no | `20` | Short-call threshold (%) |
| `MIN_CALLS_FOR_DETECTION` | no | `5` | Min calls before alerting |
| `SLACK_WEBHOOK_URL` | no | — | Slack alert webhook *(not yet wired)* |
| `ALERT_EMAIL` | no | — | Email alert recipient *(not yet wired)* |

---

## What's Complete (Skeleton)

- Full agent loop with tool-calling and multi-turn reasoning
- All 6 AVOXI API integrations with TypeScript types
- All three entry points (CLI, monitor, dashboard)
- 4 LLM providers (Kimi, OpenAI, Gemini fully wired; Claude adapter skeleton)
- Dashboard web UI (HTML/CSS/JS, no framework, SSE-based live updates)
- In-memory state store with SSE broadcast
- System prompt with severity logic and SIP code interpretation
- Config validation with helpful error messages

## What's Not Yet Implemented

| Item | Where | Notes |
|---|---|---|
| Claude adapter | `src/llm-claude.ts` | `@anthropic-ai/sdk` install + 3 conversion methods |
| Slack webhook | `src/monitor.ts` + `src/dashboard/server.ts` | env var defined, POST not wired |
| Email via SMTP | same | env vars defined, send logic not wired |
| CDR pagination > 1,000 | `src/tools/avoxi.ts:getCdrSummary` | cursor-based pagination needed |
| Test suite | — | unit + integration tests |
| Docker / deployment | — | Dockerfile + docker-compose |
| Express (optional) | `src/dashboard/server.ts` | using vanilla `http` now; swap to express for middleware |

---

## Git Repository

```bash
git log --oneline
# 8504558 Add PROJECT_REPORT.md for GrupoWellness dev team
# 3762227 Initial commit: avoxi-ai-agent skeleton
```

`.env` is gitignored — credentials are never committed. Copy `.env.example` → `.env` to run locally.
