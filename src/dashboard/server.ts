/**
 * `pnpm dashboard` — HTTP server + SSE live feed.
 *
 * Routes:
 *   GET  /                         → serves web/index.html
 *   GET  /api/calls                → paginated audited-call list
 *   GET  /api/calls/:id            → single call w/ journey + audit narrative
 *   GET  /api/calls/:id/recording  → 302 to the 24 h pre-signed URL, but
 *                                    ONLY if privacy gate allows for the
 *                                    authenticated session
 *   GET  /api/reports              → periodic report list
 *   GET  /api/reports/:id          → one report (md/html)
 *   GET  /api/schedule             → current on-call window
 *   GET  /events                   → SSE (live audit feed from cli/watch)
 *
 * Shares the same runAgent + tool plumbing as the CLI entry points — the
 * dashboard simply renders what the agent already produced.
 *
 * STATUS: SKELETON.
 */

export {};
