/**
 * AVOXI API client — thin typed wrapper over the HTTPS surface.
 *
 * Base URL:    https://genius.avoxi.com/api/v2   (override with AVOXI_BASE_URL)
 * Auth:        Bearer token in `Authorization` header (see avoxi/auth.ts)
 * Reference:   https://genius.avoxi.com/api/v2/api-docs/
 *
 * Methods (only the subset the auditor actually needs):
 *   - listCdrs({ call_start_oldest, call_start_newest, limit, offset, timezone })
 *   - listAgents({ team_id?, user_id? })
 *   - getAgentTimeline({ from_timestamp, to_timestamp, agent_ids?, team_ids? })
 *   - getTeamLive(team_id)
 *   - listTeamsLive()
 *   - listAlertLogs({ oldest, newest, statuses?, numbers?, agents? })
 *   - listNumbers({ numbers?, number? })
 *   - getEntitlements()   ← used only for a self-check at startup
 *
 * Error handling: non-2xx → throw AvoxiApiError with status, path, response body.
 * Pagination:     listCdrs must handle `has_more`/offset loop — max 10 000/page.
 * Timeouts:       AbortController with 15 s default, configurable per call.
 *
 * STATUS: SKELETON.
 */

export {};
