import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const automationDir = path.join(repoRoot, 'automation');
const reportsDir = path.join(repoRoot, 'reports');
const mobileDistDir = path.join(repoRoot, 'apps', 'mobile', 'dist');

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
const host = process.env.VIEWER_HOST || args.host || '127.0.0.1';
const port = Number.parseInt(process.env.VIEWER_PORT || args.port || '4318', 10) || 4318;
const livePreviewUrl = String(process.env.VIEWER_MOBILE_PREVIEW_URL || args['preview-url'] || 'http://127.0.0.1:19006').replace(/\/+$/, '');

function applyCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return structuredClone(fallback);
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

function normalizeDocument(value, key) {
  if (Array.isArray(value)) {
    return { version: 1, [key]: value };
  }

  if (value && typeof value === 'object' && Array.isArray(value[key])) {
    return value;
  }

  return { version: 1, [key]: [] };
}

function parseMarkdownSections(markdown) {
  return markdown
    .split(/^## /m)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section) => {
      const [titleLine, ...bodyLines] = section.split(/\r?\n/);
      return {
        title: titleLine.trim(),
        body: bodyLines.join('\n').trim(),
      };
    });
}

function sortTasks(left, right) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  const leftRank = rank[left.priority] ?? rank.medium;
  const rightRank = rank[right.priority] ?? rank.medium;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
}

function buildAgentState(agent, tasks, locks, events) {
  const activeLock = locks.find((lock) => lock.agent === agent) ?? null;
  const lastEvent = events.find((event) => event.agent === agent) ?? null;
  const lastFailedTask = [...tasks]
    .filter((task) => task.assignedAgent === agent && task.status === 'failed')
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))[0] ?? null;
  const currentTask = activeLock ? tasks.find((task) => task.id === activeLock.taskId) ?? null : null;
  const status = activeLock ? 'running' : lastFailedTask ? 'attention' : lastEvent ? 'idle' : 'ready';

  return {
    agent,
    status,
    taskId: currentTask?.id ?? lastEvent?.taskId ?? lastFailedTask?.id ?? null,
    title: currentTask?.title ?? lastEvent?.taskId ?? lastFailedTask?.title ?? null,
    lockedPaths: activeLock?.lockedPaths ?? [],
    lastActivityAt: lastEvent?.timestamp ?? lastFailedTask?.updatedAt ?? null,
    lastFile: lastEvent?.lastFile ?? null,
    lastStatus: lastEvent?.status ?? null,
  };
}

function buildPreviewState(liveReachable) {
  return {
    liveUrl: livePreviewUrl,
    staticUrl: '/preview-static/',
    embedUrl: liveReachable ? livePreviewUrl : '/preview-static/',
    liveReachable,
  };
}

async function probePreview(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 1500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    return response.ok;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function buildDashboardData(liveReachable) {
  const taskState = readJson(path.join(automationDir, 'task-state.json'), {});
  const tasks = normalizeDocument(readJson(path.join(automationDir, 'tasks.json'), { tasks: [] }), 'tasks').tasks;
  const locks = normalizeDocument(readJson(path.join(automationDir, 'locks.json'), { locks: [] }), 'locks').locks;
  const handoffs = normalizeDocument(readJson(path.join(automationDir, 'handoffs.json'), { handoffs: [] }), 'handoffs').handoffs;
  const checkpoints = normalizeDocument(readJson(path.join(automationDir, 'checkpoints.json'), { checkpoints: [] }), 'checkpoints').checkpoints;
  const changeEvents = normalizeDocument(readJson(path.join(automationDir, 'change-events.json'), { events: [] }), 'events').events
    .slice()
    .reverse();
  const progressEntries = parseMarkdownSections(readText(path.join(reportsDir, 'progress-log.md'))).reverse().slice(0, 8);
  const conflictEntries = parseMarkdownSections(readText(path.join(reportsDir, 'conflict-report.md'))).reverse().slice(0, 8);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === 'done').length;
  const failedTasks = [...tasks]
    .filter((task) => task.status === 'failed')
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: repoRoot,
    taskState,
    tasks,
    backlog: [...tasks].filter((task) => task.status !== 'done').sort(sortTasks),
    locks,
    handoffs,
    checkpoints: checkpoints.slice(-10).reverse(),
    changeEvents: changeEvents.slice(0, 30),
    progressEntries,
    conflictEntries,
    failedTasks: failedTasks.slice(0, 10),
    summary: {
      totalTasks,
      completedTasks,
      failedTasks: failedTasks.length,
      pendingTasks: tasks.filter((task) => task.status === 'pending').length,
      runningTasks: tasks.filter((task) => task.status === 'running').length,
      completionPct: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    },
    agents: {
      codex: buildAgentState('codex', tasks, locks, changeEvents),
      claude: buildAgentState('claude', tasks, locks, changeEvents),
    },
    preview: buildPreviewState(liveReachable),
  };
}

function sendJson(response, statusCode, payload) {
  applyCors(response);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') {
    return 'text/html; charset=utf-8';
  }
  if (extension === '.css') {
    return 'text/css; charset=utf-8';
  }
  if (extension === '.js') {
    return 'application/javascript; charset=utf-8';
  }
  if (extension === '.json') {
    return 'application/json; charset=utf-8';
  }
  if (extension === '.ico') {
    return 'image/x-icon';
  }
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.svg') {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}

function resolveSafePath(baseDir, unsafePath) {
  const normalizedPath = path.normalize(unsafePath).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(baseDir, normalizedPath);
  if (!resolved.startsWith(baseDir)) {
    return null;
  }
  return resolved;
}

function serveFile(response, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  applyCors(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Cache-Control': 'no-store',
    });
    response.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(response, 200, { ok: true, generatedAt: new Date().toISOString() });
    return;
  }

  if (pathname === '/api/change-events') {
    const changeEvents = normalizeDocument(readJson(path.join(automationDir, 'change-events.json'), { events: [] }), 'events').events
      .slice()
      .reverse();
    const limit = Number.parseInt(requestUrl.searchParams.get('limit') || '25', 10) || 25;
    sendJson(response, 200, {
      events: changeEvents.slice(0, Math.max(limit, 1)),
    });
    return;
  }

  if (pathname === '/api/dashboard') {
    const liveReachable = await probePreview(livePreviewUrl);
    sendJson(response, 200, buildDashboardData(liveReachable));
    return;
  }

  if (pathname.startsWith('/preview-static')) {
    const relativePath = pathname.replace(/^\/preview-static\/?/, '') || 'index.html';
    let filePath = resolveSafePath(mobileDistDir, relativePath);

    if (!filePath) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Invalid path');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(mobileDistDir, 'index.html');
    }

    serveFile(response, filePath);
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolveSafePath(publicDir, relativePath);
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Invalid path');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(response, filePath);
    return;
  }

  serveFile(response, path.join(publicDir, 'index.html'));
});

server.listen(port, host, () => {
  console.log(`Workflow viewer listening on http://${host}:${port}`);
  console.log(`Mobile preview target: ${livePreviewUrl}`);
});
