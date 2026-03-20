import fs from 'node:fs';
import process from 'node:process';

import { pauseFile, resumeFile, stopFile } from './lib/workflow-utils.js';

const result = {
  stopRequested: fs.existsSync(stopFile),
  pauseRequested: fs.existsSync(pauseFile),
  resumeRequested: fs.existsSync(resumeFile),
};

console.log(JSON.stringify(result, null, 2));

if (result.stopRequested) {
  process.exit(20);
}

if (result.pauseRequested) {
  process.exit(10);
}

process.exit(0);
