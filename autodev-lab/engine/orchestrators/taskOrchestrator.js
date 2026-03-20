const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function chooseSmallestScope(tasks) {
  return [...tasks].sort((left, right) => {
    const leftScope = Array.isArray(left.archivosObjetivo)
      ? left.archivosObjetivo.length
      : 99;
    const rightScope = Array.isArray(right.archivosObjetivo)
      ? right.archivosObjetivo.length
      : 99;

    if (leftScope !== rightScope) {
      return leftScope - rightScope;
    }

    return String(left.id).localeCompare(String(right.id));
  })[0];
}

function updateGeneratedTaskState(taskPath, nextTask) {
  fs.writeFileSync(taskPath, JSON.stringify(nextTask, null, 2), 'utf8');
}

function buildTaskPath(config, taskId) {
  return path.join(config.rutasAbsolutas.tareas, 'generated', `${taskId}.json`);
}

function orchestrateTask({
  rootTask,
  rootTaskReference,
  planning,
  logger,
  config,
}) {
  const backlog = Array.isArray(planning.generatedTasks) ? planning.generatedTasks : [];
  const explicitGeneratedTask = rootTask && rootTask.taskKind === 'generated';

  if (explicitGeneratedTask) {
    const selectedTask = {
      ...rootTask,
      taskPath:
        rootTaskReference && rootTaskReference.endsWith('.json')
          ? path.resolve(config.repoRoot, rootTaskReference)
          : buildTaskPath(config, rootTask.id),
    };
    const canExecuteAutomatically =
      selectedTask.clasificacion === 'seguro_automatico' &&
      selectedTask.requiereRevision !== true;

    return {
      resumen: canExecuteAutomatically
        ? `Tarea generada explicita seleccionada: ${selectedTask.id}.`
        : `Tarea generada explicita ${selectedTask.id} requiere revision y no se ejecutara automaticamente.`,
      generatedCount: backlog.length,
      selectedTask,
      selectedTaskPath: selectedTask.taskPath,
      areaObjetivo: selectedTask.areaObjetivo,
      clasificacion: selectedTask.clasificacion,
      canExecuteAutomatically,
      selectionReason: 'Tarea generada solicitada explicitamente por el usuario.',
      omittedReason: canExecuteAutomatically
        ? null
        : 'La tarea seleccionada no es seguro_automatico.',
      nextSuggestedTask: null,
    };
  }

  const automaticCandidates = backlog.filter(
    (task) =>
      task.estado === 'pendiente' &&
      task.clasificacion === 'seguro_automatico' &&
      task.requiereRevision !== true
  );

  if (!automaticCandidates.length) {
    const nextManualTask = chooseSmallestScope(
      backlog.filter((task) => task.estado === 'pendiente')
    );

    logger.info('TaskOrchestrator: no hay tareas seguras para ejecutar.', {
      tareasGeneradas: backlog.length,
      siguienteSugerida: nextManualTask ? nextManualTask.id : null,
    });

    return {
      resumen: `No hay tareas seguras pendientes para ejecutar automaticamente. Generadas: ${backlog.length}.`,
      generatedCount: backlog.length,
      selectedTask: null,
      selectedTaskPath: null,
      areaObjetivo: null,
      clasificacion: null,
      canExecuteAutomatically: false,
      selectionReason:
        'No existen tareas pendientes con clasificacion seguro_automatico.',
      omittedReason:
        'Las tareas restantes son semiautomaticas, manuales o ya fueron completadas.',
      nextSuggestedTask: nextManualTask
        ? {
            id: nextManualTask.id,
            clasificacion: nextManualTask.clasificacion,
            areaObjetivo: nextManualTask.areaObjetivo,
          }
        : null,
    };
  }

  const selectedTask = chooseSmallestScope(automaticCandidates);
  const selectedTaskPath = buildTaskPath(config, selectedTask.id);

  logger.info('TaskOrchestrator: tarea segura seleccionada.', {
    tarea: selectedTask.id,
    area: selectedTask.areaObjetivo,
    clasificacion: selectedTask.clasificacion,
  });

  return {
    resumen: `TaskOrchestrator selecciono ${selectedTask.id} como siguiente tarea segura.`,
    generatedCount: backlog.length,
    selectedTask,
    selectedTaskPath,
    areaObjetivo: selectedTask.areaObjetivo,
    clasificacion: selectedTask.clasificacion,
    canExecuteAutomatically: true,
    selectionReason:
      'Es la tarea seguro_automatico pendiente con menor alcance de archivos objetivo.',
    omittedReason: null,
    nextSuggestedTask: null,
  };
}

function markGeneratedTask(config, task, taskPath, estado, patch = {}) {
  if (!task || !taskPath || !fs.existsSync(taskPath)) {
    return null;
  }

  const currentTask = loadJson(taskPath);
  const nextTask = {
    ...currentTask,
    ...patch,
    estado,
    actualizadoEn: new Date().toISOString(),
  };

  updateGeneratedTaskState(taskPath, nextTask);
  return nextTask;
}

module.exports = {
  orchestrateTask,
  markGeneratedTask,
};
