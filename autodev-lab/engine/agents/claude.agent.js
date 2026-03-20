function analizarTarea(tarea, logger) {
  logger.info('Claude agent: analizarTarea placeholder.', {
    tarea: tarea.id,
    aplicacionObjetivo: tarea.aplicacionObjetivo,
  });

  return {
    agente: 'claude',
    resumen:
      'Claude preparo un analisis inicial placeholder para la app React Native.',
  };
}

function revisarResultado(tarea, implementacion, logger) {
  logger.info('Claude agent: revisarResultado placeholder.', {
    tarea: tarea.id,
    estadoImplementacion: implementacion.estadoPlaceholder || 'sin-cambios',
  });

  return {
    agente: 'claude',
    resumen:
      'Claude completo una validacion placeholder sin ejecutar pruebas reales.',
  };
}

module.exports = {
  analizarTarea,
  revisarResultado,
};
