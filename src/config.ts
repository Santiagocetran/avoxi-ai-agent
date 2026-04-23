/**
 * Environment & config loader.
 *
 * Responsibilities:
 *   - Load .env (dotenv)
 *   - Validate required vars per selected LLM provider
 *   - Load the on-call schedule from config/schedule.yaml
 *   - Expose typed getters: loadAvoxiConfig, loadLlmConfig, loadScheduleConfig,
 *     loadPrivacyConfig, loadNotifierConfig, loadStorageConfig, loadDashboardConfig
 *
 * Centralised here so every module reads config exactly once at startup
 * and no module reaches into process.env directly.
 *
 * STATUS: SKELETON.
 */

export {};
