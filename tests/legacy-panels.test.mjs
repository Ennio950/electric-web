import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesWithoutInlineHandlers = [
  'panel-empleado.html',
  'panel-jefe.html',
  'client-requests.html',
  'login-empleado.html',
  'panel-cliente.html',
  path.join('assets', 'js', 'boss-panel.js'),
  path.join('assets', 'js', 'client-requests.js'),
];

test('legacy surfaces avoid inline event handler attributes', () => {
  const offenders = [];

  for (const relativePath of filesWithoutInlineHandlers) {
    const filePath = path.join(workspaceRoot, relativePath);
    const content = fs.readFileSync(filePath, 'utf8');

    if (/<[^>]+\s(?:onclick|onchange|onsubmit|oninput|onload|onerror)\s*=/.test(content)) {
      offenders.push(relativePath);
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Legacy surfaces should not use inline event attributes: ${offenders.join(', ')}`,
  );

  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, 'panel-empleado.html'), 'utf8').includes('data-panel-action='),
    true,
    'panel-empleado.html should expose explicit data-panel-action hooks',
  );

  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, 'login-empleado.html'), 'utf8').includes('tailwindcss.js'),
    false,
    'login-empleado.html should not rely on the Tailwind runtime script',
  );

  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, 'login-jefe.html'), 'utf8').includes('tailwindcss.js'),
    false,
    'login-jefe.html should not rely on the Tailwind runtime script',
  );

  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, 'login-gateway.html'), 'utf8').includes('tailwindcss.js'),
    false,
    'login-gateway.html should not rely on the Tailwind runtime script',
  );

  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8').includes('tailwindcss.js'),
    false,
    'index.html should not rely on the Tailwind runtime script',
  );

  const scheduleHtml = fs.readFileSync(path.join(workspaceRoot, 'schedule.html'), 'utf8');
  assert.equal(
    scheduleHtml.includes('assets/js/schedule-redirect.js'),
    true,
    'schedule.html should redirect through the shared scheduled-flow alias script',
  );

  assert.equal(
    scheduleHtml.includes('emergency.html?mode=scheduled'),
    true,
    'schedule.html should point to the scheduled emergency workflow',
  );

  const emergencyHtml = fs.readFileSync(path.join(workspaceRoot, 'emergency.html'), 'utf8');
  assert.equal(
    emergencyHtml.includes('dispatchMode: FLOW_MODE'),
    true,
    'emergency.html should submit the selected dispatch mode when creating a call',
  );

  assert.equal(
    emergencyHtml.includes('mode=${encodeURIComponent(FLOW_MODE)}'),
    true,
    'emergency.html should request the matching dispatch mode when loading calls',
  );

  assert.equal(
    emergencyHtml.includes('input.showPicker()'),
    true,
    'emergency.html should force the native date/time picker when supported',
  );

  assert.equal(
    emergencyHtml.includes('Tiempo estimado (min)'),
    true,
    'emergency.html should expose the ETA field in clear Spanish copy',
  );

  assert.equal(
    emergencyHtml.includes('Programa una visita y sigue el mismo flujo operativo: aceptación, chat, cierre y pago.'),
    false,
    'emergency.html should not show the old verbose scheduled-work subtitle',
  );

  assert.equal(
    emergencyHtml.includes('Ya confirmaste el pago. Puedes enviar otro visita programada cuando lo necesites.'),
    false,
    'emergency.html should not imply prior payment confirmation for an empty scheduled-work form',
  );

  const clientPanelHtml = fs.readFileSync(path.join(workspaceRoot, 'panel-cliente.html'), 'utf8');
  assert.equal(
    clientPanelHtml.includes('id="btnScheduledWork"'),
    true,
    'panel-cliente.html should expose a scheduled-work entry button',
  );

  assert.equal(
    clientPanelHtml.includes('window.location.href = "emergency.html?mode=scheduled"'),
    true,
    'panel-cliente.html should route the scheduled-work button into the shared scheduled workflow',
  );

  const loginGatewayHtml = fs.readFileSync(path.join(workspaceRoot, 'login-gateway.html'), 'utf8');
  assert.equal(
    loginGatewayHtml.includes('id="google-domain-help"'),
    true,
    'login-gateway.html should expose a visible domain help note for Google auth on public hosts',
  );

  const indexHtml = fs.readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
  assert.equal(
    indexHtml.includes('data-company-role-title="client"'),
    true,
    'index.html should expose branding hooks for the client portal card',
  );

  assert.equal(
    indexHtml.includes('data-company-role-image="boss"'),
    true,
    'index.html should expose image hooks for the boss portal card',
  );
});
