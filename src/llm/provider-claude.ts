/**
 * Anthropic Claude adapter.
 *
 * Claude's message API differs from OpenAI's in three ways — same three
 * deltas as before, listed here for the implementer:
 *
 *   1. tool definitions use `input_schema` instead of `parameters`
 *   2. tool results are content blocks inside a role:"user" message, not
 *      a distinct role:"tool" message
 *   3. finish_reason mapping: stop_reason "end_turn"→"stop",
 *      "tool_use"→"tool_calls"
 *
 * Exposes `.chat.completions.create()` so agent.ts stays provider-agnostic.
 *
 * STATUS: SKELETON.
 */

export {};
