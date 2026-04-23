/**
 * AVOXI v2 client. Hides HTTP, bearer auth, base URL, pagination and
 * retries, plus Avoxi's `{data: [...]}` response envelope.
 *
 * Surface
 *   listCalls(since: Date, until: Date): Promise<Call[]>
 *     - MUST auto-paginate. /cdrs caps at 10 000 rows/page; callers never
 *       see the page cursor.
 *     - Returns [] if the window has no calls; only throws on
 *       auth/network failure.
 *
 * Domain type — deliberately NOT mirroring the Avoxi CDR shape.
 * Field names here are domain-neutral; Avoxi field names are hidden.
 *
 *   Call = {
 *     id:              string;                         // Avoxi avoxi_call_id
 *     status:          'answered'|'unanswered'|'voicemail';
 *     direction:       'inbound'|'outbound'|'internal';
 *     from:            string;
 *     to:              string;
 *     startedAt:       Date;
 *     answeredAt?:     Date;
 *     endedAt:         Date;
 *     forwardedTo:     string[];                       // routing buckets, in order
 *     events:          Event[];                        // timestamped hops (was agent_actions)
 *     priorExtension?: string;                         // last ext rung before voicemail
 *     finalDestination?: string;                       // last hop before termination
 *   };
 *   Event = { at: Date; kind: string; actor?: string };
 *
 * Post-MVP note. CDRs carry a 24 h pre-signed `call_recording_url`.
 * When the privacy review lands, extend this module with a
 * `getRecordingUrl(call)` that returns that URL (and nothing else —
 * download bytes stays out of this module).
 *
 * STATUS: SKELETON.
 */

export {};
