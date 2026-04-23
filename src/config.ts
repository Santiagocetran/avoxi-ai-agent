/**
 * Env + YAML loader. Single read at startup; no other module touches
 * process.env. All parsing, defaulting and validation (zod) live here so
 * every other module sees a pre-validated AppConfig and trusts it.
 *
 * Inputs
 *   .env                     AVOXI_API_TOKEN, LLM_PROVIDER, *_API_KEY,
 *                            *_MODEL, optional *_BASE_URL, COMPANY_NAME
 *   config/schedule.yaml     on-call windows (see Schedule below)
 *
 * Surface
 *   loadConfig(): AppConfig          // throws only on missing/invalid config
 *
 * Types
 *   AppConfig = {
 *     avoxi:        { token: string; baseUrl: string };
 *     llm:          { provider: 'kimi'|'openai'|'gemini';
 *                     apiKey:   string;
 *                     model:    string;
 *                     baseUrl?: string };
 *     schedule:     Schedule;
 *     companyName:  string;
 *   };
 *
 *   Schedule = {
 *     timezone: string;              // IANA, e.g. 'America/Argentina/Buenos_Aires'
 *     windows:  Window[];
 *   };
 *   Window = { days: Weekday[]; start: string; end: string }; // end may be "HH:MM+1"
 *   Weekday = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
 *
 * STATUS: SKELETON.
 */

export {};
