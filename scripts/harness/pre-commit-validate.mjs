#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkspace, shellCommand, workspaceRoot } from '../lib/workspace.mjs';
import { execFileSync } from 'node:child_process';

function gitOutput(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function run(command, cwd, label) {
  console.log(`\n== ${label}: ${command} ==`);
  shellCommand(command, cwd);
}

function packageScripts(repoPath) {
  const packagePath = path.join(repoPath, 'package.json');
  if (!existsSync(packagePath)) return {};
  return JSON.parse(readFileSync(packagePath, 'utf8')).scripts || {};
}

function taskfileHasTask(repoPath, taskName) {
  const taskfilePath = path.join(repoPath, 'Taskfile.yml');
  if (!existsSync(taskfilePath)) return false;
  const taskfile = readFileSync(taskfilePath, 'utf8');
  return new RegExp(`^  ${taskName}:`, 'm').test(taskfile);
}

function runPackageChecks(repoName, repoPath) {
  const scripts = packageScripts(repoPath);

  if (scripts.lint) run('npm run lint', repoPath, repoName);
  if (scripts['style:check']) run('npm run style:check', repoPath, repoName);
}

function runTaskChecks(repoName, repoPath) {
  if (taskfileHasTask(repoPath, 'lint')) run('task lint', repoPath, repoName);
}

function checkAgentsLineLimit(repoName, repoPath) {
  const agentsPath = path.join(repoPath, 'AGENTS.md');
  if (!existsSync(agentsPath)) return;

  const lineCount = readFileSync(agentsPath, 'utf8').split('\n').length;
  if (lineCount > 140) {
    throw new Error(`${repoName}: AGENTS.md has ${lineCount} lines; keep it at 140 lines or fewer and move details into linked docs.`);
  }
}

const repoRoot = gitOutput(['rev-parse', '--show-toplevel']);
const repo = repoRoot === workspaceRoot
  ? { name: 'acornops-workspace', absolutePath: workspaceRoot }
  : loadWorkspace().find((candidate) => candidate.absolutePath === repoRoot);

if (!repo) {
  console.log(`Repository ${repoRoot} is not managed by ${workspaceRoot}/workspace.yaml; skipping AcornOps pre-commit validation.`);
  process.exit(0);
}

try {
  runPackageChecks(repo.name, repo.absolutePath);
  runTaskChecks(repo.name, repo.absolutePath);
  checkAgentsLineLimit(repo.name, repo.absolutePath);
} catch (error) {
  console.error('\nPre-commit validation failed.');
  console.error(error.message);
  console.error('\nThe command output above should identify the failing files or rule. Fix the lint/style or AGENTS.md line-limit issue, then retry commit.');
  console.error('Use git commit --no-verify only for an intentional emergency bypass.');
  process.exit(1);
}
