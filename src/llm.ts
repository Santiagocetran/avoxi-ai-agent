/**
 * LLM client factory. Returns an OpenAI-compatible client for either:
 *   - Kimi (Moonshot AI) — cloud, set LLM_PROVIDER=kimi
 *   - Hermes via Ollama  — local, set LLM_PROVIDER=hermes
 */

import OpenAI from 'openai';

export interface LlmConfig {
  provider: 'kimi' | 'hermes';
  kimiApiKey?: string;
  kimiBaseUrl?: string;
  kimiModel?: string;
  hermesBaseUrl?: string;
  hermesModel?: string;
}

export interface ResolvedLlm {
  client: OpenAI;
  model: string;
}

export function buildLlmClient(config: LlmConfig): ResolvedLlm {
  if (config.provider === 'kimi') {
    if (!config.kimiApiKey) throw new Error('KIMI_API_KEY is required when LLM_PROVIDER=kimi');
    return {
      client: new OpenAI({
        apiKey: config.kimiApiKey,
        baseURL: config.kimiBaseUrl ?? 'https://api.moonshot.cn/v1',
      }),
      model: config.kimiModel ?? 'moonshot-v1-32k',
    };
  }

  // Hermes via Ollama
  return {
    client: new OpenAI({
      apiKey: 'ollama', // Ollama ignores the key but the SDK requires a non-empty value
      baseURL: config.hermesBaseUrl ?? 'http://localhost:11434/v1',
    }),
    model: config.hermesModel ?? 'hermes3',
  };
}
