const fs = require('fs');
const path = require('path');

const CONTROLLER_ERRORS_MARKER = '// AutoDev managed backend controller error helpers';

const BACKEND_SAFE_FIX_SPECS = {
  'straight-wire-backend/src/controllers/clientJobs.controller.js': {
    importAnchor:
      "const { createJobForClientApi, listClientJobs } = require('../services/jobs.service');\n",
    importLine:
      "const { sendApiError, handleApiError } = require('../utils/controllerErrors');\n",
    functionBlock: `function sendError(res, status, error, message) {
  return res.status(status).json({ ok: false, error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code.toLowerCase() : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendError(res, status, error, message);
}
`,
  },
  'straight-wire-backend/src/controllers/employeeJobs.controller.js': {
    importAnchor: `const {
  listEmployeeJobsByFilter,
  acceptJobForStaff,
  updateJobStatusForStaff,
} = require('../services/jobs.service');
`,
    importLine:
      "const { sendApiError, handleApiError } = require('../utils/controllerErrors');\n",
    functionBlock: `function sendError(res, status, error, message) {
  return res.status(status).json({ ok: false, error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const error = err && typeof err.code === 'string' ? err.code.toLowerCase() : 'internal_error';
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';
  return sendError(res, status, error, message);
}
`,
  },
};

function buildControllerErrorsContent() {
  return [
    CONTROLLER_ERRORS_MARKER,
    'function sendApiError(res, status, error, message) {',
    "  return res.status(status).json({ ok: false, error, message });",
    '}',
    '',
    'function handleApiError(res, err) {',
    "  const status = err && typeof err.status === 'number' ? err.status : 500;",
    "  const error = err && typeof err.code === 'string' ? err.code.toLowerCase() : 'internal_error';",
    "  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Request failed.';",
    '  return sendApiError(res, status, error, message);',
    '}',
    '',
    'module.exports = {',
    '  sendApiError,',
    '  handleApiError,',
    '};',
    '',
  ].join('\n');
}

function ensureControllerErrorsUtil(filePath, changeTracker) {
  const nextContent = buildControllerErrorsContent();
  changeTracker.writeFile(filePath, nextContent, {
    accion: 'crear_o_actualizar_backend_controller_errors',
  });
}

function applyBackendSpec(filePath, spec, changeTracker) {
  const originalContent = fs.readFileSync(filePath, 'utf8');

  if (!originalContent.includes(spec.importAnchor)) {
    return {
      ok: false,
      motivo: 'No se encontro el bloque import esperado para aplicar el fix backend.',
    };
  }

  if (!originalContent.includes(spec.functionBlock)) {
    return {
      ok: false,
      motivo: 'No coincide el helper local sendError/handleError esperado.',
    };
  }

  const nextContent = originalContent
    .replace(spec.importAnchor, `${spec.importAnchor}${spec.importLine}`)
    .replace(spec.functionBlock, '')
    .replace(/\bsendError\(/g, 'sendApiError(')
    .replace(/\bhandleError\(/g, 'handleApiError(');

  changeTracker.writeFile(filePath, nextContent, {
    accion: 'normalizar_backend_controller_errors',
  });

  return {
    ok: true,
  };
}

function applyBackendSafeFix({
  selectedTask,
  logger,
  config,
  changeTracker,
}) {
  const targetFile = selectedTask?.fixPayload?.targetFile;
  const spec = targetFile ? BACKEND_SAFE_FIX_SPECS[targetFile] : null;

  if (!spec) {
    return {
      resumen: 'La tarea backend no coincide con un patron seguro soportado.',
      appliedFixes: [],
      omittedFixes: [
        {
          archivo: targetFile || 'sin_archivo',
          motivo: 'Patron backend no soportado para autofix seguro.',
        },
      ],
      changeSummary: changeTracker.getSummary(),
      fixSummary: {
        findingsCount: 1,
        fixesApplied: 0,
        modifiedFiles: [],
        omittedFiles: [targetFile || 'sin_archivo'],
      },
      nextRecommendations: [
        'Revisar manualmente el controlador backend antes de automatizarlo.',
      ],
    };
  }

  const controllerPath = path.resolve(config.repoRoot, targetFile);
  const utilPath = path.resolve(
    config.repoRoot,
    'straight-wire-backend/src/utils/controllerErrors.js'
  );

  changeTracker.recordAnalyzedFile(controllerPath);
  changeTracker.recordAnalyzedFile(utilPath);

  ensureControllerErrorsUtil(utilPath, changeTracker);

  const result = applyBackendSpec(controllerPath, spec, changeTracker);
  if (!result.ok) {
    const omitted = {
      archivo: targetFile,
      motivo: result.motivo,
    };
    changeTracker.recordOmitted(omitted);
    return {
      resumen: `No se aplico el fix backend en ${targetFile}.`,
      appliedFixes: [],
      omittedFixes: [omitted],
      changeSummary: changeTracker.getSummary(),
      fixSummary: {
        findingsCount: 1,
        fixesApplied: 0,
        modifiedFiles: [],
        omittedFiles: [targetFile],
      },
      nextRecommendations: [
        'Ajustar el spec backend si el controlador fue modificado manualmente.',
      ],
    };
  }

  const changeSummary = changeTracker.getSummary();

  logger.info('BackendSafeFixer: fix aplicado.', {
    tarea: selectedTask.id,
    archivosModificados: changeSummary.modifiedFiles,
  });

  return {
    resumen: `BackendSafeFixer aplico una normalizacion segura en ${targetFile}.`,
    appliedFixes: [
      {
        archivo: targetFile,
        accion: 'extraer sendError/handleError a util compartida',
      },
    ],
    omittedFixes: [],
    changeSummary,
    fixSummary: {
      findingsCount: 1,
      fixesApplied: 1,
      modifiedFiles: changeSummary.modifiedFiles,
      omittedFiles: [],
    },
    nextRecommendations: [
      'Extender la utilidad solo a controladores backend pequenos con helper identico.',
    ],
  };
}

module.exports = {
  applyBackendSafeFix,
};
