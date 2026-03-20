import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeImportedTemplates } from '../host-vanilla/js/core/templateStore.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeImportedTemplates validates imported templates before saving them', () => {
  const normalized = normalizeImportedTemplates([{ templateId: 'demo', name: 'Demo' }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].templateId, 'demo');

  assert.throws(
    () => normalizeImportedTemplates([{}]),
    /Plantilla 1: La plantilla requiere templateId y name\./,
  );
});

test('legacy host avoids interpolating imported values directly into HTML', () => {
  const appJs = fs.readFileSync(path.join(workspaceRoot, 'host-vanilla', 'js', 'app.js'), 'utf8');
  const renderResultsJs = fs.readFileSync(path.join(workspaceRoot, 'host-vanilla', 'js', 'ui', 'renderResults.js'), 'utf8');
  const templateStoreJs = fs.readFileSync(path.join(workspaceRoot, 'host-vanilla', 'js', 'core', 'templateStore.js'), 'utf8');

  assert.equal(
    appJs.includes("validation.errors.map((error) => `<li>${error}</li>`).join('')"),
    false,
    'app.js should render validation errors through text nodes',
  );

  assert.equal(
    renderResultsJs.includes('<td>${row.name}</td>'),
    false,
    'renderResults.js should not interpolate material names into HTML strings',
  );

  assert.equal(
    renderResultsJs.includes('td.textContent = value;'),
    true,
    'renderResults.js should render material values through textContent',
  );

  assert.equal(
    templateStoreJs.includes('return calculator.normalizeTemplate(item);'),
    true,
    'templateStore.js should normalize imported templates before storing them',
  );
});
