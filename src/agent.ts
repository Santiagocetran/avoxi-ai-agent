/**
 * Core agent loop.
 * Runs a multi-turn conversation with the LLM, dispatching tool calls until
 * the model produces a final text response (no more tool calls).
 */

import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { ClaudeAdapter } from './llm-claude.js';
import { TOOLS, dispatchTool } from './tools/index.js';
import { buildSystemPrompt } from './prompts/system.js';
import type { AvoxiConfig } from './tools/avoxi.js';

const MAX_TOOL_ROUNDS = 8;

export interface AgentRunOptions {
  llmClient: OpenAI | ClaudeAdapter;
  model: string;
  avoxiConfig: AvoxiConfig;
  userPrompt: string;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
}

export async function runAgent(opts: AgentRunOptions): Promise<string> {
  const { llmClient, model, avoxiConfig, userPrompt, onToolCall, onToolResult } = opts;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(new Date()) },
    { role: 'user', content: userPrompt },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await llmClient.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('LLM returned no choices');

    messages.push(choice.message);

    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
      return choice.message.content ?? '';
    }

    for (const toolCall of choice.message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

      onToolCall?.(name, args);

      let result: unknown;
      try {
        result = await dispatchTool(name, args, avoxiConfig);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }

      onToolResult?.(name, result);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(`Agent exceeded ${MAX_TOOL_ROUNDS} tool rounds without a final answer`);
}
