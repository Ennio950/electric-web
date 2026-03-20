import process from 'node:process';

import { parseArgs, releaseLockByTaskId } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const taskId = args.task ?? args._[0];

if (!taskId) {
  console.error('Usage: node scripts/release-lock.js --task <task-id>');
  process.exit(1);
}

releaseLockByTaskId(taskId);
console.log(JSON.stringify({ releasedTaskId: taskId }, null, 2));
