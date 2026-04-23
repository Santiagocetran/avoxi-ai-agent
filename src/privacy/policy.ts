/**
 * Privacy policy — declarative.
 *
 * Fields loaded from env / config/privacy.yaml:
 *   RECORDINGS_ENABLED       boolean  default: false
 *   TRANSCRIPTION_ENABLED    boolean  default: false
 *   REDACT_PATTERNS          regex[]  phone, email, SSN, CCN, etc.
 *   RECORDING_RETENTION_DAYS number   how long to keep any downloaded bytes
 *   ALLOWED_TRANSCRIPT_LOCALES ISO[]  (whitelist)
 *   LEGAL_BASIS              enum     'consent'|'legitimate_interest'|'none'
 *
 * Surface:
 *   policy.canProcessRecording(): { allowed: boolean; reason: string }
 *   policy.redact(text: string): string
 *
 * Rationale: SW-lead-recomendations.md flags audio processing as needing
 * privacy review. Making this a first-class module instead of scattered
 * flags gives us a single place for legal to audit.
 *
 * STATUS: SKELETON. See docs/PRIVACY.md.
 */

export {};
