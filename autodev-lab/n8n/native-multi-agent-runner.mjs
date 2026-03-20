import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAgentWorkspace } from '../../scripts/lib/workflow-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportsRoot = path.join(repoRoot, 'autodev-lab', 'reports', 'n8n-native-team');
const continuousStatePath = path.join(reportsRoot, 'continuous-state.json');
const continuousLockPath = path.join(reportsRoot, 'continuous-lock.json');
const continuousStopPath = path.join(reportsRoot, 'continuous-stop.flag');
const mobileBuildRunnerPath = path.join(
  repoRoot,
  'autodev-lab',
  'n8n',
  'mobile-native-build-runner.mjs',
);

const isWindows = process.platform === 'win32';

function resolveWindowsCommand(preferred, fallback) {
  if (!isWindows) {
    return fallback;
  }

  const result = spawnSync('where.exe', [preferred], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    const firstPath = (result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    if (firstPath) {
      return firstPath;
    }
  }

  return fallback;
}

const nodeCommand = isWindows ? resolveWindowsCommand('node.exe', 'node.exe') : 'node';
const codexCommand = isWindows ? resolveWindowsCommand('codex.exe', 'codex.cmd') : 'codex';
const claudeCommand = isWindows ? resolveWindowsCommand('claude.cmd', 'claude.cmd') : 'claude';
const ollamaCommand = isWindows ? resolveWindowsCommand('ollama.exe', 'ollama.exe') : 'ollama';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const profile = args.find((arg) => !arg.startsWith('--')) || 'full';
const dryRun = flags.has('--dry-run');
const defaultLoopDelayMs = readDelayEnv('N8N_NATIVE_LOOP_DELAY_MS', 60_000);
const defaultLoopFailureDelayMs = readDelayEnv('N8N_NATIVE_LOOP_FAILURE_DELAY_MS', 180_000);

const defaultDeepseekModel =
  (process.env.N8N_NATIVE_DEEPSEEK_MODEL || process.env.OLLAMA_SLOW_MODEL || '').trim() ||
  'qwen2.5-coder:0.5b';
const defaultDeepseekHost = (process.env.N8N_NATIVE_DEEPSEEK_HOST || '127.0.0.1:11435').trim();

class RunnerError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'RunnerError';
    this.exitCode = exitCode;
  }
}

function readDelayEnv(name, fallback) {
  const rawValue = (process.env[name] || '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function log(message) {
  console.log(`[n8n-native-team] ${message}`);
}

function fail(message, exitCode = 1) {
  throw new RunnerError(message, exitCode);
}

function ensurePathExists(targetPath, description) {
  if (!fs.existsSync(targetPath)) {
    fail(`No existe ${description}: ${targetPath}`, 2);
  }
}

function formatWindowsArg(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function spawnCommand(command, commandArgs, options = {}) {
  if (!isWindows || /\.(exe|com)$/iu.test(command)) {
    return spawnSync(command, commandArgs, options);
  }

  if (isWindows) {
    const rendered = [command, ...commandArgs.map(formatWindowsArg)].join(' ');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', rendered], options);
  }
}

function ensureCommand(command, description, versionArgs = ['--version']) {
  const result = spawnCommand(command, versionArgs, {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    fail(`${description} no esta disponible en PATH.`, 3);
  }
}

function sanitizeTimestamp(date = new Date()) {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function toRepoRelative(targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join('/');
}

function ensureReportsRoot() {
  fs.mkdirSync(reportsRoot, { recursive: true });
}

function findLatestReport(prefix) {
  if (!fs.existsSync(reportsRoot)) {
    return null;
  }

  const candidates = fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(reportsRoot, entry.name),
      mtimeMs: fs.statSync(path.join(reportsRoot, entry.name)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0] || null;
}

function writeTextFile(absolutePath, content) {
  ensureReportsRoot();
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function writeJsonFile(absolutePath, payload) {
  writeTextFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJsonFile(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function removeFileIfExists(absolutePath) {
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function recordManifestEntry(entry) {
  const manifestPath = path.join(reportsRoot, 'latest-run.json');
  const manifest = fs.existsSync(manifestPath)
    ? readJsonFile(manifestPath)
    : {
        repo: path.basename(repoRoot),
        updatedAt: null,
        steps: [],
      };

  const steps = Array.isArray(manifest.steps) ? manifest.steps.filter(Boolean) : [];
  const remaining = steps.filter((step) => step.profile !== entry.profile);
  manifest.updatedAt = new Date().toISOString();
  manifest.steps = [...remaining, entry];
  writeJsonFile(manifestPath, manifest);
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireContinuousLock() {
  ensureReportsRoot();

  const existing = readJsonFile(continuousLockPath);
  if (existing?.pid && processExists(existing.pid)) {
    fail(`Ya hay un ciclo continuo ejecutandose con PID ${existing.pid}.`, 11);
  }

  removeFileIfExists(continuousLockPath);

  const payload = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    repo: path.basename(repoRoot),
  };
  writeJsonFile(continuousLockPath, payload);
  return payload;
}

function releaseContinuousLock() {
  removeFileIfExists(continuousLockPath);
}

function hasContinuousStopSignal() {
  return fs.existsSync(continuousStopPath);
}

function writeContinuousStopSignal() {
  writeTextFile(continuousStopPath, `${new Date().toISOString()}\n`);
}

function clearContinuousStopSignal() {
  removeFileIfExists(continuousStopPath);
}

function updateContinuousState(patch) {
  const current = readJsonFile(continuousStatePath) || {
    repo: path.basename(repoRoot),
    mode: 'daemon',
  };

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  writeJsonFile(continuousStatePath, next);
  return next;
}

function readContinuousState() {
  return readJsonFile(continuousStatePath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepWithStopCheck(ms) {
  let remaining = ms;

  while (remaining > 0) {
    if (hasContinuousStopSignal()) {
      return true;
    }

    const currentDelay = Math.min(1_000, remaining);
    await sleep(currentDelay);
    remaining -= currentDelay;
  }

  return hasContinuousStopSignal();
}

function renderContextBlock() {
  const contextLines = [
    'Contexto del repositorio:',
    '- Proyecto: Electric Web Copia',
    '- Objetivo: convertir Electric Web Copia en una app nativa multi-OS con paridad funcional respecto a la web y preparacion real de produccion, sin romper web.',
    '- Ruta movil: apps/mobile',
    '- Reporte base: autodev-lab/reports/mobile-inspection.md',
  ];

  const latestDeepseek = findLatestReport('deepseek-analysis-');
  if (latestDeepseek) {
    contextLines.push(`- Ultimo analisis DeepSeek: ${toRepoRelative(latestDeepseek.absolutePath)}`);
  }

  const latestClaude = findLatestReport('claude-review-');
  const latestClaudePass = findLatestReport('claude-pass-');
  if (latestClaudePass) {
    contextLines.push(`- Ultimo pase Claude: ${toRepoRelative(latestClaudePass.absolutePath)}`);
  } else if (latestClaude) {
    contextLines.push(`- Ultima revision Claude: ${toRepoRelative(latestClaude.absolutePath)}`);
  }

  return contextLines.join('\n');
}

function normalizeInlinePrompt(prompt) {
  return prompt.replace(/\s+/g, ' ').trim();
}

function buildDeepseekPrompt() {
  return [
    'Actua como arquitecto tecnico senior enfocado en Expo Router y React Native multi-plataforma.',
    renderContextBlock(),
    'Analiza el repo actual y enumera las brechas mas importantes para llevar Electric Web Copia a paridad funcional total con la web y a un estado listo para produccion.',
    'Prioriza compatibilidad Android/iOS/web, autenticacion, navegacion, flujos criticos, APIs, almacenamiento local, notificaciones, build/release y riesgos de regresion entre web y mobile.',
    'Entrega hallazgos accionables, agrupados por prioridad, con recomendaciones concretas y referencias de archivos cuando sea posible.',
    'No modifiques codigo.',
  ].join('\n\n');
}

function buildCodexPrompt() {
  return [
    'Trabaja dentro del repositorio actual como implementador principal del ownership tecnico de Codex.',
    renderContextBlock(),
    'Objetivo: cerrar brechas reales para que Electric Web Copia quede convertida en una app nativa multi-OS con la mayor paridad funcional posible respecto a la web y con preparacion de produccion.',
    'Tu ownership operativo en este pase es: automation/, scripts/, apps/mobile/src/config, apps/mobile/src/hooks, apps/mobile/src/lib, apps/mobile/src/providers, apps/mobile/src/services, apps/mobile/src/stores, apps/mobile/src/types, straight-wire-backend/, packages/, tests/ y e2e/.',
    'Trabaja por iteraciones pequenas pero con impacto real, enfocadas en capa de datos, integracion con backend, contratos compartidos, validaciones y configuracion relacionada.',
    'Prioriza: autenticacion, flujos criticos, paridad funcional, compatibilidad Android/iOS/web, Expo Router, buildabilidad, configuracion de release, typing, fallbacks por plataforma y coherencia operativa.',
    'No invadas apps/mobile/app, apps/mobile/src/components ni apps/mobile/src/theme; si detectas un hueco de UI, dejalo claramente documentado como bloqueo para Claude.',
    'No toques credenciales, secretos ni hagas cambios destructivos.',
    'Si encuentras bloqueos, deja el repo en un estado consistente y resume claramente archivos cambiados, riesgos y validaciones ejecutadas.',
  ].join('\n\n');
}

function buildClaudePrompt() {
  return [
    'Trabaja dentro del repositorio actual como implementador principal del ownership visual y de rutas de Claude.',
    renderContextBlock(),
    'Objetivo: cerrar brechas reales de pantallas, componentes y theme para llevar la app nativa a paridad funcional y visual con la web, manteniendo preparacion de produccion.',
    'Tu ownership operativo en este pase es: apps/mobile/app/, apps/mobile/src/components/, apps/mobile/src/theme/, mobile/ y reportes funcionales cuando ayuden a explicar parity.',
    'Implementa cambios reales de codigo. Enfocate en Expo Router, pantallas auth/client/employee/boss/builder, componentes reutilizables, platform conditionals y consistencia de UX entre web y mobile.',
    'No invadas services, stores, hooks, providers, backend ni packages; si necesitas un cambio de contrato o datos, describe con precision el bloqueo y el borde tecnico.',
    'Entrega al final archivos cambiados, riesgos restantes y validaciones corridas.',
  ].join('\n\n');
}

function buildAgentEnv(workspaceRoot) {
  return {
    ...process.env,
    WORKFLOW_CONTROL_ROOT: repoRoot,
    WORKFLOW_WORKSPACE_ROOT: workspaceRoot,
  };
}

function runCapturedCommand({
  label,
  command,
  commandArgs,
  cwd = repoRoot,
  outputFile,
  allowFailure = false,
  stdinText = null,
  env = process.env,
}) {
  log(`==> ${label}`);
  log(`cwd: ${cwd}`);
  log(`cmd: ${[command, ...commandArgs].join(' ')}`);

  if (dryRun) {
    return {
      ok: true,
      outputFile,
      stdout: '',
      stderr: '',
    };
  }

  const result = spawnCommand(command, commandArgs, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
    input: stdinText ?? undefined,
    maxBuffer: 20 * 1024 * 1024,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combinedOutput = `${stdout}${stderr ? `\n[stderr]\n${stderr}` : ''}`.trim();

  if (outputFile) {
    writeTextFile(outputFile, `${combinedOutput}\n`);
  }

  if (stdout) {
    process.stdout.write(stdout);
    if (!stdout.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }

  if (stderr) {
    process.stderr.write(stderr);
    if (!stderr.endsWith('\n')) {
      process.stderr.write('\n');
    }
  }

  if (result.error) {
    if (allowFailure) {
      log(`Paso no bloqueante con error en "${label}": ${result.error.message}`);
      return {
        ok: false,
        outputFile,
        stdout,
        stderr,
        failureReason: result.error.message,
      };
    }

    fail(`Fallo el paso "${label}": ${result.error.message}`, 4);
  }

  if (result.status !== 0) {
    if (allowFailure) {
      log(`Paso no bloqueante "${label}" termino con codigo ${result.status}. Continuando.`);
      return {
        ok: false,
        outputFile,
        stdout,
        stderr,
        failureReason: `exit-code-${result.status}`,
      };
    }

    fail(`El paso "${label}" termino con codigo ${result.status}.`, result.status || 1);
  }

  return {
    ok: true,
    outputFile,
    stdout,
    stderr,
  };
}

function runDeepseekStep() {
  const timestamp = sanitizeTimestamp();
  const outputFile = path.join(reportsRoot, `deepseek-analysis-${timestamp}.md`);
  const deepseekEnv = {
    ...process.env,
    OLLAMA_HOST: defaultDeepseekHost,
    OLLAMA_LLM_LIBRARY: 'cpu',
    CUDA_VISIBLE_DEVICES: '-1',
  };

  const result = runCapturedCommand({
    label: `Local CPU analysis (${defaultDeepseekModel})`,
    command: ollamaCommand,
    commandArgs: ['run', defaultDeepseekModel, buildDeepseekPrompt()],
    outputFile,
    env: deepseekEnv,
  });

  if (!dryRun) {
    recordManifestEntry({
      profile: 'deepseek',
      ranAt: new Date().toISOString(),
      model: defaultDeepseekModel,
      outputFile: toRepoRelative(outputFile),
    });
  }

  return result;
}

function runCodexStep() {
  const timestamp = sanitizeTimestamp();
  const outputFile = path.join(reportsRoot, `codex-pass-${timestamp}.log`);
  const workspaceRoot = getAgentWorkspace('codex');
  const prompt = normalizeInlinePrompt(buildCodexPrompt());
  const commandArgs = [
    'exec',
    '--cd',
    workspaceRoot,
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
  ];

  if (workspaceRoot !== repoRoot) {
    commandArgs.push('--add-dir', repoRoot);
  }

  commandArgs.push(prompt);

  const result = runCapturedCommand({
    label: 'Codex implementation pass',
    command: codexCommand,
    commandArgs,
    cwd: workspaceRoot,
    outputFile,
    env: buildAgentEnv(workspaceRoot),
  });

  if (!dryRun) {
    recordManifestEntry({
      profile: 'codex',
      ranAt: new Date().toISOString(),
      outputFile: toRepoRelative(outputFile),
    });
  }

  return result;
}

function runClaudeStep() {
  const timestamp = sanitizeTimestamp();
  const outputFile = path.join(reportsRoot, `claude-pass-${timestamp}.log`);
  const workspaceRoot = getAgentWorkspace('claude');
  const prompt = `${buildClaudePrompt().trim()}\n`;
  const commandArgs = [
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
    commandArgs.push('--add-dir', repoRoot);
  }

  const result = runCapturedCommand({
    label: 'Claude implementation pass',
    command: claudeCommand,
    commandArgs,
    cwd: workspaceRoot,
    stdinText: prompt,
    outputFile,
    allowFailure: true,
    env: buildAgentEnv(workspaceRoot),
  });

  if (!dryRun) {
    recordManifestEntry({
      profile: 'claude',
      ranAt: new Date().toISOString(),
      ok: result.ok,
      failureReason: result.failureReason || null,
      outputFile: toRepoRelative(outputFile),
    });
  }

  return result;
}

function runConvertStep() {
  const timestamp = sanitizeTimestamp();
  const outputFile = path.join(reportsRoot, `native-convert-${timestamp}.log`);
  const commandArgs = [mobileBuildRunnerPath, 'convert'];

  if (dryRun) {
    commandArgs.push('--dry-run');
  }

  const result = runCapturedCommand({
    label: 'Native multi-OS conversion validation',
    command: nodeCommand,
    commandArgs,
    outputFile,
  });

  if (!dryRun) {
    recordManifestEntry({
      profile: 'convert',
      ranAt: new Date().toISOString(),
      outputFile: toRepoRelative(outputFile),
    });
  }

  return result;
}

function runFullSequence() {
  runDeepseekStep();
  runCodexStep();
  runClaudeStep();
  runConvertStep();
}

async function runDaemonLoop() {
  if (dryRun) {
    log('Modo dry-run: el daemon ejecuta solo un ciclo simulado.');
    runFullSequence();
    return;
  }

  acquireContinuousLock();
  clearContinuousStopSignal();

  updateContinuousState({
    status: 'starting',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    currentCycle: 0,
    currentPhase: null,
    loopDelayMs: defaultLoopDelayMs,
    loopFailureDelayMs: defaultLoopFailureDelayMs,
    lastError: null,
    stopRequested: false,
  });

  let cycle = 0;

  try {
    while (true) {
      if (hasContinuousStopSignal()) {
        updateContinuousState({
          status: 'stop-requested',
          stopRequested: true,
          stopRequestedAt: new Date().toISOString(),
          currentPhase: null,
        });
        break;
      }

      cycle += 1;
      const cycleStartedAt = new Date().toISOString();
      let cycleFailed = false;
      let cycleError = null;

      log(`Iniciando ciclo continuo #${cycle}.`);
      updateContinuousState({
        status: 'running',
        currentCycle: cycle,
        currentPhase: 'deepseek',
        lastCycleStartedAt: cycleStartedAt,
        stopRequested: false,
      });

      try {
        runDeepseekStep();
        updateContinuousState({ currentPhase: 'codex' });
        runCodexStep();
        updateContinuousState({ currentPhase: 'claude' });
        runClaudeStep();
        updateContinuousState({ currentPhase: 'convert' });
        runConvertStep();
      } catch (error) {
        cycleFailed = true;
        cycleError = error instanceof Error ? error.message : String(error);
        log(`Ciclo continuo #${cycle} fallo: ${cycleError}`);
      }

      const cycleEndedAt = new Date().toISOString();
      const pauseMs = cycleFailed ? defaultLoopFailureDelayMs : defaultLoopDelayMs;

      updateContinuousState({
        status: cycleFailed ? 'waiting-after-failure' : 'waiting',
        currentCycle: cycle,
        currentPhase: null,
        lastCycleStartedAt: cycleStartedAt,
        lastCycleEndedAt: cycleEndedAt,
        lastCycleStatus: cycleFailed ? 'failed' : 'completed',
        lastError: cycleFailed ? cycleError : null,
      });

      log(
        cycleFailed
          ? `Ciclo continuo #${cycle} finalizado con error. Pausa de ${Math.ceil(
              pauseMs / 1_000,
            )} segundos antes del siguiente intento.`
          : `Ciclo continuo #${cycle} completado. Pausa de ${Math.ceil(
              pauseMs / 1_000,
            )} segundos antes del siguiente ciclo.`,
      );

      const stopDetected = await sleepWithStopCheck(pauseMs);
      if (stopDetected) {
        updateContinuousState({
          status: 'stop-requested',
          stopRequested: true,
          stopRequestedAt: new Date().toISOString(),
          currentPhase: null,
        });
        break;
      }
    }
  } finally {
    const stopDetected = hasContinuousStopSignal();
    updateContinuousState({
      status: 'stopped',
      currentPhase: null,
      stoppedAt: new Date().toISOString(),
      stopRequested: stopDetected,
    });
    releaseContinuousLock();
    if (stopDetected) {
      clearContinuousStopSignal();
    }
  }
}

const profiles = {
  deepseek: {
    description: 'Analisis tecnico local en CPU.',
    run: () => runDeepseekStep(),
  },
  codex: {
    description: 'Pase de implementacion con Codex CLI.',
    run: () => runCodexStep(),
  },
  claude: {
    description: 'Pase de implementacion con Claude CLI dentro de su ownership visual.',
    run: () => runClaudeStep(),
  },
  convert: {
    description: 'Validacion del pipeline native multi-OS.',
    run: () => runConvertStep(),
  },
  full: {
    description: 'Secuencia completa: analisis local -> Codex implementa -> Claude implementa -> convert.',
    run: () => runFullSequence(),
  },
  daemon: {
    description:
      'Bucle continuo infinito: analisis local -> Codex implementa -> Claude implementa -> convert hasta recibir una senal de parada.',
    run: async () => runDaemonLoop(),
  },
  stop: {
    description: 'Solicita detener de forma ordenada el bucle continuo.',
    run: () => {
      writeContinuousStopSignal();
      updateContinuousState({
        status: 'stop-requested',
        stopRequested: true,
        stopRequestedAt: new Date().toISOString(),
      });
      log('Senal de parada escrita. El supervisor se detendra al cerrar el paso o pausa actual.');
    },
  },
  status: {
    description: 'Muestra el estado actual del bucle continuo.',
    run: () => {
      const state = readContinuousState();
      if (!state) {
        log('No hay estado continuo registrado todavia.');
        return;
      }

      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    },
  },
};

async function main() {
  if (!profiles[profile]) {
    fail(`Perfil no soportado: ${profile}. Usa uno de: ${Object.keys(profiles).join(', ')}.`, 5);
  }

  ensurePathExists(repoRoot, 'el repo raiz');
  ensurePathExists(path.join(repoRoot, 'apps', 'mobile'), 'apps/mobile');
  ensurePathExists(mobileBuildRunnerPath, 'el runner de conversion native');
  ensureReportsRoot();

  if (!dryRun) {
    ensureCommand(nodeCommand, 'Node.js');

    if (profile === 'deepseek' || profile === 'full' || profile === 'daemon') {
      ensureCommand(ollamaCommand, 'Ollama');
    }

    if (profile === 'codex' || profile === 'full' || profile === 'daemon') {
      ensureCommand(codexCommand, 'Codex CLI', ['--help']);
    }

    if (profile === 'claude' || profile === 'full' || profile === 'daemon') {
      ensureCommand(claudeCommand, 'Claude CLI', ['--help']);
    }
  }

  log(`Repo: ${repoRoot}`);
  log(`Perfil: ${profile}`);
  log(`Modo dry-run: ${dryRun ? 'si' : 'no'}`);
  log(profiles[profile].description);

  await Promise.resolve(profiles[profile].run());

  log('Secuencia finalizada.');
}

main().catch((error) => {
  if (error instanceof RunnerError) {
    console.error(`[n8n-native-team] ${error.message}`);
    process.exit(error.exitCode || 1);
  }

  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[n8n-native-team] ${message}`);
  process.exit(1);
});
