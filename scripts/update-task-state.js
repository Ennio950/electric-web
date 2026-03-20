import process from 'node:process';

import { findTask, parseArgs, updateTask } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const taskId = args.task ?? args._[0];

if (!taskId) {
  console.error('Usage: node scripts/update-task-state.js --task <task-id> [--status pending|running|done|failed|review|handoff|blocked] [--note "text"]');
  process.exit(1);
}

const task = findTask(taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const nextNotes = args.note ? [...task.notes, args.note] : task.notes;
const updatedTask = updateTask(taskId, {
  status: args.status ?? task.status,
  notes: nextNotes,
});

console.log(JSON.stringify(updatedTask, null, 2));
