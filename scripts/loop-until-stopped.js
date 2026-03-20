import process from 'node:process';

import {
  appendConflictLog,
  appendProgressLog,
  asBoolean,
  asInteger,
  clearPauseFlag,
  clearResumeFlag,
  createWorkspaceSnapshot,
  createCheckpoint,
  diffSnapshots,
  ensureRuntimeDirs,
  getAgentWorkspace,
  loadTasksDocument,
  pathMatchesPattern,
  parseArgs,
  readControlState,
  repoRoot,
  runAgentTask,
  selectNextTask,
  sleep,
  syncTaskState,
} from './lib/workflow-utils.js';

const args = parseArgs(process.argv.slice(2));
const selectedAgent = args.agent ?? 'both';
const dryRun = asBoolean(args['dry-run']);
const maxCycles = asInteger(args['max-cycles'], Number.POSITIVE_INFINITY);
const idleSleepMs = asInteger(args['idle-sleep-ms'], 4000);
const runOnce = asBoolean(args.once);
const agents = selectedAgent === 'both' ? ['codex', 'claude'] : [selectedAgent];

ensureRuntimeDirs();
syncTaskState();

let cycle = 0;
appendProgressLog('Workflow bootstrap', [
  `Agent mode: ${selectedAgent}`,
  `Dry run: ${dryRun}`,
  `Max cycles: ${Number.isFinite(maxCycles) ? maxCycles : 'infinite'}`,
]);

async function runSelectedTask(agent, taskId) {
  try {
    const result = await runAgentTask(agent, {
      taskId,
      dryRun,
    });

    return {
      agent,
      taskId,
      exitCode: result.exitCode,
      valid: result.validation.valid,
      touchedFiles: result.touchedFiles,
      workspaceRoot: result.workspaceRoot,
      snapshotMode: result.snapshotMode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendConflictLog(`Fallo de ejecucion en ${taskId}`, [
      `Agente: ${agent}`,
      `Error: ${message}`,
    ]);

    return {
      agent,
      taskId,
      exitCode: 1,
      valid: false,
      touchedFiles: [],
      error: message,
    };
  }
}

while (cycle < maxCycles) {
  cycle += 1;

  const control = readControlState();
  if (control.resumeRequested) {
    clearPauseFlag();
    clearResumeFlag();
  }

  if (control.stopRequested) {
    appendProgressLog('Workflow detenido', [`STOP detectado antes del ciclo ${cycle}.`]);
    break;
  }

  if (control.pauseRequested) {
    appendProgressLog('Workflow en pausa', [`PAUSE detectado en el ciclo ${cycle}.`]);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const pausedState = readControlState();
      if (!pausedState.pauseRequested || pausedState.resumeRequested || pausedState.stopRequested) {
        if (pausedState.resumeRequested) {
          clearPauseFlag();
          clearResumeFlag();
        }
        break;
      }
      await sleep(2000);
    }
  }

  const selectedTasks = agents
    .map((agent) => ({
      agent,
      task: selectNextTask(agent),
      workspaceRoot: getAgentWorkspace(agent),
    }))
    .filter((entry) => entry.task);

  const processedTasks = selectedTasks.length;
  const runsInSharedRoot = (
    selectedTasks.length > 1
    && selectedTasks.every((entry) => entry.workspaceRoot === repoRoot)
  );
  const cycleBeforeSnapshot = runsInSharedRoot ? createWorkspaceSnapshot(repoRoot) : null;
  const cycleResults = processedTasks === 0
    ? []
    : await Promise.all(selectedTasks.map((entry) => runSelectedTask(entry.agent, entry.task.id)));

  if (cycleBeforeSnapshot) {
    const cycleAfterSnapshot = createWorkspaceSnapshot(repoRoot);
    const cycleDiff = diffSnapshots(cycleBeforeSnapshot, cycleAfterSnapshot);
    const allowedUnion = selectedTasks.flatMap((entry) => entry.task.allowedPaths);
    const unauthorizedFiles = cycleDiff.touched.filter((file) => (
      !allowedUnion.some((pattern) => pathMatchesPattern(file, pattern))
    ));

    if (unauthorizedFiles.length > 0) {
      appendConflictLog(`Violacion paralela de ciclo ${cycle}`, [
        `Tareas: ${selectedTasks.map((entry) => entry.task.id).join(', ')}`,
        `Archivos fuera de la union permitida: ${unauthorizedFiles.join(', ')}`,
      ]);
    }
  }

  createCheckpoint(`cycle-${cycle}`, {
    cycle,
    selectedAgent,
    dryRun,
    processedTasks,
    results: cycleResults,
  });
  syncTaskState();

  if (runOnce) {
    break;
  }

  if (processedTasks === 0) {
    const remainingPending = loadTasksDocument().tasks.filter((task) => task.status === 'pending').length;
    if (remainingPending === 0) {
      appendProgressLog('Workflow sin backlog', ['No quedan tareas pendientes.']);
      break;
    }

    await sleep(idleSleepMs);
  }
}
