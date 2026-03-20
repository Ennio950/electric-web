const fs = require('fs');
const path = require('path');

const claudeAgent = require('../agents/claude.agent');
const codexAgent = require('../agents/codex.agent');
const openclawAgent = require('../agents/openclaw.agent');
const { ChangeTracker } = require('./changeTracker');
const { DiffReporter } = require('./diffReporter');
const mobileFixPlanner = require('../planners/mobileFixPlanner');
const taskBacklogPlanner = require('../planners/taskBacklogPlanner');
const mobileSafeFixer = require('../fixers/mobileSafeFixer');
const backendSafeFixer = require('../fixers/backendSafeFixer');
const mobileInspector = require('../inspectors/mobile/mobileInspector');
const {
  orchestrateTask,
  markGeneratedTask,
} = require('../orchestrators/taskOrchestrator');

const EXECUTABLE_BACKLOG_MODE = 'SAFE_AUTODEV_EXECUTABLE_BACKLOG_MOBILE_BACKEND';

function includesMobileArea(areaObjetivo) {
  return areaObjetivo === 'mobile' || areaObjetivo === 'mobile-backend';
}

function resolveFileCandidates(basePath) {
  return [
    basePath,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
}

function resolveImportPath(importPath, importerPath, config) {
  let basePath = null;

  if (importPath.startsWith('@/')) {
    basePath = path.join(config.repoRoot, 'apps', 'mobile', importPath.slice(2));
  } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
    basePath = path.resolve(path.dirname(importerPath), importPath);
  } else {
    return null;
  }

  return resolveFileCandidates(basePath).find((candidate) => fs.existsSync(candidate)) || null;
}

function collectImports(content) {
  const imports = new Set();

  for (const match of content.matchAll(/from ['"]([^'"]+)['"]/g)) {
    imports.add(match[1]);
  }

  for (const match of content.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    imports.add(match[1]);
  }

  return [...imports];
}

function listFilesRecursive(rootDir, extensions) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(absolutePath, extensions));
      continue;
    }
    if (extensions.includes(path.extname(entry.name))) {
      results.push(absolutePath);
    }
  }
  return results;
}

function extractNamedImports(bindingBlock) {
  return bindingBlock
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^type\s+/, ''))
    .map((segment) => segment.split(/\s+as\s+/i)[0].trim())
    .filter(Boolean);
}

function validateApiServiceExports(config, summary) {
  const serviceRelativePath = 'apps/mobile/src/services/apiService.ts';
  if (!(summary.modifiedFiles || []).includes(serviceRelativePath)) {
    return {
      ok: true,
      detalle: '',
    };
  }

  const servicePath = path.join(config.repoRoot, serviceRelativePath);
  if (!fs.existsSync(servicePath)) {
    return {
      ok: false,
      detalle: 'apps/mobile/src/services/apiService.ts no existe tras el fix.',
    };
  }

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const exportedFunctions = new Set(
    [...serviceContent.matchAll(/export function ([A-Za-z0-9_]+)/g)].map(
      (match) => match[1]
    )
  );
  const mobileRoot = path.join(config.repoRoot, 'apps', 'mobile');
  const mobileFiles = [
    ...listFilesRecursive(path.join(mobileRoot, 'app'), ['.ts', '.tsx']),
    ...listFilesRecursive(path.join(mobileRoot, 'src'), ['.ts', '.tsx']),
  ].filter((filePath) => filePath !== servicePath);
  const missingExports = [];

  for (const filePath of mobileFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(
      /import\s*{([^}]+)}\s*from\s*['"]@\/src\/services\/apiService['"]/g
    )) {
      for (const importedName of extractNamedImports(match[1])) {
        if (!exportedFunctions.has(importedName)) {
          missingExports.push(
            `${path.relative(config.repoRoot, filePath).split(path.sep).join('/')} -> ${importedName}`
          );
        }
      }
    }
  }

  return {
    ok: missingExports.length === 0,
    detalle: missingExports.join(', '),
  };
}

function validateSafeExecution({ implementationResult, config, logger }) {
  const summary = implementationResult.changeSummary || {
    changes: [],
    modifiedFiles: [],
    backups: [],
    productiveFilesTouched: 0,
    backendFilesTouched: 0,
  };
  const checks = [];

  const filesExist = summary.modifiedFiles.every((relativePath) =>
    fs.existsSync(path.resolve(config.repoRoot, relativePath))
  );
  checks.push({
    nombre: 'archivos_modificados_existen',
    ok: filesExist,
  });

  const backupsExist = summary.backups.every((relativePath) =>
    fs.existsSync(path.resolve(config.repoRoot, relativePath))
  );
  checks.push({
    nombre: 'backups_creados',
    ok: backupsExist,
  });

  const productiveLimit =
    config.limites?.general?.maxArchivosProductivosPorTarea || 5;
  const productiveLimitOk = summary.productiveFilesTouched <= productiveLimit;
  checks.push({
    nombre: 'limite_archivos_productivos',
    ok: productiveLimitOk,
    detalle: `${summary.productiveFilesTouched}/${productiveLimit}`,
  });

  const backendLimit =
    config.limites?.backend?.maxArchivosProductivosPorTarea || 2;
  const backendLimitOk = summary.backendFilesTouched <= backendLimit;
  checks.push({
    nombre: 'limite_archivos_backend',
    ok: backendLimitOk,
    detalle: `${summary.backendFilesTouched}/${backendLimit}`,
  });

  const invalidImports = [];
  for (const change of summary.changes || []) {
    const absolutePath = path.resolve(config.repoRoot, change.relativePath);

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    for (const importPath of collectImports(content)) {
      const resolved = resolveImportPath(importPath, absolutePath, config);
      if ((importPath.startsWith('@/') || importPath.startsWith('.')) && !resolved) {
        invalidImports.push({
          archivo: change.relativePath,
          importPath,
        });
      }
    }
  }

  checks.push({
    nombre: 'imports_validos',
    ok: invalidImports.length === 0,
    detalle:
      invalidImports.length > 0
        ? invalidImports
            .map((entry) => `${entry.archivo} -> ${entry.importPath}`)
            .join(', ')
        : '',
  });

  const apiServiceExports = validateApiServiceExports(config, summary);
  checks.push({
    nombre: 'api_service_exports_validos',
    ok: apiServiceExports.ok,
    detalle: apiServiceExports.detalle,
  });

  const ok = checks.every((check) => check.ok);
  logger.info('Validacion de backlog ejecutable completada.', {
    ok,
    checks,
  });

  return {
    resumen: ok
      ? 'Validacion basica ok: archivos, imports, backups y limites consistentes.'
      : 'Validacion basica detecto inconsistencias y requiere rollback.',
    ok,
    checks,
  };
}

function validateLegacyMobileFix(task, implementationResult, config, logger) {
  const validation = validateSafeExecution({
    implementationResult,
    config: {
      ...config,
      limites: {
        ...config.limites,
        general: {
          maxArchivosProductivosPorTarea:
            config.limites?.mobile?.maxArchivosProductivosPorEjecucion || 3,
        },
        backend: {
          maxArchivosProductivosPorTarea: 0,
        },
      },
    },
    logger,
  });

  logger.info('Validacion mobile safe fix completada.', {
    tarea: task.id,
    ok: validation.ok,
  });

  return validation;
}

function buildNoopImplementation(planning, orchestration, changeTracker) {
  const omittedFixes = orchestration.omittedReason
    ? [
        {
          archivo: orchestration.selectedTask
            ? orchestration.selectedTask.id
            : 'sin_tarea',
          motivo: orchestration.omittedReason,
        },
      ]
    : [];

  return {
    resumen: orchestration.selectedTask
      ? `La tarea ${orchestration.selectedTask.id} no se ejecuto automaticamente.`
      : 'No hay tarea segura pendiente para ejecutar.',
    appliedFixes: [],
    omittedFixes,
    changeSummary: changeTracker.getSummary(),
    fixSummary: {
      findingsCount: planning.stats?.generatedCount || 0,
      fixesApplied: 0,
      modifiedFiles: [],
      omittedFiles: omittedFixes.map((entry) => entry.archivo),
      backlogPath: planning.backlogPath,
    },
    nextRecommendations: [
      orchestration.omittedReason ||
        'Revisar manualmente las tareas semiautomaticas y manuales.',
    ],
  };
}

function determineSelectedTaskFinalState(orchestration, implementation, validation) {
  if (!orchestration.selectedTask) {
    return null;
  }

  if (!orchestration.canExecuteAutomatically) {
    return 'requiere_revision';
  }

  if (!validation.ok) {
    return 'fallido';
  }

  return implementation.fixSummary?.fixesApplied > 0
    ? 'completado'
    : 'requiere_revision';
}

function buildExecutableSummary({
  planning,
  orchestration,
  implementation,
  validation,
}) {
  if (!orchestration.selectedTask) {
    return `AutoDev completo la orquestacion. Tareas generadas: ${
      planning.stats?.generatedCount || 0
    }, sin tarea segura para ejecutar automaticamente.`;
  }

  if (!orchestration.canExecuteAutomatically) {
    return `AutoDev genero el backlog ejecutable y dejo ${orchestration.selectedTask.id} en revision por riesgo ${orchestration.clasificacion}.`;
  }

  if (!validation.ok) {
    return `AutoDev revirtio cambios de ${orchestration.selectedTask.id} tras una validacion fallida.`;
  }

  if ((implementation.fixSummary?.fixesApplied || 0) === 0) {
    return `AutoDev evaluo ${orchestration.selectedTask.id} pero no aplico cambios por seguridad.`;
  }

  return `AutoDev ejecuto ${orchestration.selectedTask.id}. Tareas generadas: ${
    planning.stats?.generatedCount || 0
  }, fixes aplicados: ${implementation.fixSummary?.fixesApplied || 0}.`;
}

class LoopRunner {
  constructor({ config, logger, reporter, taskManager, agents = {}, inspectors = {} }) {
    this.config = config;
    this.logger = logger;
    this.reporter = reporter;
    this.taskManager = taskManager;
    this.agents = {
      claude: agents.claude || claudeAgent,
      codex: agents.codex || codexAgent,
      openclaw: agents.openclaw || openclawAgent,
    };
    this.inspectors = {
      mobile: inspectors.mobile || mobileInspector,
    };
    this.mobilePlanner = mobileFixPlanner;
    this.taskBacklogPlanner = taskBacklogPlanner;
    this.mobileSafeFixer = mobileSafeFixer;
    this.backendSafeFixer = backendSafeFixer;
  }

  async executePhase(nombre, runner) {
    const iniciadoEn = new Date().toISOString();
    this.logger.info(`Iniciando fase ${nombre}.`);

    try {
      const result = await Promise.resolve(runner());
      const finalizadoEn = new Date().toISOString();
      const resumen =
        result && typeof result.resumen === 'string'
          ? result.resumen
          : `Fase ${nombre} completada con placeholder.`;

      this.logger.info(`Fase ${nombre} completada.`, { resumen });

      return {
        nombre,
        estado: 'completado',
        iniciadoEn,
        finalizadoEn,
        resumen,
        result,
      };
    } catch (error) {
      const finalizadoEn = new Date().toISOString();

      this.logger.error(`Fase ${nombre} fallo.`, {
        error: error.message,
      });

      throw {
        nombre,
        estado: 'fallido',
        iniciadoEn,
        finalizadoEn,
        resumen: error.message,
        error,
      };
    }
  }

  async runLegacyTask(taskReference, loadedTask) {
    const executionId = new Date().toISOString().replace(/[:.]/g, '-');
    const phaseResults = [];
    const changeTracker = new ChangeTracker({
      config: this.config,
      logger: this.logger,
    });
    const diffReporter = new DiffReporter({
      config: this.config,
      logger: this.logger,
    });

    let task = this.taskManager.updateTaskState(taskReference, 'ejecutando', {
      resumenResultado: 'AutoDev loop iniciado.',
    });

    try {
      const analisis = await this.executePhase('analisis', () => {
        if (task.areaObjetivo === 'mobile') {
          const inspection = this.inspectors.mobile.inspectMobileApp(
            task,
            this.logger,
            this.config
          );

          return {
            resumen: inspection.resumen,
            detalles: {
              inspection,
            },
          };
        }

        const inspeccion = this.agents.openclaw.inspeccionarRepositorio(
          task,
          this.logger,
          this.config
        );
        const analisisTarea = this.agents.claude.analizarTarea(
          task,
          this.logger,
          this.config
        );

        return {
          resumen:
            'Analisis placeholder completado para la app React Native con Expo.',
          detalles: {
            inspeccion,
            analisisTarea,
          },
        };
      });
      phaseResults.push(analisis);

      const planificacion = await this.executePhase('planificacion', () => {
        if (task.areaObjetivo === 'mobile' && task.modo === 'safe_fix') {
          return this.mobilePlanner.planMobileFixes(
            task,
            this.logger,
            this.config
          );
        }

        return this.agents.codex.generarPlanImplementacion(
          task,
          analisis.result,
          this.logger,
          this.config
        );
      });
      phaseResults.push(planificacion);

      const implementacion = await this.executePhase('implementacion', () => {
        if (task.areaObjetivo === 'mobile' && task.modo === 'safe_fix') {
          return this.mobileSafeFixer.applyMobileSafeFixes({
            task,
            planning: planificacion.result,
            logger: this.logger,
            config: this.config,
            changeTracker,
          });
        }

        return this.agents.codex.generarParcheCodigo(
          task,
          planificacion.result,
          this.logger,
          this.config
        );
      });
      phaseResults.push(implementacion);

      const validacion = await this.executePhase('validacion', () => {
        if (task.areaObjetivo === 'mobile' && task.modo === 'safe_fix') {
          return validateLegacyMobileFix(
            task,
            implementacion.result,
            this.config,
            this.logger
          );
        }

        return this.agents.claude.revisarResultado(
          task,
          implementacion.result,
          this.logger,
          this.config
        );
      });
      phaseResults.push(validacion);

      const reporte = await this.executePhase('reporte', () => {
        if (task.areaObjetivo === 'mobile' && task.modo === 'safe_fix') {
          const diffReportPath = diffReporter.generateMobileFixReport({
            task,
            planning: planificacion.result,
            implementation: implementacion.result,
            validation: validacion.result,
            logFilePath: this.logger.logFilePath,
          });

          return {
            resumen: `Reporte de cambios generado en ${path.relative(
              this.config.repoRoot,
              diffReportPath
            )}.`,
            diffReportPath,
          };
        }

        return {
          resumen:
            'Reporte listo para generacion markdown en autodev-lab/reports.',
        };
      });
      phaseResults.push(reporte);

      const resumenResultado =
        task.areaObjetivo === 'mobile' && task.modo === 'safe_fix'
          ? `AutoDev completo el safe fix mobile. Hallazgos: ${
              planificacion.result.stats.findingsCount
            }, fixes aplicados: ${
              implementacion.result.fixSummary.fixesApplied
            }, omitidos: ${implementacion.result.fixSummary.omittedFiles.length}.`
          : task.areaObjetivo === 'mobile'
            ? 'AutoDev completo la inspeccion real mobile y cerro el flujo de planificacion, implementacion placeholder, validacion y reporte.'
            : 'AutoDev completo el flujo placeholder: analisis, planificacion, implementacion, validacion y reporte.';

      task = this.taskManager.updateTaskState(taskReference, 'completado', {
        resumenResultado,
      });

      const reportPath = this.reporter.generateTaskReport({
        tarea: task,
        executionId,
        phaseResults,
        estadoFinal: task.estado,
        logFilePath: this.logger.logFilePath,
      });

      return {
        task,
        phaseResults,
        reportPath,
        logFilePath: this.logger.logFilePath,
        mobileExecution:
          task.areaObjetivo === 'mobile' && task.modo === 'safe_fix'
            ? {
                findingsCount: planificacion.result.stats.findingsCount,
                fixesApplied: implementacion.result.fixSummary.fixesApplied,
                modifiedFiles: implementacion.result.fixSummary.modifiedFiles,
                omittedFiles: implementacion.result.fixSummary.omittedFiles,
                backlogPath: planificacion.result.backlogPath,
                diffReportPath: reporte.result.diffReportPath,
              }
            : null,
      };
    } catch (phaseFailure) {
      const nextRetries = loadedTask.reintentos + 1;
      const estadoFinal =
        nextRetries >= this.config.maximoReintentos
          ? 'requiere_revision'
          : 'fallido';

      task = this.taskManager.updateTaskState(taskReference, estadoFinal, {
        reintentos: nextRetries,
        resumenResultado: `AutoDev se detuvo en la fase ${phaseFailure.nombre}: ${phaseFailure.resumen}`,
      });

      const reportPath = this.reporter.generateTaskReport({
        tarea: task,
        executionId,
        phaseResults,
        estadoFinal: task.estado,
        error: phaseFailure.error || phaseFailure,
        logFilePath: this.logger.logFilePath,
      });

      const wrappedError = new Error(
        `Task ${task.id} failed during ${phaseFailure.nombre}.`
      );
      wrappedError.reportPath = reportPath;
      wrappedError.logFilePath = this.logger.logFilePath;
      wrappedError.task = task;
      throw wrappedError;
    }
  }

  async runExecutableBacklogTask(taskReference, loadedTask) {
    const executionId = new Date().toISOString().replace(/[:.]/g, '-');
    const phaseResults = [];
    const changeTracker = new ChangeTracker({
      config: this.config,
      logger: this.logger,
    });
    const diffReporter = new DiffReporter({
      config: this.config,
      logger: this.logger,
    });
    const explicitGeneratedRoot = loadedTask.taskKind === 'generated';

    let task = this.taskManager.updateTaskState(taskReference, 'ejecutando', {
      resumenResultado: 'AutoDev executable backlog iniciado.',
    });
    let selectedTask = null;
    let selectedTaskPath = null;

    try {
      const analisis = await this.executePhase('analisis', () => {
        if (!includesMobileArea(task.areaObjetivo)) {
          return {
            resumen:
              'Analisis backend ligero: se delega el scan detallado al planner seguro.',
          };
        }

        const mobileInspectionTask = {
          ...task,
          areaObjetivo: 'mobile',
          aplicacionObjetivo: 'apps/mobile',
          plataformaObjetivo: 'react-native-expo',
        };
        const inspection = this.inspectors.mobile.inspectMobileApp(
          mobileInspectionTask,
          this.logger,
          this.config
        );

        return {
          resumen: inspection.resumen,
          detalles: {
            inspection,
          },
        };
      });
      phaseResults.push(analisis);

      const planificacion = await this.executePhase('planificacion', () =>
        this.taskBacklogPlanner.planExecutableTasks(task, this.logger, this.config)
      );
      phaseResults.push(planificacion);

      const orquestacion = await this.executePhase('orquestacion', () =>
        orchestrateTask({
          rootTask: task,
          rootTaskReference: taskReference,
          planning: planificacion.result,
          logger: this.logger,
          config: this.config,
        })
      );
      phaseResults.push(orquestacion);

      selectedTask = orquestacion.result.selectedTask;
      selectedTaskPath = orquestacion.result.selectedTaskPath;

      if (
        selectedTask &&
        orquestacion.result.canExecuteAutomatically &&
        !explicitGeneratedRoot
      ) {
        markGeneratedTask(
          this.config,
          selectedTask,
          selectedTaskPath,
          'ejecutando',
          {
            resumenResultado: `Seleccionada automaticamente por ${task.id}.`,
          }
        );
      }

      const implementacion = await this.executePhase('implementacion', () => {
        if (!selectedTask || !orquestacion.result.canExecuteAutomatically) {
          return buildNoopImplementation(
            planificacion.result,
            orquestacion.result,
            changeTracker
          );
        }

        if (selectedTask.areaObjetivo === 'mobile') {
          return this.mobileSafeFixer.applyMobileSafeFixes({
            task: selectedTask,
            planning: planificacion.result,
            selectedTask,
            logger: this.logger,
            config: this.config,
            changeTracker,
          });
        }

        if (selectedTask.areaObjetivo === 'backend') {
          return this.backendSafeFixer.applyBackendSafeFix({
            selectedTask,
            logger: this.logger,
            config: this.config,
            changeTracker,
          });
        }

        return buildNoopImplementation(
          planificacion.result,
          {
            ...orquestacion.result,
            omittedReason:
              'La tarea mobile-backend requiere revision manual antes de tocar ambas areas.',
          },
          changeTracker
        );
      });
      phaseResults.push(implementacion);

      const validacion = await this.executePhase('validacion', () => {
        const validation = validateSafeExecution({
          implementationResult: implementacion.result,
          config: this.config,
          logger: this.logger,
        });

        if (!validation.ok) {
          changeTracker.restoreAll();
          throw new Error(validation.resumen);
        }

        return validation;
      });
      phaseResults.push(validacion);

      const selectedTaskFinalState = determineSelectedTaskFinalState(
        orquestacion.result,
        implementacion.result,
        validacion.result
      );

      const reporte = await this.executePhase('reporte', () => {
        const diffReportPath = diffReporter.generateTaskExecutionReport({
          rootTask: task,
          planning: planificacion.result,
          orchestration: orquestacion.result,
          implementation: implementacion.result,
          validation: validacion.result,
          selectedTaskFinalState,
          logFilePath: this.logger.logFilePath,
        });

        return {
          resumen: `Reporte de ejecucion generado en ${path.relative(
            this.config.repoRoot,
            diffReportPath
          )}.`,
          diffReportPath,
        };
      });
      phaseResults.push(reporte);

      if (selectedTask && !explicitGeneratedRoot) {
        markGeneratedTask(
          this.config,
          selectedTask,
          selectedTaskPath,
          selectedTaskFinalState || 'requiere_revision',
          {
            resumenResultado:
              selectedTaskFinalState === 'completado'
                ? `AutoDev ejecuto ${selectedTask.id} con ${
                    implementacion.result.fixSummary?.fixesApplied || 0
                  } fix(es) seguro(s).`
                : `AutoDev no aplico cambios confiables en ${selectedTask.id}; requiere revision.`,
          }
        );
      }

      const rootFinalState =
        explicitGeneratedRoot && selectedTaskFinalState
          ? selectedTaskFinalState
          : 'completado';
      const resumenResultado = buildExecutableSummary({
        planning: planificacion.result,
        orchestration: orquestacion.result,
        implementation: implementacion.result,
        validation: validacion.result,
      });

      task = this.taskManager.updateTaskState(taskReference, rootFinalState, {
        resumenResultado,
      });

      const reportPath = this.reporter.generateTaskReport({
        tarea: task,
        executionId,
        phaseResults,
        estadoFinal: task.estado,
        logFilePath: this.logger.logFilePath,
      });

      return {
        task,
        phaseResults,
        reportPath,
        logFilePath: this.logger.logFilePath,
        taskExecution: {
          generatedCount: planificacion.result.stats.generatedCount,
          selectedTask: selectedTask ? selectedTask.id : null,
          areaObjetivo: orquestacion.result.areaObjetivo,
          clasificacion: orquestacion.result.clasificacion,
          fixesApplied: implementacion.result.fixSummary.fixesApplied,
          modifiedFiles: implementacion.result.fixSummary.modifiedFiles,
          omittedFiles: implementacion.result.fixSummary.omittedFiles,
          backlogPath: planificacion.result.backlogPath,
          diffReportPath: reporte.result.diffReportPath,
        },
      };
    } catch (phaseFailure) {
      if (selectedTask && !explicitGeneratedRoot && selectedTaskPath) {
        markGeneratedTask(
          this.config,
          selectedTask,
          selectedTaskPath,
          'fallido',
          {
            resumenResultado: `AutoDev se detuvo en ${phaseFailure.nombre}: ${phaseFailure.resumen}`,
          }
        );
      }

      const nextRetries = loadedTask.reintentos + 1;
      const estadoFinal =
        nextRetries >= this.config.maximoReintentos
          ? 'requiere_revision'
          : 'fallido';

      task = this.taskManager.updateTaskState(taskReference, estadoFinal, {
        reintentos: nextRetries,
        resumenResultado: `AutoDev se detuvo en la fase ${phaseFailure.nombre}: ${phaseFailure.resumen}`,
      });

      const reportPath = this.reporter.generateTaskReport({
        tarea: task,
        executionId,
        phaseResults,
        estadoFinal: task.estado,
        error: phaseFailure.error || phaseFailure,
        logFilePath: this.logger.logFilePath,
      });

      const wrappedError = new Error(
        `Task ${task.id} failed during ${phaseFailure.nombre}.`
      );
      wrappedError.reportPath = reportPath;
      wrappedError.logFilePath = this.logger.logFilePath;
      wrappedError.task = task;
      throw wrappedError;
    }
  }

  async run(taskReference) {
    const loadedTask = this.taskManager.loadTask(taskReference);

    if (
      loadedTask.modo === EXECUTABLE_BACKLOG_MODE ||
      loadedTask.taskKind === 'generated'
    ) {
      return this.runExecutableBacklogTask(taskReference, loadedTask);
    }

    return this.runLegacyTask(taskReference, loadedTask);
  }
}

module.exports = {
  LoopRunner,
  EXECUTABLE_BACKLOG_MODE,
};
