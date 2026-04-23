/**
 * Core agent loop — multi-turn LLM conversation with tool dispatch.
 *
 * Used by every entry point (cli/audit, cli/watch, cli/inspect, dashboard).
 * The agent is deliberately task-agnostic: the caller supplies the system
 * prompt and the user prompt, and selects which tools are exposed.
 *
 * Flow per invocation:
 *   1. send [system, user] messages to the LLM with the tool catalog
 *   2. while response contains tool calls → dispatch to tools/index.ts,
 *      append tool results, loop (cap at MAX_TOOL_ROUNDS)
 *   3. return the final plain-text response
 *
 * Callbacks (onToolCall / onToolResult) are the integration point for
 * live UIs (dashboard SSE) and structured stdout (CLI).
 *
 * STATUS: SKELETON — this file is a placeholder, no runtime code yet.
 */

export {};
