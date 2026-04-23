# avoxi-ai-agent

AI-powered VoIP operations monitoring agent for the AVOXI telephony platform.
Connects to the AVOXI API via LLM function-calling to diagnose call quality issues, detect anomalies, and report health status in plain language.

---

## Operating modes

| Mode | Command | Description |
|---|---|---|
| **CLI** | `pnpm query "…"` | Ad-hoc question — answered once, then exit |
| **Monitor** | `pnpm monitor` | Background cron daemon, prints to stdout |
| **Dashboard** | `pnpm dashboard` | Web UI + cron daemon at `http://localhost:3000` |

---

## Directory tree

```
avoxi-ai-agent/
├── .env.example               ← all configurable variables with defaults
├── .gitignore
├── package.json
├── tsconfig.json
├── web/
│   └── index.html             ← single-page dashboard UI (vanilla JS, no framework)
└── src/
    ├── agent.ts               ← core multi-turn LLM loop (max 8 rounds)
    ├── cli.ts                 ← entry point: pnpm query
    ├── monitor.ts             ← entry point: pnpm monitor (cron → stdout)
    ├── config.ts              ← env var loader & validator
    ├── llm.ts                 ← LLM client factory
    ├── llm-claude.ts          ← Anthropic SDK adapter (skeleton)
    ├── prompts/
    │   └── system.ts          ← system prompt + health-check instructions
    ├── tools/
    │   ├── avoxi.ts           ← AVOXI API client + TypeScript data models
    │   └── index.ts           ← tool schemas (JSON Schema) + dispatcher
    └── dashboard/
        ├── server.ts          ← HTTP server + SSE endpoint + cron loop
        └── store.ts           ← in-memory state: status, history, activity feed
```

---

## Architecture

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
              ├─ kimi / openai / gemini  →  openai SDK
              └─ claude                 →  ClaudeAdapter [SKELETON]
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
│    · dashboard  →  push to store → broadcast via SSE            │
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

**Dashboard data flow**

```
agent callbacks
      │  push events
      ▼
dashboard/store.ts  ──  current severity · last 50 checks · last 30 tool events
      │  SSE broadcast
      ▼
dashboard/server.ts  ──  GET /events (SSE) · GET /api/status · GET /api/history
      │
      ▼
web/index.html  ──  status badge · live activity feed · check history table
```

---

## LLM providers

| Provider | `LLM_PROVIDER` value | Default model | SDK |
|---|---|---|---|
| Kimi (Moonshot AI) | `kimi` | `moonshot-v1-32k` | `openai` |
| OpenAI | `openai` | `gpt-4o` | `openai` |
| Google Gemini | `gemini` | `gemini-2.0-flash` | `openai` (compatible endpoint) |
| Anthropic Claude | `claude` | `claude-sonnet-4-6` | `@anthropic-ai/sdk` *(adapter — skeleton)* |

Kimi, OpenAI, and Gemini all speak the OpenAI-compatible wire format and share the same SDK. Claude uses the Anthropic SDK; `src/llm-claude.ts` adapts it to the same interface so `agent.ts` needs no changes.

To complete the Claude adapter: `pnpm add @anthropic-ai/sdk`, then implement the three conversion methods inside `src/llm-claude.ts`.

---

## Dashboard

`pnpm dashboard` starts a web server at `http://localhost:3000` that runs the same monitor loop and exposes a live UI — no Slack, no email, no external services needed.

| Section | What it shows |
|---|---|
| Status badge | Current severity (CRITICAL / WARNING / INFO) — color-coded, pulses on active alerts |
| Last check summary | Full LLM response from the most recent health check |
| Live activity feed | Real-time stream of every tool call the agent makes |
| Check history | Last 50 checks with timestamp, severity, and summary |

REST endpoints: `GET /` (UI) · `GET /api/status` · `GET /api/history` · `GET /events` (SSE stream)

---

## Setup

### Prerequisites

- Node.js ≥ 20 and pnpm
- An AVOXI admin API key + account ID
- An API key for your chosen LLM provider

### Install

```bash
pnpm install
cp .env.example .env
# edit .env — fill in AVOXI_API_KEY, AVOXI_ACCOUNT_ID, and your LLM credentials
```

### Verify

```bash
pnpm query "Is the AVOXI system healthy right now?"
```

---

## Usage

### Ad-hoc queries

```bash
pnpm query "What was the failure rate in the last hour?"
pnpm query "Show me all failed calls between 2pm and 4pm today"
pnpm query "Are there any suspended or porting DIDs?"
pnpm query "Which trunks are close to capacity?"
pnpm query "What SIP error codes are we seeing most in the last 2 hours?"
pnpm query "Walk me through everything that happened between 10am and 11am today"
```

### Background monitor (stdout)

```bash
pnpm monitor
# pipe to a log file:
pnpm monitor >> /var/log/avoxi-agent.log 2>&1
```

### Web dashboard

```bash
pnpm dashboard
# open http://localhost:3000
```

---

## Available tools (function calls)

| Tool | What it does |
|---|---|
| `get_system_health` | Probes AVOXI API availability and measures latency |
| `get_cdr_summary` | Aggregates up to 1,000 CDRs: failure rate, short-call rate, avg duration, SIP breakdown |
| `get_cdrs` | Raw CDR records with filters (date range, disposition, DID, direction) |
| `get_active_calls` | Real-time active call list |
| `get_trunks` | SIP trunk status and concurrent call counts |
| `get_dids` | DID phone numbers with status and assignment |

---

## Alert thresholds (configurable in `.env`)

| Condition | Severity |
|---|---|
| Failure rate ≥ 40% · trunk down · API unreachable | **CRITICAL** |
| Failure rate 15–40% · short-call rate ≥ 20% · trunk >80% capacity · latency >2s | **WARNING** |
| Everything within normal range | **INFO** |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AVOXI_API_KEY` | yes | — | AVOXI admin API key |
| `AVOXI_ACCOUNT_ID` | yes | — | AVOXI account ID |
| `LLM_PROVIDER` | no | `kimi` | `kimi` \| `openai` \| `gemini` \| `claude` |
| `KIMI_API_KEY` | if kimi | — | Moonshot AI key |
| `KIMI_MODEL` | no | `moonshot-v1-32k` | |
| `OPENAI_API_KEY` | if openai | — | OpenAI key |
| `OPENAI_MODEL` | no | `gpt-4o` | |
| `GEMINI_API_KEY` | if gemini | — | Google AI Studio key |
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | |
| `CLAUDE_API_KEY` | if claude | — | Anthropic key |
| `CLAUDE_MODEL` | no | `claude-sonnet-4-6` | |
| `COMPANY_NAME` | no | `your organization` | Used in the LLM system prompt |
| `MONITOR_CRON` | no | `*/5 * * * *` | Cron schedule |
| `DASHBOARD_PORT` | no | `3000` | Web dashboard port |
| `FAILURE_RATE_CRITICAL` | no | `40` | Critical threshold (%) |
| `FAILURE_RATE_WARNING` | no | `15` | Warning threshold (%) |
| `SHORT_CALL_WARNING` | no | `20` | Short-call threshold (%) |
| `MIN_CALLS_FOR_DETECTION` | no | `5` | Min calls before alerting |

---

## What's complete (skeleton)

- Full agent loop with multi-turn tool-calling
- All 6 AVOXI API integrations with TypeScript types
- All three entry points (CLI, monitor, dashboard)
- Kimi, OpenAI, Gemini fully wired; Claude adapter skeleton ready to implement
- Dashboard web UI — SSE-based live updates, no framework
- In-memory state store with SSE broadcast to all connected tabs
- System prompt with severity logic and SIP code guide
- Config validation with clear error messages on missing vars

## What's not yet implemented

| Item | Where | Notes |
|---|---|---|
| Claude adapter | `src/llm-claude.ts` | Install `@anthropic-ai/sdk`, implement 3 conversion methods |
| Slack webhook | `src/monitor.ts` / `src/dashboard/server.ts` | Env var defined, POST not wired |
| Email via SMTP | same | Env vars defined, send logic not wired |
| CDR pagination > 1,000 | `src/tools/avoxi.ts` | Cursor-based pagination needed |
| Test suite | — | Unit + integration tests |
| Docker / deployment | — | Dockerfile + docker-compose |

---

## Troubleshooting

**`AVOXI API error 401`** — `AVOXI_API_KEY` is wrong or expired. Regenerate in AVOXI dashboard.

**`AVOXI API error 403`** — API key lacks CDR read permission. Check scope in Settings → API Access.

**`Missing required env var`** — copy `.env.example` to `.env` and fill in the flagged variable.

**`Agent exceeded 8 tool rounds`** — LLM is looping. Check that tools return valid JSON and the system prompt is unambiguous.

---

## Adding a new tool

1. Add the fetch function to `src/tools/avoxi.ts`
2. Add the JSON Schema definition to the `TOOLS` array in `src/tools/index.ts`
3. Add the dispatch case to `dispatchTool` in `src/tools/index.ts`
4. Update the system prompt in `src/prompts/system.ts` if the LLM needs guidance on when to use it
