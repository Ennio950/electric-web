import process from 'node:process';

import { createLock, findTask, parseArgs } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const taskId = args.task ?? args._[0];
const agent = args.agent;

if (!taskId || !agent) {
  console.error('Usage: node scripts/create-lock.js --task <task-id> --agent <codex|claude>');
  process.exit(1);
}

const task = findTask(taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const lock = createLock(task, agent);
console.log(JSON.stringify(lock, null, 2));
