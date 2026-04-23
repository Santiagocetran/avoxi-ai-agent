# avoxi-ai-agent — Project Report

**GrupoWellness Software Team / April 2026**

---

## What It Is

An AI-powered VoIP operations monitoring agent for GrupoWellnessLatina. It connects to the **AVOXI telephony API** and uses an **LLM with function-calling** (tool use) to autonomously diagnose call quality issues, detect anomalies, and report health status in plain language.

Two operating modes:

- **CLI** — answer ad-hoc questions: `pnpm query "why are calls failing?"`
- **Monitor** — background daemon that runs health checks on a cron schedule (default: every 5 min)

---

## Directory Tree

```
avoxi-ai-agent/
├── .env.example          ← all configurable variables with defaults
├── .gitignore            ← excludes node_modules/, dist/, .env
├── package.json          ← deps + pnpm scripts
├── tsconfig.json         ← TypeScript: ES2022, NodeNext, strict
├── README.md             ← usage docs
└── src/
    ├── agent.ts          ← core multi-turn LLM loop (max 8 rounds)
    ├── cli.ts            ← entry point: pnpm query "<question>"
    ├── monitor.ts        ← entry point: pnpm monitor (cron daemon)
    ├── config.ts         ← env var loader & validator
    ├── llm.ts            ← LLM client factory (Kimi or Hermes)
    ├── prompts/
    │   └── system.ts     ← system prompt + health-check instructions
    └── tools/
        ├── avoxi.ts      ← AVOXI API client + data models
        └── index.ts      ← tool schemas (JSON Schema) + dispatcher
```

---

## Architecture

```
User / Cron trigger
        │
        ▼
 cli.ts or monitor.ts          ← entry points
        │
        ▼
   config.ts                   ← load & validate env vars
        │
        ▼
   llm.ts (buildLlmClient)     ← create OpenAI-compatible client
        │
        ▼
   agent.ts (runAgent)         ← multi-turn loop
   ┌─────────────────────────────────────────────────┐
   │  1. Build messages: [system prompt, user query] │
   │  2. Call LLM with tool schemas                  │
   │  3. If LLM calls a tool → dispatch it           │
   │  4. Append tool result → go to step 2           │
   │  5. If LLM says "stop" → return final answer    │
   │  (max 8 rounds)                                 │
   └─────────────────────────────────────────────────┘
        │
        ▼
   tools/index.ts              ← dispatcher routes to:
        │
        ├── get_system_health   → avoxi.ts:getSystemHealth
        ├── get_cdr_summary     → avoxi.ts:getCdrSummary
        ├── get_cdrs            → avoxi.ts:getCdrs
        ├── get_active_calls    → avoxi.ts:getActiveCalls
        ├── get_trunks          → avoxi.ts:getTrunks
        └── get_dids            → avoxi.ts:getDids
                │
                ▼
        AVOXI REST API v2       ← https://api.avoxi.com/v2
        Auth: X-API-Key header
```

---

## LLM Providers

| Provider | Type | Model | Base URL |
|---|---|---|---|
| **Kimi (Moonshot AI)** | Cloud | `moonshot-v1-32k` | `https://api.moonshot.cn/v1` |
| **Hermes 3 (Ollama)** | Local | `hermes3` | `http://localhost:11434/v1` |

Both use the OpenAI-compatible API format. Switch via `LLM_PROVIDER=kimi|hermes` in `.env`.

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

Output format from the monitor:

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
| `openai` | ^4.52.0 | LLM client (OpenAI-compatible for Kimi & Ollama) |
| `node-cron` | ^3.0.3 | Cron scheduler for monitor daemon |
| `dotenv` | ^16.4.5 | `.env` file loading |
| `chalk` | ^5.3.0 | Colored terminal output |
| `zod` | ^3.23.8 | Schema validation (available, not yet wired) |
| `tsx` | dev | Run TypeScript directly without compile step |

---

## Scripts

```bash
pnpm query "your question"   # ad-hoc CLI query
pnpm monitor                 # start background cron monitor
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
| `LLM_PROVIDER` | no | `kimi` | `kimi` or `hermes` |
| `KIMI_API_KEY` | if kimi | — | Moonshot AI API key |
| `KIMI_MODEL` | no | `moonshot-v1-32k` | Kimi model name |
| `HERMES_BASE_URL` | no | `http://localhost:11434/v1` | Ollama endpoint |
| `HERMES_MODEL` | no | `hermes3` | Ollama model name |
| `MONITOR_CRON` | no | `*/5 * * * *` | Cron schedule |
| `FAILURE_RATE_CRITICAL` | no | `40` | Critical threshold (%) |
| `FAILURE_RATE_WARNING` | no | `15` | Warning threshold (%) |
| `SHORT_CALL_WARNING` | no | `20` | Short-call threshold (%) |
| `MIN_CALLS_FOR_DETECTION` | no | `5` | Min calls before alerting |
| `SLACK_WEBHOOK_URL` | no | — | Slack alert webhook |
| `ALERT_EMAIL` | no | — | Email alert recipient |

---

## What's Working (Skeleton)

- Full agent loop with tool-calling and multi-turn reasoning
- All 6 AVOXI API integrations with TypeScript types
- Both entry points (CLI + monitor daemon)
- System prompt with severity logic and SIP code interpretation
- Config validation with helpful error messages
- `.gitignore`, `.env.example`, `README.md`

---

## What's Not Yet Implemented

- Slack webhook alerting (env vars defined, send logic not wired)
- Email alerting via SMTP (env vars defined, send logic not wired)
- Pagination beyond 1,000 CDRs in `getCdrSummary`
- Test suite (unit + integration)
- Docker / deployment configuration
- Multi-tenant / multi-account support
- Web dashboard or API surface

---

## Git Repository

Initialized at `avoxi-ai-agent/` with the full skeleton in the initial commit. The `.env` file is gitignored — credentials are never committed.

```bash
git log --oneline
# 3762227 Initial commit: avoxi-ai-agent skeleton
```
