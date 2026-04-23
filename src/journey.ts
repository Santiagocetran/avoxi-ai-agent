/**
 * Call-journey reconstruction + missed-call classification.
 *
 * Pure functions. No I/O. Deterministic given (Call, Schedule).
 * The time anchor for every classification decision is `call.startedAt`
 * — never `Date.now()`. This module does not know what "now" is.
 *
 * Surface
 *   classify(call: Call, schedule: Schedule): Analysis
 *   isOnCall(at: Date, schedule: Schedule): boolean
 *
 * Types
 *   Analysis = {
 *     steps:  Step[];        // ordered timeline
 *     missed: boolean;
 *     reason: MissReason;
 *   };
 *
 *   Step      = { at: Date; kind: StepKind; actor?: string; detail?: string };
 *   StepKind  = 'hit_did' | 'forwarded' | 'ring_agent' | 'agent_declined'
 *             | 'agent_answered' | 'queued' | 'voicemail' | 'hangup' | 'other';
 *
 *   MissReason =
 *     | 'no_agent_on_duty'    // call arrived during on-call window, nobody answered
 *     | 'agent_declined'
 *     | 'ring_timeout'
 *     | 'queue_abandoned'
 *     | 'voicemail_left'
 *     | 'voicemail_empty'
 *     | 'routing_failure'     // forwarded_to empty / no finalDestination
 *     | 'off_hours_expected'  // outside on-call window — informational only
 *     | 'unknown';            // fall-through — never throws
 *
 * STATUS: SKELETON.
 */

export {};
