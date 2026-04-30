"""Audit orchestrator. Hides LLM wiring, prompt text and output formatting.

Surface
  audit_window(since, until, config) -> str

Pipeline
  1. AvoxiClient.list_calls(since, until)
  2. journey.classify(call, schedule) per call
  3. Build a compact JSON summary from the classified set
  4. Send to an OpenAI-compatible LLM (provider + base_url resolved in config)
  5. Return the narrative (markdown)

The LLM narrates data that has already been deterministically classified - no
function-calling, no tool loop. Keeps the hot path small and auditable.
"""

from datetime import datetime
import json

from openai import OpenAI

from .avoxi import AvoxiClient
from .config import AppConfig
from .journey import MissedAnalysis, classify

SYSTEM_PROMPT = (
    "You are an on-call audit assistant. You receive a structured JSON summary "
    "of telephone calls from an Avoxi system during an on-call window. Write a "
    "concise markdown report for the operations team. Focus on actionable missed "
    "calls during on-call hours. Be factual and brief."
)

REPORT_INSTRUCTIONS = """Write a markdown report with these sections:
## Overview
## Missed calls during on-call hours
## Other notable events
## Recommendations"""


def audit_window(since: datetime, until: datetime, config: AppConfig) -> str:
    with AvoxiClient(config.avoxi) as client:
        calls = client.list_calls(since, until)

    if len(calls) == 0:
        return f"""# On-call audit — {config.company_name}
**Window:** {since.isoformat()} → {until.isoformat()}

## Overview
No calls were recorded in this window.

## Missed calls during on-call hours
None.

## Other notable events
None.

## Recommendations
No action required."""

    analyzed = [(call, classify(call, config.schedule)) for call in calls]
    missed = [(call, analysis) for call, analysis in analyzed if analysis.missed]

    by_reason: dict[str, int] = {}
    for _, analysis in missed:
        if isinstance(analysis, MissedAnalysis):
            by_reason[analysis.reason] = by_reason.get(analysis.reason, 0) + 1

    summary = {
        "window": {"since": since.isoformat(), "until": until.isoformat()},
        "company": config.company_name,
        "totals": {"all": len(calls), "missed": len(missed), "byReason": by_reason},
        "missedCalls": [
            {
                "id": call.id,
                "startedAt": call.started_at.isoformat(),
                "from": call.from_,
                "to": call.to,
                "reason": analysis.reason if isinstance(analysis, MissedAnalysis) else None,
                "steps": [
                    {"at": step.at.isoformat(), "kind": step.kind, "actor": step.actor}
                    for step in analysis.steps
                ],
            }
            for call, analysis in missed
        ],
    }

    llm = OpenAI(api_key=config.llm.api_key, base_url=config.llm.base_url)
    response = llm.chat.completions.create(
        model=config.llm.model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"{REPORT_INSTRUCTIONS}\n\n{json.dumps(summary, indent=2, default=str)}",
            },
        ],
    )

    return response.choices[0].message.content or "(no response from LLM)"
