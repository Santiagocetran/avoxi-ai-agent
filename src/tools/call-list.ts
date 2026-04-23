/**
 * Implements the `list_calls` LLM tool.
 *
 * Wraps avoxi/client.listCdrs but:
 *   - Auto-paginates when `has_more` is true (hard cap on total rows so the
 *     LLM can't accidentally pull months of data)
 *   - Strips irrelevant fields to keep the tool-result JSON small
 *   - Optionally pre-filters to status=UNANSWERED|VOICEMAIL
 *
 * STATUS: SKELETON.
 */

export {};
