# avoxi-ai-agent

**An agent that audits Avoxi's call journey via the v2 API and reports
unanswered calls during on-call hours.**

Project-proposal MVP. The tree below is the entire scaffold — five
TypeScript modules, one schedule file — designed to communicate the idea
and then grow deliberately.

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

Default window is the previous on-call shift (e.g. last night 21:00 → 09:00 ART).

---

## 2. Design principles

This project follows John Ousterhout's *A Philosophy of Software Design*
from the first commit:

- **Deep modules.** Every file earns its keep by hiding substantial
  complexity behind a narrow interface. `avoxi.ts` hides HTTP, auth,
  pagination and retries behind one function. `journey.ts` hides all
  classification rules behind `classify(call, schedule)`.
- **Information hiding.** Avoxi's wire shape (`avoxi_call_id`,
  `agent_actions`, etc.) stops at `avoxi.ts`. Downstream modules see
  domain-neutral names.
- **Define errors out of existence.** `listCalls` returns `[]` for empty
  windows. `classify` never throws; unknown shapes fall to `reason: 'unknown'`.
- **Pure where it can be.** `journey.ts` has no I/O and no dependency
  on `Date.now()` — its only time anchor is `call.startedAt`. If the
  watch-daemon phase needs "is *now* on-call?", that's a separate
  `isOnCall(at, schedule)` helper, not a parameter contaminating the
  classifier.
- **Strategic > tactical.** Five modules now beats thirty-eight modules
  later; the skeleton's shape is what the real code will inherit.

---

## 3. Architecture

```
   cli.ts
      │
      ▼
   config.loadConfig()          ─► AppConfig
      │                              (avoxi, llm, schedule, companyName)
      ▼
   audit.auditWindow(since, until, config)
      │
      ├──► avoxi.listCalls(since, until)     ─► Call[]
      │         (hides HTTP · auth · pagination · retries)
      │
      ├──► journey.classify(call, schedule)  ─► { steps, missed, reason }
      │         (pure; anchor = call.startedAt)
      │
      └──► LLM (OpenAI-wire)                 ─► narrative (markdown)
```

No dashboards, no persistence, no notifications, no function-calling
agent loop. Those are deferred — see §6.

---

## 4. File tree

```
avoxi-ai-agent/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── config/
│   └── schedule.yaml       ← on-call windows (ART default)
└── src/
    ├── cli.ts              ← entry point; argv → auditWindow → stdout
    ├── config.ts           ← .env + schedule.yaml → validated AppConfig
    ├── avoxi.ts            ← Avoxi v2 client; hides HTTP + pagination
    ├── journey.ts          ← classify(call, schedule) — pure
    └── audit.ts            ← orchestrator; pipes list → classify → LLM
```

Every `.ts` file is a doc-header-only skeleton at this point — the
contract is fixed, implementation lands in M1 (§6).

---

## 5. Module contracts

| Module | Surface | Hides |
|---|---|---|
| `config.ts` | `loadConfig(): AppConfig` | env parsing, YAML parsing, zod validation, defaults |
| `avoxi.ts` | `listCalls(since, until): Promise<Call[]>` | HTTP, bearer auth, base URL, pagination, retries, response envelope |
| `journey.ts` | `classify(call, schedule): Analysis`, `isOnCall(at, schedule): boolean` | journey reconstruction rules, missed-call taxonomy |
| `audit.ts` | `auditWindow(since, until, config): Promise<string>` | LLM provider wiring, prompt text, output formatting |
| `cli.ts` | — | argv parsing, window resolution |

Full types (`AppConfig`, `Call`, `Analysis`, `MissReason`, …) live in the
relevant module's doc header.

---

## 6. Roadmap

| Phase | Scope |
|---|---|
| **M1 — MVP** (this repo) | Implement the five modules. `pnpm audit` produces a narrative for a given window. |
| **M2 — Recording audit** | After legal sign-off on transcription, extend `avoxi.ts` with the 24 h pre-signed recording URL and pipe downloaded audio through a transcription + redaction step. |
| **M3 — Continuous operation** | Watch daemon (replaces the manual WhatsApp missed-call flow), SQLite persistence so alerts dedupe, notifier (Slack/WhatsApp), dashboard for historical browse. |

Every phase adds to the tree; none of them change the five MVP modules'
contracts.

---

## 7. Environment

Required:

- `AVOXI_API_TOKEN` — bearer token with CDR read scope.
- `LLM_PROVIDER` + `LLM_API_KEY` + `LLM_MODEL` — one of `kimi | openai | gemini`.

Recommended:

- `COMPANY_NAME` — quoted in the narrative.

See `.env.example` for the complete list.

---

## 8. Why not just subscribe to Avoxi's own alerts?

Avoxi's alerts (`/alerts/logs`) fire on infrastructure conditions —
trunk down, API errors. They don't fire on "a customer called at
03:17 ART during weeknight on-call and nobody picked up" because that
isn't a malfunction from Avoxi's point of view. Only our `schedule`
knows it is. Avoxi's alerts are useful *context* for later phases; they
are not the detector.
