/**
 * Missed-call classifier — pure functions over AvoxiCdr.
 *
 * Primary predicate:
 *   isMissed(cdr): boolean
 *     = cdr.status === 'UNANSWERED'
 *       || (cdr.status === 'VOICEMAIL' && voicemail-counts-as-missed per policy)
 *
 * Secondary: a reason label drawn from a controlled vocabulary so the
 * dashboard can group, sort, and trend these.
 *
 *   type MissedReason =
 *     | 'no_agent_on_duty'         // on-call hour but nobody answered
 *     | 'agent_declined'           // agent_actions contains 'declined'
 *     | 'ring_timeout'             // rang through without pickup
 *     | 'queue_abandoned'          // caller hung up in queue
 *     | 'voicemail_left'
 *     | 'voicemail_empty'
 *     | 'routing_failure'          // forwarded_to empty / forward_destination missing
 *     | 'off_hours_expected'       // outside on-call + business hours
 *     | 'unknown'
 *
 * classify(cdr, schedule, agents): { missed: boolean; reason: MissedReason }
 *
 * STATUS: SKELETON.
 */

export {};
