/**
 * Implements `list_agents` and `get_agent_timeline` LLM tools.
 *
 * - list_agents: thin pass-through over avoxi/client.listAgents.
 * - get_agent_timeline: pass-through over GET /agents/timeline (Avoxi marks
 *   this endpoint as "Coming Soon" — the code should fall back gracefully
 *   by returning { error: 'endpoint_unavailable' } if Avoxi returns 404).
 *
 * STATUS: SKELETON.
 */

export {};
