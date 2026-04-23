/**
 * TypeScript models that mirror the AVOXI v2 response shapes.
 *
 * Derived from the live OpenAPI spec at
 *   https://genius.avoxi.com/api/v2/api-docs/
 *
 * The single most important model is AvoxiCdr — it carries everything
 * we need to reconstruct a call journey:
 *
 *   interface AvoxiCdr {
 *     avoxi_call_id:        string;     // the Call ID
 *     to / from / *_country: string;
 *     status:               'ANSWERED' | 'UNANSWERED' | 'VOICEMAIL';
 *     direction:            'INBOUND' | 'OUTBOUND' | 'INTERNAL';
 *     date_start:           string;     // ISO 8601 w/ tz
 *     date_answered:        string;     // present iff ANSWERED
 *     date_end:             string;
 *     duration:             { seconds: number; formatted: string };
 *     forwarded_to:         string[];   // e.g. ['SIP','Queue','Agent']
 *     sorted_dispositions:  Disposition[];
 *     forward_destination:  string;     // final hop (ext/number/SIP)
 *     call_recording_url:   string | null;  // valid 24 h
 *     friendly_name:        string;
 *     agent_actions:        AgentAction[];   // journey fragments
 *     voicemail_details?:   { prior_extension_called: {extension,type,name} };
 *     billing_group_details: BillingGroup[];
 *     charged:              { amount_usd: string; quantity_secs: string };
 *   }
 *
 *   interface AgentAction {
 *     event:     string;   // e.g. 'handled', 'rang', 'declined'
 *     user_id:   string;
 *     user_name: string;
 *     timestamp: string;   // ISO 8601
 *   }
 *
 * Other models defined here: AvoxiAgent, AgentTimelineEntry, LiveTeamStats,
 * AlertLog, AvoxiNumber, Entitlements, plus list-response envelopes.
 *
 * STATUS: SKELETON.
 */

export {};
