/**
 * Dashboard in-memory snapshot + SSE fan-out.
 *
 * - Last N audited calls (capped)
 * - Last N live events from cli/watch
 * - Current on-call window state
 *
 * Re-hydrated on startup from storage/audit-log.ts so a restart doesn't
 * blank the UI.
 *
 * STATUS: SKELETON.
 */

export {};
