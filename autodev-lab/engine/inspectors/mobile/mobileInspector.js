const fs = require('fs');
const path = require('path');

const LARGE_SCREEN_LINE_THRESHOLD = 220;
const COMPLEX_SCREEN_HOOK_THRESHOLD = 8;
const COMPLEX_SCREEN_QUERY_THRESHOLD = 4;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isRouteGroup(segment) {
  return /^\(.+\)$/.test(segment);
}

function stripRouteGroup(segment) {
  return segment.replace(/^\((.+)\)$/, '$1');
}

function listFilesRecursive(directoryPath, extensions) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath, extensions));
      continue;
    }

    if (!extensions || extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
}

function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function extractHooks(content) {
  const hookMatches = content.match(/\buse[A-Z][A-Za-z0-9_]*\b/g) || [];
  const hookCounts = {};

  for (const hookName of hookMatches) {
    hookCounts[hookName] = (hookCounts[hookName] || 0) + 1;
  }

  return hookCounts;
}

function normalizeSegments(relativeFilePath) {
  return toPosix(relativeFilePath).split('/');
}

function resolveRouteInfo(appDir, filePath) {
  const relativePath = path.relative(appDir, filePath);
  const segments = normalizeSegments(relativePath);
  const fileName = segments[segments.length - 1];
  const fileBaseName = fileName.replace(/\.(tsx|ts)$/, '');
  const directorySegments = segments.slice(0, -1);
  const routeGroupNames = directorySegments.filter(isRouteGroup).map(stripRouteGroup);
  const expoSegments = [...directorySegments];
  const urlSegments = directorySegments.filter((segment) => !isRouteGroup(segment));

  if (fileBaseName !== 'index' && fileBaseName !== '_layout') {
    expoSegments.push(fileBaseName);
    urlSegments.push(fileBaseName);
  }

  const expoRoute = expoSegments.length ? `/${expoSegments.join('/')}` : '/';
  const urlPath = urlSegments.length ? `/${urlSegments.join('/')}` : '/';
  const dynamicSegments = urlSegments.filter((segment) => /^\[.+\]$/.test(segment));

  return {
    relativePath: toPosix(relativePath),
    fileName,
    fileBaseName,
    expoRoute,
    urlPath,
    routeGroupNames,
    dynamicSegments,
    isLayout: fileBaseName === '_layout',
    isDynamicRoute: dynamicSegments.length > 0,
  };
}

function analyzeFile(filePath, mobileRoot, appDir) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lineCount = content.split(/\r?\n/).length;
  const relativeToMobileRoot = toPosix(path.relative(mobileRoot, filePath));
  const hookCounts = extractHooks(content);
  const hookNames = Object.keys(hookCounts).sort();
  const totalHookOccurrences = Object.values(hookCounts).reduce(
    (total, count) => total + count,
    0
  );
  const fetchCount = countMatches(content, /\bfetch\s*\(/g);
  const axiosCount =
    countMatches(content, /\baxios\s*\(/g) +
    countMatches(content, /\baxios\.(get|post|put|patch|delete)\s*\(/g);
  const apiImportCount = countMatches(
    content,
    /from\s+['"][^'"]*lib\/api(?:\.ts)?['"]|require\(['"][^'"]*lib\/api(?:\.ts)?['"]\)/g
  );
  const reactQueryImportCount = countMatches(content, /@tanstack\/react-query/g);
  const zustandImportCount = countMatches(content, /['"]zustand(?:\/[^'"]*)?['"]/g);
  const asNeverCount = countMatches(content, /\bas never\b/g);
  const explicitAnyCount =
    countMatches(content, /\bany\b/g) +
    countMatches(content, /@ts-ignore|@ts-expect-error/g);
  const routeInfo = filePath.startsWith(appDir)
    ? resolveRouteInfo(appDir, filePath)
    : null;

  return {
    filePath,
    relativeToMobileRoot,
    lineCount,
    hookCounts,
    hookNames,
    totalHookOccurrences,
    fetchCount,
    axiosCount,
    apiImportCount,
    reactQueryImportCount,
    zustandImportCount,
    asNeverCount,
    explicitAnyCount,
    queryMutationCount:
      (hookCounts.useQuery || 0) +
      (hookCounts.useMutation || 0) +
      (hookCounts.useInfiniteQuery || 0),
    routeInfo,
  };
}

function aggregateHooks(fileAnalyses) {
  const hookMap = new Map();

  for (const analysis of fileAnalyses) {
    for (const [hookName, occurrences] of Object.entries(analysis.hookCounts)) {
      const current = hookMap.get(hookName) || {
        nombre: hookName,
        ocurrencias: 0,
        archivos: [],
      };

      current.ocurrencias += occurrences;
      current.archivos.push(analysis.relativeToMobileRoot);
      hookMap.set(hookName, current);
    }
  }

  return [...hookMap.values()]
    .map((entry) => ({
      ...entry,
      archivos: [...new Set(entry.archivos)].sort(),
      cantidadArchivos: new Set(entry.archivos).size,
    }))
    .sort((left, right) => {
      if (right.ocurrencias !== left.ocurrencias) {
        return right.ocurrencias - left.ocurrencias;
      }
      return left.nombre.localeCompare(right.nombre);
    });
}

function aggregateApiUsage(fileAnalyses) {
  const directNetworkFiles = fileAnalyses
    .filter((analysis) => analysis.fetchCount > 0 || analysis.axiosCount > 0)
    .map((analysis) => ({
      archivo: analysis.relativeToMobileRoot,
      fetch: analysis.fetchCount,
      axios: analysis.axiosCount,
    }))
    .sort((left, right) => {
      const leftTotal = left.fetch + left.axios;
      const rightTotal = right.fetch + right.axios;
      return rightTotal - leftTotal || left.archivo.localeCompare(right.archivo);
    });

  const apiImportFiles = fileAnalyses
    .filter((analysis) => analysis.apiImportCount > 0)
    .map((analysis) => ({
      archivo: analysis.relativeToMobileRoot,
      imports: analysis.apiImportCount,
    }))
    .sort((left, right) => right.imports - left.imports || left.archivo.localeCompare(right.archivo));

  return {
    totalFetchCalls: directNetworkFiles.reduce((total, file) => total + file.fetch, 0),
    totalAxiosCalls: directNetworkFiles.reduce((total, file) => total + file.axios, 0),
    totalApiImportFiles: apiImportFiles.length,
    directNetworkFiles,
    apiImportFiles,
  };
}

function summarizeState(fileAnalyses) {
  const zustandStoreFiles = fileAnalyses
    .filter((analysis) => analysis.zustandImportCount > 0)
    .map((analysis) => analysis.relativeToMobileRoot)
    .sort();

  const reactQueryFiles = fileAnalyses
    .filter((analysis) => analysis.reactQueryImportCount > 0)
    .map((analysis) => analysis.relativeToMobileRoot)
    .sort();

  return {
    zustandStoreFiles,
    reactQueryFiles,
  };
}

function detectLargeScreens(screenAnalyses) {
  return screenAnalyses
    .filter((analysis) => analysis.lineCount > LARGE_SCREEN_LINE_THRESHOLD)
    .sort((left, right) => right.lineCount - left.lineCount)
    .map((analysis) => ({
      archivo: analysis.relativeToMobileRoot,
      expoRoute: analysis.routeInfo.expoRoute,
      lineas: analysis.lineCount,
    }));
}

function detectComplexScreens(screenAnalyses) {
  return screenAnalyses
    .filter(
      (analysis) =>
        analysis.totalHookOccurrences >= COMPLEX_SCREEN_HOOK_THRESHOLD ||
        analysis.queryMutationCount >= COMPLEX_SCREEN_QUERY_THRESHOLD
    )
    .sort((left, right) => {
      if (right.queryMutationCount !== left.queryMutationCount) {
        return right.queryMutationCount - left.queryMutationCount;
      }
      return right.totalHookOccurrences - left.totalHookOccurrences;
    })
    .map((analysis) => ({
      archivo: analysis.relativeToMobileRoot,
      expoRoute: analysis.routeInfo.expoRoute,
      totalHooks: analysis.totalHookOccurrences,
      consultasYMutaciones: analysis.queryMutationCount,
    }));
}

function detectRouteOverlap(screens) {
  const routeUsage = new Map();

  for (const screen of screens) {
    const key = screen.routeInfo.urlPath;
    const current = routeUsage.get(key) || {
      ruta: key,
      grupos: new Set(),
      archivos: [],
    };

    for (const groupName of screen.routeInfo.routeGroupNames) {
      current.grupos.add(groupName);
    }

    current.archivos.push(screen.relativeToMobileRoot);
    routeUsage.set(key, current);
  }

  return [...routeUsage.values()]
    .filter((entry) => entry.grupos.size > 1)
    .map((entry) => ({
      ruta: entry.ruta,
      grupos: [...entry.grupos].sort(),
      archivos: entry.archivos.sort(),
    }))
    .sort((left, right) => left.ruta.localeCompare(right.ruta));
}

function detectTypeFriction(fileAnalyses) {
  return fileAnalyses
    .filter((analysis) => analysis.asNeverCount > 0 || analysis.explicitAnyCount > 0)
    .sort((left, right) => {
      const leftTotal = left.asNeverCount + left.explicitAnyCount;
      const rightTotal = right.asNeverCount + right.explicitAnyCount;
      return rightTotal - leftTotal || left.relativeToMobileRoot.localeCompare(right.relativeToMobileRoot);
    })
    .map((analysis) => ({
      archivo: analysis.relativeToMobileRoot,
      asNever: analysis.asNeverCount,
      anyExplicito: analysis.explicitAnyCount,
    }));
}

function buildRouteTree(screens, layouts) {
  const lines = [];

  lines.push('- `/`');

  const groupNames = [...new Set(layouts.flatMap((layout) => layout.routeInfo.routeGroupNames))].sort();
  for (const groupName of groupNames) {
    lines.push(`  - Grupo \`(${groupName})\``);

    const groupScreens = screens
      .filter((screen) => screen.routeInfo.routeGroupNames.includes(groupName))
      .sort((left, right) => left.routeInfo.expoRoute.localeCompare(right.routeInfo.expoRoute));

    for (const screen of groupScreens) {
      const suffix = screen.routeInfo.isDynamicRoute ? ' dinamica' : ' estatica';
      lines.push(
        `    - \`${screen.routeInfo.expoRoute}\` -> \`${screen.routeInfo.relativePath}\` (${suffix})`
      );
    }
  }

  const rootScreens = screens
    .filter((screen) => screen.routeInfo.routeGroupNames.length === 0)
    .sort((left, right) => left.routeInfo.expoRoute.localeCompare(right.routeInfo.expoRoute));

  if (rootScreens.length > 0) {
    lines.push('  - Rutas sin grupo');
    for (const screen of rootScreens) {
      lines.push(
        `    - \`${screen.routeInfo.expoRoute}\` -> \`${screen.routeInfo.relativePath}\``
      );
    }
  }

  return lines.join('\n');
}

function formatList(items, formatter, emptyLabel) {
  if (!items.length) {
    return `- ${emptyLabel}`;
  }

  return items.map((item) => `- ${formatter(item)}`).join('\n');
}

function buildProblemStatements(analysis) {
  const problems = [];

  if (analysis.largeScreens.length > 0) {
    const topLarge = analysis.largeScreens
      .slice(0, 5)
      .map((screen) => `${screen.archivo} (${screen.lineas} lineas)`)
      .join(', ');

    problems.push(
      `Pantallas grandes detectadas por encima de ${LARGE_SCREEN_LINE_THRESHOLD} lineas: ${topLarge}.`
    );
  }

  if (analysis.complexScreens.length > 0) {
    const topComplex = analysis.complexScreens
      .slice(0, 5)
      .map(
        (screen) =>
          `${screen.archivo} (${screen.consultasYMutaciones} consultas/mutaciones, ${screen.totalHooks} hooks)`
      )
      .join(', ');

    problems.push(`Pantallas con mucha logica local y hooks repetidos: ${topComplex}.`);
  }

  if (analysis.routeOverlap.length > 0) {
    const overlapping = analysis.routeOverlap
      .slice(0, 5)
      .map((entry) => `${entry.ruta} en ${entry.grupos.join(', ')}`)
      .join(', ');

    problems.push(`Rutas funcionalmente parecidas repartidas entre grupos: ${overlapping}.`);
  }

  const directScreenApiImports = analysis.screenAnalyses.filter(
    (screen) => screen.apiImportCount > 0
  );
  if (directScreenApiImports.length > 0) {
    problems.push(
      `${directScreenApiImports.length} pantallas importan el cliente API directamente; conviene extraer hooks o servicios por feature.`
    );
  }

  const directNetworkOutsideApi = analysis.apiUsage.directNetworkFiles.filter(
    (entry) =>
      entry.archivo !== 'src/lib/api.ts' && !entry.archivo.startsWith('src/lib/')
  );
  if (directNetworkOutsideApi.length > 0) {
    const fileList = directNetworkOutsideApi
      .slice(0, 5)
      .map((entry) => entry.archivo)
      .join(', ');
    problems.push(`Hay llamadas de red fuera de la capa central api.ts: ${fileList}.`);
  }

  const typeFriction = analysis.typeFriction.filter(
    (entry) => entry.asNever > 0 || entry.anyExplicito > 0
  );
  if (typeFriction.length > 0) {
    const fileList = typeFriction
      .slice(0, 5)
      .map((entry) => `${entry.archivo} (as never: ${entry.asNever}, any: ${entry.anyExplicito})`)
      .join(', ');
    problems.push(`Se detecto friccion de tipado y casts de navegacion: ${fileList}.`);
  }

  if (problems.length === 0) {
    problems.push(
      'No se detectaron problemas fuertes con las heuristicas actuales, pero el analisis es estatico y debe complementarse con validacion funcional.'
    );
  }

  return problems;
}

function buildRecommendations(analysis) {
  const recommendations = [
    'Extraer hooks por feature para rutas con varias consultas o mutaciones, especialmente en flujos de requests, emergency y boss.',
    'Dividir pantallas grandes en componentes presentacionales y contenedores de datos para reducir el peso de cada screen.',
    'Centralizar helpers de navegacion tipada para reducir el uso de casts `as never` con Expo Router.',
    'Revisar rutas duplicadas entre grupos para consolidar UI y reutilizar logica compartida.',
  ];

  if (analysis.state.reactQueryFiles.length > 0) {
    recommendations.push(
      'Aprovechar mejor `src/hooks/` para encapsular React Query y evitar que las pantallas importen directamente el cliente API.'
    );
  }

  if (analysis.state.zustandStoreFiles.length > 0) {
    recommendations.push(
      'Definir limites claros entre estado global en Zustand y estado remoto en React Query para evitar mezclar responsabilidades.'
    );
  }

  return recommendations;
}

function buildBacklog(analysis) {
  const backlog = [];

  backlog.push(
    'Crear hooks de dominio para requests y emergency, reemplazando imports directos de `src/lib/api.ts` en pantallas.'
  );
  backlog.push(
    'Refactorizar las pantallas mas grandes detectadas por el inspector en componentes y hooks reutilizables.'
  );
  backlog.push(
    'Introducir un helper tipado para `router.push` y `router.replace` que elimine la mayoria de `as never`.'
  );
  backlog.push(
    'Consolidar patrones repetidos entre `client`, `employee` y `boss` en componentes compartidos.'
  );
  backlog.push(
    'Agregar una segunda pasada del inspector para correlacionar rutas con servicios, stores y hooks custom por feature.'
  );

  if (analysis.routeOverlap.length > 0) {
    backlog.push(
      `Auditar rutas compartidas entre grupos (${analysis.routeOverlap
        .slice(0, 3)
        .map((entry) => entry.ruta)
        .join(', ')}) para detectar logica duplicada.`
    );
  }

  return backlog;
}

function buildReportContent(analysis) {
  const routeGroupsMarkdown = formatList(
    analysis.routeGroups,
    (groupName) => `\`(${groupName})\``,
    'No se detectaron grupos de rutas.'
  );

  const layoutsMarkdown = formatList(
    analysis.layouts,
    (layout) =>
      `\`${layout.routeInfo.relativePath}\` -> \`${layout.routeInfo.expoRoute}\``,
    'No se detectaron layouts.'
  );

  const screensMarkdown = formatList(
    analysis.screenAnalyses,
    (screen) =>
      `\`${screen.routeInfo.expoRoute}\` -> \`${screen.routeInfo.relativePath}\` (${screen.lineCount} lineas, hooks: ${
        screen.hookNames.length ? screen.hookNames.join(', ') : 'ninguno'
      })`,
    'No se detectaron pantallas.'
  );

  const hooksMarkdown = formatList(
    analysis.hooks.slice(0, 20),
    (hook) =>
      `\`${hook.nombre}\` en ${hook.cantidadArchivos} archivos (${hook.ocurrencias} ocurrencias)`,
    'No se detectaron hooks.'
  );

  const apiMarkdown = [
    `- Fetch detectados: ${analysis.apiUsage.totalFetchCalls}`,
    `- Axios detectados: ${analysis.apiUsage.totalAxiosCalls}`,
    `- Archivos que importan api.ts: ${analysis.apiUsage.totalApiImportFiles}`,
    formatList(
      analysis.apiUsage.apiImportFiles.slice(0, 20),
      (entry) => `\`${entry.archivo}\` (${entry.imports} imports relacionados)`,
      'No se detectaron imports de api.ts.'
    ),
    formatList(
      analysis.apiUsage.directNetworkFiles.slice(0, 20),
      (entry) => `\`${entry.archivo}\` (fetch: ${entry.fetch}, axios: ${entry.axios})`,
      'No se detectaron llamadas directas de red.'
    ),
  ].join('\n');

  const dependenciesMarkdown = formatList(
    analysis.dependencies,
    (dependency) => `\`${dependency.nombre}\`: ${dependency.version}`,
    'No se pudieron cargar dependencias.'
  );

  const stateMarkdown = [
    '- Zustand',
    formatList(
      analysis.state.zustandStoreFiles,
      (filePath) => `\`${filePath}\``,
      'No se detecto Zustand.'
    ),
    '- React Query',
    formatList(
      analysis.state.reactQueryFiles.slice(0, 20),
      (filePath) => `\`${filePath}\``,
      'No se detecto React Query.'
    ),
  ].join('\n');

  const problemsMarkdown = formatList(
    analysis.problemStatements,
    (statement) => statement,
    'Sin problemas potenciales.'
  );

  const recommendationsMarkdown = formatList(
    analysis.recommendations,
    (recommendation) => recommendation,
    'Sin recomendaciones.'
  );

  const backlogMarkdown = formatList(
    analysis.backlog,
    (item) => item,
    'Sin backlog sugerido.'
  );

  return [
    '# Mobile Inspection',
    '',
    '## Resumen',
    `- Aplicacion objetivo: ${analysis.task.aplicacionObjetivo}`,
    `- Plataforma objetivo: ${analysis.task.plataformaObjetivo}`,
    `- Modo: ${analysis.task.modo}`,
    `- Pantallas detectadas: ${analysis.stats.totalScreens}`,
    `- Layouts detectados: ${analysis.stats.totalLayouts}`,
    `- Grupos de rutas detectados: ${analysis.routeGroups.length ? analysis.routeGroups.join(', ') : 'ninguno'}`,
    `- Hooks distintos detectados: ${analysis.stats.distinctHooks}`,
    `- Ocurrencias totales de hooks: ${analysis.stats.totalHookOccurrences}`,
    `- Llamadas API detectadas: ${analysis.stats.totalApiCalls}`,
    '',
    '## Estructura Completa de Rutas Expo Router',
    buildRouteTree(analysis.screenAnalyses, analysis.layouts),
    '',
    '## Lista de Pantallas Detectadas',
    screensMarkdown,
    '',
    '## Grupos de Rutas',
    routeGroupsMarkdown,
    '',
    '## Layouts Encontrados',
    layoutsMarkdown,
    '',
    '## Hooks Detectados',
    hooksMarkdown,
    '',
    '## Estado Global y Datos Remotos',
    stateMarkdown,
    '',
    '## Dependencias Relevantes',
    dependenciesMarkdown,
    '',
    '## Llamadas a API Detectadas',
    apiMarkdown,
    '',
    '## Problemas Potenciales',
    problemsMarkdown,
    '',
    '## Recomendaciones de Mejora',
    recommendationsMarkdown,
    '',
    '## Backlog de Tareas Sugeridas para AutoDev',
    backlogMarkdown,
    '',
  ].join('\n');
}

function inspectMobileApp(task, logger, config) {
  const mobileRoot = path.resolve(config.repoRoot, task.aplicacionObjetivo || 'apps/mobile');
  const appDir = path.join(mobileRoot, 'app');
  const srcDir = path.join(mobileRoot, 'src');
  const packageJsonPath = path.join(mobileRoot, 'package.json');
  const reportPath = path.join(config.rutasAbsolutas.reportes, 'mobile-inspection.md');

  if (!fs.existsSync(appDir)) {
    throw new Error(`Mobile app directory not found: ${appDir}`);
  }

  logger.info('Inspector mobile: escaneo iniciado.', {
    appDir,
    srcDir,
  });

  const appFiles = listFilesRecursive(appDir, ['.tsx', '.ts']);
  const srcFiles = listFilesRecursive(srcDir, ['.tsx', '.ts']);
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    : { dependencies: {} };

  const dependencies = Object.entries(packageJson.dependencies || {})
    .map(([nombre, version]) => ({ nombre, version }))
    .sort((left, right) => left.nombre.localeCompare(right.nombre));

  const allAnalyses = [...appFiles, ...srcFiles].map((filePath) =>
    analyzeFile(filePath, mobileRoot, appDir)
  );

  const screenAnalyses = allAnalyses
    .filter((analysis) => analysis.routeInfo && !analysis.routeInfo.isLayout)
    .sort((left, right) => left.routeInfo.expoRoute.localeCompare(right.routeInfo.expoRoute));

  const layouts = allAnalyses
    .filter((analysis) => analysis.routeInfo && analysis.routeInfo.isLayout)
    .sort((left, right) => left.routeInfo.expoRoute.localeCompare(right.routeInfo.expoRoute));

  const routeGroups = [
    ...new Set(
      [...screenAnalyses, ...layouts].flatMap((analysis) => analysis.routeInfo.routeGroupNames)
    ),
  ].sort();

  const hooks = aggregateHooks(allAnalyses);
  const apiUsage = aggregateApiUsage(allAnalyses);
  const state = summarizeState(allAnalyses);
  const largeScreens = detectLargeScreens(screenAnalyses);
  const complexScreens = detectComplexScreens(screenAnalyses);
  const routeOverlap = detectRouteOverlap(screenAnalyses);
  const typeFriction = detectTypeFriction(allAnalyses);

  const stats = {
    totalScreens: screenAnalyses.length,
    totalLayouts: layouts.length,
    distinctHooks: hooks.length,
    totalHookOccurrences: hooks.reduce((total, hook) => total + hook.ocurrencias, 0),
    totalApiCalls: apiUsage.totalFetchCalls + apiUsage.totalAxiosCalls + apiUsage.totalApiImportFiles,
  };

  const analysis = {
    task,
    dependencies,
    screenAnalyses,
    layouts,
    routeGroups,
    hooks,
    apiUsage,
    state,
    largeScreens,
    complexScreens,
    routeOverlap,
    typeFriction,
    stats,
  };

  analysis.problemStatements = buildProblemStatements(analysis);
  analysis.recommendations = buildRecommendations(analysis);
  analysis.backlog = buildBacklog(analysis);

  const reportContent = buildReportContent(analysis);
  fs.writeFileSync(reportPath, reportContent, 'utf8');

  logger.info('Inspector mobile: rutas detectadas.', {
    pantallas: stats.totalScreens,
    layouts: stats.totalLayouts,
    grupos: routeGroups,
  });
  logger.info('Inspector mobile: hooks detectados.', {
    hooksDistintos: stats.distinctHooks,
    ocurrencias: stats.totalHookOccurrences,
  });
  logger.info('Inspector mobile: APIs detectadas.', {
    fetch: apiUsage.totalFetchCalls,
    axios: apiUsage.totalAxiosCalls,
    importsApi: apiUsage.totalApiImportFiles,
  });
  logger.info('Inspector mobile: reporte generado.', {
    ruta: reportPath,
  });

  return {
    resumen: `Inspeccion real completada: ${stats.totalScreens} pantallas, grupos ${routeGroups.join(', ') || 'sin grupos'}, reporte generado en autodev-lab/reports/mobile-inspection.md.`,
    stats,
    routeGroups,
    reportPath,
    potentialProblems: analysis.problemStatements,
    recommendations: analysis.recommendations,
    backlog: analysis.backlog,
  };
}

module.exports = {
  inspectMobileApp,
};
