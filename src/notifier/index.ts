/**
 * Notifier dispatcher.
 *
 * Delegates to one or more channels based on env:
 *   NOTIFY_CHANNELS = "slack,email"     // comma-separated
 *
 * Channels wired under src/notifier/*.ts each implement the same tiny
 * interface:   send(message: NotifierMessage): Promise<NotifierResult>
 *
 * Retries and delivery records go to storage/audit-log.ts.
 *
 * STATUS: SKELETON.
 */

export {};
