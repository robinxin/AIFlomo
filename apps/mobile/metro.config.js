const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 让 Metro 监视整个 monorepo，使根目录 node_modules 可被解析
config.watchFolders = [monorepoRoot];

// 模块解析顺序：先查 app 目录，再查 monorepo 根目录
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
