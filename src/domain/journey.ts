/**
 * Call-journey reconstruction.
 *
 * Avoxi's v2 API does NOT expose a single "journey" endpoint; the journey
 * is reconstructed client-side from fields already present on an AvoxiCdr:
 *
 *   date_start                  → t0 (call hit the DID)
 *   forwarded_to[]              → which routing buckets it entered, in order
 *   agent_actions[]             → per-agent events (rang / declined / handled)
 *                                 with timestamps — these are the main
 *                                 journey steps
 *   voicemail_details           → if reached, which extension was last tried
 *   forward_destination         → final hop before termination
 *   date_answered / date_end    → answer + termination timestamps
 *   status                      → ANSWERED | UNANSWERED | VOICEMAIL
 *
 * Output model:
 *   interface JourneyTimeline {
 *     call_id:      string;
 *     inbound_to:   string;     // DID
 *     from:         string;     // caller number
 *     started_at:   string;
 *     ended_at:     string;
 *     final_state:  'answered' | 'unanswered' | 'voicemail';
 *     steps:        JourneyStep[];
 *   }
 *   interface JourneyStep {
 *     at:           string;     // ISO timestamp
 *     kind:         'hit_did'|'forwarded'|'ring_agent'|'agent_declined'|
 *                   'agent_answered'|'queued'|'voicemail'|'hangup'|'other';
 *     actor?:       string;     // agent name / queue name / extension
 *     detail?:      string;
 *   }
 *
 * build(cdr): JourneyTimeline
 * render(timeline): string  // human-readable bullet list for prompts/logs
 *
 * STATUS: SKELETON.
 */

export {};
