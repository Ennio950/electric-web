const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@electric/builder-domain': path.resolve(workspaceRoot, 'packages/builder-domain'),
  '@electric/estimator-core': path.resolve(workspaceRoot, 'packages/estimator-core'),
};
config.resolver.nodeModulesPaths = [
  ...new Set([
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    ...(config.resolver.nodeModulesPaths ?? []),
  ]),
];

module.exports = config;
