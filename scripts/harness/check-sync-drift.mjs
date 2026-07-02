#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadWorkspace, workspaceRoot } from '../lib/workspace.mjs';

const githubTemplateFiles = [
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE/cross-repo.md',
  '.github/PULL_REQUEST_TEMPLATE/docs-maintenance.md',
  '.github/ISSUE_TEMPLATE/cross-repo-change.md',
  '.github/ISSUE_TEMPLATE/docs-maintenance.md',
];

function usage() {
  console.log(`Usage: node scripts/harness/check-sync-drift.mjs (--staged|--all)

Options:
  --staged   Check only sync surfaces touched by staged workspace changes.
  --all      Check every sync surface.
`);
}

function gitOutput(args, cwd = workspaceRoot) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function stagedFiles() {
  const output = gitOutput(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
  return output ? output.split(/\r?\n/) : [];
}

function touchedSurfaces(files) {
  const surfaces = new Set();

  for (const file of files) {
    if (file.startsWith('.agents/skills/shared/') || file === '.agents/skills/README.md') {
      surfaces.add('shared-skills');
    }
    if (
      file === '.github/pull_request_template.md' ||
      file.startsWith('.github/PULL_REQUEST_TEMPLATE/') ||
      file.startsWith('.github/ISSUE_TEMPLATE/')
    ) {
      surfaces.add('github-templates');
    }
    if (file === '.claude/settings.json') {
      surfaces.add('claude-settings');
    }
    if (
      file.startsWith('.githooks/') ||
      file === 'scripts/harness/check-sync-drift.mjs' ||
      file === 'scripts/sync/githooks.sh'
    ) {
      surfaces.add('githooks');
    }
  }

  return surfaces;
}

function availableRepos() {
  return loadWorkspace().filter((repo) => existsSync(repo.absolutePath) && existsSync(path.join(repo.absolutePath, '.git')));
}

function fileMatches(sourceFile, targetFile) {
  if (!existsSync(sourceFile) || !existsSync(targetFile)) return false;
  return readFileSync(sourceFile, 'utf8') === readFileSync(targetFile, 'utf8');
}

function collectFiles(directory, ignored = new Set(), prefix = '') {
  if (!existsSync(directory)) return [];

  const files = [];
  for (const entry of readdirSync(directory).sort()) {
    const relativePath = prefix ? path.join(prefix, entry) : entry;
    if (ignored.has(relativePath)) continue;

    const absolutePath = path.join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(absolutePath, ignored, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

function treeMatches(sourceDirectory, targetDirectory, ignoredTargetFiles = new Set()) {
  if (!existsSync(sourceDirectory) || !existsSync(targetDirectory)) return false;

  const sourceFiles = collectFiles(sourceDirectory);
  const targetFiles = collectFiles(targetDirectory, ignoredTargetFiles);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(targetFiles)) return false;

  return sourceFiles.every((file) => fileMatches(path.join(sourceDirectory, file), path.join(targetDirectory, file)));
}

function checkSharedSkillsSync(repos) {
  const failures = [];
  const sourceShared = path.join(workspaceRoot, '.agents/skills/shared');
  const sourceReadme = path.join(workspaceRoot, '.agents/skills/README.md');

  for (const repo of repos) {
    if (!treeMatches(sourceShared, path.join(repo.absolutePath, '.agents/skills/shared'), new Set(['.standards-version']))) {
      failures.push(`${repo.name}: shared skills are not synced`);
    }
    if (!fileMatches(sourceReadme, path.join(repo.absolutePath, '.agents/skills/README.md'))) {
      failures.push(`${repo.name}: shared skills README is not synced`);
    }
  }

  return failures;
}

function checkGithubTemplateSync(repos) {
  const failures = [];

  for (const repo of repos) {
    for (const file of githubTemplateFiles) {
      if (!fileMatches(path.join(workspaceRoot, file), path.join(repo.absolutePath, file))) {
        failures.push(`${repo.name}: ${file} is not synced`);
      }
    }
  }

  return failures;
}

function checkClaudeSettingsSync(repos) {
  const failures = [];
  const sourceSettings = path.join(workspaceRoot, '.claude/settings.json');

  for (const repo of repos) {
    if (!fileMatches(sourceSettings, path.join(repo.absolutePath, '.claude/settings.json'))) {
      failures.push(`${repo.name}: .claude/settings.json is not synced`);
    }
  }

  return failures;
}

function configuredHooksPath(repoPath) {
  try {
    return gitOutput(['config', '--get', 'core.hooksPath'], repoPath);
  } catch {
    return '';
  }
}

function checkGitHooksSetup(repos) {
  const failures = [];
  const expectedHooksPath = path.join(workspaceRoot, '.githooks');

  if (configuredHooksPath(workspaceRoot) !== expectedHooksPath) {
    failures.push('acornops-workspace: core.hooksPath is not configured');
  }

  for (const repo of repos) {
    if (configuredHooksPath(repo.absolutePath) !== expectedHooksPath) {
      failures.push(`${repo.name}: core.hooksPath is not configured`);
    }
  }

  return failures;
}

function unique(values) {
  return [...new Set(values)];
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const unknownArgs = args.filter((arg) => arg !== '--staged' && arg !== '--all');
if (unknownArgs.length > 0) {
  console.error(`Unexpected argument: ${unknownArgs[0]}`);
  usage();
  process.exit(1);
}

const stagedMode = args.includes('--staged');
const allMode = args.includes('--all');
if (stagedMode === allMode) {
  usage();
  process.exit(1);
}

const repoRoot = gitOutput(['rev-parse', '--show-toplevel']);
if (repoRoot !== workspaceRoot) {
  process.exit(0);
}

const files = stagedMode
  ? stagedFiles()
  : ['.agents/skills/shared/', '.agents/skills/README.md', '.github/pull_request_template.md', '.claude/settings.json', '.githooks/'];
const surfaces = touchedSurfaces(files);
if (surfaces.size === 0) {
  process.exit(0);
}

const repos = availableRepos();
const failures = [];
const commands = [];

function record(surfaceFailures, surfaceCommands) {
  failures.push(...surfaceFailures);
  if (surfaceFailures.length > 0) commands.push(...surfaceCommands);
}

if (surfaces.has('shared-skills')) {
  record(checkSharedSkillsSync(repos), ['./scripts/sync/shared-skills.sh --dry-run', './scripts/sync/shared-skills.sh']);
}

if (surfaces.has('github-templates')) {
  record(checkGithubTemplateSync(repos), ['./scripts/sync/github-templates.sh --dry-run', './scripts/sync/github-templates.sh']);
}

if (surfaces.has('claude-settings')) {
  record(checkClaudeSettingsSync(repos), ['./scripts/sync/claude-settings.sh --dry-run', './scripts/sync/claude-settings.sh']);
}

if (surfaces.has('githooks')) {
  record(checkGitHooksSetup(repos), ['./scripts/sync/githooks.sh --dry-run', './scripts/sync/githooks.sh']);
}

if (failures.length === 0) {
  process.exit(0);
}

console.error(stagedMode
  ? 'Shared workspace files changed, but synced outputs or local hook config are stale.'
  : 'Shared sync outputs or local hook config are stale.');
console.error('');
console.error('Out-of-sync checks:');
for (const failure of failures) console.error(` - ${failure}`);
console.error('');
console.error('Run the relevant sync command(s), review the resulting repository changes, then retry the commit:');
for (const command of unique(commands)) console.error(`  ${command}`);
console.error('');
console.error('Use --no-verify only for an intentional emergency bypass.');
process.exit(1);
