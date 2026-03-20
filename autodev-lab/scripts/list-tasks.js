#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const generatedDir = path.resolve(
  __dirname,
  '..',
  'tasks',
  'generated'
);
const backlogPath = path.resolve(
  __dirname,
  '..',
  'reports',
  'executable-task-backlog.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function printTasks(tasks) {
  if (!tasks.length) {
    console.log('No hay tareas generadas.');
    return;
  }

  console.log('ID | AREA | CLASIFICACION | ESTADO');
  for (const task of tasks) {
    console.log(
      `${task.id} | ${task.areaObjetivo} | ${task.clasificacion} | ${task.estado}`
    );
  }
}

function listGeneratedTasks() {
  if (fs.existsSync(backlogPath)) {
    const backlogEntries = readJson(backlogPath);
    const tasks = backlogEntries
      .map((entry) => {
        const taskPath = path.join(generatedDir, `${entry.id}.json`);
        const task = fs.existsSync(taskPath) ? readJson(taskPath) : {};
        return {
          ...entry,
          estado: task.estado || entry.estado || 'pendiente',
        };
      })
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    printTasks(tasks);
    return;
  }

  if (!fs.existsSync(generatedDir)) {
    console.log('No hay tareas generadas.');
    return;
  }

  const tasks = fs
    .readdirSync(generatedDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => readJson(path.join(generatedDir, fileName)));

  printTasks(tasks);
}

listGeneratedTasks();
