# Architecture

See `README.md` for the full design rationale and the accepted paradigm
change. This file is the durable architecture reference — it should stay
synchronised with the code as modules get implemented.

## One-line summary

A scheduled auditor that pulls every call from the Avoxi v2 API, reconstructs
each call's journey client-side, flags unanswered calls against an on-call
calendar, and (optionally, policy-gated) audits recordings via LLM
transcription + summarisation.

## Layers (bottom-up)

1. **`avoxi/`** — dumb HTTP client over the Avoxi v2 API. No business logic.
2. **`domain/`** — pure, stateless: schedule, missed-call classifier, journey
   reconstruction, aggregation for reports.
3. **`privacy/`** — single gate every recording / transcription path passes
   through.
4. **`storage/`** — SQLite persistence: audited calls, runs, notifications,
   privacy decisions.
5. **`llm/`** + **`agent.ts`** — generic multi-turn tool-calling loop.
6. **`tools/`** — thin function-calling adapters exposing `avoxi/` +
   `domain/` to the LLM.
7. **`prompts/`** — task-specific system/user prompts.
8. **`notifier/`** — slack/email/webhook/whatsapp fan-out.
9. **`cli/`** + **`dashboard/`** — entry points; they compose the layers
   above but contain no business logic themselves.

## Data flow — per call

```
 AVOXI API  ─►  avoxi/client.listCdrs()
                    │
                    ▼
             AvoxiCdr  ─►  domain/journey.build()   ─►  JourneyTimeline
                       ─►  domain/missed-call.classify()  ─►  { missed, reason }
                    │
                    ▼
          tools/call-journey + tools/call-list  (exposed to LLM)
                    │
                    ▼
           agent loop (prompts/* + tools/index)
                    │
                    ▼
       storage/audit-log  ─►  notifier/*  ─►  dashboard/store (SSE)
```

## Why the journey is reconstructed client-side

Avoxi v2 does not expose a `/call-journey/{id}` endpoint. What it DOES give
you (on every CDR) is enough to rebuild one:

- `date_start`, `date_answered`, `date_end`
- `forwarded_to[]`          — routing path buckets ("SIP", "Queue", ...)
- `agent_actions[]`         — per-agent events with timestamps
- `voicemail_details.prior_extension_called`  — last agent tried before VM
- `forward_destination`     — final hop before termination
- `status`                  — ANSWERED | UNANSWERED | VOICEMAIL

`domain/journey.build()` turns those fields into an ordered
`JourneyStep[]` that is stable, easy to render, and suitable for feeding
to the LLM.
