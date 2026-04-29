/**
 * Env + YAML loader. Single read at startup; no other module touches
 * process.env. All parsing, defaulting and validation (zod) live here so
 * every other module sees a pre-validated AppConfig and trusts it.
 *
 * Inputs
 *   .env                     AVOXI_API_TOKEN, LLM_PROVIDER, LLM_API_KEY,
 *                            LLM_MODEL, optional LLM_BASE_URL, COMPANY_NAME
 *   config/schedule.yaml     on-call windows
 *
 * Surface
 *   loadConfig(): AppConfig          // throws only on missing/invalid config
 *
 * Types
 *   AppConfig = {
 *     avoxi:       { token: string; baseUrl: string };
 *     llm:         { provider: 'kimi'|'openai'|'gemini';
 *                    apiKey: string; model: string; baseUrl: string };
 *     schedule:    Schedule;
 *     companyName: string;
 *   };
 *
 *   Schedule = { timezone: string; windows: Window[] };
 *   Window   = { name?: string; days: Weekday[]; start: string; end: string };
 *   Weekday  = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
 *
 * Note: AppConfig.llm.baseUrl is always a resolved string. The per-provider
 * default URL table lives here so no downstream module knows which provider
 * is active — they receive a plain URL.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  kimi:   'https://api.moonshot.cn/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
};

const WeekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

const WindowSchema = z.object({
  name:  z.string().optional(),
  days:  z.array(WeekdaySchema),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'start must be HH:MM'),
  end:   z.string().regex(/^\d{2}:\d{2}(\+1)?$/, 'end must be HH:MM or HH:MM+1'),
});

const ScheduleSchema = z.object({
  timezone: z.string().min(1),
  windows:  z.array(WindowSchema).min(1),
});

const EnvSchema = z.object({
  AVOXI_API_TOKEN: z.string().min(1),
  AVOXI_BASE_URL:  z.string().url().default('https://genius.avoxi.com/api/v2'),
  LLM_PROVIDER:    z.enum(['kimi', 'openai', 'gemini']),
  LLM_API_KEY:     z.string().min(1),
  LLM_MODEL:       z.string().min(1),
  LLM_BASE_URL:    z.string().url().optional(),
  COMPANY_NAME:    z.string().default('your company'),
});

export type Weekday  = z.infer<typeof WeekdaySchema>;
export type Window   = z.infer<typeof WindowSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;

export type AppConfig = {
  avoxi:       { token: string; baseUrl: string };
  llm:         { provider: 'kimi' | 'openai' | 'gemini'; apiKey: string; model: string; baseUrl: string };
  schedule:    Schedule;
  companyName: string;
};

export function loadConfig(): AppConfig {
  const envResult = EnvSchema.safeParse(process.env);
  if (!envResult.success) {
    const fields = envResult.error.issues
      .map(i => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    throw new Error(`Config error — ${fields}`);
  }
  const env = envResult.data;

  const schedulePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../config/schedule.yaml',
  );

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(schedulePath, 'utf8'));
  } catch {
    throw new Error(`Cannot read schedule file: ${schedulePath}`);
  }

  const schedResult = ScheduleSchema.safeParse(raw);
  if (!schedResult.success) {
    const fields = schedResult.error.issues.map(i => i.path.join('.')).join(', ');
    throw new Error(`schedule.yaml invalid — fields: ${fields}`);
  }

  const baseUrl = env.LLM_BASE_URL ?? PROVIDER_BASE_URLS[env.LLM_PROVIDER];

  return {
    avoxi:       { token: env.AVOXI_API_TOKEN, baseUrl: env.AVOXI_BASE_URL },
    llm:         { provider: env.LLM_PROVIDER, apiKey: env.LLM_API_KEY, model: env.LLM_MODEL, baseUrl },
    schedule:    schedResult.data,
    companyName: env.COMPANY_NAME,
  };
}
