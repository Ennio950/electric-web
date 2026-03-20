const fs = require('fs');
const path = require('path');

const mobileFixPlanner = require('./mobileFixPlanner');

const BACKEND_SAFE_FIX_SPECS = {
  'straight-wire-backend/src/controllers/clientJobs.controller.js': {
    categoryFix: 'backend-controller-error-utility',
    fixKind: 'backend-controller-error-utility',
    clasificacion: 'seguro_automatico',
  },
  'straight-wire-backend/src/controllers/employeeJobs.controller.js': {
    categoryFix: 'backend-controller-error-utility',
    fixKind: 'backend-controller-error-utility',
    clasificacion: 'seguro_automatico',
  },
};

const BACKEND_EXCLUDED_AUTOFIX = new Set([
  'straight-wire-backend/src/controllers/auth.magic.controller.js',
]);

function listJsonFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.join(directoryPath, fileName));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseInspectionScreens(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return [];
  }

  const lines = fs.readFileSync(reportPath, 'utf8').split(/\r?\n/);
  const screens = [];

  for (const line of lines) {
    const match = line.match(
      /^- `([^`]+)` -> `([^`]+)` \((\d+) lineas, hooks: (.+)\)$/
    );

    if (!match) {
      continue;
    }

    screens.push({
      expoRoute: match[1],
      relativePath: match[2].startsWith('app/')
        ? match[2]
        : `app/${match[2]}`,
      lineCount: Number(match[3]),
      hooks:
        match[4] === 'ninguno'
          ? []
          : match[4].split(',').map((hook) => hook.trim()),
    });
  }

  return screens;
}

function loadExistingGeneratedTasks(generatedDir) {
  const byKey = new Map();
  const usedIds = new Set();

  for (const filePath of listJsonFiles(generatedDir)) {
    const task = readJson(filePath);
    if (task.taskKey) {
      byKey.set(task.taskKey, {
        ...task,
        __filePath: filePath,
      });
    }
    if (task.id) {
      usedIds.add(task.id);
    }
  }

  return {
    byKey,
    usedIds,
  };
}

function nextTaskIdFactory(usedIds) {
  let nextNumber = 1;

  return function nextTaskId() {
    while (usedIds.has(`task-${String(nextNumber).padStart(3, '0')}`)) {
      nextNumber += 1;
    }

    const taskId = `task-${String(nextNumber).padStart(3, '0')}`;
    usedIds.add(taskId);
    nextNumber += 1;
    return taskId;
  };
}

function buildMobileGeneratedTasks(mobileBacklog, inspectionScreens) {
  const tasks = [];

  for (const entry of mobileBacklog) {
    if (entry.tipo === 'api_directa_repetida') {
      tasks.push({
        taskKey: `mobile-api:${entry.archivo}`,
        titulo: `Extraer llamada API repetida de ${entry.archivo}`,
        descripcion: `Normalizar la importacion directa de api.ts en ${entry.archivo}.`,
        areaObjetivo: 'mobile',
        clasificacion: entry.clasificacion,
        categoriaFix: 'api-service-extraction',
        archivosObjetivo: [
          `apps/mobile/${entry.archivo}`,
          'apps/mobile/src/services/apiService.ts',
        ],
        requiereRevision: entry.clasificacion !== 'seguro_automatico',
        fixPayload: {
          kind: 'mobile-api-service-extraction',
          targetFile: entry.archivo,
          serviceFunction: entry.serviceFunction || null,
        },
      });
      continue;
    }

    if (entry.tipo === 'fetch_directo') {
      tasks.push({
        taskKey: `mobile-fetch:${entry.archivo}`,
        titulo: `Revisar fetch directo en ${entry.archivo}`,
        descripcion:
          'Evaluar si conviene encapsular el fetch en un helper o servicio sin cambiar el comportamiento visible.',
        areaObjetivo: 'mobile',
        clasificacion: 'manual',
        categoriaFix: 'api-service-extraction',
        archivosObjetivo: [`apps/mobile/${entry.archivo}`],
        requiereRevision: true,
        fixPayload: {
          kind: 'mobile-fetch-review',
          targetFile: entry.archivo,
        },
      });
    }
  }

  for (const screen of inspectionScreens
    .filter((entry) => entry.lineCount >= 400)
    .slice(0, 2)) {
    tasks.push({
      taskKey: `mobile-helper:${screen.relativePath}`,
      titulo: `Separar logica de pantalla grande ${screen.relativePath}`,
      descripcion:
        'Mover logica simple de pantalla a helper o servicio manteniendo la arquitectura Expo Router.',
      areaObjetivo: 'mobile',
      clasificacion: 'manual',
      categoriaFix: 'screen-helper-separation',
      archivosObjetivo: [`apps/mobile/${screen.relativePath}`],
      requiereRevision: true,
      fixPayload: {
        kind: 'mobile-screen-helper-review',
        targetFile: screen.relativePath,
      },
    });
  }

  return tasks;
}

function scanBackendControllers(config) {
  const controllersDir = path.join(
    config.repoRoot,
    'straight-wire-backend',
    'src',
    'controllers'
  );
  const files = fs
    .readdirSync(controllersDir)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => path.join(controllersDir, fileName));

  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path
        .relative(config.repoRoot, filePath)
        .split(path.sep)
        .join('/');
      const lineCount = content.split(/\r?\n/).length;
      const hasErrorHelpers =
        content.includes('function sendError(res, status, error, message)') &&
        content.includes('function handleError(res, err)');

      if (!hasErrorHelpers) {
        return null;
      }

      if (BACKEND_EXCLUDED_AUTOFIX.has(relativePath)) {
        return {
          relativePath,
          lineCount,
          clasificacion: 'manual',
        };
      }

      if (BACKEND_SAFE_FIX_SPECS[relativePath]) {
        return {
          relativePath,
          lineCount,
          clasificacion: BACKEND_SAFE_FIX_SPECS[relativePath].clasificacion,
          fixSpec: BACKEND_SAFE_FIX_SPECS[relativePath],
        };
      }

      return {
        relativePath,
        lineCount,
        clasificacion: lineCount <= 220 ? 'semiautomatico' : 'manual',
      };
    })
    .filter(Boolean);
}

function buildBackendGeneratedTasks(backendCandidates) {
  return backendCandidates.map((entry) => ({
    taskKey: `backend-error:${entry.relativePath}`,
    titulo: `Normalizar helper de errores en ${entry.relativePath}`,
    descripcion:
      'Extraer manejo de errores repetido a una utilidad backend pequeña y reutilizable.',
    areaObjetivo: 'backend',
    clasificacion: entry.clasificacion,
    categoriaFix: 'backend-controller-error-utility',
    archivosObjetivo:
      entry.clasificacion === 'seguro_automatico'
        ? [
            entry.relativePath,
            'straight-wire-backend/src/utils/controllerErrors.js',
          ]
        : [entry.relativePath],
    requiereRevision: entry.clasificacion !== 'seguro_automatico',
    fixPayload: {
      kind: 'backend-controller-error-utility',
      targetFile: entry.relativePath,
    },
  }));
}

function buildCrossAreaTasks(mobileTasks, backendTasks) {
  if (!mobileTasks.length || !backendTasks.length) {
    return [];
  }

  return [
    {
      taskKey: 'mobile-backend:contract-review',
      titulo: 'Revisar contrato mobile-backend de errores y servicios',
      descripcion:
        'Evaluar si conviene alinear wrappers mobile con utilidades backend para mantener contratos simples y auditables.',
      areaObjetivo: 'mobile-backend',
      clasificacion: 'manual',
      categoriaFix: 'mobile-backend-contract-review',
      archivosObjetivo: [
        'apps/mobile/src/lib/api.ts',
        'straight-wire-backend/src/controllers/clientJobs.controller.js',
      ],
      requiereRevision: true,
      fixPayload: {
        kind: 'mobile-backend-contract-review',
      },
    },
  ];
}

function materializeGeneratedTasks({
  tasks,
  generatedDir,
  existingTasks,
  nextTaskId,
  mode,
}) {
  const now = new Date().toISOString();
  const generatedTasks = [];

  for (const candidate of tasks) {
    const existingTask = existingTasks.byKey.get(candidate.taskKey);
    const id = existingTask ? existingTask.id : nextTaskId();
    const taskPath = path.join(generatedDir, `${id}.json`);
    const taskPayload = {
      id,
      titulo: candidate.titulo,
      descripcion: candidate.descripcion,
      modulo: candidate.areaObjetivo,
      estado: existingTask
        ? existingTask.estado
        : candidate.clasificacion === 'manual'
          ? 'requiere_revision'
          : 'pendiente',
      reintentos: existingTask ? existingTask.reintentos || 0 : 0,
      modo: mode,
      areaObjetivo: candidate.areaObjetivo,
      plataformaObjetivo:
        candidate.areaObjetivo === 'backend'
          ? 'node-express'
          : candidate.areaObjetivo === 'mobile-backend'
            ? 'react-native-expo + node-express'
            : 'react-native-expo',
      aplicacionObjetivo:
        candidate.areaObjetivo === 'backend'
          ? 'straight-wire-backend'
          : candidate.areaObjetivo === 'mobile-backend'
            ? 'apps/mobile + straight-wire-backend'
            : 'apps/mobile',
      creadoEn: existingTask ? existingTask.creadoEn : now,
      actualizadoEn: now,
      resumenResultado: existingTask
        ? existingTask.resumenResultado
        : 'Tarea generada y pendiente de orquestacion.',
      categoriaFix: candidate.categoriaFix,
      clasificacion: candidate.clasificacion,
      archivosObjetivo: candidate.archivosObjetivo,
      requiereRevision: candidate.requiereRevision,
      taskKind: 'generated',
      taskKey: candidate.taskKey,
      fixPayload: candidate.fixPayload,
      taskPath: `autodev-lab/tasks/generated/${id}.json`,
    };

    writeJson(taskPath, taskPayload);
    generatedTasks.push(taskPayload);
  }

  return generatedTasks.sort((left, right) =>
    String(left.id).localeCompare(String(right.id))
  );
}

function buildBacklogJson(generatedTasks) {
  return generatedTasks.map((task) => ({
    id: task.id,
    titulo: task.titulo,
    areaObjetivo: task.areaObjetivo,
    clasificacion: task.clasificacion,
    estado: task.estado,
    categoriaFix: task.categoriaFix,
    archivosObjetivo: task.archivosObjetivo,
    requiereRevision: task.requiereRevision,
  }));
}

function planExecutableTasks(task, logger, config) {
  const reportsDir = config.rutasAbsolutas.reportes;
  const generatedDir = path.join(config.rutasAbsolutas.tareas, 'generated');
  const backlogPath = path.join(reportsDir, 'executable-task-backlog.json');
  const mobileInspectionPath = path.join(reportsDir, 'mobile-inspection.md');
  const shouldIncludeMobile = task.areaObjetivo !== 'backend';
  const shouldIncludeBackend = task.areaObjetivo !== 'mobile';

  fs.mkdirSync(generatedDir, { recursive: true });

  let mobileBacklog = [];
  let inspectionScreens = [];

  if (shouldIncludeMobile) {
    const mobilePlanningSeed = {
      id: task.id,
      areaObjetivo: 'mobile',
      aplicacionObjetivo: 'apps/mobile',
      plataformaObjetivo: 'react-native-expo',
    };
    const mobilePlan = mobileFixPlanner.planMobileFixes(
      mobilePlanningSeed,
      logger,
      config
    );
    mobileBacklog = mobilePlan.backlog || [];
    inspectionScreens = parseInspectionScreens(mobileInspectionPath);
  }

  const backendCandidates = shouldIncludeBackend
    ? scanBackendControllers(config)
    : [];

  const mobileTasks = shouldIncludeMobile
    ? buildMobileGeneratedTasks(mobileBacklog, inspectionScreens)
    : [];
  const backendTasks = shouldIncludeBackend
    ? buildBackendGeneratedTasks(backendCandidates)
    : [];
  const crossAreaTasks =
    shouldIncludeMobile && shouldIncludeBackend
      ? buildCrossAreaTasks(mobileTasks, backendTasks)
      : [];

  const allCandidates = [...mobileTasks, ...backendTasks, ...crossAreaTasks];
  const existingTasks = loadExistingGeneratedTasks(generatedDir);
  const nextTaskId = nextTaskIdFactory(existingTasks.usedIds);
  const generatedTasks = materializeGeneratedTasks({
    tasks: allCandidates,
    generatedDir,
    existingTasks,
    nextTaskId,
    mode: 'SAFE_AUTODEV_EXECUTABLE_BACKLOG_MOBILE_BACKEND',
  });
  const backlogJson = buildBacklogJson(generatedTasks);

  writeJson(backlogPath, backlogJson);

  logger.info('TaskBacklogPlanner: backlog ejecutable generado.', {
    tareas: generatedTasks.length,
    mobile: mobileTasks.length,
    backend: backendTasks.length,
    mobileBackend: crossAreaTasks.length,
    ruta: backlogPath,
  });

  return {
    resumen: `TaskBacklogPlanner genero ${generatedTasks.length} tareas ejecutables (${mobileTasks.length} mobile, ${backendTasks.length} backend, ${crossAreaTasks.length} mobile-backend).`,
    generatedTasks,
    backlogPath,
    stats: {
      generatedCount: generatedTasks.length,
      mobileCount: mobileTasks.length,
      backendCount: backendTasks.length,
      crossAreaCount: crossAreaTasks.length,
    },
  };
}

module.exports = {
  planExecutableTasks,
};
