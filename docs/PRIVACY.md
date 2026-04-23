# Privacy — recordings & transcription

The previous skeleton had no recording/transcription path, so this
concern did not exist. The new paradigm introduces it as an optional
capability, and the SW lead flagged it as needing legal review before
it ships.

## Default stance

**Off.** `config/privacy.yaml` ships with:

```
recordings.enabled:    false
transcription.enabled: false
```

So out of the box, the auditor reads CDRs + journey metadata only —
no audio, no transcripts. Everything still works for missed-call
detection; only content-level audit requires audio.

## Single choke point

Every code path that reads recording bytes or transcripts MUST call
`privacy/gate.ts#canProcessRecording(cdr)`. The gate consults:

1. `config/privacy.yaml` flags
2. Per-CDR facts (country, billing group, age of recording)
3. The retention policy

…and returns `{ allowed: boolean, reason: string }`. Every decision
(allow or deny) is persisted to `privacy_decisions` for audit.

## Redaction

When transcription IS enabled, raw transcripts are routed through
`privacy/policy.ts#redact` *before* they reach:

- the LLM context,
- persistent storage,
- any notification payload.

Default patterns redact phone numbers, emails, and credit-card-shaped
digit sequences. Extend per local regulation.

## Retention

`config/privacy.yaml#recordings.retention_days` (default: 7) bounds how
long downloaded audio may sit in `./tmp/recordings`. The dashboard and
CLI purge older files on startup.

## To enable for Grupo Wellness

1. Legal sign-off on the transcription provider (OpenAI / Gemini /
   local Whisper). Local Whisper is the simplest from a data-residency
   standpoint.
2. Flip `recordings.enabled: true` and `transcription.enabled: true`.
3. Set `transcription.provider` and the matching API key env.
4. Re-run `pnpm audit` — transcripts appear in the periodic reports;
   raw transcripts in storage are redacted.
