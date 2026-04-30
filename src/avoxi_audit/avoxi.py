"""Avoxi v2 client. Hides HTTP, bearer auth, base URL, pagination and
retries behind a narrow context manager.

Surface
  AvoxiClient(cfg).list_calls(since, until) -> list[Call]
    - list_calls auto-paginates; callers never see a cursor.
    - Returns [] for empty windows; throws only on auth/network/parse errors.

Domain types (Avoxi wire shape is entirely private to this module)
  Call  = { id, status, direction, from_, to, started_at, answered_at,
            ended_at, forwarded_to, events, prior_extension, final_destination }
  Event = { at: datetime; kind: str; actor?: str }

TODO(M1): verify wire field names against a live /cdrs response.
  Known confirmed: avoxi_call_id, agent_actions, { data: [...] } envelope.
  Educated guesses: caller_id, dialed_number, start_time, end_time,
  forwarded_to, next_cursor — align before merging to production.
"""

from dataclasses import dataclass
from datetime import datetime
from time import sleep
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from .config import AvoxiConfig


class AvoxiError(Exception):
    pass


class AvoxiAuthError(AvoxiError):
    """401/403 — credentials rejected. Never retried."""


class AvoxiClientError(AvoxiError):
    """Non-retryable 4xx (other than 401/403/429) — bad request, not found, etc."""


@dataclass(frozen=True)
class Event:
    at: datetime
    kind: str
    actor: str | None = None


@dataclass(frozen=True)
class Call:
    """Domain call. `from_` uses a trailing underscore because `from` is a keyword."""

    id: str
    status: Literal["answered", "unanswered", "voicemail"]
    direction: Literal["inbound", "outbound", "internal"]
    from_: str
    to: str
    started_at: datetime
    answered_at: datetime | None
    ended_at: datetime
    forwarded_to: list[str]
    events: list[Event]
    prior_extension: str | None = None
    final_destination: str | None = None


class _WireEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    timestamp: datetime
    event_type: str
    actor: str | None = None


class _WireCall(BaseModel):
    model_config = ConfigDict(extra="allow")

    avoxi_call_id: str
    status: str = "unanswered"
    direction: str = "inbound"
    caller_id: str = ""
    dialed_number: str = ""
    start_time: datetime
    answer_time: datetime | None = None
    end_time: datetime
    forwarded_to: list[str] = Field(default_factory=list)
    agent_actions: list[_WireEvent] = Field(default_factory=list)
    prior_extension: str | None = None
    final_destination: str | None = None


class _WirePage(BaseModel):
    data: list[_WireCall]
    next_cursor: str | None = None


def _normalize_status(status: str) -> Literal["answered", "unanswered", "voicemail"]:
    if status == "answered":
        return "answered"
    if status == "voicemail":
        return "voicemail"
    return "unanswered"


def _normalize_direction(direction: str) -> Literal["inbound", "outbound", "internal"]:
    if direction == "outbound":
        return "outbound"
    if direction == "internal":
        return "internal"
    return "inbound"


def _map_wire_call(wire: _WireCall) -> Call:
    return Call(
        id=wire.avoxi_call_id,
        status=_normalize_status(wire.status),
        direction=_normalize_direction(wire.direction),
        from_=wire.caller_id,
        to=wire.dialed_number,
        started_at=wire.start_time,
        answered_at=wire.answer_time,
        ended_at=wire.end_time,
        forwarded_to=wire.forwarded_to,
        events=[
            Event(at=event.timestamp, kind=event.event_type, actor=event.actor)
            for event in wire.agent_actions
        ],
        prior_extension=wire.prior_extension,
        final_destination=wire.final_destination,
    )


class AvoxiClient:
    def __init__(self, cfg: AvoxiConfig) -> None:
        self._base_url = cfg.base_url.rstrip("/")
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {cfg.token}"},
            timeout=httpx.Timeout(timeout=30.0, connect=5.0),
        )

    def __enter__(self) -> "AvoxiClient":
        return self

    def __exit__(self, *exc) -> None:
        self._client.close()

    def list_calls(self, since: datetime, until: datetime) -> list[Call]:
        calls: list[Call] = []
        cursor: str | None = None

        while True:
            params = {
                "start_time": since.isoformat(),
                "end_time": until.isoformat(),
                "limit": "10000",
            }
            if cursor:
                params["cursor"] = cursor

            page = self._fetch_page(params)
            calls.extend(_map_wire_call(wire) for wire in page.data)

            if not page.next_cursor:
                return calls
            cursor = page.next_cursor

    def _fetch_page(self, params: dict[str, str]) -> _WirePage:
        # TODO(M1): verify query param names (start_time/end_time) against live API docs.
        url = f"{self._base_url}/cdrs"
        total_sleep = 0.0
        last_error: Exception | None = None

        for attempt in range(1, 4):
            response: httpx.Response | None = None
            try:
                response = self._client.get(url, params=params)
                if response.status_code in (401, 403):
                    raise AvoxiAuthError(f"Avoxi auth failed ({response.status_code})")
                if response.status_code == 429 or response.status_code >= 500:
                    raise AvoxiError(f"Avoxi server error ({response.status_code})")
                if response.status_code >= 400:
                    raise AvoxiClientError(f"Avoxi request failed ({response.status_code})")
                return _WirePage.model_validate(response.json())
            except (AvoxiAuthError, AvoxiClientError):
                raise
            except (AvoxiError, httpx.RequestError) as exc:
                last_error = exc
                if attempt >= 3:
                    raise exc

                delay = self._retry_delay(attempt, response)
                if total_sleep + delay > 60:
                    raise last_error
                sleep(delay)
                total_sleep += delay

        if last_error is not None:
            raise last_error
        raise AvoxiError("Avoxi request failed")

    @staticmethod
    def _retry_delay(attempt: int, response: httpx.Response | None) -> float:
        if response is not None and response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            if retry_after is not None:
                try:
                    return min(float(int(retry_after)), 30.0)
                except ValueError:
                    pass
        return 0.5 * 2 ** (attempt - 1)
