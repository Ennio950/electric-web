import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const mobileRoot = path.join(repoRoot, 'apps', 'mobile');
const previewPort = process.env.MOBILE_PREVIEW_PORT || '19006';
const viewerUrl = process.env.EXPO_PUBLIC_WORKFLOW_VIEWER_URL || 'http://127.0.0.1:4318';
const child = process.platform === 'win32'
  ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run web -- --port ${previewPort}`], {
      cwd: mobileRoot,
      env: {
        ...process.env,
        EXPO_PUBLIC_WORKFLOW_VIEWER_URL: viewerUrl,
      },
      stdio: 'inherit',
    })
  : spawn('npm', ['run', 'web', '--', '--port', previewPort], {
      cwd: mobileRoot,
      env: {
        ...process.env,
        EXPO_PUBLIC_WORKFLOW_VIEWER_URL: viewerUrl,
      },
      stdio: 'inherit',
    });

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
