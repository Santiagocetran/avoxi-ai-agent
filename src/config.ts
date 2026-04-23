import 'dotenv/config';
import type { AvoxiConfig } from './tools/avoxi.js';
import type { LlmConfig, LlmProvider } from './llm.js';

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

const VALID_PROVIDERS: LlmProvider[] = ['kimi', 'openai', 'gemini', 'claude'];

export function loadLlmConfig(): LlmConfig {
  const provider = (optional('LLM_PROVIDER') ?? 'kimi') as LlmProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`LLM_PROVIDER must be one of: ${VALID_PROVIDERS.join(', ')}. Got: "${provider}"`);
  }
  return {
    provider,
    kimiApiKey:    optional('KIMI_API_KEY'),
    kimiBaseUrl:   optional('KIMI_BASE_URL'),
    kimiModel:     optional('KIMI_MODEL'),
    openaiApiKey:  optional('OPENAI_API_KEY'),
    openaiModel:   optional('OPENAI_MODEL'),
    geminiApiKey:  optional('GEMINI_API_KEY'),
    geminiModel:   optional('GEMINI_MODEL'),
    claudeApiKey:  optional('CLAUDE_API_KEY'),
    claudeModel:   optional('CLAUDE_MODEL'),
  };
}

export function loadMonitorCron(): string {
  return optional('MONITOR_CRON') ?? '*/5 * * * *';
}

export function loadDashboardPort(): number {
  return parseInt(optional('DASHBOARD_PORT') ?? '3000', 10);
}
