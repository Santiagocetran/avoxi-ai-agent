/**
 * Audit orchestrator. Hides LLM provider wiring, prompt engineering and
 * output formatting.
 *
 * Surface
 *   auditWindow(since: Date, until: Date, config: AppConfig): Promise<string>
 *
 * Pipeline
 *   1. avoxi.listCalls(since, until)
 *   2. journey.classify(call, config.schedule)   per call
 *   3. Build a compact prompt from the classified set
 *   4. Send to an OpenAI-wire LLM built from config.llm
 *   5. Return the narrative (markdown)
 *
 * MVP choice. The LLM only narrates data that has already been
 * deterministically classified — no function-calling, no tool-dispatch
 * loop. That keeps the hot path small and auditable; tools get
 * re-introduced later when recording audit and live look-ups arrive.
 *
 * STATUS: SKELETON.
 */

export {};
