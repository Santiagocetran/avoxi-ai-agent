/**
 * ClaudeAdapter — wraps the Anthropic SDK to expose the same
 * .chat.completions.create() interface that the agent loop expects.
 *
 * STATUS: PSEUDO-CODE SKELETON
 * The Anthropic message format differs from OpenAI's in a few ways:
 *   - Tool definitions use "input_schema" instead of "parameters"
 *   - Tool results are sent as content blocks, not role:"tool" messages
 *   - finish_reason maps to stop_reason ("end_turn" vs "stop", "tool_use" vs "tool_calls")
 *
 * TODO: install dependency → pnpm add @anthropic-ai/sdk
 * TODO: implement _convertTools(), _convertMessages(), _convertResponse()
 */

// import Anthropic from '@anthropic-ai/sdk';
// import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages.js';

export class ClaudeAdapter {
  // private sdk: Anthropic;

  constructor(_apiKey: string) {
    // TODO: this.sdk = new Anthropic({ apiKey });
    throw new Error('ClaudeAdapter is not yet implemented. See src/llm-claude.ts');
  }

  // Mimics OpenAI client.chat.completions.create()
  get chat() {
    return {
      completions: {
        create: async (_params: unknown): Promise<unknown> => {
          // TODO:
          // 1. _convertTools(params.tools) → Anthropic tool format
          // 2. _convertMessages(params.messages) → Anthropic messages format
          // 3. Call this.sdk.messages.create({ model, max_tokens, tools, messages })
          // 4. _convertResponse(sdkResponse) → OpenAI-shaped response object
          //    - map stop_reason "end_turn"  → finish_reason "stop"
          //    - map stop_reason "tool_use"  → finish_reason "tool_calls"
          //    - map content blocks          → message.tool_calls[]
          throw new Error('ClaudeAdapter.chat.completions.create() not implemented');
        },
      },
    };
  }

  // -- Private helpers (pseudo-code) -----------------------------------------

  // _convertTools(openAiTools): AnthropicTool[] {
  //   return openAiTools.map(t => ({
  //     name: t.function.name,
  //     description: t.function.description,
  //     input_schema: t.function.parameters,   // Anthropic calls it input_schema
  //   }));
  // }

  // _convertMessages(messages): MessageParam[] {
  //   // Anthropic doesn't have role:"tool" — tool results are content blocks
  //   // inside a role:"user" message. Map accordingly.
  // }

  // _convertResponse(sdkResponse): OpenAI.Chat.Completions.ChatCompletion {
  //   // Rebuild the OpenAI shape so agent.ts needs zero changes
  // }
}
