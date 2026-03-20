#!/usr/bin/env node
const path = require('path');

const { createEngine } = require('../engine');

function printUsage() {
  console.log(
    'Uso: node autodev-lab/scripts/run-task.js --task sample-task | --task generated/task-001 | --next-safe'
  );
}

function normalizeTaskReference(taskReference) {
  if (!taskReference) {
    return taskReference;
  }

  if (taskReference.startsWith('generated/')) {
    const normalized = taskReference.endsWith('.json')
      ? taskReference
      : `${taskReference}.json`;
    return path.join('autodev-lab', 'tasks', normalized);
  }

  return taskReference;
}

function resolveTaskReference(argv) {
  const args = [...argv];
  if (args.includes('--next-safe')) {
    return 'sample-task';
  }

  const flagIndex = args.findIndex((part) => part === '--task');

  if (flagIndex !== -1 && args[flagIndex + 1]) {
    return normalizeTaskReference(args[flagIndex + 1]);
  }

  return normalizeTaskReference(args.find((part) => !part.startsWith('--')));
}

function printExecutionSummary(result) {
  const execution = result.taskExecution || result.mobileExecution;
  if (!execution) {
    return;
  }

  if (typeof execution.generatedCount === 'number') {
    console.log(`Tareas generadas: ${execution.generatedCount}`);
  }
  if (execution.selectedTask) {
    console.log(`Tarea seleccionada: ${execution.selectedTask}`);
  }
  if (execution.areaObjetivo) {
    console.log(`Area objetivo: ${execution.areaObjetivo}`);
  }
  if (execution.clasificacion) {
    console.log(`Clasificacion: ${execution.clasificacion}`);
  }
  if (typeof execution.findingsCount === 'number') {
    console.log(`Hallazgos encontrados: ${execution.findingsCount}`);
  }
  if (typeof execution.fixesApplied === 'number') {
    console.log(`Fixes seguros aplicados: ${execution.fixesApplied}`);
  }
  console.log(
    `Archivos modificados: ${
      execution.modifiedFiles && execution.modifiedFiles.length
        ? execution.modifiedFiles.join(', ')
        : 'ninguno'
    }`
  );
  console.log(
    `Archivos omitidos: ${
      execution.omittedFiles && execution.omittedFiles.length
        ? execution.omittedFiles.join(', ')
        : 'ninguno'
    }`
  );
  if (execution.backlogPath) {
    console.log(
      `Backlog JSON: ${path.relative(process.cwd(), execution.backlogPath)}`
    );
  }
  if (execution.diffReportPath) {
    console.log(
      `Reporte de cambios: ${path.relative(process.cwd(), execution.diffReportPath)}`
    );
  }
}

async function main() {
  const taskReference = resolveTaskReference(process.argv.slice(2));

  if (!taskReference || taskReference === '--help') {
    printUsage();
    if (!taskReference) {
      process.exitCode = 1;
    }
    return;
  }

  const engine = createEngine();

  try {
    const result = await engine.loopRunner.run(taskReference);

    console.log(`Tarea ejecutada: ${result.task.id}`);
    console.log(`Estado final: ${result.task.estado}`);
    printExecutionSummary(result);
    console.log(`Reporte: ${path.relative(process.cwd(), result.reportPath)}`);
    console.log(`Log: ${path.relative(process.cwd(), result.logFilePath)}`);
  } finally {
    await engine.logger.close();
  }
}

main().catch((error) => {
  console.error(`Error ejecutando tarea: ${error.message}`);

  if (error.reportPath) {
    console.error(`Reporte parcial: ${path.relative(process.cwd(), error.reportPath)}`);
  }

  if (error.logFilePath) {
    console.error(`Log: ${path.relative(process.cwd(), error.logFilePath)}`);
  }

  process.exitCode = 1;
});
