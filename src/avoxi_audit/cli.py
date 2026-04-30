"""Single entry point. Kept deliberately thin - complexity lives in other modules.

  uv run audit [--since=<iso>] [--until=<iso>]

Default window when both flags are absent: the previous completed on-call shift.
Exit codes: 0 = ok, 1 = config or runtime error.
"""

from argparse import ArgumentParser
from datetime import datetime, timezone
import sys

from .audit import audit_window
from .config import load_config
from .journey import previous_shift

_TZ_ERROR = "--since and --until must include a timezone offset (e.g. 2026-04-29T21:00:00-03:00)"


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(_TZ_ERROR)
    return parsed


def main() -> None:
    try:
        parser = ArgumentParser()
        parser.add_argument("--since")
        parser.add_argument("--until")
        args = parser.parse_args()

        if (args.since is None) != (args.until is None):
            raise ValueError("Provide both --since and --until, or neither.")

        config = None

        if args.since is not None and args.until is not None:
            since = _parse_datetime(args.since)
            until = _parse_datetime(args.until)
        else:
            config = load_config()
            now = datetime.now(timezone.utc)
            since, until = previous_shift(now, config.schedule)

        if config is None:
            config = load_config()

        narrative = audit_window(since, until, config)
        sys.stdout.write(narrative + "\n")
    except Exception as exc:
        sys.stderr.write(f"error: {exc}\n")
        sys.exit(1)
