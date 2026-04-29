/**
 * Call-journey reconstruction + missed-call classification.
 *
 * Pure functions. No I/O. No Date.now(). Deterministic given inputs.
 * Time anchor for every decision is call.startedAt — never "now".
 *
 * Surface
 *   isOnCall(at, schedule): boolean
 *   classify(call, schedule): Analysis
 *   previousShift(now, schedule): { since: Date; until: Date }
 *     — only function that accepts a "now"; used by cli.ts for default window.
 *
 * Note: Call/Event types are owned by avoxi.ts (it produces them).
 *       Analysis, Step, StepKind, MissReason are owned here.
 */

import type { Call } from './avoxi.js';
import type { Schedule, Weekday, Window } from './config.js';

// ─── Exported types ───────────────────────────────────────────────────────────

export type StepKind =
  | 'hit_did' | 'forwarded' | 'ring_agent' | 'agent_declined'
  | 'agent_answered' | 'queued' | 'voicemail' | 'hangup' | 'other';

export type Step = { at: Date; kind: StepKind; actor?: string; detail?: string };

export type MissReason =
  | 'no_agent_on_duty'   // on-call window, nobody answered
  | 'agent_declined'
  | 'ring_timeout'
  | 'queue_abandoned'
  | 'voicemail_left'     // M2: distinguish voicemail_empty once recording length is available
  | 'voicemail_empty'
  | 'routing_failure'    // forwardedTo empty and no finalDestination
  | 'off_hours_expected' // outside on-call window — informational only
  | 'unknown';

// Discriminated union: reason only exists when missed is true
export type Analysis =
  | { steps: Step[]; missed: true;  reason: MissReason }
  | { steps: Step[]; missed: false };

// ─── Private helpers ──────────────────────────────────────────────────────────

const WEEKDAYS: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nextWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7];
}

function parseEnd(end: string): { time: string; crossesMidnight: boolean } {
  if (end.endsWith('+1')) return { time: end.slice(0, 5), crossesMidnight: true };
  return { time: end, crossesMidnight: false };
}

function localParts(at: Date, timezone: string): { weekday: Weekday; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday:  'short',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(at);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const hour = get('hour');
  const hhmm = hour === '24' ? `00:${get('minute')}` : `${hour}:${get('minute')}`;
  return { weekday: get('weekday') as Weekday, hhmm };
}

function inWindow(weekday: Weekday, hhmm: string, w: Window): boolean {
  const { time: endTime, crossesMidnight } = parseEnd(w.end);

  if (!crossesMidnight) {
    // "24:00" end means the entire day; any valid HH:MM < "24:00" as a string
    return w.days.includes(weekday) && hhmm >= w.start && hhmm < endTime;
  }

  const nextDays = w.days.map(nextWeekday);
  return (
    (w.days.includes(weekday) && hhmm >= w.start) ||
    (nextDays.includes(weekday) && hhmm < endTime)
  );
}

const STEP_KIND_MAP: Record<string, StepKind> = {
  hit_did:        'hit_did',
  forwarded:      'forwarded',
  ring_agent:     'ring_agent',
  agent_declined: 'agent_declined',
  agent_answered: 'agent_answered',
  queued:         'queued',
  voicemail:      'voicemail',
  hangup:         'hangup',
};

function kindFor(raw: string): StepKind {
  return STEP_KIND_MAP[raw] ?? 'other';
}

function buildSteps(call: Call): Step[] {
  return call.events.map(e => ({ at: e.at, kind: kindFor(e.kind), actor: e.actor }));
}

function missReason(call: Call, steps: Step[], schedule: Schedule): MissReason {
  const kinds = new Set(steps.map(s => s.kind));
  const lastKind = steps[steps.length - 1]?.kind;

  if (call.forwardedTo.length === 0 && !call.finalDestination) return 'routing_failure';
  if (kinds.has('agent_declined')) return 'agent_declined';
  if (lastKind === 'voicemail') return 'voicemail_left'; // M2: distinguish empty vs left via recording length
  if (kinds.has('queued') && !kinds.has('agent_answered')) return 'queue_abandoned';
  if (kinds.has('ring_agent') && !kinds.has('agent_answered')) return 'ring_timeout';

  return isOnCall(call.startedAt, schedule) ? 'no_agent_on_duty' : 'off_hours_expected';
}

// ─── Exported functions ───────────────────────────────────────────────────────

export function isOnCall(at: Date, schedule: Schedule): boolean {
  const { weekday, hhmm } = localParts(at, schedule.timezone);
  return schedule.windows.some(w => inWindow(weekday, hhmm, w));
}

export function classify(call: Call, schedule: Schedule): Analysis {
  const steps = buildSteps(call);
  if (call.status === 'answered') return { steps, missed: false };
  return { steps, missed: true, reason: missReason(call, steps, schedule) };
}

// ─── previousShift ────────────────────────────────────────────────────────────

// Compute offset (ms) between UTC and the given timezone at instant `at`.
// Positive when UTC is ahead of local (e.g. UTC+0 vs ART UTC-3 → +10800000).
function utcOffsetMs(at: Date, timezone: string): number {
  // sv-SE locale produces "YYYY-MM-DD HH:MM:SS" — parseable as UTC
  const localStr = at.toLocaleString('sv-SE', { timeZone: timezone });
  const localAsUtc = new Date(localStr.replace(' ', 'T') + 'Z');
  return at.getTime() - localAsUtc.getTime();
}

// Convert a local "YYYY-MM-DD HH:MM" in the given timezone to a UTC Date.
function localToUtc(dateStr: string, hhmm: string, timezone: string): Date {
  const naive = new Date(`${dateStr}T${hhmm}:00Z`);
  const offset = utcOffsetMs(naive, timezone);
  return new Date(naive.getTime() + offset);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Returns the most recently completed on-call window before `now`.
// Scans back 9 days — enough to cover any weekly schedule.
export function previousShift(now: Date, schedule: Schedule): { since: Date; until: Date } {
  let best: { since: Date; until: Date } | null = null;

  const todayLocal = now.toLocaleDateString('sv-SE', { timeZone: schedule.timezone });

  for (let daysBack = 0; daysBack < 9; daysBack++) {
    const dateStr = addDays(todayLocal, -daysBack);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone, weekday: 'short',
    }).format(new Date(`${dateStr}T12:00:00Z`)) as Weekday;

    for (const w of schedule.windows) {
      if (!w.days.includes(weekday)) continue;

      const { time: rawEnd, crossesMidnight } = parseEnd(w.end);
      const isFullDay   = rawEnd === '24:00';
      const endTime     = isFullDay ? '00:00' : rawEnd;
      const endDateStr  = (crossesMidnight || isFullDay) ? addDays(dateStr, 1) : dateStr;

      const since = localToUtc(dateStr, w.start, schedule.timezone);
      const until = localToUtc(endDateStr, endTime, schedule.timezone);

      if (until <= now && (!best || until > best.until)) {
        best = { since, until };
      }
    }
  }

  if (!best) throw new Error('Cannot determine previous on-call shift from schedule');
  return best;
}
