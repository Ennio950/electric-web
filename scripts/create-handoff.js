import process from 'node:process';

import { createHandoff, parseArgs } from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));

if (!args.from || !args.to || !args['source-task'] || !args.reason) {
  console.error('Usage: node scripts/create-handoff.js --from codex --to claude --source-task <id> --reason "..." [--paths a,b] [--changes x,y]');
  process.exit(1);
}

const handoff = createHandoff({
  fromAgent: args.from,
  toAgent: args.to,
  sourceTaskId: args['source-task'],
  reason: args.reason,
  affectedPaths: String(args.paths ?? '').split(',').map((item) => item.trim()).filter(Boolean),
  proposedChanges: String(args.changes ?? '').split(',').map((item) => item.trim()).filter(Boolean),
});

console.log(JSON.stringify(handoff, null, 2));
