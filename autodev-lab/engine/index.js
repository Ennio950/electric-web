const fs = require('fs');
const path = require('path');

const defaultConfig = require('./config/default.config.json');
const { createLogger } = require('./core/logger');
const { TaskManager } = require('./core/taskManager');
const { LoopRunner } = require('./core/loopRunner');
const { Reporter } = require('./core/reporter');

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function createEngine(overrides = {}) {
  const labRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(labRoot, '..');
  const config = {
    ...defaultConfig,
    ...overrides,
    rutas: {
      ...defaultConfig.rutas,
      ...(overrides.rutas || {}),
    },
  };

  const rutasAbsolutas = {
    logs: path.resolve(repoRoot, config.rutas.logs),
    reportes: path.resolve(repoRoot, config.rutas.reportes),
    tareas: path.resolve(repoRoot, config.rutas.tareas),
  };

  ensureDirectory(rutasAbsolutas.logs);
  ensureDirectory(rutasAbsolutas.reportes);
  ensureDirectory(rutasAbsolutas.tareas);

  const runtimeConfig = {
    ...config,
    labRoot,
    repoRoot,
    rutasAbsolutas,
  };

  const logger = createLogger({
    nombreMotor: runtimeConfig.nombreMotor,
    logsDir: runtimeConfig.rutasAbsolutas.logs,
  });

  const reporter = new Reporter({
    config: runtimeConfig,
    logger,
  });

  const taskManager = new TaskManager({
    config: runtimeConfig,
    logger,
  });

  const loopRunner = new LoopRunner({
    config: runtimeConfig,
    logger,
    reporter,
    taskManager,
  });

  return {
    config: runtimeConfig,
    logger,
    reporter,
    taskManager,
    loopRunner,
  };
}

module.exports = {
  createEngine,
  defaultConfig,
};
