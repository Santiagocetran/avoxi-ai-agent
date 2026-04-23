# On-call schedule

Defined in `config/schedule.yaml`, consumed by `src/domain/schedule.ts`.

## Defaults (Grupo Wellness)

From `SW-lead-recomendations.md`:

- **Weekdays** (Mon–Fri): on-call starts at **21:00 ART** and runs through
  **09:00 ART** the next morning.
- **Weekends** (Sat–Sun): on-call 24 h/day.

Outside these windows, calls are classified with the
`off_hours_expected` reason and do NOT trigger alerts — they still
appear in reports for completeness.

## Timezone

`America/Argentina/Buenos_Aires` (IANA). All Avoxi timestamps are ISO-8601
with offset, so comparison is always done in UTC internally; the IANA
timezone is used only for rendering and for computing window boundaries
that span DST (though ART has no DST, future moves to other TZs need this).

## Changing the schedule

1. Edit `config/schedule.yaml`.
2. Restart any `pnpm watch` daemon (config is read at startup).
3. `pnpm audit --since=...` to back-fill classifications with the new
   schedule.
