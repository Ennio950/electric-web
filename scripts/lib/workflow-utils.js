import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const scriptsDir = path.resolve(__dirname, '..');
export const repoRoot = path.resolve(process.env.WORKFLOW_CONTROL_ROOT || path.join(scriptsDir, '..'));
export const automationDir = path.join(repoRoot, 'automation');
export const reportsDir = path.join(repoRoot, 'reports');
export const promptsDir = path.join(repoRoot, 'prompts');
export const mobileManifestDir = path.join(repoRoot, 'mobile');
export const runtimeDir = path.join(automationDir, 'runtime');
export const runtimePromptDir = path.join(runtimeDir, 'prompts');
export const runtimeLogDir = path.join(runtimeDir, 'logs');
export const runtimeSnapshotDir = path.join(runtimeDir, 'snapshots');
export const agentWorkspacesFile = path.join(automationDir, 'agent-workspaces.local.json');

export const tasksFile = path.join(automationDir, 'tasks.json');
export const taskStateFile = path.join(automationDir, 'task-state.json');
export const locksFile = path.join(automationDir, 'locks.json');
export const handoffsFile = path.join(automationDir, 'handoffs.json');
export const checkpointsFile = path.join(automationDir, 'checkpoints.json');
export const changeEventsFile = path.join(automationDir, 'change-events.json');
export const stopFile = path.join(automationDir, 'STOP');
export const pauseFile = path.join(automationDir, 'PAUSE');
export const resumeFile = path.join(automationDir, 'RESUME');

const defaultIgnoredDirectories = new Set([
  '.expo',
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'dist-check',
  'dist-check-2',
  'dist-check-3',
  'logs',
  'node_modules',
  'runtime',
  'test-results',
]);

const defaultIgnoredFiles = new Set([
  'automation/STOP',
  'automation/PAUSE',
  'automation/RESUME',
  'automation/agent-workspaces.local.json',
  'automation/change-events.json',
  'automation/checkpoints.json',
  'automation/handoffs.json',
  'automation/locks.json',
  'automation/task-state.json',
  'automation/tasks.json',
  'reports/conflict-report.md',
  'reports/progress-log.md',
]);

const requiredTaskFields = [
  'id',
  'title',
  'description',
  'phase',
  'priority',
  'assignedAgent',
  'taskType',
  'status',
  'retries',
  'dependsOn',
  'allowedPaths',
  'forbiddenPaths',
  'filesExpected',
  'validationSteps',
  'notes',
  'createdAt',
  'updatedAt',
];

const priorityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function normalizeDocument(value, key) {
  if (Array.isArray(value)) {
    return { version: 1, [key]: value };
  }

  if (value && typeof value === 'object' && Array.isArray(value[key])) {
    return value;
  }

  return { version: 1, [key]: [] };
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureRuntimeDirs() {
  [automationDir, reportsDir, promptsDir, mobileManifestDir, runtimeDir, runtimePromptDir, runtimeLogDir, runtimeSnapshotDir].forEach(ensureDir);
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeRelPath(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export function toRelativePath(filePath) {
  return normalizeRelPath(path.relative(repoRoot, filePath));
}

export function pathMatchesPattern(relPath, pattern) {
  const normalizedPath = normalizeRelPath(relPath);
  const normalizedPattern = normalizeRelPath(pattern);

  if (!normalizedPattern) {
    return true;
  }

  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.endsWith('/*')) {
    const prefix = normalizedPattern.slice(0, -2);
    return normalizedPath === prefix || path.posix.dirname(normalizedPath) === prefix;
  }

  return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
}

export function ensureList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function patternsOverlap(leftPatterns, rightPatterns) {
  const left = ensureList(leftPatterns);
  const right = ensureList(rightPatterns);

  return left.some((leftPattern) => right.some((rightPattern) => (
    pathMatchesPattern(leftPattern, rightPattern) || pathMatchesPattern(rightPattern, leftPattern)
  )));
}

export function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== undefined) {
      return structuredClone(fallback);
    }

    throw error;
  }
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

export function readText(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return fallback;
  }
}

export function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

export function loadTasksDocument() {
  return normalizeDocument(readJson(tasksFile, { version: 1, tasks: [] }), 'tasks');
}

export function saveTasksDocument(document) {
  writeJson(tasksFile, normalizeDocument(document, 'tasks'));
}

export function loadLocksDocument() {
  return normalizeDocument(readJson(locksFile, { version: 1, locks: [] }), 'locks');
}

export function saveLocksDocument(document) {
  writeJson(locksFile, normalizeDocument(document, 'locks'));
}

export function loadHandoffsDocument() {
  return normalizeDocument(readJson(handoffsFile, { version: 1, handoffs: [] }), 'handoffs');
}

export function saveHandoffsDocument(document) {
  writeJson(handoffsFile, normalizeDocument(document, 'handoffs'));
}

export function loadCheckpointsDocument() {
  return normalizeDocument(readJson(checkpointsFile, { version: 1, checkpoints: [] }), 'checkpoints');
}

export function saveCheckpointsDocument(document) {
  writeJson(checkpointsFile, normalizeDocument(document, 'checkpoints'));
}

export function loadChangeEventsDocument() {
  return normalizeDocument(readJson(changeEventsFile, { version: 1, events: [] }), 'events');
}

export function saveChangeEventsDocument(document) {
  writeJson(changeEventsFile, normalizeDocument(document, 'events'));
}

function normalizeAgentWorkspacesDocument(document) {
  const candidate = document && typeof document === 'object' ? document : {};
  const agentEntries = candidate.agents && typeof candidate.agents === 'object' ? candidate.agents : {};

  return {
    version: 1,
    updatedAt: candidate.updatedAt ?? null,
    agents: {
      codex: {
        path: path.resolve(agentEntries.codex?.path || repoRoot),
      },
      claude: {
        path: path.resolve(agentEntries.claude?.path || repoRoot),
      },
    },
  };
}

export function loadAgentWorkspacesDocument() {
  return normalizeAgentWorkspacesDocument(readJson(agentWorkspacesFile, null));
}

export function saveAgentWorkspacesDocument(document) {
  writeJson(agentWorkspacesFile, normalizeAgentWorkspacesDocument({
    ...document,
    updatedAt: nowIso(),
  }));
}

export function getAgentWorkspace(agent) {
  const envOverrides = {
    codex: process.env.WORKFLOW_CODEX_WORKSPACE,
    claude: process.env.WORKFLOW_CLAUDE_WORKSPACE,
  };
  const explicitPath = envOverrides[agent];

  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  return loadAgentWorkspacesDocument().agents[agent]?.path || repoRoot;
}

export function loadTaskStateDocument() {
  return readJson(taskStateFile, {
    version: 1,
    projectRoot: toRelativePath(repoRoot),
    mobileRoot: 'apps/mobile',
    selectedMobileStack: 'expo-router-react-native',
    currentRun: null,
    stats: {},
    lastCompletedTaskId: null,
    updatedAt: nowIso(),
    notes: [],
  });
}

export function saveTaskStateDocument(document) {
  writeJson(taskStateFile, document);
}

export function validateTaskStructure(task) {
  const errors = [];

  for (const field of requiredTaskFields) {
    if (!(field in task)) {
      errors.push(`missing:${field}`);
    }
  }

  if (!['codex', 'claude'].includes(task.assignedAgent)) {
    errors.push(`invalid:assignedAgent:${task.assignedAgent}`);
  }

  if (!['pending', 'running', 'review', 'handoff', 'blocked', 'done', 'failed'].includes(task.status)) {
    errors.push(`invalid:status:${task.status}`);
  }

  if (!Number.isInteger(task.retries) || task.retries < 0) {
    errors.push('invalid:retries');
  }

  for (const key of ['dependsOn', 'allowedPaths', 'forbiddenPaths', 'filesExpected', 'validationSteps', 'notes']) {
    if (!Array.isArray(task[key])) {
      errors.push(`invalid:${key}:must-be-array`);
    }
  }

  const allowed = ensureList(task.allowedPaths);
  const forbidden = ensureList(task.forbiddenPaths);
  if (patternsOverlap(allowed, forbidden)) {
    errors.push('invalid:path-overlap');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sortTasks(left, right) {
  const leftPriority = priorityRank[left.priority] ?? priorityRank.medium;
  const rightPriority = priorityRank[right.priority] ?? priorityRank.medium;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

export function syncTaskState() {
  const tasksDocument = loadTasksDocument();
  const locksDocument = loadLocksDocument();
  const handoffsDocument = loadHandoffsDocument();
  const currentState = loadTaskStateDocument();
  const stats = {};

  for (const task of tasksDocument.tasks) {
    stats[task.status] = (stats[task.status] ?? 0) + 1;
  }

  const lastCompleted = [...tasksDocument.tasks]
    .filter((task) => task.status === 'done')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  const nextTask = [...tasksDocument.tasks]
    .filter((task) => task.status === 'pending')
    .sort(sortTasks)[0];

  const nextState = {
    ...currentState,
    stats,
    activeLocks: locksDocument.locks.length,
    openHandoffs: handoffsDocument.handoffs.filter((handoff) => handoff.status !== 'done').length,
    lastCompletedTaskId: lastCompleted?.id ?? currentState.lastCompletedTaskId ?? null,
    nextTaskId: nextTask?.id ?? null,
    updatedAt: nowIso(),
  };

  saveTaskStateDocument(nextState);
  return nextState;
}

export function findTask(taskId) {
  const document = loadTasksDocument();
  return document.tasks.find((task) => task.id === taskId) ?? null;
}

export function updateTask(taskId, patch) {
  const document = loadTasksDocument();
  const index = document.tasks.findIndex((task) => task.id === taskId);

  if (index === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const mergedTask = {
    ...document.tasks[index],
    ...patch,
    updatedAt: nowIso(),
  };

  document.tasks[index] = mergedTask;
  saveTasksDocument(document);
  syncTaskState();
  return mergedTask;
}

export function createCheckpoint(label, details) {
  const document = loadCheckpointsDocument();
  document.checkpoints.push({
    checkpointId: `chk-${Date.now()}`,
    label,
    details,
    createdAt: nowIso(),
  });
  saveCheckpointsDocument(document);
  return document.checkpoints.at(-1);
}

export function appendMarkdownSection(filePath, title, body) {
  const section = `\n## ${title}\n\n${body.trim()}\n`;
  ensureDir(path.dirname(filePath));

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, section.trimStart(), 'utf8');
    return;
  }

  fs.appendFileSync(filePath, section, 'utf8');
}

export function appendProgressLog(title, lines) {
  appendMarkdownSection(
    path.join(reportsDir, 'progress-log.md'),
    `${title} (${new Date().toISOString()})`,
    ensureList(lines).map((line) => `- ${line}`).join('\n'),
  );
}

export function appendConflictLog(title, lines) {
  appendMarkdownSection(
    path.join(reportsDir, 'conflict-report.md'),
    `${title} (${new Date().toISOString()})`,
    ensureList(lines).map((line) => `- ${line}`).join('\n'),
  );
}

export function appendChangeEvent(payload) {
  const document = loadChangeEventsDocument();
  const files = [...new Set(ensureList(payload.files).map((file) => normalizeRelPath(file)).filter(Boolean))];
  const event = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent: payload.agent,
    taskId: payload.taskId,
    files,
    fileCount: files.length,
    lastFile: files.at(-1) ?? null,
    timestamp: payload.timestamp ?? nowIso(),
    status: payload.status ?? 'done',
    exitCode: payload.exitCode ?? 0,
    message: payload.message ?? null,
  };

  if (payload.validation) {
    event.validation = payload.validation;
  }

  document.events.push(event);
  document.events = document.events.slice(-250);
  saveChangeEventsDocument(document);
  return event;
}

function shouldIgnorePath(relativePath) {
  const normalizedPath = normalizeRelPath(relativePath);
  if (defaultIgnoredFiles.has(normalizedPath)) {
    return true;
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  return segments.some((segment) => defaultIgnoredDirectories.has(segment));
}

function fingerprintFile(filePath) {
  const stats = fs.statSync(filePath);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
  return {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    hash,
  };
}

function shouldTrackIncludedPath(relativePath, includePatterns) {
  if (includePatterns.length === 0) {
    return true;
  }

  return includePatterns.some((pattern) => pathMatchesPattern(relativePath, pattern));
}

function shouldDescendIntoDirectory(relativePath, includePatterns) {
  if (!relativePath || includePatterns.length === 0) {
    return true;
  }

  return includePatterns.some((pattern) => {
    const normalizedPattern = normalizeRelPath(pattern);
    return (
      normalizedPattern === relativePath
      || normalizedPattern.startsWith(`${relativePath}/`)
      || relativePath.startsWith(`${normalizedPattern}/`)
    );
  });
}

export function createWorkspaceSnapshot(root = repoRoot, includePatterns = []) {
  const snapshot = {};
  const workspaceRoot = path.resolve(root);
  const trackedPatterns = ensureList(includePatterns).map(normalizeRelPath).filter(Boolean);

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizeRelPath(path.relative(workspaceRoot, absolutePath));

      if (shouldIgnorePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!shouldDescendIntoDirectory(relativePath, trackedPatterns)) {
          continue;
        }

        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!shouldTrackIncludedPath(relativePath, trackedPatterns)) {
        continue;
      }

      snapshot[relativePath] = fingerprintFile(absolutePath);
    }
  }

  walk(workspaceRoot);
  return snapshot;
}

export function diffSnapshots(before, after) {
  const changed = [];
  const created = [];
  const deleted = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const left = before[key];
    const right = after[key];

    if (!left && right) {
      created.push(key);
      continue;
    }

    if (left && !right) {
      deleted.push(key);
      continue;
    }

    if (left.hash !== right.hash || left.size !== right.size) {
      changed.push(key);
    }
  }

  return {
    changed,
    created,
    deleted,
    touched: [...new Set([...changed, ...created, ...deleted])].sort(),
  };
}

export function readControlState() {
  return {
    stopRequested: fs.existsSync(stopFile),
    pauseRequested: fs.existsSync(pauseFile),
    resumeRequested: fs.existsSync(resumeFile),
  };
}

export function clearResumeFlag() {
  if (fs.existsSync(resumeFile)) {
    fs.unlinkSync(resumeFile);
  }
}

export function clearPauseFlag() {
  if (fs.existsSync(pauseFile)) {
    fs.unlinkSync(pauseFile);
  }
}

export function clearStopFlag() {
  if (fs.existsSync(stopFile)) {
    fs.unlinkSync(stopFile);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createLock(task, agent) {
  const document = loadLocksDocument();
  const conflictingLock = document.locks.find((lock) => (
    lock.agent !== agent && patternsOverlap(lock.lockedPaths, task.allowedPaths)
  ));

  if (conflictingLock) {
    throw new Error(`Conflicting lock: ${conflictingLock.lockId}`);
  }

  const lock = {
    lockId: `lock-${Date.now()}`,
    taskId: task.id,
    agent,
    lockedPaths: [...task.allowedPaths],
    acquiredAt: nowIso(),
    expiresAt: null,
    releaseCondition: 'task-complete-or-manual-release',
  };

  document.locks.push(lock);
  saveLocksDocument(document);
  syncTaskState();
  return lock;
}

export function releaseLockByTaskId(taskId) {
  const document = loadLocksDocument();
  document.locks = document.locks.filter((lock) => lock.taskId !== taskId);
  saveLocksDocument(document);
  syncTaskState();
}

export function createHandoff(payload) {
  const document = loadHandoffsDocument();
  const handoff = {
    handoffId: `handoff-${Date.now()}`,
    fromAgent: payload.fromAgent,
    toAgent: payload.toAgent,
    sourceTaskId: payload.sourceTaskId,
    reason: payload.reason,
    affectedPaths: ensureList(payload.affectedPaths),
    proposedChanges: ensureList(payload.proposedChanges),
    status: payload.status ?? 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  document.handoffs.push(handoff);
  saveHandoffsDocument(document);
  syncTaskState();
  return handoff;
}

export function selectNextTask(agent) {
  const tasksDocument = loadTasksDocument();
  const locksDocument = loadLocksDocument();
  const taskIndex = new Map(tasksDocument.tasks.map((task) => [task.id, task]));

  return [...tasksDocument.tasks]
    .filter((task) => task.assignedAgent === agent)
    .filter((task) => task.status === 'pending')
    .filter((task) => task.dependsOn.every((dependency) => taskIndex.get(dependency)?.status === 'done'))
    .filter((task) => !locksDocument.locks.some((lock) => lock.agent !== agent && patternsOverlap(lock.lockedPaths, task.allowedPaths)))
    .sort(sortTasks)[0] ?? null;
}

export function validateOwnership(task, changedFiles) {
  const locksDocument = loadLocksDocument();
  const violations = [];

  for (const file of changedFiles) {
    const allowed = task.allowedPaths.length === 0 || task.allowedPaths.some((pattern) => pathMatchesPattern(file, pattern));
    if (!allowed) {
      violations.push(`outside-allowed:${file}`);
    }

    if (task.forbiddenPaths.some((pattern) => pathMatchesPattern(file, pattern))) {
      violations.push(`forbidden-path:${file}`);
    }

    const foreignLock = locksDocument.locks.find((lock) => (
      lock.agent !== task.assignedAgent && lock.lockedPaths.some((pattern) => pathMatchesPattern(file, pattern))
    ));

    if (foreignLock) {
      violations.push(`foreign-lock:${file}:${foreignLock.lockId}`);
    }
  }

  const missingExpected = task.filesExpected.filter((pattern) => !changedFiles.some((file) => pathMatchesPattern(file, pattern)));

  return {
    valid: violations.length === 0,
    violations,
    missingExpected,
  };
}

export function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce((output, [key, value]) => (
    output.replaceAll(`{{${key}}}`, value)
  ), template);
}

export function buildPrompt(agent, task, workspaceRoot = getAgentWorkspace(agent)) {
  const systemPromptPath = path.join(promptsDir, `${agent}_system_prompt.md`);
  const taskTemplatePath = path.join(promptsDir, `${agent}_task_template.md`);
  const systemPrompt = readText(systemPromptPath);
  const taskTemplate = readText(taskTemplatePath);

  const replacements = {
    PROJECT_ROOT: workspaceRoot,
    CONTROL_ROOT: repoRoot,
    TASK_ID: task.id,
    TASK_TITLE: task.title,
    TASK_DESCRIPTION: task.description,
    TASK_PHASE: task.phase,
    TASK_PRIORITY: task.priority,
    TASK_TYPE: task.taskType,
    ALLOWED_PATHS: task.allowedPaths.map((item) => `- ${item}`).join('\n') || '- (sin restricciones)',
    FORBIDDEN_PATHS: task.forbiddenPaths.map((item) => `- ${item}`).join('\n') || '- (sin rutas prohibidas)',
    FILES_EXPECTED: task.filesExpected.map((item) => `- ${item}`).join('\n') || '- (sin archivos obligatorios)',
    VALIDATION_STEPS: task.validationSteps.map((item) => `- ${item}`).join('\n') || '- (sin validaciones)',
    NOTES: task.notes.map((item) => `- ${item}`).join('\n') || '- (sin notas)',
    TASK_JSON: stableStringify(task),
  };

  return `${systemPrompt.trim()}\n\n---\n\n${renderTemplate(taskTemplate, replacements).trim()}\n`;
}

function resolveAgentBinary(agent) {
  if (agent === 'codex') {
    return process.env.WORKFLOW_CODEX_BIN || (process.platform === 'win32' ? 'codex.cmd' : 'codex');
  }

  return process.env.WORKFLOW_CLAUDE_BIN || (process.platform === 'win32' ? 'claude.cmd' : 'claude');
}

function buildAgentArgs(agent, outputFile, workspaceRoot) {
  if (agent === 'codex') {
    const args = [
      'exec',
      '-',
      '--cd',
      workspaceRoot,
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      '--output-last-message',
      outputFile,
    ];

    if (workspaceRoot !== repoRoot) {
      args.push('--add-dir', repoRoot);
    }

    return args;
  }

  const args = [
    '-p',
    '--input-format',
    'text',
    '--output-format',
    'text',
    '--permission-mode',
    'bypassPermissions',
    '--add-dir',
    workspaceRoot,
  ];

  if (workspaceRoot !== repoRoot) {
    args.push('--add-dir', repoRoot);
  }

  return args;
}

export function writeRuntimePrompt(task, agent, prompt) {
  ensureRuntimeDirs();
  const promptPath = path.join(runtimePromptDir, `${task.id}-${agent}.md`);
  writeText(promptPath, prompt);
  return promptPath;
}

export async function runProcess({ command, args, cwd, input, logFile, env }) {
  ensureDir(path.dirname(logFile));
  fs.appendFileSync(logFile, `$ ${command} ${args.join(' ')}\n`, 'utf8');

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      fs.appendFileSync(logFile, text, 'utf8');
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      fs.appendFileSync(logFile, text, 'utf8');
    });

    child.on('error', (error) => {
      fs.appendFileSync(logFile, `[process-error] ${error instanceof Error ? error.message : String(error)}\n`, 'utf8');
      reject(error);
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    if (input) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

export async function runAgentTask(agent, options) {
  ensureRuntimeDirs();

  const task = findTask(options.taskId);
  if (!task) {
    throw new Error(`Task not found: ${options.taskId}`);
  }

  const taskValidation = validateTaskStructure(task);
  if (!taskValidation.valid) {
    throw new Error(`Task schema invalid: ${taskValidation.errors.join(', ')}`);
  }

  const workspaceRoot = getAgentWorkspace(agent);
  const usesSharedWorkspace = path.resolve(workspaceRoot) === repoRoot;
  const snapshotPatterns = usesSharedWorkspace ? task.allowedPaths : [];
  const prompt = buildPrompt(agent, task, workspaceRoot);
  const promptPath = writeRuntimePrompt(task, agent, prompt);
  const logFile = path.join(runtimeLogDir, `${task.id}-${agent}-${Date.now()}.log`);

  const lock = createLock(task, agent);
  if (!options.dryRun) {
    updateTask(task.id, { status: 'running' });
  }

  fs.appendFileSync(
    logFile,
    `[workspace] ${workspaceRoot}\n[snapshot-mode] ${usesSharedWorkspace ? 'allowed-paths' : 'full-workspace'}\n`,
    'utf8',
  );

  const beforeSnapshot = createWorkspaceSnapshot(workspaceRoot, snapshotPatterns);
  writeJson(path.join(runtimeSnapshotDir, `${task.id}-${agent}-before.json`), beforeSnapshot);

  let result = {
    agent,
    taskId: task.id,
    promptPath,
    logFile,
    dryRun: Boolean(options.dryRun),
    exitCode: 0,
    changedFiles: [],
    createdFiles: [],
    deletedFiles: [],
    validation: { valid: true, violations: [], missingExpected: [] },
  };

  try {
    if (options.dryRun) {
      fs.appendFileSync(logFile, `[dry-run] ${agent} did not execute.\n`, 'utf8');
    } else {
      const outputFile = path.join(runtimeLogDir, `${task.id}-${agent}-last-message.txt`);
      const command = resolveAgentBinary(agent);
      const args = buildAgentArgs(agent, outputFile, workspaceRoot);
      let executionResult;

      try {
        executionResult = await runProcess({
          command,
          args,
          cwd: workspaceRoot,
          input: prompt,
          logFile,
          env: {
            ...process.env,
            WORKFLOW_CONTROL_ROOT: repoRoot,
            WORKFLOW_WORKSPACE_ROOT: workspaceRoot,
          },
        });
      } catch (error) {
        executionResult = {
          exitCode: 1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
        };
      }

      writeText(outputFile, executionResult.stdout || executionResult.stderr || '');
      result = {
        ...result,
        exitCode: executionResult.exitCode,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr,
        outputFile,
      };
    }

    const afterSnapshot = createWorkspaceSnapshot(workspaceRoot, snapshotPatterns);
    writeJson(path.join(runtimeSnapshotDir, `${task.id}-${agent}-after.json`), afterSnapshot);

    const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
    result.changedFiles = diff.changed;
    result.createdFiles = diff.created;
    result.deletedFiles = diff.deleted;
    result.touchedFiles = diff.touched;
    result.workspaceRoot = workspaceRoot;
    result.snapshotMode = usesSharedWorkspace ? 'allowed-paths' : 'full-workspace';

    const ownershipValidation = validateOwnership(task, diff.touched);
    result.validation = ownershipValidation;
    const runStatus =
      options.dryRun ? 'dry-run' : (!ownershipValidation.valid || result.exitCode !== 0 ? 'failed' : 'done');
    const runMessage =
      result.exitCode !== 0
        ? result.stderr || result.stdout || `Task ${task.id} exited with code ${result.exitCode}.`
        : ownershipValidation.violations.join(', ') || null;

    if (options.dryRun) {
      appendProgressLog(`Dry run ${task.id}`, [
        `Agente: ${agent}`,
        `Prompt: ${toRelativePath(promptPath)}`,
        `Log: ${toRelativePath(logFile)}`,
        `Archivos tocados simulados: ${diff.touched.join(', ') || 'ninguno'}`,
      ]);
    } else if (!ownershipValidation.valid || result.exitCode !== 0) {
      appendChangeEvent({
        agent,
        taskId: task.id,
        files: diff.touched,
        status: runStatus,
        exitCode: result.exitCode,
        message: runMessage,
        validation: ownershipValidation,
      });

      updateTask(task.id, {
        status: 'failed',
        retries: task.retries + 1,
        notes: [
          ...task.notes,
          `Last run ${nowIso()} failed for ${agent}.`,
        ],
      });

      appendConflictLog(`Violacion o fallo en ${task.id}`, [
        `Agente: ${agent}`,
        `Exit code: ${result.exitCode}`,
        `Archivos tocados: ${diff.touched.join(', ') || 'ninguno'}`,
        `Violaciones: ${ownershipValidation.violations.join(', ') || 'ninguna'}`,
      ]);
    } else {
      appendChangeEvent({
        agent,
        taskId: task.id,
        files: diff.touched,
        status: runStatus,
        exitCode: result.exitCode,
        validation: ownershipValidation,
      });

      updateTask(task.id, {
        status: 'done',
        notes: [
          ...task.notes,
          `Completed by ${agent} on ${nowIso()}.`,
        ],
      });

      appendProgressLog(`Task ${task.id} completada`, [
        `Agente: ${agent}`,
        `Prompt: ${toRelativePath(promptPath)}`,
        `Log: ${toRelativePath(logFile)}`,
        `Archivos tocados: ${diff.touched.join(', ') || 'ninguno'}`,
      ]);
    }

    createCheckpoint(`task-${task.id}`, {
      agent,
      dryRun: Boolean(options.dryRun),
      exitCode: result.exitCode,
      touchedFiles: diff.touched,
      validation: ownershipValidation,
    });
  } finally {
    releaseLockByTaskId(lock.taskId);
  }

  syncTaskState();
  return result;
}

export function parseArgs(argv) {
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

export function asBoolean(value) {
  if (value === true) {
    return true;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function asInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
