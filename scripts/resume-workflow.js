import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

import {
  clearPauseFlag,
  clearResumeFlag,
  parseArgs,
  scriptsDir,
} from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));

clearPauseFlag();
clearResumeFlag();

const childArgs = [
  path.join(scriptsDir, 'loop-until-stopped.js'),
  '--agent',
  args.agent ?? 'both',
];

if (args['dry-run']) {
  childArgs.push('--dry-run');
}

if (args['max-cycles']) {
  childArgs.push('--max-cycles', args['max-cycles']);
}

const child = spawn(process.execPath, childArgs, {
  cwd: scriptsDir,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
