import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootRulesPath = path.join(workspaceRoot, 'firestore.rules');
const backendRulesPath = path.join(workspaceRoot, 'straight-wire-backend', 'firestore.rules');

function readRules(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim();
}

test('root and backend firestore rules stay byte-for-byte in sync', () => {
  const rootRules = readRules(rootRulesPath);
  const backendRules = readRules(backendRulesPath);

  assert.equal(
    backendRules,
    rootRules,
    'firestore.rules and straight-wire-backend/firestore.rules must stay identical',
  );
});

test('firestore rules cover both request collections and block direct user writes', () => {
  const rules = readRules(rootRulesPath);

  assert.match(rules, /match \/requests\/\{requestId\}/);
  assert.match(rules, /match \/clientRequests\/\{requestId\}/);
  assert.match(rules, /match \/users\/\{uid\}[\s\S]*allow write: if false;/);
});
