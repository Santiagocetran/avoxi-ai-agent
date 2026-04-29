/**
 * Audit orchestrator. Hides LLM wiring, prompt text and output formatting.
 *
 * Surface
 *   auditWindow(since, until, config): Promise<string>
 *
 * Pipeline
 *   1. avoxi.listCalls(since, until)
 *   2. journey.classify(call, schedule)   per call
 *   3. Build a compact JSON summary from the classified set
 *   4. Send to an OpenAI-wire LLM (provider + baseURL already resolved in config)
 *   5. Return the narrative (markdown)
 *
 * The LLM narrates data that has already been deterministically classified —
 * no function-calling, no tool loop. Keeps the hot path small and auditable.
 */

import OpenAI from 'openai';
import { createAvoxiClient } from './avoxi.js';
import { classify } from './journey.js';
import type { AppConfig } from './config.js';

const SYSTEM_PROMPT =
  `You are an on-call audit assistant. You receive a structured JSON summary of ` +
  `telephone calls from an Avoxi system during an on-call window. ` +
  `Write a concise markdown report for the operations team. ` +
  `Focus on actionable missed calls during on-call hours. Be factual and brief.`;

const REPORT_INSTRUCTIONS =
  `Write a markdown report with these sections:
## Overview
## Missed calls during on-call hours
## Other notable events
## Recommendations`;

export async function auditWindow(since: Date, until: Date, config: AppConfig): Promise<string> {
  const client = createAvoxiClient(config.avoxi);
  const calls  = await client.listCalls(since, until);

  if (calls.length === 0) {
    const w = `${since.toISOString()} → ${until.toISOString()}`;
    return `# On-call audit — ${config.companyName}\n**Window:** ${w}\n\nNo calls recorded in this window.\n`;
  }

  const analyzed = calls.map(c => ({ call: c, analysis: classify(c, config.schedule) }));
  const missed   = analyzed.filter(({ analysis }) => analysis.missed);

  const byReason: Record<string, number> = {};
  for (const { analysis } of missed) {
    if (analysis.missed) {
      byReason[analysis.reason] = (byReason[analysis.reason] ?? 0) + 1;
    }
  }

  const summary = {
    window:      { since: since.toISOString(), until: until.toISOString() },
    company:     config.companyName,
    totals:      { all: calls.length, missed: missed.length, byReason },
    missedCalls: missed.map(({ call: c, analysis }) => ({
      id:        c.id,
      startedAt: c.startedAt.toISOString(),
      from:      c.from,
      to:        c.to,
      reason:    analysis.missed ? analysis.reason : undefined,
      steps:     analysis.steps.map(s => ({
                   at: s.at.toISOString(), kind: s.kind, actor: s.actor,
                 })),
    })),
  };

  const llm = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });

  const response = await llm.chat.completions.create({
    model:    config.llm.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `${REPORT_INSTRUCTIONS}\n\n${JSON.stringify(summary, null, 2)}` },
    ],
  });

  return response.choices[0]?.message?.content ?? '(no response from LLM)';
}
