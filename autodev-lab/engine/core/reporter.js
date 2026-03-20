const fs = require('fs');
const path = require('path');

class Reporter {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.reportsDir = config.rutasAbsolutas.reportes;

    fs.mkdirSync(this.reportsDir, { recursive: true });
  }

  buildReportPath(taskId, executionId) {
    return path.join(this.reportsDir, `${taskId}-${executionId}.md`);
  }

  generateTaskReport({
    tarea,
    executionId,
    phaseResults,
    estadoFinal,
    error,
    logFilePath,
  }) {
    const reportPath = this.buildReportPath(tarea.id, executionId);
    const phasesMarkdown = phaseResults
      .map((phase) => {
        return [
          `### ${phase.nombre}`,
          `- Estado: ${phase.estado}`,
          `- Inicio: ${phase.iniciadoEn}`,
          `- Fin: ${phase.finalizadoEn}`,
          `- Resumen: ${phase.resumen}`,
          '',
        ].join('\n');
      })
      .join('\n');

    const content = [
      '# Reporte AutoDev',
      '',
      '## Ejecucion',
      `- Motor: ${this.config.nombreMotor}`,
      `- Version: ${this.config.version}`,
      `- Modo: ${tarea.modo}`,
      `- Estado final: ${estadoFinal}`,
      `- Estrategia movil: ${this.config.estrategiaMovil}`,
      `- Integraciones previstas: ${this.config.integracionesPlaneadas.join(', ')}`,
      `- Log: ${logFilePath}`,
      '',
      '## Tarea',
      `- ID: ${tarea.id}`,
      `- Titulo: ${tarea.titulo}`,
      `- Descripcion: ${tarea.descripcion}`,
      `- Modulo: ${tarea.modulo}`,
      `- Area objetivo: ${tarea.areaObjetivo}`,
      `- Plataforma objetivo: ${tarea.plataformaObjetivo}`,
      `- Aplicacion objetivo: ${tarea.aplicacionObjetivo}`,
      `- Categoria fix: ${tarea.categoriaFix || 'sin_categoria'}`,
      `- Reintentos: ${tarea.reintentos}`,
      `- Creada: ${tarea.creadoEn}`,
      `- Actualizada: ${tarea.actualizadoEn}`,
      '',
      '## Resumen final',
      tarea.resumenResultado,
      '',
      '## Fases',
      phasesMarkdown || 'Sin fases ejecutadas.',
    ];

    if (error) {
      content.push('## Error');
      content.push(error.message || String(error));
      content.push('');
    }

    fs.writeFileSync(reportPath, `${content.join('\n')}\n`, 'utf8');
    this.logger.info('Reporte markdown generado.', { ruta: reportPath });

    return reportPath;
  }
}

module.exports = {
  Reporter,
};
