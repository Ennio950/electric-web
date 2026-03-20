import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  asBoolean,
  nowIso,
  parseArgs,
  repoRoot,
  saveAgentWorkspacesDocument,
} from './lib/workflow-utils.js';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
}

function assertSuccess(result, message) {
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || 'unknown error';
    throw new Error(`${message}: ${detail}`.trim());
  }
}

function commandOutput(command, args) {
  const result = run(command, args);
  if (result.error || result.status !== 0) {
    return null;
  }

  return String(result.stdout || '').trim();
}

function hasHeadCommit() {
  return Boolean(commandOutput('git', ['rev-parse', '--verify', 'HEAD']));
}

function ensureGitRepo(defaultBranch) {
  const insideRepo = commandOutput('git', ['rev-parse', '--is-inside-work-tree']) === 'true';
  let initialized = false;

  if (!insideRepo) {
    let initResult = run('git', ['init', '-b', defaultBranch]);
    if (initResult.error || initResult.status !== 0) {
      initResult = run('git', ['init']);
      assertSuccess(initResult, 'No se pudo inicializar git');
      assertSuccess(run('git', ['branch', '-M', defaultBranch]), 'No se pudo renombrar la rama inicial');
    }

    initialized = true;
  }

  if (!commandOutput('git', ['config', '--get', 'user.name'])) {
    assertSuccess(run('git', ['config', 'user.name', 'Workflow Bootstrap']), 'No se pudo configurar git user.name');
  }

  if (!commandOutput('git', ['config', '--get', 'user.email'])) {
    assertSuccess(run('git', ['config', 'user.email', 'workflow-bootstrap@local']), 'No se pudo configurar git user.email');
  }

  return initialized;
}

function ensureBaselineCommit() {
  if (hasHeadCommit()) {
    return false;
  }

  assertSuccess(run('git', ['add', '-A']), 'No se pudo preparar el baseline de git');
  assertSuccess(
    run('git', ['commit', '-m', 'chore: bootstrap multi-agent baseline']),
    'No se pudo crear el commit baseline',
  );
  return true;
}

function ensureBranch(branchName, baseRef) {
  const exists = commandOutput('git', ['show-ref', '--verify', `refs/heads/${branchName}`]);
  if (exists) {
    return false;
  }

  assertSuccess(run('git', ['branch', branchName, baseRef]), `No se pudo crear la rama ${branchName}`);
  return true;
}

function listWorktrees() {
  const output = commandOutput('git', ['worktree', 'list', '--porcelain']) || '';
  return output
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const worktreeLine = lines.find((line) => line.startsWith('worktree '));
      const branchLine = lines.find((line) => line.startsWith('branch '));

      return {
        path: worktreeLine ? path.resolve(worktreeLine.slice('worktree '.length).trim()) : null,
        branch: branchLine ? branchLine.slice('branch refs/heads/'.length).trim() : null,
      };
    })
    .filter((entry) => entry.path);
}

function ensureWorktree(worktreePath, branchName) {
  const absolutePath = path.resolve(worktreePath);
  const existing = listWorktrees().find((entry) => entry.path === absolutePath);

  if (existing) {
    return {
      created: false,
      path: absolutePath,
      branch: existing.branch || branchName,
    };
  }

  assertSuccess(
    run('git', ['worktree', 'add', absolutePath, branchName]),
    `No se pudo crear el worktree ${absolutePath}`,
  );

  return {
    created: true,
    path: absolutePath,
    branch: branchName,
  };
}

const args = parseArgs(process.argv.slice(2));
const defaultBranch = args.branch || 'main';
const createWorktrees = asBoolean(args.worktrees) || asBoolean(args['with-worktrees']);
const codexPath = path.resolve(args['codex-path'] || path.join(repoRoot, '..', `${path.basename(repoRoot)}-codex`));
const claudePath = path.resolve(args['claude-path'] || path.join(repoRoot, '..', `${path.basename(repoRoot)}-claude`));

assertSuccess(run('git', ['--version']), 'Git no esta disponible en PATH');

const gitInitialized = ensureGitRepo(defaultBranch);
const baselineCommitCreated = ensureBaselineCommit();

let codexWorkspace = repoRoot;
let claudeWorkspace = repoRoot;
let codexWorktree = null;
let claudeWorktree = null;

if (createWorktrees) {
  ensureBranch('agent/codex', defaultBranch);
  ensureBranch('agent/claude', defaultBranch);
  codexWorktree = ensureWorktree(codexPath, 'agent/codex');
  claudeWorktree = ensureWorktree(claudePath, 'agent/claude');
  codexWorkspace = codexWorktree.path;
  claudeWorkspace = claudeWorktree.path;
}

saveAgentWorkspacesDocument({
  updatedAt: nowIso(),
  agents: {
    codex: { path: codexWorkspace },
    claude: { path: claudeWorkspace },
  },
});

process.stdout.write(`${JSON.stringify({
  projectRoot: repoRoot,
  gitInitialized,
  baselineCommitCreated,
  createWorktrees,
  workspaces: {
    codex: codexWorkspace,
    claude: claudeWorkspace,
  },
  worktrees: {
    codex: codexWorktree,
    claude: claudeWorktree,
  },
  localConfig: path.join(repoRoot, 'automation', 'agent-workspaces.local.json'),
}, null, 2)}\n`);
