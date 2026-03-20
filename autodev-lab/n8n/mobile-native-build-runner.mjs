import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const mobileRoot = path.join(repoRoot, 'apps', 'mobile');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const easCliPackage = process.env.N8N_EAS_CLI_PACKAGE || 'eas-cli@latest';
const hasExpoToken = (process.env.EXPO_TOKEN || '').trim().length > 0;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const profile = args.find((arg) => !arg.startsWith('--')) || 'manual';
const dryRun = flags.has('--dry-run');
const autoSubmit =
  flags.has('--auto-submit') || process.env.N8N_MOBILE_AUTO_SUBMIT === '1';

function log(message) {
  console.log(`[n8n-mobile-build] ${message}`);
}

function fail(message, exitCode = 1) {
  console.error(`[n8n-mobile-build] ${message}`);
  process.exit(exitCode);
}

function ensurePathExists(targetPath, description) {
  if (!fs.existsSync(targetPath)) {
    fail(`No existe ${description}: ${targetPath}`, 2);
  }
}

function formatWindowsArg(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function spawnCommand(command, args, options = {}) {
  if (isWindows) {
    const rendered = [command, ...args.map(formatWindowsArg)].join(' ');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', rendered], options);
  }

  return spawnSync(command, args, options);
}

function ensureCommand(command, description) {
  const result = spawnCommand(command, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    fail(`${description} no esta disponible en PATH.`, 3);
  }
}

function ensureExpoToken() {
  if ((process.env.EXPO_TOKEN || '').trim()) {
    return;
  }

  fail(
    'Falta EXPO_TOKEN. Para builds EAS no interactivos define EXPO_TOKEN en el entorno de n8n.',
    4,
  );
}

function runStep(step) {
  const cwd = step.cwd || repoRoot;
  const renderedCommand = `${step.command} ${step.args.join(' ')}`.trim();

  log(`==> ${step.label}`);
  log(`cwd: ${cwd}`);
  log(`cmd: ${renderedCommand}`);

  if (dryRun) {
    return;
  }

  const result = spawnCommand(step.command, step.args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    fail(`Fallo el paso "${step.label}": ${result.error.message}`, 5);
  }

  if (result.status !== 0) {
    fail(`El paso "${step.label}" termino con codigo ${result.status}.`, result.status || 1);
  }
}

function buildStep(label, argsList, cwd = repoRoot) {
  return {
    label,
    command: npmCommand,
    args: argsList,
    cwd,
  };
}

function expoStep(label, argsList, cwd = mobileRoot) {
  return {
    label,
    command: npxCommand,
    args: argsList,
    cwd,
  };
}

const localValidationSteps = [
  buildStep('Compilar paquetes web compartidos', ['run', 'build']),
  buildStep('Validar TypeScript de apps/mobile', ['--prefix', 'apps/mobile', 'run', 'typecheck']),
];

const webExportStep = expoStep('Exportar base web Expo a dist', [
  'expo',
  'export',
  '--platform',
  'web',
]);

const previewBuildStep = expoStep('Disparar build preview Android+iOS en EAS', [
  '--yes',
  easCliPackage,
  'build',
  '--platform',
  'all',
  '--profile',
  'preview',
  '--non-interactive',
  '--no-wait',
]);

const productionBuildArgs = [
  '--yes',
  easCliPackage,
  'build',
  '--platform',
  'all',
  '--profile',
  'production',
  '--non-interactive',
  '--no-wait',
];

if (autoSubmit) {
  productionBuildArgs.push('--auto-submit');
}

const productionBuildStep = expoStep(
  autoSubmit
    ? 'Disparar build production Android+iOS con auto-submit'
    : 'Disparar build production Android+iOS',
  productionBuildArgs,
);

const convertSteps = [...localValidationSteps, webExportStep];
if (hasExpoToken) {
  convertSteps.push(previewBuildStep);
}

const plans = {
  convert: {
    description: hasExpoToken
      ? 'Pipeline principal para electric-web copia: compila el proyecto, exporta web Expo y dispara preview native build.'
      : 'Pipeline principal para electric-web copia: compila el proyecto y exporta web Expo. El preview native build se omite porque falta EXPO_TOKEN.',
    requiresExpoToken: false,
    steps: convertSteps,
  },
  manual: {
    description: 'Ejecucion manual local para probar el pipeline sin esperar el horario.',
    requiresExpoToken: false,
    steps: [...localValidationSteps, webExportStep],
  },
  hourly: {
    description: 'Chequeo ligero para asegurar que la base native/web siga tipando.',
    requiresExpoToken: false,
    steps: [
      buildStep('Validar TypeScript de apps/mobile', [
        '--prefix',
        'apps/mobile',
        'run',
        'typecheck',
      ]),
    ],
  },
  daily: {
    description: 'Compila la base compartida y vuelve a exportar la version web de Expo.',
    requiresExpoToken: false,
    steps: [...localValidationSteps, webExportStep],
  },
  weekly: {
    description: 'Lanza un build preview Android+iOS en EAS para pruebas internas.',
    requiresExpoToken: true,
    steps: [...localValidationSteps, previewBuildStep],
  },
  monthly: {
    description: autoSubmit
      ? 'Lanza build production Android+iOS y solicita envio automatico a stores.'
      : 'Lanza build production Android+iOS listo para distribucion.',
    requiresExpoToken: true,
    steps: [...localValidationSteps, productionBuildStep],
  },
};

if (!plans[profile]) {
  fail(
    `Perfil no soportado: ${profile}. Usa uno de: ${Object.keys(plans).join(', ')}.`,
    6,
  );
}

ensurePathExists(repoRoot, 'el repo raiz');
ensurePathExists(mobileRoot, 'apps/mobile');
ensurePathExists(path.join(mobileRoot, 'app.json'), 'apps/mobile/app.json');
ensurePathExists(path.join(mobileRoot, 'eas.json'), 'apps/mobile/eas.json');
ensureCommand('node', 'Node.js');
ensureCommand(npmCommand, 'npm');
ensureCommand(npxCommand, 'npx');

if (plans[profile].requiresExpoToken && !dryRun) {
  ensureExpoToken();
}

log(`Repo: ${repoRoot}`);
log(`Perfil: ${profile}`);
log(`Modo dry-run: ${dryRun ? 'si' : 'no'}`);
log(`Auto-submit: ${autoSubmit ? 'si' : 'no'}`);
log(plans[profile].description);

for (const step of plans[profile].steps) {
  runStep(step);
}

log('Pipeline finalizado.');
