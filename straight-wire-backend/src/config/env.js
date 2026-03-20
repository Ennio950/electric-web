'use strict';

const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');

const ENV_STATE_KEY = Symbol.for('straight-wire-backend.env.state');

function getBackendRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveEnvFiles(rootDir = getBackendRoot()) {
  return [path.join(rootDir, '.env.local'), path.join(rootDir, '.env')];
}

function loadBackendEnv() {
  if (global[ENV_STATE_KEY]) {
    return global[ENV_STATE_KEY];
  }

  const envFiles = resolveEnvFiles();
  const loadedFiles = [];

  for (const filePath of envFiles) {
    if (!fs.existsSync(filePath)) continue;
    dotenv.config({
      path: filePath,
      override: false,
      quiet: true,
    });
    loadedFiles.push(filePath);
  }

  const state = {
    backendRoot: getBackendRoot(),
    envFiles,
    loadedFiles,
  };

  global[ENV_STATE_KEY] = state;
  return state;
}

module.exports = {
  getBackendRoot,
  loadBackendEnv,
  resolveEnvFiles,
};

