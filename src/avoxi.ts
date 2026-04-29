/**
 * Avoxi v2 client. Hides HTTP, bearer auth, base URL, pagination and
 * retries behind a narrow factory.
 *
 * Surface
 *   createAvoxiClient(cfg): { listCalls(since, until): Promise<Call[]> }
 *     - listCalls auto-paginates; callers never see a cursor.
 *     - Returns [] for empty windows; throws only on auth/network/parse errors.
 *
 * Domain types (Avoxi wire shape is entirely private to this module)
 *   Call  = { id, status, direction, from, to, startedAt, answeredAt?,
 *              endedAt, forwardedTo, events, priorExtension?, finalDestination? }
 *   Event = { at: Date; kind: string; actor?: string }
 *
 * TODO(M1): verify wire field names against a live /cdrs response.
 *   Known confirmed: avoxi_call_id, agent_actions, { data: [...] } envelope.
 *   Everything else is an educated guess — align before merging to production.
 */

import { z } from 'zod';
import type { AppConfig } from './config.js';

// ─── Domain types ────────────────────────────────────────────────────────────

export type Event = { at: Date; kind: string; actor?: string };

export type Call = {
  id:                string;
  status:            'answered' | 'unanswered' | 'voicemail';
  direction:         'inbound' | 'outbound' | 'internal';
  from:              string;
  to:                string;
  startedAt:         Date;
  answeredAt?:       Date;
  endedAt:           Date;
  forwardedTo:       string[];
  events:            Event[];
  priorExtension?:   string;
  finalDestination?: string;
};

// ─── Wire schema (private) ───────────────────────────────────────────────────

// TODO(M1): align field names with a live response dump in tmp/sample-cdrs.json
const WireEventSchema = z.object({
  timestamp:  z.string(),
  event_type: z.string(),
  actor:      z.string().optional(),
}).passthrough();

const WireCallSchema = z.object({
  avoxi_call_id:     z.string(),
  status:            z.string().default('unanswered'),
  direction:         z.string().default('inbound'),
  caller_id:         z.string().default(''),
  dialed_number:     z.string().default(''),
  start_time:        z.string(),
  answer_time:       z.string().nullable().optional(),
  end_time:          z.string(),
  forwarded_to:      z.array(z.string()).default([]),
  agent_actions:     z.array(WireEventSchema).default([]),
  prior_extension:   z.string().optional(),
  final_destination: z.string().optional(),
}).passthrough();

const WirePageSchema = z.object({
  data:        z.array(WireCallSchema),
  next_cursor: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

class AvoxiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AvoxiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStatus(s: string): Call['status'] {
  if (s === 'answered') return 'answered';
  if (s === 'voicemail') return 'voicemail';
  return 'unanswered';
}

function normalizeDirection(d: string): Call['direction'] {
  if (d === 'outbound') return 'outbound';
  if (d === 'internal') return 'internal';
  return 'inbound';
}

function mapWireCall(wire: z.infer<typeof WireCallSchema>): Call {
  return {
    id:               wire.avoxi_call_id,
    status:           normalizeStatus(wire.status),
    direction:        normalizeDirection(wire.direction),
    from:             wire.caller_id,
    to:               wire.dialed_number,
    startedAt:        new Date(wire.start_time),
    answeredAt:       wire.answer_time ? new Date(wire.answer_time) : undefined,
    endedAt:          new Date(wire.end_time),
    forwardedTo:      wire.forwarded_to,
    events:           wire.agent_actions.map(e => ({
                        at:    new Date(e.timestamp),
                        kind:  e.event_type,
                        actor: e.actor,
                      })),
    priorExtension:   wire.prior_extension,
    finalDestination: wire.final_destination,
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAvoxiClient(cfg: AppConfig['avoxi']) {
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    'Content-Type': 'application/json',
  };

  async function fetchPage(url: string, attempt = 1): Promise<z.infer<typeof WirePageSchema>> {
    const res = await fetch(url, { headers });

    if (res.status === 401 || res.status === 403) {
      throw new AvoxiError(`Avoxi auth failed (${res.status})`, res.status);
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 3) throw new AvoxiError(`Avoxi server error (${res.status})`, res.status);
      await sleep(500 * 2 ** (attempt - 1));
      return fetchPage(url, attempt + 1);
    }

    if (!res.ok) {
      throw new AvoxiError(`Avoxi request failed (${res.status})`, res.status);
    }

    const body = await res.json() as unknown;
    return WirePageSchema.parse(body);
  }

  return {
    async listCalls(since: Date, until: Date): Promise<Call[]> {
      const calls: Call[] = [];
      // TODO(M1): verify query param names (start_time/end_time) against live API docs
      const base = `${cfg.baseUrl}/cdrs?start_time=${since.toISOString()}&end_time=${until.toISOString()}&limit=10000`;
      let url: string | null = base;

      while (url) {
        const page = await fetchPage(url);
        for (const wire of page.data) {
          calls.push(mapWireCall(wire));
        }
        // TODO(M1): confirm whether Avoxi uses next_cursor or empty last page to signal end
        url = page.next_cursor ? `${base}&cursor=${page.next_cursor}` : null;
      }

      return calls;
    },
  };
}
