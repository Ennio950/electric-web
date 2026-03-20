import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const logDir = path.join(repoRoot, 'automation', 'runtime', 'logs');

function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
const workflowScript = args.dry ? 'workflow:start:dry' : 'workflow:start';
const viewerPort = args['viewer-port'] || process.env.VIEWER_PORT || '4318';
const mobilePort = args['mobile-port'] || process.env.MOBILE_PREVIEW_PORT || '19006';

fs.mkdirSync(logDir, { recursive: true });

function spawnDetached(name, script, extraEnv = {}) {
  const stdoutPath = path.join(logDir, `n8n-${name}.out.log`);
  const stderrPath = path.join(logDir, `n8n-${name}.err.log`);
  const stdoutFd = fs.openSync(stdoutPath, 'a');
  const stderrFd = fs.openSync(stderrPath, 'a');
  const env = {
    ...process.env,
    VIEWER_PORT: viewerPort,
    MOBILE_PREVIEW_PORT: mobilePort,
    EXPO_PUBLIC_WORKFLOW_VIEWER_URL: `http://127.0.0.1:${viewerPort}`,
    ...extraEnv,
  };
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], {
        cwd: repoRoot,
        env,
        detached: true,
        stdio: ['ignore', stdoutFd, stderrFd],
      })
    : spawn('npm', ['run', script], {
        cwd: repoRoot,
        env,
        detached: true,
        stdio: ['ignore', stdoutFd, stderrFd],
      });

  child.unref();

  return {
    name,
    script,
    pid: child.pid,
    stdout: path.relative(repoRoot, stdoutPath).replaceAll('\\', '/'),
    stderr: path.relative(repoRoot, stderrPath).replaceAll('\\', '/'),
  };
}

const started = [];

if (!args['no-viewer']) {
  started.push(spawnDetached('viewer', 'viewer:start'));
}

if (!args['no-mobile']) {
  started.push(spawnDetached('mobile', 'mobile:start'));
}

if (!args['no-workflow']) {
  started.push(spawnDetached('workflow', workflowScript));
}

console.log(JSON.stringify({
  startedAt: new Date().toISOString(),
  projectRoot: repoRoot,
  workflowMode: workflowScript,
  viewerUrl: `http://127.0.0.1:${viewerPort}`,
  mobilePreviewUrl: `http://127.0.0.1:${mobilePort}`,
  processes: started,
  note: 'Si ejecutas esto dentro del contenedor de n8n, expone los puertos 4318 y 19006 o usa un host bridge.',
}, null, 2));
