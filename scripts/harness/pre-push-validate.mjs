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

  if (scripts['harness:check']) run('npm run harness:check', repoPath, repoName);
}

function runTaskChecks(repoName, repoPath) {
  if (taskfileHasTask(repoPath, 'harness:check')) run('task harness:check', repoPath, repoName);
}

function runWorkspaceHarness() {
  run('./scripts/harness/check-agent-harness.sh', workspaceRoot, 'acornops');
  run('node scripts/harness/check-platform-harness.mjs', workspaceRoot, 'acornops');
}

const repoRoot = gitOutput(['rev-parse', '--show-toplevel']);
const repo = repoRoot === workspaceRoot
  ? { name: 'acornops', absolutePath: workspaceRoot }
  : loadWorkspace().find((candidate) => candidate.absolutePath === repoRoot);

if (!repo) {
  console.log(`Repository ${repoRoot} is not managed by ${workspaceRoot}/workspace.yaml; skipping AcornOps pre-push validation.`);
  process.exit(0);
}

try {
  runPackageChecks(repo.name, repo.absolutePath);
  runTaskChecks(repo.name, repo.absolutePath);
  runWorkspaceHarness();
} catch (error) {
  console.error('\nPre-push validation failed.');
  console.error(error.message);
  console.error('\nThe command output above should identify the failing harness rule or file. Fix the harness failure, then retry push.');
  console.error('Use git push --no-verify only for an intentional emergency bypass.');
  process.exit(1);
}
