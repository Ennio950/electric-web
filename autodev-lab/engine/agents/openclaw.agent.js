function inspeccionarRepositorio(tarea, logger) {
  logger.info('OpenClaw agent: inspeccionarRepositorio placeholder.', {
    tarea: tarea.id,
    modulo: tarea.modulo,
    aplicacionObjetivo: tarea.aplicacionObjetivo,
  });

  return {
    agente: 'openclaw',
    resumen:
      'OpenClaw registro una inspeccion placeholder del repositorio orientada a apps/mobile.',
  };
}

function ejecutarComandoLocal(command, logger) {
  logger.info('OpenClaw agent: ejecutarComandoLocal placeholder.', {
    command,
  });

  return {
    agente: 'openclaw',
    resumen: `Comando placeholder registrado: ${command}`,
  };
}

module.exports = {
  inspeccionarRepositorio,
  ejecutarComandoLocal,
};
