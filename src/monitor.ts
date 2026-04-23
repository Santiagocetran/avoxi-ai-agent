/**
 * Background monitor — runs on a cron schedule and posts results to stdout.
 * Pipe output to a log file or Slack webhook as needed.
 *
 * Usage:
 *   node --loader tsx src/monitor.ts
 *   # or via package.json script:
 *   pnpm monitor
 */

import cron from 'node-cron';
import chalk from 'chalk';
import { loadAvoxiConfig, loadLlmConfig, loadMonitorCron } from './config.js';
import { buildLlmClient } from './llm.js';
import { runAgent } from './agent.js';
import { buildMonitorPrompt } from './prompts/system.js';

const avoxiConfig = loadAvoxiConfig();
const { client, model } = await buildLlmClient(loadLlmConfig());
const schedule = loadMonitorCron();

async function runCheck(): Promise<void> {
  const ts = new Date().toISOString();
  console.log(chalk.gray(`\n[${ts}] Running scheduled health check...`));

  try {
    const result = await runAgent({
      llmClient: client,
      model,
      avoxiConfig,
      userPrompt: buildMonitorPrompt(),
      onToolCall: (name, args) => {
        console.log(chalk.cyan(`  → tool: ${name}`), chalk.gray(JSON.stringify(args)));
      },
      onToolResult: (name, result) => {
        const preview = JSON.stringify(result).slice(0, 120);
        console.log(chalk.green(`  ← ${name}:`), chalk.gray(preview + (preview.length >= 120 ? '…' : '')));
      },
    });

    const severity = result.includes('CRITICAL')
      ? chalk.red
      : result.includes('WARNING')
        ? chalk.yellow
        : chalk.green;

    console.log('\n' + severity(result));
  } catch (err) {
    console.error(chalk.red(`[ERROR] Health check failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

console.log(chalk.blue(`AVOXI Monitor started. Schedule: ${schedule}`));
console.log(chalk.gray(`LLM provider: ${process.env.LLM_PROVIDER ?? 'kimi'} | Model: ${model}`));

// Run once immediately on startup, then follow the cron
runCheck();
cron.schedule(schedule, runCheck);
