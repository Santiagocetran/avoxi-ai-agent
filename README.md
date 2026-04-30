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

One-time setup:

```bash
uv sync
```

One command:

```bash
uv run audit [--since=<iso>] [--until=<iso>]
```

Default window when no flags are given: the previous completed on-call shift
(e.g. last night 21:00 -> 09:00 ART).

---

## 2. Design principles

This project follows John Ousterhout's *A Philosophy of Software Design*:

- **Deep modules.** Every file hides substantial complexity behind a narrow
  interface. `avoxi.py` hides HTTP, auth, pagination and retries behind a
  single context manager. `journey.py` hides all classification rules behind
  `classify(call, schedule)`.
- **Information hiding.** Avoxi's wire shape (`avoxi_call_id`, `agent_actions`,
  etc.) stops at `avoxi.py`. Downstream modules see domain-neutral names.
  Provider-specific LLM base URLs stop at `config.py`; every other module
  receives a plain URL string or `None` for the OpenAI SDK default.
- **Define errors out of existence.** `list_calls` returns `[]` for empty
  windows. `classify` never throws; unknown shapes fall to `reason: 'unknown'`.
  `Analysis` is a discriminated union: `reason` only exists on the type when
  `missed: true`, so answered calls cannot accidentally carry a miss reason.
- **Pure where it can be.** `journey.py` has no I/O and no dependency on
  `datetime.now()`. Its only time anchors are `call.started_at` and the explicit
  `now` argument to `previous_shift`.
- **Strategic > tactical.** Five modules beats thirty-eight; the shape chosen
  here is what M2 and M3 will extend without changing.

---

## 3. Architecture

```
cli.py
  |
  +- load_config()                       -> AppConfig
  |    dotenv + schedule.yaml + pydantic
  |    resolves provider base URL here
  |
  +- audit_window(since, until, config)
       |
       +- AvoxiClient(cfg)
       |    .list_calls(since, until)    -> list[Call]
       |    httpx + bearer auth + pagination + 3x backoff
       |    wire shape private behind pydantic schema
       |
       +- journey.classify(call, schedule) -> Analysis
       |    pure + no I/O + no datetime.now()
       |    Analysis = MissedAnalysis(reason, steps)
       |             | AnsweredAnalysis(steps)
       |
       +- OpenAI(api_key, base_url)      -> markdown narrative
            compact JSON summary -> system + user prompt
```

No dashboards, no persistence, no notifications, no function-calling
agent loop. Those are deferred - see §6.

---

## 4. File tree

```
avoxi-ai-agent/
├── README.md
├── pyproject.toml
├── uv.lock
├── .env.example
├── .gitignore
├── config/
│   └── schedule.yaml
└── src/
    └── avoxi_audit/
        ├── __init__.py
        ├── config.py
        ├── avoxi.py
        ├── journey.py
        ├── audit.py
        └── cli.py
```

---

## 5. Module contracts

| Module | Surface | Hides |
|---|---|---|
| `config.py` | `load_config() -> AppConfig` | env parsing, YAML parsing, pydantic validation, defaults, per-provider LLM base URL resolution |
| `avoxi.py` | `AvoxiClient(cfg)` (context manager); `client.list_calls(since, until) -> list[Call]` | HTTP, bearer auth, base URL, pagination, retries, response envelope, wire→domain mapping, socket lifecycle |
| `journey.py` | `classify(call, schedule) -> Analysis`<br>`is_on_call(at, schedule) -> bool`<br>`previous_shift(now, schedule) -> tuple[datetime, datetime]` | journey reconstruction rules, missed-call taxonomy, timezone arithmetic |
| `audit.py` | `audit_window(since, until, config) -> str` | LLM client construction, prompt text, output formatting, zero-call short-circuit |
| `cli.py` | `main()` | argparse parsing, window resolution, naive-datetime rejection |

### Key types

```python
# config.py
AppConfig = {
    "avoxi": {"token": str, "base_url": str},
    "llm": {
        "provider": "kimi|openai|gemini",
        "api_key": str,
        "model": str,
        "base_url": str | None,
    },
    "schedule": Schedule,
    "company_name": str,
}

# avoxi.py
Call = {
    "id": str,
    "status": "answered|unanswered|voicemail",
    "direction": "inbound|outbound|internal",
    "from_": str,
    "to": str,
    "started_at": datetime,
    "answered_at": datetime | None,
    "ended_at": datetime,
    "forwarded_to": list[str],
    "events": list[Event],
    "prior_extension": str | None,
    "final_destination": str | None,
}

# journey.py
Analysis = MissedAnalysis | AnsweredAnalysis
```

---

## 6. Roadmap

| Phase | Status | Scope |
|---|---|---|
| **M1 - MVP** | Implemented in Python | pydantic + httpx + openai SDK + zoneinfo, uv-managed. `uv run audit` produces a narrative for any window. |
| **M2 - Recording audit** | Pending legal | Extend `avoxi.py` with the 24 h pre-signed recording URL; pipe audio through transcription + redaction; distinguish `voicemail_empty` from `voicemail_left`. |
| **M3 - Continuous operation** | Deferred | Watch daemon (replaces manual WhatsApp flow), SQLite persistence for deduplication, notifier (Slack/WhatsApp), dashboard for historical browse. |

Every phase adds to the tree; the five MVP module contracts are stable.

### M1 open items

Before running against production, verify the Avoxi wire field names in
`avoxi.py` against a live `/cdrs` response. Known confirmed: `avoxi_call_id`,
`agent_actions`, `{ data: [...] }` envelope. Fields marked `# TODO(M1)`:
`caller_id`, `dialed_number`, `start_time`, `end_time`, `forwarded_to`,
`next_cursor`, `start_time`/`end_time` query params. Drop a sample in
`tmp/sample-cdrs.json` to align.

---

## 7. Environment

Required:

- `AVOXI_API_TOKEN` - bearer token with CDR read scope.
- `LLM_PROVIDER` - one of `kimi | openai | gemini`.
- `LLM_API_KEY` - API key for the chosen provider.
- `LLM_MODEL` - model name (e.g. `moonshot-v1-32k`, `gpt-4o`, `gemini-1.5-pro`).

Optional:

- `AVOXI_BASE_URL` - defaults to `https://genius.avoxi.com/api/v2`.
- `LLM_BASE_URL` - overrides the default base URL for the chosen provider.
- `COMPANY_NAME` - quoted in the narrative; defaults to `"your company"`.
- `SCHEDULE_PATH` - overrides the schedule file path. Default:
  `./config/schedule.yaml` relative to the current working directory.

Run:

```bash
uv run audit [--since=<iso>] [--until=<iso>]
```

See `.env.example` for the full list.

---

## 8. Why not just subscribe to Avoxi's own alerts?

Avoxi's alerts (`/alerts/logs`) fire on infrastructure conditions -
trunk down, API errors. They don't fire on "a customer called at
03:17 ART during weeknight on-call and nobody picked up" because that
isn't a malfunction from Avoxi's point of view. Only our `schedule`
knows it is. Avoxi's alerts are useful *context* for later phases; they
are not the detector.
