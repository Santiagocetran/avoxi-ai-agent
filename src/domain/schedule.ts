/**
 * On-call schedule logic — pure functions, no I/O.
 *
 * Configured in config/schedule.yaml (timezone + weekly windows).
 *
 * Surface:
 *   isOnCall(ts: Date): boolean
 *   currentWindow(ts: Date): Window | null
 *   previousWindow(ts: Date): Window
 *   nextWindow(ts: Date): Window
 *
 * Default Grupo Wellness config:
 *   timezone: "America/Argentina/Buenos_Aires"
 *   windows:
 *     - weekday: [Mon, Tue, Wed, Thu, Fri]
 *       start:   "21:00"
 *       end:     "09:00+1"    # crosses midnight
 *     - weekday: [Sat, Sun]
 *       start:   "00:00"
 *       end:     "24:00"
 *
 * STATUS: SKELETON.
 */

export {};
