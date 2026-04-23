/**
 * LLM client factory. Supports four providers via OpenAI-compatible SDK:
 *   - kimi    → Moonshot AI (cloud)
 *   - openai  → OpenAI native
 *   - gemini  → Google Gemini via OpenAI-compatible endpoint
 *   - claude  → Anthropic Claude via thin adapter (see llm-claude.ts)
 */

import OpenAI from 'openai';
import type { ClaudeAdapter } from './llm-claude.js';

export type LlmProvider = 'kimi' | 'openai' | 'gemini' | 'claude';

export interface LlmConfig {
  provider: LlmProvider;
  // Kimi
  kimiApiKey?: string;
  kimiBaseUrl?: string;
  kimiModel?: string;
  // OpenAI
  openaiApiKey?: string;
  openaiModel?: string;
  // Gemini
  geminiApiKey?: string;
  geminiModel?: string;
  // Claude
  claudeApiKey?: string;
  claudeModel?: string;
}

// The agent loop accepts either an OpenAI client or the Claude adapter —
// both expose the same .chat.completions.create() interface.
export interface ResolvedLlm {
  client: OpenAI | ClaudeAdapter;
  model: string;
}

export async function buildLlmClient(config: LlmConfig): Promise<ResolvedLlm> {
  switch (config.provider) {
    case 'kimi': {
      if (!config.kimiApiKey) throw new Error('KIMI_API_KEY is required when LLM_PROVIDER=kimi');
      return {
        client: new OpenAI({
          apiKey: config.kimiApiKey,
          baseURL: config.kimiBaseUrl ?? 'https://api.moonshot.cn/v1',
        }),
        model: config.kimiModel ?? 'moonshot-v1-32k',
      };
    }

    case 'openai': {
      if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
      return {
        client: new OpenAI({ apiKey: config.openaiApiKey }),
        model: config.openaiModel ?? 'gpt-4o',
      };
    }

    case 'gemini': {
      if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      // Google exposes an OpenAI-compatible endpoint — no extra SDK needed
      return {
        client: new OpenAI({
          apiKey: config.geminiApiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        }),
        model: config.geminiModel ?? 'gemini-2.0-flash',
      };
    }

    case 'claude': {
      if (!config.claudeApiKey) throw new Error('CLAUDE_API_KEY is required when LLM_PROVIDER=claude');
      // Anthropic SDK has a different wire format; ClaudeAdapter normalises it.
      const { ClaudeAdapter } = await import('./llm-claude.js');
      return {
        client: new ClaudeAdapter(config.claudeApiKey),
        model: config.claudeModel ?? 'claude-sonnet-4-6',
      };
    }

    default:
      throw new Error(`Unknown LLM_PROVIDER: ${String(config.provider)}`);
  }
}
