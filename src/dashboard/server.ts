/**
 * Dashboard server — runs the monitor loop and exposes:
 *
 *   GET /              → serves web/index.html (the dashboard UI)
 *   GET /api/status    → current severity + last check time (JSON)
 *   GET /api/history   → last 50 check results (JSON)
 *   GET /events        → SSE stream of live agent activity + check results
 *
 * Usage:
 *   pnpm dashboard
 *
 * STATUS: SKELETON — routing and SSE headers are wired; the monitor loop
 *         integration below requires agent.ts callbacks to be connected.
 *
 * TODO: pnpm add express @types/express
 */

// import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { loadAvoxiConfig, loadLlmConfig, loadMonitorCron, loadDashboardPort } from '../config.js';
import { buildLlmClient } from '../llm.js';
import { runAgent } from '../agent.js';
import { buildMonitorPrompt } from '../prompts/system.js';
import {
  addCheckResult,
  addActivityEvent,
  registerSseClient,
  getSnapshot,
  type Severity,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '../../web');

// ── Bootstrap ────────────────────────────────────────────────────────────────

const avoxiConfig = loadAvoxiConfig();
const port = loadDashboardPort();

let agentClient: Awaited<ReturnType<typeof buildLlmClient>>;

async function init(): Promise<void> {
  agentClient = await buildLlmClient(loadLlmConfig());
}

// ── Monitor loop (same logic as monitor.ts, but pushes to store) ─────────────

async function runCheck(): Promise<void> {
  const ts = new Date().toISOString();

  addActivityEvent({ timestamp: ts, type: 'check_start' });

  try {
    const result = await runAgent({
      llmClient: agentClient.client,
      model: agentClient.model,
      avoxiConfig,
      userPrompt: buildMonitorPrompt(),
      onToolCall: (name, args) => {
        addActivityEvent({ timestamp: new Date().toISOString(), type: 'tool_call', toolName: name, payload: args });
      },
      onToolResult: (name, result) => {
        addActivityEvent({ timestamp: new Date().toISOString(), type: 'tool_result', toolName: name, payload: result });
      },
    });

    const severity: Severity = result.includes('CRITICAL')
      ? 'CRITICAL'
      : result.includes('WARNING')
        ? 'WARNING'
        : 'INFO';

    addCheckResult({
      id: ts,
      timestamp: ts,
      severity,
      summary: result,
    });

    addActivityEvent({ timestamp: new Date().toISOString(), type: 'check_end' });
  } catch (err) {
    addCheckResult({
      id: ts,
      timestamp: ts,
      severity: 'ERROR',
      summary: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── HTTP router (vanilla Node — swap for express when dependency is added) ───

function router(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';

  // Static dashboard
  if (url === '/' || url === '/index.html') {
    try {
      const html = readFileSync(resolve(WEB_ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Dashboard UI not found. Make sure web/index.html exists.');
    }
    return;
  }

  // REST: current status
  if (url === '/api/status') {
    const snap = getSnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      severity: snap.currentSeverity,
      lastCheckAt: snap.lastCheckAt,
    }));
    return;
  }

  // REST: check history
  if (url === '/api/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getSnapshot().history));
    return;
  }

  // SSE: live event stream
  if (url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    registerSseClient(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ── Start ────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await init();

  const schedule = loadMonitorCron();
  runCheck();
  cron.schedule(schedule, runCheck);

  createServer(router).listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
    console.log(`Monitor schedule: ${schedule}`);
  });
}

start().catch((err) => {
  console.error('Dashboard failed to start:', err);
  process.exit(1);
});
