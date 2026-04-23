/**
 * Recording download helper.
 *
 * The AVOXI CDR carries `call_recording_url` — a pre-signed Google Cloud
 * Storage URL valid for ~24 h. This module:
 *
 *   - Downloads the audio to a local scratch path (default ./tmp/recordings)
 *   - Streams to disk (never buffer whole file in memory)
 *   - Is the ONLY module permitted to touch recording bytes — everyone
 *     else goes through it, so the privacy gate has a single choke point.
 *
 * Before downloading, MUST call privacy/gate.ts#canProcessRecording(call)
 * and abort with a typed error if the gate refuses.
 *
 * STATUS: SKELETON.
 */

export {};
