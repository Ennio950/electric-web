const fs = require('fs');
const path = require('path');

const SERVICE_FILE_MARKER = '// AutoDev managed API service wrappers';

const SAFE_FIX_SPECS = {
  'app/(client)/requests/index.tsx': {
    serviceFunction: 'loadClientRequests',
    serviceFactory: `export function loadClientRequests() {
  return withCurrentToken(fetchClientRequests);
}
`,
    importFrom: `import { fetchClientRequests, withCurrentToken } from '@/src/lib/api';`,
    importTo: `import { loadClientRequests } from '@/src/services/apiService';`,
    queryFrom: `queryFn: () => withCurrentToken(fetchClientRequests),`,
    queryTo: `queryFn: loadClientRequests,`,
  },
  'app/(client)/emergency/index.tsx': {
    serviceFunction: 'loadClientEmergencyCalls',
    serviceFactory: `export function loadClientEmergencyCalls() {
  return withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' }));
}
`,
    importFrom: `import { fetchEmergencyCalls, withCurrentToken } from '@/src/lib/api';`,
    importTo: `import { loadClientEmergencyCalls } from '@/src/services/apiService';`,
    queryFrom: `queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),`,
    queryTo: `queryFn: loadClientEmergencyCalls,`,
  },
  'app/(employee)/emergency/new.tsx': {
    serviceFunction: 'loadEmployeeEmergencyCalls',
    serviceFactory: `export function loadEmployeeEmergencyCalls() {
  return withCurrentToken((token) => fetchEmergencyCalls(token));
}
`,
    importFrom: `import { fetchEmergencyCalls, withCurrentToken } from '@/src/lib/api';`,
    importTo: `import { loadEmployeeEmergencyCalls } from '@/src/services/apiService';`,
    queryFrom: `queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token)),`,
    queryTo: `queryFn: loadEmployeeEmergencyCalls,`,
  },
};

function buildServiceContent(selectedSpecs) {
  const requiredImports = ['fetchClientRequests', 'fetchEmergencyCalls', 'withCurrentToken']
    .filter((name) =>
      selectedSpecs.some((spec) => spec.serviceFactory.includes(name))
    );

  return [
    SERVICE_FILE_MARKER,
    'import {',
    ...requiredImports.map((name) => `  ${name},`),
    "} from '@/src/lib/api';",
    '',
    ...selectedSpecs.map((spec) => spec.serviceFactory.trimEnd()),
    '',
  ].join('\n');
}

function readExistingManagedServiceSpecs(serviceFilePath) {
  if (!fs.existsSync(serviceFilePath)) {
    return {
      ok: true,
      specs: [],
    };
  }

  const currentContent = fs.readFileSync(serviceFilePath, 'utf8');
  if (!currentContent.includes(SERVICE_FILE_MARKER)) {
    return {
      ok: false,
      motivo:
        'El archivo src/services/apiService.ts ya existe y no esta gestionado por AutoDev.',
    };
  }

  const specs = Object.values(SAFE_FIX_SPECS).filter((spec) =>
    currentContent.includes(`export function ${spec.serviceFunction}()`)
  );

  return {
    ok: true,
    specs,
  };
}

function mergeServiceSpecs(serviceFilePath, selectedSpecs) {
  const existing = readExistingManagedServiceSpecs(serviceFilePath);
  if (!existing.ok) {
    return existing;
  }

  const mergedByFunction = new Map();
  for (const spec of [...existing.specs, ...selectedSpecs]) {
    mergedByFunction.set(spec.serviceFunction, spec);
  }

  return {
    ok: true,
    specs: [...mergedByFunction.values()],
  };
}

function upsertManagedServiceFile(serviceFilePath, selectedSpecs, changeTracker) {
  const merged = mergeServiceSpecs(serviceFilePath, selectedSpecs);
  if (!merged.ok) {
    return merged;
  }

  const serviceContent = buildServiceContent(
    merged.specs.sort((left, right) =>
      left.serviceFunction.localeCompare(right.serviceFunction)
    )
  );

  changeTracker.writeFile(serviceFilePath, serviceContent, {
    accion: 'crear_o_actualizar_servicio_api',
  });

  return {
    ok: true,
  };
}

function applySpecToFile(filePath, spec, changeTracker) {
  const originalContent = fs.readFileSync(filePath, 'utf8');

  if (!originalContent.includes(spec.importFrom)) {
    return {
      ok: false,
      motivo: 'Import exacto no encontrado; posible cambio manual previo.',
    };
  }

  if (!originalContent.includes(spec.queryFrom)) {
    return {
      ok: false,
      motivo: 'Patron queryFn no coincide con el fix seguro soportado.',
    };
  }

  const nextContent = originalContent
    .replace(spec.importFrom, spec.importTo)
    .replace(spec.queryFrom, spec.queryTo);

  changeTracker.writeFile(filePath, nextContent, {
    accion: 'extraer_wrapper_api_seguro',
    serviceFunction: spec.serviceFunction,
  });

  return {
    ok: true,
  };
}

function applyMobileSafeFixes({
  task,
  planning,
  selectedTask,
  logger,
  config,
  changeTracker,
}) {
  const mobileRoot = path.resolve(config.repoRoot, task.aplicacionObjetivo);
  const serviceFilePath = path.join(mobileRoot, 'src', 'services', 'apiService.ts');
  const maxProductiveFiles =
    config.limites?.mobile?.maxArchivosProductivosPorEjecucion || 3;
  const maxScreenFixes = Math.max(0, maxProductiveFiles - 1);
  const safeCandidates = selectedTask
    ? [
        {
          archivo: selectedTask.fixPayload?.targetFile,
          clasificacion: selectedTask.clasificacion,
        },
      ].filter(
        (entry) =>
          entry.archivo &&
          entry.clasificacion === 'seguro_automatico' &&
          SAFE_FIX_SPECS[entry.archivo]
      )
    : (planning.backlog || []).filter(
        (entry) =>
          entry.clasificacion === 'seguro_automatico' &&
          SAFE_FIX_SPECS[entry.archivo]
      );
  const selectedCandidates = selectedTask
    ? safeCandidates.slice(0, 1)
    : safeCandidates.slice(0, maxScreenFixes);
  const appliedFixes = [];
  const omittedFixes = [];

  for (const entry of selectedTask
    ? selectedCandidates
    : planning.backlog || []) {
    if (entry.archivo && (entry.archivo.startsWith('app/') || entry.archivo.startsWith('src/'))) {
      changeTracker.recordAnalyzedFile(path.join(mobileRoot, entry.archivo));
    }
  }

  if (!selectedCandidates.length) {
    return {
      resumen: `No se aplicaron fixes seguros. Hallazgos detectados: ${(planning.backlog || []).length}.`,
      appliedFixes,
      omittedFixes,
      fixSummary: {
        findingsCount: selectedTask ? 1 : (planning.backlog || []).length,
        fixesApplied: 0,
        modifiedFiles: [],
        omittedFiles: [],
        backlogPath: planning.backlogPath,
      },
      changeSummary: changeTracker.getSummary(),
      nextRecommendations: [
        'Revisar manualmente los hallazgos semiautomaticos y manuales antes de tocar pantallas complejas.',
      ],
    };
  }

  const serviceResult = upsertManagedServiceFile(
    serviceFilePath,
    selectedCandidates.map((entry) => SAFE_FIX_SPECS[entry.archivo]),
    changeTracker
  );
  if (!serviceResult.ok) {
    const omitted = {
      archivo: 'src/services/apiService.ts',
      motivo: serviceResult.motivo,
    };
    omittedFixes.push(omitted);
    changeTracker.recordOmitted(omitted);
    return {
      resumen: 'No se aplicaron fixes seguros porque el servicio API existente requiere revision manual.',
      appliedFixes,
      omittedFixes,
      fixSummary: {
        findingsCount: selectedTask ? 1 : (planning.backlog || []).length,
        fixesApplied: 0,
        modifiedFiles: [],
        omittedFiles: omittedFixes.map((item) => item.archivo),
        backlogPath: planning.backlogPath,
      },
      changeSummary: changeTracker.getSummary(),
      nextRecommendations: [
        'Revisar manualmente src/services/apiService.ts antes de mezclar nuevos wrappers gestionados por AutoDev.',
      ],
    };
  }

  for (const entry of selectedCandidates) {
    const spec = SAFE_FIX_SPECS[entry.archivo];
    const absolutePath = path.join(mobileRoot, entry.archivo);
    const result = applySpecToFile(absolutePath, spec, changeTracker);

    if (!result.ok) {
      const omitted = {
        archivo: entry.archivo,
        motivo: result.motivo,
      };
      omittedFixes.push(omitted);
      changeTracker.recordOmitted(omitted);
      continue;
    }

    appliedFixes.push({
      archivo: entry.archivo,
      accion: `import actualizado a ${spec.serviceFunction}()`,
    });
  }

  for (const entry of safeCandidates.slice(selectedCandidates.length)) {
    const omitted = {
      archivo: entry.archivo,
      motivo: `Se excederia el limite de ${maxProductiveFiles} archivos productivos por ejecucion.`,
    };
    omittedFixes.push(omitted);
    changeTracker.recordOmitted(omitted);
  }

  if (!selectedTask) {
    for (const entry of (planning.backlog || []).filter(
      (item) => item.clasificacion !== 'seguro_automatico'
    )) {
      omittedFixes.push({
        archivo: entry.archivo,
        motivo: entry.motivo,
      });
    }
  }

  const changeSummary = changeTracker.getSummary();
  const fixesApplied = appliedFixes.length;

  logger.info('MobileSafeFixer: ejecucion completada.', {
    hallazgos: (planning.backlog || []).length,
    fixesAplicados: fixesApplied,
    archivosModificados: changeSummary.modifiedFiles,
    archivosOmitidos: omittedFixes.length,
  });

  return {
    resumen: `MobileSafeFixer analizo ${selectedTask ? 1 : (planning.backlog || []).length} hallazgos y aplico ${fixesApplied} fixes seguros.`,
    appliedFixes,
    omittedFixes,
    changeSummary,
    fixSummary: {
      findingsCount: selectedTask ? 1 : (planning.backlog || []).length,
      fixesApplied,
      modifiedFiles: changeSummary.modifiedFiles,
      omittedFiles: omittedFixes.map((item) => item.archivo),
      backlogPath: planning.backlogPath,
    },
    nextRecommendations: [
      'Extender el fixer a wrappers de requests y emergency adicionales solo cuando el patron siga siendo exacto y pequeno.',
      'Mantener el limite de archivos productivos por corrida para conservar reversibilidad.',
    ],
  };
}

module.exports = {
  applyMobileSafeFixes,
};
