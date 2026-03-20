const fs = require('fs');
const path = require('path');

const SAFE_LINE_LIMIT = 220;
const SEMI_AUTOMATIC_LINE_LIMIT = 360;

const SUPPORTED_SAFE_PATTERNS = {
  'app/(client)/requests/index.tsx': {
    serviceFunction: 'loadClientRequests',
    accionSugerida: 'extraer a src/services/apiService.ts',
  },
  'app/(client)/emergency/index.tsx': {
    serviceFunction: 'loadClientEmergencyCalls',
    accionSugerida: 'extraer a src/services/apiService.ts',
  },
  'app/(employee)/emergency/new.tsx': {
    serviceFunction: 'loadEmployeeEmergencyCalls',
    accionSugerida: 'extraer a src/services/apiService.ts',
  },
};

function parseQuotedPath(line) {
  const match = line.match(/`([^`]+)`/);
  return match ? match[1] : null;
}

function parseInspectionReport(reportContent) {
  const lines = reportContent.split(/\r?\n/);
  const screenMetrics = new Map();
  const apiFiles = [];

  for (const line of lines) {
    const screenMatch = line.match(
      /^- `([^`]+)` -> `([^`]+)` \((\d+) lineas, hooks: (.+)\)$/
    );

    if (screenMatch) {
      const expoRoute = screenMatch[1];
      const reportRelativePath = screenMatch[2];
      const lineCount = Number(screenMatch[3]);
      const hooks = screenMatch[4] === 'ninguno'
        ? []
        : screenMatch[4].split(',').map((hook) => hook.trim());
      const repoRelativePath =
        reportRelativePath.startsWith('app/') || reportRelativePath.startsWith('src/')
          ? reportRelativePath
          : `app/${reportRelativePath}`;

      screenMetrics.set(repoRelativePath, {
        expoRoute,
        lineCount,
        hooks,
      });
      continue;
    }

    if (/imports relacionados/.test(line)) {
      const quotedPath = parseQuotedPath(line);
      if (quotedPath) {
        apiFiles.push(quotedPath);
      }
    }
  }

  return {
    screenMetrics,
    apiFiles,
  };
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function detectApiImportInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const apiImportLine = content
    .split(/\r?\n/)
    .find((line) => line.includes(`@/src/lib/api`));

  if (!apiImportLine) {
    return null;
  }

  const importMatch = apiImportLine.match(/import\s*{([^}]+)}\s*from\s*['"]@\/src\/lib\/api['"]/);
  const imports = importMatch
    ? importMatch[1]
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];

  return {
    apiImportLine,
    imports,
    content,
  };
}

function classifyEntry({ lineCount, supportedPattern }) {
  if (supportedPattern && lineCount <= SAFE_LINE_LIMIT) {
    return 'seguro_automatico';
  }

  if (lineCount <= SEMI_AUTOMATIC_LINE_LIMIT) {
    return 'semiautomatico';
  }

  return 'manual';
}

function planMobileFixes(task, logger, config) {
  const reportPath = path.join(
    config.rutasAbsolutas.reportes,
    'mobile-inspection.md'
  );
  const backlogPath = path.join(
    config.rutasAbsolutas.reportes,
    'mobile-fix-backlog.json'
  );
  const mobileRoot = path.resolve(config.repoRoot, task.aplicacionObjetivo);

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Inspection report not found: ${reportPath}`);
  }

  logger.info('MobileFixPlanner: leyendo reporte de inspeccion.', {
    ruta: reportPath,
  });

  const reportContent = fs.readFileSync(reportPath, 'utf8');
  const parsed = parseInspectionReport(reportContent);
  const backlog = [];
  let nextId = 1;

  for (const relativePath of parsed.apiFiles) {
    const cleanRelativePath = relativePath.replace(/^apps\/mobile\//, '');
    const absolutePath = path.join(mobileRoot, cleanRelativePath);

    if (!fs.existsSync(absolutePath)) {
      backlog.push({
        id: `fix-${String(nextId).padStart(3, '0')}`,
        tipo: 'api_directa_repetida',
        archivo: cleanRelativePath,
        clasificacion: 'manual',
        accionSugerida: 'revisar archivo no encontrado',
        motivo: 'El archivo reportado ya no existe.',
      });
      nextId += 1;
      continue;
    }

    const metrics =
      parsed.screenMetrics.get(cleanRelativePath) || {
        lineCount: readLines(absolutePath),
        hooks: [],
      };
    const apiInfo = detectApiImportInfo(absolutePath);
    const supportedPattern = SUPPORTED_SAFE_PATTERNS[cleanRelativePath] || null;
    const clasificacion = classifyEntry({
      lineCount: metrics.lineCount,
      supportedPattern,
    });

    backlog.push({
      id: `fix-${String(nextId).padStart(3, '0')}`,
      tipo: 'api_directa_repetida',
      archivo: cleanRelativePath,
      clasificacion,
      accionSugerida:
        supportedPattern?.accionSugerida ||
        'extraer a src/services por feature antes de tocar la pantalla',
      serviceFunction: supportedPattern ? supportedPattern.serviceFunction : null,
      lineas: metrics.lineCount,
      imports: apiInfo ? apiInfo.imports : [],
      motivo:
        clasificacion === 'manual'
          ? 'La pantalla supera el umbral seguro o no coincide con un patron soportado.'
          : clasificacion === 'semiautomatico'
            ? 'La pantalla requiere extraccion controlada, pero no coincide con un patron seguro exacto.'
            : 'Patron soportado para extraer wrapper de servicio minimo.',
    });
    nextId += 1;
  }

  const directFetchMatch = reportContent.match(/`src\/lib\/imageUpload\.ts` \(fetch: (\d+), axios: (\d+)\)/);
  if (directFetchMatch) {
    backlog.push({
      id: `fix-${String(nextId).padStart(3, '0')}`,
      tipo: 'fetch_directo',
      archivo: 'src/lib/imageUpload.ts',
      clasificacion: 'manual',
      accionSugerida: 'revisar si conviene extraer helper comun de upload sin tocar el flujo actual',
      motivo: 'El fetch directo existe fuera del cliente API principal y no entra en el fix seguro de esta ejecucion.',
    });
  }

  fs.writeFileSync(backlogPath, JSON.stringify(backlog, null, 2), 'utf8');

  const safeCount = backlog.filter(
    (entry) => entry.clasificacion === 'seguro_automatico'
  ).length;
  const semiCount = backlog.filter(
    (entry) => entry.clasificacion === 'semiautomatico'
  ).length;
  const manualCount = backlog.filter(
    (entry) => entry.clasificacion === 'manual'
  ).length;

  logger.info('MobileFixPlanner: backlog generado.', {
    hallazgos: backlog.length,
    seguroAutomatico: safeCount,
    semiautomatico: semiCount,
    manual: manualCount,
    ruta: backlogPath,
  });

  return {
    resumen: `Backlog de mobile fixes generado con ${backlog.length} hallazgos (${safeCount} seguros, ${semiCount} semiautomaticos, ${manualCount} manuales).`,
    backlog,
    backlogPath,
    manualRecommendations: backlog
      .filter((entry) => entry.clasificacion !== 'seguro_automatico')
      .slice(0, 10)
      .map(
        (entry) => `${entry.archivo}: ${entry.accionSugerida} (${entry.clasificacion})`
      ),
    stats: {
      findingsCount: backlog.length,
      safeCount,
      semiCount,
      manualCount,
    },
  };
}

module.exports = {
  planMobileFixes,
};
