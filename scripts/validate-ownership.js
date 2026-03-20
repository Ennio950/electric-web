import process from 'node:process';

import { findTask, parseArgs, validateOwnership } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const taskId = args.task ?? args._[0];

if (!taskId) {
  console.error('Usage: node scripts/validate-ownership.js --task <task-id> --files file1,file2');
  process.exit(1);
}

const task = findTask(taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const files = String(args.files ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const result = validateOwnership(task, files);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 2);
