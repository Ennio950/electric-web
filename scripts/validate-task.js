import process from 'node:process';

import { findTask, loadTasksDocument, parseArgs, validateTaskStructure } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));

function printResult(task) {
  const validation = validateTaskStructure(task);
  console.log(JSON.stringify({
    id: task.id,
    valid: validation.valid,
    errors: validation.errors,
  }, null, 2));
  return validation.valid;
}

if (args.all) {
  const document = loadTasksDocument();
  const allValid = document.tasks.map(printResult).every(Boolean);
  process.exit(allValid ? 0 : 2);
}

const taskId = args.task ?? args._[0];
if (!taskId) {
  console.error('Usage: node scripts/validate-task.js --task <task-id> | --all');
  process.exit(1);
}

const task = findTask(taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

process.exit(printResult(task) ? 0 : 2);
