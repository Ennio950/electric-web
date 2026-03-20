#!/usr/bin/env node
const path = require('path');

const { createEngine } = require('../engine');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (!part.startsWith('--')) {
      continue;
    }

    const key = part.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.log(
    'Uso: node autodev-lab/scripts/create-task.js --titulo "Titulo" [--descripcion "Texto"] [--modulo mobile] [--areaObjetivo mobile] [--plataformaObjetivo react-native-expo] [--aplicacionObjetivo apps/mobile] [--modo SAFE_AUTODEV_BOOTSTRAP_REACT_NATIVE]'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === 'true' || args.ayuda === 'true') {
    printUsage();
    return;
  }

  if (!args.titulo) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const engine = createEngine();

  try {
    const task = engine.taskManager.createTask({
      titulo: args.titulo,
      descripcion: args.descripcion || 'Tarea creada desde la CLI de AutoDev.',
      modulo: args.modulo || 'mobile',
      estado: args.estado || 'pendiente',
      reintentos: 0,
      modo: args.modo || engine.config.modoEjecucionDefecto,
      areaObjetivo: args.areaObjetivo || 'mobile',
      plataformaObjetivo:
        args.plataformaObjetivo || engine.config.estrategiaMovil,
      aplicacionObjetivo: args.aplicacionObjetivo || 'apps/mobile',
      resumenResultado: 'Tarea creada y pendiente de ejecucion.',
    });

    console.log(`Tarea creada: ${task.id}`);
    console.log(
      `Archivo: ${path.relative(process.cwd(), engine.taskManager.buildTaskPath(task.id))}`
    );
    console.log(`Log: ${path.relative(process.cwd(), engine.logger.logFilePath)}`);
  } finally {
    await engine.logger.close();
  }
}

main().catch((error) => {
  console.error(`Error creando tarea: ${error.message}`);
  process.exitCode = 1;
});
