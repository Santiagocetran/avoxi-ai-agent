/**
 * In-memory state store for the dashboard.
 *
 * Holds the most recent check results, live agent activity,
 * and the set of connected SSE clients to broadcast to.
 *
 * STATUS: SKELETON — data shapes and broadcast stub are defined;
 *         full persistence (e.g. SQLite) can be added later.
 */

import type { ServerResponse } from 'http';

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO' | 'ERROR' | 'UNKNOWN';

export interface CheckResult {
  id: string;           // nanoid / timestamp string
  timestamp: string;    // ISO 8601
  severity: Severity;
  summary: string;      // full LLM response text
}

export interface ActivityEvent {
  timestamp: string;
  type: 'tool_call' | 'tool_result' | 'check_start' | 'check_end';
  toolName?: string;
  payload?: unknown;    // args or result preview
}

export interface DashboardState {
  currentSeverity: Severity;
  lastCheckAt: string | null;
  history: CheckResult[];     // capped at MAX_HISTORY
  activity: ActivityEvent[];  // capped at MAX_ACTIVITY (live feed)
}

const MAX_HISTORY  = 50;
const MAX_ACTIVITY = 30;

const state: DashboardState = {
  currentSeverity: 'UNKNOWN',
  lastCheckAt: null,
  history: [],
  activity: [],
};

// SSE client registry — each connected browser is a ServerResponse
const sseClients = new Set<ServerResponse>();

// ── Mutations ────────────────────────────────────────────────────────────────

export function addCheckResult(result: CheckResult): void {
  state.currentSeverity = result.severity;
  state.lastCheckAt = result.timestamp;
  state.history.unshift(result);
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
  broadcast({ type: 'check_result', data: result });
}

export function addActivityEvent(event: ActivityEvent): void {
  state.activity.unshift(event);
  if (state.activity.length > MAX_ACTIVITY) state.activity.length = MAX_ACTIVITY;
  broadcast({ type: 'activity', data: event });
}

// ── SSE ──────────────────────────────────────────────────────────────────────

export function registerSseClient(res: ServerResponse): void {
  sseClients.add(res);
  // Send current state snapshot immediately on connect
  sendEvent(res, { type: 'snapshot', data: getSnapshot() });
  res.on('close', () => sseClients.delete(res));
}

export function getSnapshot(): DashboardState {
  return { ...state, history: [...state.history], activity: [...state.activity] };
}

function broadcast(payload: object): void {
  for (const client of sseClients) {
    sendEvent(client, payload);
  }
}

function sendEvent(res: ServerResponse, payload: object): void {
  // SSE format: "data: <json>\n\n"
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
