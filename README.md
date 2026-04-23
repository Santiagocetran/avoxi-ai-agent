# avoxi-ai-agent

AI agent for monitoring the GrupoWellnessLatina AVOXI telephony platform.
Uses function-calling to query the live AVOXI API and reason over call data in natural language.

**LLM options:** Kimi (Moonshot AI cloud API) or Hermes 3 (local via Ollama) — no Anthropic or Vercel dependency.

---

## What it does

| Mode | Description |
|---|---|
| `pnpm monitor` | Background process. Checks the platform every 5 min, prints severity-labelled reports |
| `pnpm query "..."` | One-shot CLI. Ask any question in plain language, get a structured answer |

### What it monitors
- **CDR analysis** — failure rate, short-call rate, avg duration, SIP code breakdown
- **Active calls** — real-time concurrent call count and trunk usage
- **Trunk health** — status per trunk, capacity saturation
- **DID status** — suspended, porting, or misconfigured phone numbers
- **API health** — AVOXI endpoint availability and latency

### Anomaly thresholds (configurable in `.env`)
| Condition | Level |
|---|---|
| Failure rate ≥ 40% | CRITICAL |
| Failure rate 15–40% | WARNING |
| Short-call rate ≥ 20% | WARNING |
| Trunk capacity > 80% | WARNING |
| AVOXI API down / timeout | CRITICAL |

---

## Prerequisites

### 1. Node.js ≥ 20 and pnpm

```bash
node --version   # must be >= 20
npm i -g pnpm
```

### 2. LLM provider (pick one)

**Option A — Kimi (recommended for production)**

Get an API key from [platform.moonshot.cn](https://platform.moonshot.cn).
Set `LLM_PROVIDER=kimi` and `KIMI_API_KEY=sk-...` in your `.env`.

**Option B — Hermes 3 local via Ollama (no API cost, fully offline)**

```bash
# Install Ollama: https://ollama.com/download
ollama serve                  # start the local server
ollama pull hermes3           # download the model (~4 GB)
```

Set `LLM_PROVIDER=hermes` in your `.env`. No API key needed.

### 3. AVOXI API credentials

1. Log in to your AVOXI admin dashboard.
2. Go to **Settings → API Access** (or **Integrations → API**).
3. Generate or copy your **API Key**.
4. Find your **Account ID** in Settings → Account.

---

## Setup

```bash
# 1. Clone / enter the folder
cd avoxi-ai-agent

# 2. Install dependencies
pnpm install

# 3. Create your .env
cp .env.example .env
# Edit .env — fill in AVOXI_API_KEY, AVOXI_ACCOUNT_ID, and your LLM provider creds

# 4. Verify the connection
pnpm query "Is the AVOXI system healthy right now?"
```

---

## Usage

### Ad-hoc queries (CLI)

```bash
# Current system health
pnpm query "Is the system healthy right now?"

# Last hour summary
pnpm query "What was the failure rate in the last hour?"

# Specific time window
pnpm query "Show me all failed calls between 2pm and 4pm today"

# DID investigation
pnpm query "Are there any suspended or porting DIDs?"

# Trunk status
pnpm query "Which trunks are close to capacity?"

# Deep error analysis
pnpm query "What SIP error codes are we seeing most in the last 2 hours?"

# Incident reconstruction
pnpm query "Walk me through everything that happened between 10am and 11am today"
```

### Background monitor

```bash
pnpm monitor
```

Starts immediately with one health check, then runs every 5 minutes (configurable via `MONITOR_CRON`).
Output is plain text — pipe it wherever you need:

```bash
# Save to log file
pnpm monitor >> /var/log/avoxi-agent.log 2>&1

# Post to Slack (example using curl in a wrapper script)
pnpm monitor | while IFS= read -r line; do
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-type: application/json' \
    -d "{\"text\": \"$(echo "$line" | sed 's/"/\\"/g')\"}"
done
```

---

## Project structure

```
avoxi-ai-agent/
├── src/
│   ├── agent.ts          # Core LLM loop — multi-turn tool calling until final answer
│   ├── cli.ts            # pnpm query entrypoint
│   ├── monitor.ts        # pnpm monitor entrypoint (cron)
│   ├── config.ts         # Loads and validates all env vars
│   ├── llm.ts            # LLM client factory (Kimi / Hermes / any OpenAI-compatible)
│   ├── tools/
│   │   ├── avoxi.ts      # AVOXI API fetch functions (getCdrs, getTrunks, etc.)
│   │   └── index.ts      # OpenAI tool schemas + dispatcher
│   └── prompts/
│       └── system.ts     # System prompt + scheduled check prompt
├── .env.example          # All configurable options with descriptions
├── package.json
└── tsconfig.json
```

---

## Configuration reference

All config lives in `.env`. Copy `.env.example` as your starting point.

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | yes | `kimi` | `kimi` or `hermes` |
| `KIMI_API_KEY` | if kimi | — | Moonshot AI API key |
| `KIMI_MODEL` | no | `moonshot-v1-32k` | Kimi model name |
| `KIMI_BASE_URL` | no | `https://api.moonshot.cn/v1` | Override for proxy |
| `HERMES_BASE_URL` | no | `http://localhost:11434/v1` | Ollama base URL |
| `HERMES_MODEL` | no | `hermes3` | Ollama model tag |
| `AVOXI_API_KEY` | yes | — | AVOXI admin API key |
| `AVOXI_ACCOUNT_ID` | yes | — | AVOXI account ID |
| `AVOXI_BASE_URL` | no | `https://api.avoxi.com/v2` | Override for staging |
| `MONITOR_CRON` | no | `*/5 * * * *` | Cron schedule |
| `FAILURE_RATE_CRITICAL` | no | `40` | % threshold for CRITICAL |
| `FAILURE_RATE_WARNING` | no | `15` | % threshold for WARNING |
| `SHORT_CALL_WARNING` | no | `20` | Short-call % threshold |
| `SLACK_WEBHOOK_URL` | no | — | Slack incoming webhook |

---

## How it works internally

```
User prompt / cron tick
        │
        ▼
  System prompt (role + thresholds + SIP code guide)
        │
        ▼
  LLM (Kimi or Hermes) ─── decides which tools to call
        │
        ▼ (tool_calls)
  Tool dispatcher
    ├─ get_system_health  → AVOXI /numbers (latency probe)
    ├─ get_cdr_summary    → AVOXI /cdr     (aggregated stats)
    ├─ get_cdrs           → AVOXI /cdr     (raw records)
    ├─ get_active_calls   → AVOXI /calls/active
    ├─ get_trunks         → AVOXI /trunks
    └─ get_dids           → AVOXI /numbers
        │
        ▼ (tool results injected back as messages)
  LLM reasons over results → may call more tools (up to 8 rounds)
        │
        ▼
  Final text response with severity label and recommended action
```

The agent loop in `src/agent.ts` runs up to `MAX_TOOL_ROUNDS = 8` iterations.
On each round the LLM either requests tool calls or produces a final answer (`finish_reason: stop`).

---

## Adding a new tool

1. Add the fetch function to `src/tools/avoxi.ts`.
2. Add the OpenAI function schema to the `TOOLS` array in `src/tools/index.ts`.
3. Add the dispatch case to the `dispatchTool` switch in `src/tools/index.ts`.
4. Update the system prompt in `src/prompts/system.ts` if the LLM needs guidance on when to use it.

---

## Switching LLM provider at runtime

```bash
# Use Kimi
LLM_PROVIDER=kimi pnpm query "health check"

# Use local Hermes
LLM_PROVIDER=hermes pnpm query "health check"
```

---

## AVOXI API notes

- Base URL: `https://api.avoxi.com/v2`
- Authentication: `X-API-Key` header (set in `AVOXI_API_KEY`)
- CDR endpoint: `GET /cdr` — supports `start_date`, `end_date`, `disposition`, `did_number`, `direction`, `limit`, `offset`
- The agent fetches up to 1000 CDRs per window for `get_cdr_summary` and aggregates locally (AVOXI v2 has no native aggregation endpoint).
- If your account uses a different base path or authentication scheme, override `AVOXI_BASE_URL` and update `src/tools/avoxi.ts:buildHeaders()`.

---

## Troubleshooting

**`AVOXI API error 401`**
→ `AVOXI_API_KEY` is wrong or expired. Regenerate it in the AVOXI dashboard.

**`AVOXI API error 403`**
→ The API key does not have CDR read permissions. Check the key's permission scope in Settings → API Access.

**`Missing required env var: AVOXI_ACCOUNT_ID`**
→ Add `AVOXI_ACCOUNT_ID=...` to your `.env` file.

**Hermes: `connect ECONNREFUSED 127.0.0.1:11434`**
→ Ollama is not running. Start it with `ollama serve`.

**Hermes: model not found**
→ Run `ollama pull hermes3` to download the model first.

**Kimi: `401 Unauthorized`**
→ Check `KIMI_API_KEY` in `.env`. Keys start with `sk-`.

**Agent exceeds 8 tool rounds**
→ The LLM is looping. Check that the system prompt is clear and that tools are returning valid JSON. Reduce `MAX_TOOL_ROUNDS` in `src/agent.ts` if needed.
