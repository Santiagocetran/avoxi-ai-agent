/**
 * Implements the `transcribe_call` LLM tool.
 *
 * Flow (only if privacy/gate.ts#canProcessRecording returns true):
 *   1. avoxi/recording.ts downloads the audio
 *   2. Send to transcription provider (OpenAI Whisper / Gemini / local model
 *      — configurable via TRANSCRIPTION_PROVIDER)
 *   3. Run privacy/policy.ts#redact on the transcript (phone numbers, SSNs,
 *      credit cards) before returning to the LLM
 *   4. Return { transcript, language, duration_sec }
 *
 * If the gate refuses → return { error: 'disabled_by_policy', reason } so
 * the LLM can keep working with journey-only context.
 *
 * STATUS: SKELETON. Entire module is policy-gated; see docs/PRIVACY.md.
 */

export {};
