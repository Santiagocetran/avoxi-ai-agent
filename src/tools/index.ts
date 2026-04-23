import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';
import type { AvoxiConfig } from './avoxi.js';
import {
  getCdrs,
  getActiveCalls,
  getTrunks,
  getDids,
  getSystemHealth,
  getCdrSummary,
} from './avoxi.js';

export type ToolResult = Record<string, unknown> | unknown[];

// ─── OpenAI function-calling schema ──────────────────────────────────────────

export const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_cdrs',
      description:
        'Fetch raw Call Detail Records from AVOXI. Use for detailed call-level inspection. For aggregate stats prefer get_cdr_summary.',
      parameters: {
        type: 'object',
        properties: {
          since: { type: 'string', description: 'ISO 8601 start datetime, e.g. 2026-04-21T00:00:00Z' },
          until: { type: 'string', description: 'ISO 8601 end datetime' },
          limit: { type: 'number', description: 'Max records to return (default 100, max 1000)' },
          offset: { type: 'number', description: 'Pagination offset' },
          disposition: {
            type: 'string',
            enum: ['answered', 'no-answer', 'busy', 'failed', 'cancelled'],
            description: 'Filter by call outcome',
          },
          did_number: { type: 'string', description: 'Filter by DID phone number' },
          direction: { type: 'string', enum: ['inbound', 'outbound'], description: 'Filter by call direction' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cdr_summary',
      description:
        'Aggregate CDR stats for a time window: total calls, failure rate, short-call rate, avg duration, breakdown by SIP code. Best for anomaly detection and health checks.',
      parameters: {
        type: 'object',
        required: ['since', 'until'],
        properties: {
          since: { type: 'string', description: 'ISO 8601 start datetime' },
          until: { type: 'string', description: 'ISO 8601 end datetime' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_calls',
      description: 'List calls currently in progress. Shows real-time trunk usage and concurrent call count.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trunks',
      description: 'List all SIP trunks with status, region, and concurrent call limits. Use to detect trunk saturation or failures.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dids',
      description: 'List DID phone numbers. Use to check if numbers are active, suspended, or in porting.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'porting'],
            description: 'Filter by DID status',
          },
          country: { type: 'string', description: 'Filter by 2-letter country code, e.g. MX, US' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_health',
      description: 'Check AVOXI API availability and response latency. Run first if other tools are failing.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ─── Dispatcher — maps tool name → implementation ────────────────────────────

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  config: AvoxiConfig,
): Promise<ToolResult> {
  switch (name) {
    case 'get_cdrs':
      return getCdrs(config, args as Parameters<typeof getCdrs>[1]);
    case 'get_cdr_summary':
      return getCdrSummary(config, args as Parameters<typeof getCdrSummary>[1]);
    case 'get_active_calls':
      return getActiveCalls(config);
    case 'get_trunks':
      return getTrunks(config);
    case 'get_dids':
      return getDids(config, args as Parameters<typeof getDids>[1]);
    case 'get_system_health':
      return getSystemHealth(config);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
