/**
 * Implements `get_live_team` and `list_live_teams` LLM tools.
 *
 * Uses GET /live/teams and GET /live/team/{team_id} to surface the
 * real-time concurrent-call view (Avoxi refreshes these every 5 s).
 *
 * Used primarily by cli/watch.ts to detect ongoing calls that are
 * currently ringing with nobody on duty.
 *
 * STATUS: SKELETON.
 */

export {};
