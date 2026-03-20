function generarPlanImplementacion(tarea, analisis, logger) {
  logger.info('Codex agent: generarPlanImplementacion placeholder.', {
    tarea: tarea.id,
    resumenAnalisis: analisis.resumen,
  });

  return {
    agente: 'codex',
    resumen:
      'Codex genero un plan placeholder para revisar rutas, estado y componentes de apps/mobile.',
    pasos: [
      'Revisar estructura de Expo Router.',
      'Ubicar modulos con mayor complejidad.',
      'Definir backlog de mejoras sin tocar codigo existente.',
    ],
  };
}

function generarParcheCodigo(tarea, plan, logger) {
  logger.info('Codex agent: generarParcheCodigo placeholder.', {
    tarea: tarea.id,
    pasosPlan: Array.isArray(plan.pasos) ? plan.pasos.length : 0,
  });

  return {
    agente: 'codex',
    resumen:
      'Codex dejo preparado un parche placeholder; no se realizaron cambios sobre la app.',
    estadoPlaceholder: 'sin-cambios',
  };
}

module.exports = {
  generarPlanImplementacion,
  generarParcheCodigo,
};
