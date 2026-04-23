import 'dotenv/config';
import type { AvoxiConfig } from './tools/avoxi.js';
import type { LlmConfig } from './llm.js';

function require(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

export function loadAvoxiConfig(): AvoxiConfig {
  return {
    baseUrl: optional('AVOXI_BASE_URL') ?? 'https://api.avoxi.com/v2',
    apiKey: require('AVOXI_API_KEY'),
    accountId: require('AVOXI_ACCOUNT_ID'),
  };
}

export function loadLlmConfig(): LlmConfig {
  const provider = (optional('LLM_PROVIDER') ?? 'kimi') as 'kimi' | 'hermes';
  return {
    provider,
    kimiApiKey: optional('KIMI_API_KEY'),
    kimiBaseUrl: optional('KIMI_BASE_URL'),
    kimiModel: optional('KIMI_MODEL'),
    hermesBaseUrl: optional('HERMES_BASE_URL'),
    hermesModel: optional('HERMES_MODEL'),
  };
}

export function loadMonitorCron(): string {
  return optional('MONITOR_CRON') ?? '*/5 * * * *';
}
