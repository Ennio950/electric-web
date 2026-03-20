const fs = require('fs');
const path = require('path');

function formatList(items, formatter, emptyText) {
  if (!items.length) {
    return `- ${emptyText}`;
  }

  return items.map((item) => `- ${formatter(item)}`).join('\n');
}

class DiffReporter {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  writeReport(reportName, content) {
    const reportPath = path.join(this.config.rutasAbsolutas.reportes, reportName);
    fs.writeFileSync(reportPath, `${content.join('\n')}\n`, 'utf8');
    this.logger.info('DiffReporter: reporte markdown generado.', {
      ruta: reportPath,
    });
    return reportPath;
  }

  generateMobileFixReport({
    task,
    planning,
    implementation,
    validation,
    logFilePath,
  }) {
    const reportPath = path.join(
      this.config.rutasAbsolutas.reportes,
      'mobile-fix-report.md'
    );
    const changeSummary = implementation.changeSummary || {
      analyzedFiles: [],
      changes: [],
      omitted: [],
      backups: [],
      modifiedFiles: [],
    };
    const fixSummary = implementation.fixSummary || {
      findingsCount: 0,
      fixesApplied: 0,
      modifiedFiles: [],
      omittedFiles: [],
    };

    const content = [
      '# Mobile Fix Report',
      '',
      '## Ejecucion',
      `- Tarea: ${task.id}`,
      `- Modo: ${task.modo}`,
      `- Categoria fix: ${task.categoriaFix || 'sin_categoria'}`,
      `- Log: ${logFilePath}`,
      '',
      '## Archivos Analizados',
      formatList(
        changeSummary.analyzedFiles || [],
        (filePath) => `\`${filePath}\``,
        'No se registraron archivos analizados.'
      ),
      '',
      '## Hallazgos Detectados',
      formatList(
        planning.backlog || [],
        (entry) =>
          `\`${entry.id}\` ${entry.archivo} -> ${entry.tipo} [${entry.clasificacion}]`,
        'No se detectaron hallazgos.'
      ),
      '',
      '## Fixes Aplicados',
      formatList(
        implementation.appliedFixes || [],
        (fix) => `${fix.archivo} -> ${fix.accion}`,
        'No se aplicaron fixes.'
      ),
      '',
      '## Archivos Modificados',
      formatList(
        changeSummary.changes || [],
        (change) =>
          `\`${change.relativePath}\` (${change.existed ? 'modificado' : 'creado'})`,
        'No se modificaron archivos.'
      ),
      '',
      '## Backups Creados',
      formatList(
        changeSummary.backups || [],
        (backupPath) => `\`${backupPath}\``,
        'No se crearon backups.'
      ),
      '',
      '## Archivos Omitidos Por Seguridad',
      formatList(
        implementation.omittedFixes || [],
        (fix) => `${fix.archivo} -> ${fix.motivo}`,
        'No se omitieron archivos.'
      ),
      '',
      '## Validacion',
      `- Resultado: ${validation.ok ? 'ok' : 'requiere_revision'}`,
      formatList(
        validation.checks || [],
        (check) => `${check.nombre}: ${check.ok ? 'ok' : 'fallo'}${check.detalle ? ` (${check.detalle})` : ''}`,
        'Sin validaciones registradas.'
      ),
      '',
      '## Siguientes Recomendaciones',
      formatList(
        [
          ...(implementation.nextRecommendations || []),
          ...(planning.manualRecommendations || []),
        ],
        (recommendation) => recommendation,
        'Sin recomendaciones adicionales.'
      ),
      '',
      '## Resumen',
      `- Hallazgos encontrados: ${fixSummary.findingsCount}`,
      `- Fixes seguros aplicados: ${fixSummary.fixesApplied}`,
      `- Archivos modificados: ${fixSummary.modifiedFiles ? fixSummary.modifiedFiles.length : 0}`,
      `- Archivos omitidos: ${fixSummary.omittedFiles ? fixSummary.omittedFiles.length : 0}`,
      `- Backlog JSON: ${planning.backlogPath}`,
      '',
    ];

    return this.writeReport('mobile-fix-report.md', content);
  }

  generateTaskExecutionReport({
    rootTask,
    planning,
    orchestration,
    implementation,
    validation,
    selectedTaskFinalState,
    logFilePath,
  }) {
    const generatedTasks = planning.generatedTasks || [];
    const selectedTask = orchestration.selectedTask || null;
    const changeSummary = implementation.changeSummary || {
      analyzedFiles: [],
      changes: [],
      backups: [],
      modifiedFiles: [],
    };
    const fixSummary = implementation.fixSummary || {
      findingsCount: 0,
      fixesApplied: 0,
      modifiedFiles: [],
      omittedFiles: [],
    };

    const content = [
      '# Task Execution Report',
      '',
      '## Ejecucion',
      `- Tarea raiz: ${rootTask.id}`,
      `- Modo: ${rootTask.modo}`,
      `- Area objetivo raiz: ${rootTask.areaObjetivo}`,
      `- Log: ${logFilePath}`,
      '',
      '## Tareas Generadas',
      formatList(
        generatedTasks,
        (task) => {
          const effectiveState =
            selectedTask &&
            selectedTaskFinalState &&
            task.id === selectedTask.id
              ? selectedTaskFinalState
              : task.estado;
          return `\`${task.id}\` ${task.areaObjetivo} [${task.clasificacion}] estado=${effectiveState}`;
        },
        'No se generaron tareas ejecutables.'
      ),
      '',
      '## Tarea Seleccionada',
      selectedTask
        ? `- \`${selectedTask.id}\` ${selectedTask.titulo} (${selectedTask.areaObjetivo}, ${selectedTask.clasificacion})`
        : '- No se selecciono ninguna tarea para ejecutar.',
      `- Motivo de seleccion: ${orchestration.selectionReason || 'sin_registro'}`,
      orchestration.omittedReason
        ? `- Motivo de omision: ${orchestration.omittedReason}`
        : '- Motivo de omision: ninguno',
      orchestration.nextSuggestedTask
        ? `- Siguiente tarea sugerida: ${orchestration.nextSuggestedTask.id} (${orchestration.nextSuggestedTask.areaObjetivo}, ${orchestration.nextSuggestedTask.clasificacion})`
        : '- Siguiente tarea sugerida: ninguna',
      '',
      '## Archivos Analizados',
      formatList(
        changeSummary.analyzedFiles || [],
        (filePath) => `\`${filePath}\``,
        'No se registraron archivos analizados.'
      ),
      '',
      '## Hallazgos Detectados',
      `- Tareas generadas: ${planning.stats?.generatedCount || generatedTasks.length}`,
      `- Mobile: ${planning.stats?.mobileCount || 0}`,
      `- Backend: ${planning.stats?.backendCount || 0}`,
      `- Mobile-backend: ${planning.stats?.crossAreaCount || 0}`,
      '',
      '## Fixes Aplicados',
      formatList(
        implementation.appliedFixes || [],
        (fix) => `${fix.archivo} -> ${fix.accion}`,
        'No se aplicaron fixes.'
      ),
      '',
      '## Archivos Modificados',
      formatList(
        changeSummary.changes || [],
        (change) =>
          `\`${change.relativePath}\` (${change.existed ? 'modificado' : 'creado'})`,
        'No se modificaron archivos productivos.'
      ),
      '',
      '## Backups Creados',
      formatList(
        changeSummary.backups || [],
        (backupPath) => `\`${backupPath}\``,
        'No se crearon backups.'
      ),
      '',
      '## Archivos Omitidos',
      formatList(
        implementation.omittedFixes || [],
        (fix) => `${fix.archivo} -> ${fix.motivo}`,
        'No se omitieron archivos.'
      ),
      '',
      '## Validacion',
      `- Resultado: ${validation.ok ? 'ok' : 'fallida'}`,
      formatList(
        validation.checks || [],
        (check) =>
          `${check.nombre}: ${check.ok ? 'ok' : 'fallo'}${check.detalle ? ` (${check.detalle})` : ''}`,
        'Sin validaciones registradas.'
      ),
      '',
      '## Siguientes Recomendaciones',
      formatList(
        implementation.nextRecommendations || [],
        (recommendation) => recommendation,
        'Sin recomendaciones adicionales.'
      ),
      '',
      '## Resumen',
      `- Cantidad de hallazgos encontrados: ${planning.stats?.generatedCount || generatedTasks.length}`,
      `- Cantidad de fixes seguros aplicados: ${fixSummary.fixesApplied || 0}`,
      `- Archivos modificados: ${(fixSummary.modifiedFiles || []).length}`,
      `- Archivos omitidos: ${(fixSummary.omittedFiles || []).length}`,
      `- Backlog ejecutable: ${planning.backlogPath}`,
      '',
    ];

    return this.writeReport('task-execution-report.md', content);
  }
}

module.exports = {
  DiffReporter,
};
