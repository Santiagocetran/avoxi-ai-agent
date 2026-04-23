/**
 * AVOXI token management.
 *
 * Reads AVOXI_API_TOKEN at startup. (Avoxi tokens are long-lived per-SP
 * bearer tokens; see SW-lead-recomendations.md §3.)
 *
 * If Avoxi rolls out short-lived tokens in the future, add refresh logic
 * here — no other module should know about auth mechanics.
 *
 * Also exposes a one-shot `verifyToken()` helper that calls GET /entitlements
 * and returns the decoded permissions so startup can fail loudly if the
 * token lacks the scopes we need (CDRs, agents, alerts).
 *
 * STATUS: SKELETON.
 */

export {};
