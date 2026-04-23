/**
 * AVOXI API tool implementations.
 * Each function maps 1:1 to an OpenAI function-calling tool defined in tools/index.ts.
 * Base URL and auth are read from env at startup — no runtime env reads here.
 */

export interface AvoxiConfig {
  baseUrl: string;
  apiKey: string;
  accountId: string;
  timeoutMs?: number;
}

export interface Cdr {
  call_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  did_number: string;
  disposition: 'answered' | 'no-answer' | 'busy' | 'failed' | 'cancelled';
  sip_response_code: number;
  short_call: boolean;
  recording_url: string | null;
}

export interface ActiveCall {
  call_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  did_number: string;
  started_at: string;
  duration_seconds: number;
  trunk_id: string;
}

export interface Trunk {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  concurrent_calls: number;
  max_concurrent_calls: number;
  region: string;
}

export interface Did {
  number: string;
  status: 'active' | 'suspended' | 'porting';
  trunk_id: string | null;
  label: string | null;
  country: string;
}

async function avoxiFetch<T>(
  config: AvoxiConfig,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`AVOXI request timed out: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AVOXI API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export async function getCdrs(
  config: AvoxiConfig,
  params: {
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
    disposition?: string;
    did_number?: string;
    direction?: string;
  },
): Promise<{ data: Cdr[]; has_more: boolean; total: number }> {
  return avoxiFetch(config, '/cdr', {
    account_id: config.accountId,
    ...(params.since && { start_date: params.since }),
    ...(params.until && { end_date: params.until }),
    ...(params.limit && { limit: String(params.limit) }),
    ...(params.offset && { offset: String(params.offset) }),
    ...(params.disposition && { disposition: params.disposition }),
    ...(params.did_number && { did_number: params.did_number }),
    ...(params.direction && { direction: params.direction }),
  });
}

export async function getActiveCalls(
  config: AvoxiConfig,
): Promise<{ data: ActiveCall[]; count: number }> {
  return avoxiFetch(config, '/calls/active', {
    account_id: config.accountId,
  });
}

export async function getTrunks(
  config: AvoxiConfig,
): Promise<{ data: Trunk[] }> {
  return avoxiFetch(config, '/trunks', {
    account_id: config.accountId,
  });
}

export async function getDids(
  config: AvoxiConfig,
  params: { status?: string; country?: string } = {},
): Promise<{ data: Did[]; total: number }> {
  return avoxiFetch(config, '/numbers', {
    account_id: config.accountId,
    ...(params.status && { status: params.status }),
    ...(params.country && { country: params.country }),
  });
}

export async function getSystemHealth(
  config: AvoxiConfig,
): Promise<{ status: 'healthy' | 'degraded' | 'down'; latency_ms: number }> {
  const start = Date.now();
  try {
    await avoxiFetch(config, '/numbers', { account_id: config.accountId, limit: '1' });
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('503') || msg.includes('timed out')) {
      return { status: 'down', latency_ms: Date.now() - start };
    }
    return { status: 'degraded', latency_ms: Date.now() - start };
  }
}

export async function getCdrSummary(
  config: AvoxiConfig,
  params: { since: string; until: string },
): Promise<{
  total: number;
  answered: number;
  failed: number;
  no_answer: number;
  busy: number;
  short_calls: number;
  failure_rate_percent: number;
  short_call_rate_percent: number;
  avg_duration_seconds: number;
  by_sip_code: Record<string, number>;
}> {
  // Fetch up to 1000 CDRs for the window and compute stats locally.
  // AVOXI does not expose a native aggregation endpoint in v2.
  const result = await getCdrs(config, { ...params, limit: 1000 });
  const cdrs = result.data;

  const bySip: Record<string, number> = {};
  let answered = 0, failed = 0, noAnswer = 0, busy = 0, shortCalls = 0;
  let totalDuration = 0;

  for (const c of cdrs) {
    const code = String(c.sip_response_code);
    bySip[code] = (bySip[code] ?? 0) + 1;
    if (c.disposition === 'answered') answered++;
    else if (c.disposition === 'failed') failed++;
    else if (c.disposition === 'no-answer') noAnswer++;
    else if (c.disposition === 'busy') busy++;
    if (c.short_call) shortCalls++;
    totalDuration += c.duration_seconds;
  }

  const total = cdrs.length;
  return {
    total,
    answered,
    failed,
    no_answer: noAnswer,
    busy,
    short_calls: shortCalls,
    failure_rate_percent: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
    short_call_rate_percent: total > 0 ? Math.round((shortCalls / total) * 1000) / 10 : 0,
    avg_duration_seconds: total > 0 ? Math.round(totalDuration / total) : 0,
    by_sip_code: bySip,
  };
}
