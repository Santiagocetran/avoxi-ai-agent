# avoxi-ai-agent

**An agent that audits Avoxi's call journey via the v2 API and reports
unanswered calls during on-call hours.**

---

## 1. What the project does

1. Pulls every call in a window from `GET /cdrs`.
2. Reconstructs each call's journey client-side from the CDR fields
   (Avoxi v2 exposes no dedicated journey endpoint).
3. Classifies each call as missed / not missed against an on-call
   calendar, tagging a reason from a controlled vocabulary.
4. Sends the classified set to an LLM and returns a narrative report.

One command:

```bash
pnpm audit [--since=<iso>] [--until=<iso>]
```

Default window when no flags are given: the previous completed on-call shift
(e.g. last night 21:00 → 09:00 ART).

---

## 2. Design principles

This project follows John Ousterhout's *A Philosophy of Software Design*:

- **Deep modules.** Every file hides substantial complexity behind a narrow
  interface. `avoxi.ts` hides HTTP, auth, pagination and retries behind a
  single factory. `journey.ts` hides all classification rules behind
  `classify(call, schedule)`.
- **Information hiding.** Avoxi's wire shape (`avoxi_call_id`, `agent_actions`,
  etc.) stops at `avoxi.ts`. Downstream modules see domain-neutral names.
  Provider-specific LLM base URLs stop at `config.ts`; every other module
  receives a plain URL string.
- **Define errors out of existence.** `listCalls` returns `[]` for empty
  windows. `classify` never throws; unknown shapes fall to `reason: 'unknown'`.
  `Analysis` is a discriminated union — `reason` only exists on the type when
  `missed: true`, so answered calls cannot accidentally carry a miss reason.
- **Pure where it can be.** `journey.ts` has no I/O and no dependency on
  `Date.now()`. Its only time anchors are `call.startedAt` and the explicit
  `now` argument to `previousShift`.
- **Strategic > tactical.** Five modules beats thirty-eight; the shape chosen
  here is what M2 and M3 will extend without changing.

---

## 3. Architecture

```
cli.ts
  │
  ├─ loadConfig()                        → AppConfig
  │    dotenv + schedule.yaml + zod
  │    resolves provider base URL here
  │
  └─ auditWindow(since, until, config)
       │
       ├─ createAvoxiClient(cfg)
       │    .listCalls(since, until)     → Call[]
       │    fetch · bearer auth · pagination · 3× backoff
       │    wire shape private behind zod schema
       │
       ├─ classify(call, schedule)       → Analysis
       │    pure · no I/O · no Date.now()
       │    Analysis = { missed: true, reason, steps }
       │             | { missed: false, steps }
       │
       └─ OpenAI({ apiKey, baseURL })    → markdown narrative
            compact JSON summary → system + user prompt
```

No dashboards, no persistence, no notifications, no function-calling
agent loop. Those are deferred — see §6.

---

## 4. File tree

```
avoxi-ai-agent/
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── .env.example
├── .gitignore
├── config/
│   └── schedule.yaml       ← on-call windows (ART, Grupo Wellness defaults)
└── src/
    ├── cli.ts              ← entry point; argv → auditWindow → stdout
    ├── config.ts           ← .env + schedule.yaml → validated AppConfig
    ├── avoxi.ts            ← Avoxi v2 client; hides HTTP, pagination, wire shape
    ├── journey.ts          ← classify / isOnCall / previousShift — pure
    └── audit.ts            ← orchestrator; list → classify → LLM narrative
```

---

## 5. Module contracts

| Module | Surface | Hides |
|---|---|---|
| `config.ts` | `loadConfig(): AppConfig` | env parsing, YAML parsing, zod validation, defaults, per-provider LLM base URL resolution |
| `avoxi.ts` | `createAvoxiClient(cfg): { listCalls(since, until): Promise<Call[]> }` | HTTP, bearer auth, base URL, pagination, retries, response envelope, wire→domain mapping |
| `journey.ts` | `classify(call, schedule): Analysis`<br>`isOnCall(at, schedule): boolean`<br>`previousShift(now, schedule): { since, until }` | journey reconstruction rules, missed-call taxonomy, timezone arithmetic |
| `audit.ts` | `auditWindow(since, until, config): Promise<string>` | LLM client construction, prompt text, output formatting |
| `cli.ts` | — | argv parsing, window resolution |

### Key types

```ts
// config.ts
AppConfig = {
  avoxi:       { token: string; baseUrl: string };
  llm:         { provider: 'kimi'|'openai'|'gemini'; apiKey: string;
                 model: string; baseUrl: string };   // baseUrl always resolved
  schedule:    Schedule;
  companyName: string;
};

// avoxi.ts
Call  = { id, status, direction, from, to, startedAt, answeredAt?,
          endedAt, forwardedTo, events, priorExtension?, finalDestination? };
Event = { at: Date; kind: string; actor?: string };

// journey.ts
Analysis = { steps: Step[]; missed: true;  reason: MissReason }
         | { steps: Step[]; missed: false };            // discriminated union

MissReason = 'no_agent_on_duty' | 'agent_declined' | 'ring_timeout'
           | 'queue_abandoned'  | 'voicemail_left'  | 'voicemail_empty'
           | 'routing_failure'  | 'off_hours_expected' | 'unknown';
```

---

## 6. Roadmap

| Phase | Status | Scope |
|---|---|---|
| **M1 — MVP** | ✅ Done | Five modules implemented. `pnpm audit` produces a narrative for any window. |
| **M2 — Recording audit** | Pending legal | Extend `avoxi.ts` with the 24 h pre-signed recording URL; pipe audio through transcription + redaction; distinguish `voicemail_empty` from `voicemail_left`. |
| **M3 — Continuous operation** | Deferred | Watch daemon (replaces manual WhatsApp flow), SQLite persistence for deduplication, notifier (Slack/WhatsApp), dashboard for historical browse. |

Every phase adds to the tree; the five MVP module contracts are stable.

### M1 open items

Before running against production, verify the Avoxi wire field names in
`avoxi.ts` against a live `/cdrs` response. Known confirmed: `avoxi_call_id`,
`agent_actions`, `{ data: [...] }` envelope. Fields marked `// TODO(M1)`:
`caller_id`, `dialed_number`, `start_time`, `end_time`, `forwarded_to`,
`next_cursor`. Drop a sample in `tmp/sample-cdrs.json` to align.

---

## 7. Environment

Required:

- `AVOXI_API_TOKEN` — bearer token with CDR read scope.
- `LLM_PROVIDER` — one of `kimi | openai | gemini`.
- `LLM_API_KEY` — API key for the chosen provider.
- `LLM_MODEL` — model name (e.g. `moonshot-v1-32k`, `gpt-4o`, `gemini-1.5-pro`).

Optional:

- `AVOXI_BASE_URL` — defaults to `https://genius.avoxi.com/api/v2`.
- `LLM_BASE_URL` — overrides the default base URL for the chosen provider.
- `COMPANY_NAME` — quoted in the narrative; defaults to `"your company"`.

See `.env.example` for the full list.

---

## 8. Why not just subscribe to Avoxi's own alerts?

Avoxi's alerts (`/alerts/logs`) fire on infrastructure conditions —
trunk down, API errors. They don't fire on "a customer called at
03:17 ART during weeknight on-call and nobody picked up" because that
isn't a malfunction from Avoxi's point of view. Only our `schedule`
knows it is. Avoxi's alerts are useful *context* for later phases; they
are not the detector.
