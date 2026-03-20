const fs = require('fs');
const path = require('path');

const ALLOWED_TASK_STATES = [
  'pendiente',
  'ejecutando',
  'fallido',
  'completado',
  'requiere_revision',
];

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

class TaskManager {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.tasksDir = config.rutasAbsolutas.tareas;

    fs.mkdirSync(this.tasksDir, { recursive: true });
  }

  generateTaskId(titulo) {
    const base = slugify(titulo || 'tarea');
    const suffix = new Date().toISOString().replace(/[:.]/g, '-');
    return `${base}-${suffix}`;
  }

  buildTaskPath(taskId) {
    return path.join(this.tasksDir, `${taskId}.json`);
  }

  resolveTaskReference(taskReference) {
    if (!taskReference) {
      throw new Error('Task reference is required.');
    }

    const looksLikePath =
      taskReference.endsWith('.json') ||
      taskReference.includes('/') ||
      taskReference.includes('\\');

    if (looksLikePath) {
      if (path.isAbsolute(taskReference)) {
        return taskReference;
      }

      const repoRelativePath = path.resolve(this.config.repoRoot, taskReference);
      if (fs.existsSync(repoRelativePath)) {
        return repoRelativePath;
      }

      return path.resolve(process.cwd(), taskReference);
    }

    return this.buildTaskPath(taskReference);
  }

  validateTask(task) {
    const requiredStringFields = [
      'id',
      'titulo',
      'descripcion',
      'modulo',
      'estado',
      'modo',
      'areaObjetivo',
      'plataformaObjetivo',
      'aplicacionObjetivo',
      'creadoEn',
      'actualizadoEn',
      'resumenResultado',
    ];

    for (const field of requiredStringFields) {
      if (typeof task[field] !== 'string' || task[field].trim() === '') {
        throw new Error(`Task field "${field}" must be a non-empty string.`);
      }
    }

    if (!ALLOWED_TASK_STATES.includes(task.estado)) {
      throw new Error(`Task state "${task.estado}" is not allowed.`);
    }

    if (!Number.isInteger(task.reintentos) || task.reintentos < 0) {
      throw new Error('Task field "reintentos" must be an integer >= 0.');
    }

    return task;
  }

  normalizeTask(taskInput) {
    const now = new Date().toISOString();

    return {
      id: taskInput.id || this.generateTaskId(taskInput.titulo),
      titulo: taskInput.titulo || 'Tarea AutoDev',
      descripcion: taskInput.descripcion || 'Sin descripcion.',
      modulo: taskInput.modulo || 'mobile',
      estado: taskInput.estado || 'pendiente',
      reintentos:
        typeof taskInput.reintentos === 'number' ? taskInput.reintentos : 0,
      modo: taskInput.modo || this.config.modoEjecucionDefecto,
      areaObjetivo: taskInput.areaObjetivo || 'mobile',
      plataformaObjetivo:
        taskInput.plataformaObjetivo || this.config.estrategiaMovil,
      aplicacionObjetivo: taskInput.aplicacionObjetivo || 'apps/mobile',
      creadoEn: taskInput.creadoEn || now,
      actualizadoEn: taskInput.actualizadoEn || now,
      resumenResultado:
        taskInput.resumenResultado || 'Tarea creada y pendiente de ejecucion.',
      ...(taskInput.categoriaFix
        ? { categoriaFix: String(taskInput.categoriaFix) }
        : {}),
    };
  }

  saveTask(task) {
    const normalizedTask = this.normalizeTask(task);
    const validatedTask = this.validateTask(normalizedTask);
    const taskPath = this.buildTaskPath(validatedTask.id);

    fs.writeFileSync(taskPath, JSON.stringify(validatedTask, null, 2), 'utf8');
    this.logger.info('Tarea guardada.', {
      id: validatedTask.id,
      ruta: taskPath,
    });

    return validatedTask;
  }

  createTask(taskInput) {
    const task = this.normalizeTask(taskInput);
    const taskPath = this.buildTaskPath(task.id);

    if (fs.existsSync(taskPath)) {
      throw new Error(`Task "${task.id}" already exists.`);
    }

    return this.saveTask(task);
  }

  loadTask(taskReference) {
    const taskPath = this.resolveTaskReference(taskReference);

    if (!fs.existsSync(taskPath)) {
      throw new Error(`Task file not found: ${taskPath}`);
    }

    const raw = fs.readFileSync(taskPath, 'utf8');
    const task = JSON.parse(raw);

    this.validateTask(task);
    this.logger.info('Tarea cargada.', {
      id: task.id,
      ruta: taskPath,
    });

    return task;
  }

  updateTaskState(taskReference, estado, patch = {}) {
    if (!ALLOWED_TASK_STATES.includes(estado)) {
      throw new Error(`Task state "${estado}" is not allowed.`);
    }

    const taskPath = this.resolveTaskReference(taskReference);
    const task = this.loadTask(taskReference);
    const nextTask = {
      ...task,
      ...patch,
      estado,
      actualizadoEn: new Date().toISOString(),
    };

    this.validateTask(nextTask);

    fs.writeFileSync(
      taskPath,
      JSON.stringify(nextTask, null, 2),
      'utf8'
    );

    this.logger.info('Estado de tarea actualizado.', {
      id: nextTask.id,
      estado: nextTask.estado,
    });

    return nextTask;
  }
}

module.exports = {
  TaskManager,
  ALLOWED_TASK_STATES,
};
