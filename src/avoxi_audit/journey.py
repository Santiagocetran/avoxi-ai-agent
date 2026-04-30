"""Call-journey reconstruction + missed-call classification.

Pure functions. No I/O. Deterministic given inputs. Time anchor for every
decision is call.started_at - never "now".

Surface
  is_on_call(at, schedule) -> bool
  classify(call, schedule) -> Analysis
  previous_shift(now, schedule) -> tuple[datetime, datetime]
    - only function that accepts a "now"; used by cli.py for default window.

Note: Call/Event types are owned by avoxi.py (it produces them).
      Analysis, Step, StepKind, MissReason are owned here.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from .avoxi import Call, Event
from .config import Schedule, Weekday, Window

StepKind = Literal[
    "hit_did",
    "forwarded",
    "ring_agent",
    "agent_declined",
    "agent_answered",
    "queued",
    "voicemail",
    "hangup",
    "other",
]

MissReason = Literal[
    "no_agent_on_duty",
    "agent_declined",
    "ring_timeout",
    "queue_abandoned",
    "voicemail_left",
    "voicemail_empty",
    "routing_failure",
    "off_hours_expected",
    "unknown",
]


@dataclass(frozen=True)
class Step:
    at: datetime
    kind: StepKind
    actor: str | None = None
    detail: str | None = None


@dataclass(frozen=True)
class MissedAnalysis:
    steps: list[Step]
    reason: MissReason
    missed: Literal[True] = True


@dataclass(frozen=True)
class AnsweredAnalysis:
    steps: list[Step]
    missed: Literal[False] = False


Analysis = MissedAnalysis | AnsweredAnalysis

_WEEKDAYS: list[Weekday] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
_STEP_KIND_MAP: dict[str, StepKind] = {
    "hit_did": "hit_did",
    "forwarded": "forwarded",
    "ring_agent": "ring_agent",
    "agent_declined": "agent_declined",
    "agent_answered": "agent_answered",
    "queued": "queued",
    "voicemail": "voicemail",
    "hangup": "hangup",
}


def _ensure_aware(at: datetime, name: str) -> None:
    if at.tzinfo is None or at.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _parse_end(end: str) -> tuple[str, bool]:
    if end.endswith("+1"):
        return end[:5], True
    return end, False


def _next_weekday(day: Weekday) -> Weekday:
    return _WEEKDAYS[(_WEEKDAYS.index(day) + 1) % 7]


def _in_window(weekday: Weekday, hhmm: str, window: Window) -> bool:
    end_time, crosses_midnight = _parse_end(window.end)

    if not crosses_midnight:
        return weekday in window.days and window.start <= hhmm < end_time

    next_days = [_next_weekday(day) for day in window.days]
    return (
        (weekday in window.days and hhmm >= window.start)
        or (weekday in next_days and hhmm < end_time)
    )


def _kind_for(raw: str) -> StepKind:
    return _STEP_KIND_MAP.get(raw, "other")


def _build_steps(call: Call) -> list[Step]:
    return [Step(at=event.at, kind=_kind_for(event.kind), actor=event.actor) for event in call.events]


def _miss_reason(call: Call, steps: list[Step], schedule: Schedule) -> MissReason:
    kinds = {step.kind for step in steps}
    last_kind = steps[-1].kind if steps else None

    if len(call.forwarded_to) == 0 and not call.final_destination:
        return "routing_failure"
    if "agent_declined" in kinds:
        return "agent_declined"
    if last_kind == "voicemail":
        return "voicemail_left"
    if "queued" in kinds and "agent_answered" not in kinds:
        return "queue_abandoned"
    if "ring_agent" in kinds and "agent_answered" not in kinds:
        return "ring_timeout"

    return "no_agent_on_duty" if is_on_call(call.started_at, schedule) else "off_hours_expected"


def is_on_call(at: datetime, schedule: Schedule) -> bool:
    _ensure_aware(at, "at")
    local = at.astimezone(ZoneInfo(schedule.timezone))
    weekday = local.strftime("%a")
    hhmm = local.strftime("%H:%M")
    return any(_in_window(weekday, hhmm, window) for window in schedule.windows)  # type: ignore[arg-type]


def classify(call: Call, schedule: Schedule) -> Analysis:
    steps = _build_steps(call)
    if call.status == "answered":
        return AnsweredAnalysis(steps=steps)
    return MissedAnalysis(steps=steps, reason=_miss_reason(call, steps, schedule))


def previous_shift(now: datetime, schedule: Schedule) -> tuple[datetime, datetime]:
    _ensure_aware(now, "now")
    tz = ZoneInfo(schedule.timezone)
    local_now = now.astimezone(tz)
    today_local = local_now.date()
    best: tuple[datetime, datetime] | None = None

    for days_back in range(14):
        local_date = today_local - timedelta(days=days_back)
        weekday = local_date.strftime("%a")

        for window in schedule.windows:
            if weekday not in window.days:
                continue

            start = _local_datetime(local_date, window.start, tz)
            end_time, crosses_midnight = _parse_end(window.end)
            end_date = local_date
            if crosses_midnight or end_time == "24:00":
                end_date = local_date + timedelta(days=1)
            end = _local_datetime(end_date, "00:00" if end_time == "24:00" else end_time, tz)

            if end <= now.astimezone(tz) and (best is None or end > best[1]):
                best = (start, end)

    if best is None:
        raise RuntimeError(
            "Schedule has no completed on-call window in the last 14 days. "
            "Check config/schedule.yaml - at least one window must end within this period."
        )
    return best


def _local_datetime(local_date: date, hhmm: str, tz: ZoneInfo) -> datetime:
    hour, minute = (int(part) for part in hhmm.split(":"))
    return datetime.combine(local_date, time(hour=hour, minute=minute), tzinfo=tz)
