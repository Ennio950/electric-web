import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = new Set(['.html', '.js', '.css', '.mjs', '.cjs', '.ts', '.tsx']);
const skippedDirNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
]);
const skippedPathFragments = [
  `${path.sep}assets${path.sep}vendor${path.sep}`,
];
const suspiciousTokens = [
  '\u00e2\u20ac\u201d',
  '\u00e2\u20ac\u00a6',
  '\u00e2\u20ac\u00a2',
  '\u00c3',
  '\u00f0\u0178',
  '\ufffd',
];

function shouldSkipDir(dirPath) {
  const dirName = path.basename(dirPath);
  if (skippedDirNames.has(dirName) || dirName.endsWith('.cache')) {
    return true;
  }

  return skippedPathFragments.some((fragment) => dirPath.includes(fragment));
}

function walk(dirPath, files = []) {
  if (shouldSkipDir(dirPath)) {
    return files;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

test('source files do not contain mojibake markers', () => {
  const offenders = [];

  for (const filePath of walk(workspaceRoot)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const token = suspiciousTokens.find((candidate) => content.includes(candidate));
    if (!token) {
      continue;
    }

    const lineNumber = content.slice(0, content.indexOf(token)).split('\n').length;
    offenders.push(`${path.relative(workspaceRoot, filePath)}:${lineNumber} -> ${token}`);
  }

  assert.deepEqual(
    offenders,
    [],
    `Found mojibake markers:\n${offenders.join('\n')}`,
  );
});
