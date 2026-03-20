import process from 'node:process';

import { parseArgs, runAgentTask } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const taskId = args.task ?? args._[0];

if (!taskId) {
  console.error('Usage: node scripts/run-claude-task.js --task <task-id> [--dry-run]');
  process.exit(1);
}

const result = await runAgentTask('claude', {
  taskId,
  dryRun: Boolean(args['dry-run']),
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.exitCode === 0 && result.validation.valid ? 0 : 2);
