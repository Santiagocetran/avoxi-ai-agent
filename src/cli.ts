/**
 * Interactive CLI — ask ad-hoc questions about the AVOXI platform.
 *
 * Usage:
 *   pnpm query "What was the failure rate in the last hour?"
 *   pnpm query "Are there any suspended DIDs?"
 *   pnpm query "Show me all failed calls from the last 30 minutes"
 *   pnpm query "Is the system healthy right now?"
 */

import chalk from 'chalk';
import { loadAvoxiConfig, loadLlmConfig } from './config.js';
import { buildLlmClient } from './llm.js';
import { runAgent } from './agent.js';

const question = process.argv.slice(2).join(' ').trim();

if (!question) {
  console.error(chalk.red('Usage: pnpm query "<your question>"'));
  console.error(chalk.gray('Example: pnpm query "What happened in the last 2 hours?"'));
  process.exit(1);
}

const avoxiConfig = loadAvoxiConfig();
const { client, model } = buildLlmClient(loadLlmConfig());

console.log(chalk.gray(`\nQuery: ${question}`));
console.log(chalk.gray(`Model: ${model}\n`));

try {
  const result = await runAgent({
    llmClient: client,
    model,
    avoxiConfig,
    userPrompt: question,
    onToolCall: (name, args) => {
      console.log(chalk.cyan(`  → ${name}`), chalk.gray(JSON.stringify(args)));
    },
    onToolResult: (name) => {
      console.log(chalk.green(`  ← ${name} done`));
    },
  });

  console.log('\n' + chalk.white(result) + '\n');
} catch (err) {
  console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
}
