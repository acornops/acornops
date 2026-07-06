import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadWorkspace, workspaceRoot } from '../lib/workspace.mjs';

const root = workspaceRoot;

const docsSiteRepos = new Set(['docs-website']);
const staticInfrastructureRepos = new Set(['charts']);

const standardRequiredFiles = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'docs/index.md',
  'docs/DESIGN.md',
  'docs/PLANS.md',
  'docs/AGENT_HANDOFF.md',
  'docs/QUALITY_SCORE.md',
  'docs/RELIABILITY.md',
  'docs/SECURITY.md',
  'docs/design-docs/index.md',
  'docs/design-docs/core-beliefs.md',
  'docs/product-specs/index.md',
  'docs/product-specs/component-charter.md',
  'docs/references/index.md',
  'docs/generated/README.md',
  'docs/exec-plans/active/README.md',
  'docs/exec-plans/completed/README.md',
  'docs/exec-plans/tech-debt-tracker.md',
  'docs/contracts/README.md',
  'docs/contracts/manifest.json',
  '.agents/skills/README.md',
  '.agents/skills/shared/.standards-version'
];

const docsSiteRequiredFiles = [
  'AGENTS.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs.json',
  'package.json',
  'scripts/check-docs.mjs',
  '.github/workflows/ci.yml',
  '.agents/skills/README.md',
  '.agents/skills/shared/.standards-version'
];

const staticInfrastructureRequiredFiles = [
  'AGENTS.md',
  'README.md',
  'index.yaml',
  '.agents/skills/README.md',
  '.agents/skills/shared/.standards-version'
];

const githubTemplateFiles = [
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE/cross-repo.md',
  '.github/PULL_REQUEST_TEMPLATE/docs-maintenance.md',
  '.github/ISSUE_TEMPLATE/cross-repo-change.md',
  '.github/ISSUE_TEMPLATE/docs-maintenance.md'
];

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function repoRelative(repo, relativePath = '') {
  return path.join(path.relative(root, repo.absolutePath), relativePath);
}

function readRepo(repo, relativePath) {
  return readFileSync(path.join(repo.absolutePath, relativePath), 'utf8');
}

function expectRepoFile(repo, relativePath) {
  expect(existsSync(path.join(repo.absolutePath, relativePath)), `Missing required harness file ${repoRelative(repo, relativePath)}`);
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

function assertSyncedTree(label, sourceDirectory, targetDirectory, ignoredTargetFiles = new Set()) {
  if (!existsSync(sourceDirectory)) {
    failures.push(`Missing sync source ${sourceDirectory}`);
    return;
  }
  if (!existsSync(targetDirectory)) {
    failures.push(`Missing sync target ${targetDirectory}`);
    return;
  }

  const sourceFiles = collectFiles(sourceDirectory);
  const targetFiles = collectFiles(targetDirectory, ignoredTargetFiles);
  expect(
    JSON.stringify(targetFiles) === JSON.stringify(sourceFiles),
    `${label} is not synced: expected files ${sourceFiles.join(', ') || '(none)'}, found ${targetFiles.join(', ') || '(none)'}`
  );

  for (const file of sourceFiles) {
    const source = readFileSync(path.join(sourceDirectory, file), 'utf8');
    const targetPath = path.join(targetDirectory, file);
    if (!existsSync(targetPath)) continue;
    const target = readFileSync(targetPath, 'utf8');
    expect(source === target, `${label} differs at ${file}`);
  }
}

function assertSyncedFile(label, sourceFile, targetFile) {
  if (!existsSync(sourceFile)) {
    failures.push(`Missing sync source ${sourceFile}`);
    return;
  }
  if (!existsSync(targetFile)) {
    failures.push(`Missing synced file ${label}`);
    return;
  }
  expect(readFileSync(sourceFile, 'utf8') === readFileSync(targetFile, 'utf8'), `${label} differs from workspace source`);
}

function parseStandardsVersion(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) values.set(key, valueParts.join('='));
  }
  return values;
}

function checkSharedSync(repo) {
  const targetShared = path.join(repo.absolutePath, '.agents/skills/shared');
  assertSyncedTree(
    `${repo.name} shared skills`,
    path.join(root, '.agents/skills/shared'),
    targetShared,
    new Set(['.standards-version'])
  );
  assertSyncedFile(
    `${repo.name}/.agents/skills/README.md`,
    path.join(root, '.agents/skills/README.md'),
    path.join(repo.absolutePath, '.agents/skills/README.md')
  );

  const versionFile = path.join(targetShared, '.standards-version');
  if (!existsSync(versionFile)) return;

  const version = parseStandardsVersion(readFileSync(versionFile, 'utf8'));
  expect(version.get('source') === 'acornops', `${repo.name} shared skills standards source should be acornops`);
  expect(Boolean(version.get('revision')), `${repo.name} shared skills standards revision is required`);
  expect(Boolean(version.get('synced_at')), `${repo.name} shared skills sync timestamp is required`);
}

function checkGithubTemplateSync(repo) {
  for (const file of githubTemplateFiles) {
    assertSyncedFile(`${repoRelative(repo, file)}`, path.join(root, file), path.join(repo.absolutePath, file));
  }
}

function checkCommonRepoRules(repo) {
  checkSharedSync(repo);
  checkGithubTemplateSync(repo);

  for (const metadataPath of ['.DS_Store', '.agents/.DS_Store', '.agents/skills/.DS_Store']) {
    expect(!existsSync(path.join(repo.absolutePath, metadataPath)), `Remove generated metadata file ${repoRelative(repo, metadataPath)}`);
  }
  for (const vendorPath of ['CLAUDE.md', 'GEMINI.md', '.cursor', '.cursorrules']) {
    expect(!existsSync(path.join(repo.absolutePath, vendorPath)), `Do not add required vendor-specific agent instruction file ${repoRelative(repo, vendorPath)}`);
  }
}

function checkStandardRepo(repo) {
  for (const file of standardRequiredFiles) {
    expectRepoFile(repo, file);
  }

  const agents = readRepo(repo, 'AGENTS.md');
  const readme = readRepo(repo, 'README.md');
  const docsIndex = readRepo(repo, 'docs/index.md');
  const handoff = readRepo(repo, 'docs/AGENT_HANDOFF.md');
  expect(agents.split('\n').length <= 140, `${repoRelative(repo, 'AGENTS.md')} should remain short`);
  expect(!agents.includes('/Users/'), `${repoRelative(repo, 'AGENTS.md')} should use portable relative links`);
  expect(agents.includes('Agent-Assisted Development'), `${repoRelative(repo, 'AGENTS.md')} should describe agent-assisted development entrypoints`);
  expect(agents.includes('acornops-workspace'), `${repoRelative(repo, 'AGENTS.md')} should point cross-repo agent work to the workspace root`);
  expect(!agents.includes('acornops-agent-standards'), `${repoRelative(repo, 'AGENTS.md')} must not reference the retired standards repository`);
  expect(agents.includes('.agents/skills/shared'), `${repoRelative(repo, 'AGENTS.md')} should describe shared skills`);
  expect(agents.includes('.agents/skills/local'), `${repoRelative(repo, 'AGENTS.md')} should describe local skills`);
  expect(agents.includes('docs/AGENT_HANDOFF.md'), `${repoRelative(repo, 'AGENTS.md')} should link agent handoff policy`);
  expect(readme.includes('Agent-Assisted Development'), `${repoRelative(repo, 'README.md')} should describe agent-assisted development entrypoints`);
  expect(docsIndex.includes('docs/AGENT_HANDOFF.md'), `${repoRelative(repo, 'docs/index.md')} should link agent handoff policy`);
  expect(handoff.includes('Use Conventional Commits 1.0.0'), `${repoRelative(repo, 'docs/AGENT_HANDOFF.md')} should require commit policy`);
  expect(handoff.includes('exact commands run'), `${repoRelative(repo, 'docs/AGENT_HANDOFF.md')} should include handoff evidence`);
  expect(handoff.includes('Vendor Neutrality'), `${repoRelative(repo, 'docs/AGENT_HANDOFF.md')} should include vendor-neutrality policy`);
  expect(docsIndex.includes('docs/QUALITY_SCORE.md'), `${repoRelative(repo, 'docs/index.md')} should link quality score`);
  expect(docsIndex.includes('docs/RELIABILITY.md'), `${repoRelative(repo, 'docs/index.md')} should link reliability doc`);
  expect(docsIndex.includes('docs/SECURITY.md'), `${repoRelative(repo, 'docs/index.md')} should link security doc`);
}

function checkDocsSiteRepo(repo) {
  for (const file of docsSiteRequiredFiles) {
    expectRepoFile(repo, file);
  }

  const agents = readRepo(repo, 'AGENTS.md');
  const readme = readRepo(repo, 'README.md');
  const contributing = readRepo(repo, 'CONTRIBUTING.md');
  const packageJson = JSON.parse(readRepo(repo, 'package.json'));
  const docsConfig = JSON.parse(readRepo(repo, 'docs.json'));

  expect(agents.split('\n').length <= 140, `${repoRelative(repo, 'AGENTS.md')} should remain short`);
  expect(!agents.includes('/Users/'), `${repoRelative(repo, 'AGENTS.md')} should use portable relative links`);
  expect(agents.includes('Agent-Assisted Development'), `${repoRelative(repo, 'AGENTS.md')} should describe agent-assisted development entrypoints`);
  expect(agents.includes('acornops-workspace'), `${repoRelative(repo, 'AGENTS.md')} should point cross-repo agent work to the workspace root`);
  expect(agents.includes('.agents/skills/shared'), `${repoRelative(repo, 'AGENTS.md')} should describe shared skills`);
  expect(agents.includes('.agents/skills/local'), `${repoRelative(repo, 'AGENTS.md')} should describe local skills`);
  expect(agents.includes('exact commands run'), `${repoRelative(repo, 'AGENTS.md')} should include handoff evidence`);
  expect(agents.includes('Conventional Commits'), `${repoRelative(repo, 'AGENTS.md')} should include commit policy`);
  expect(agents.includes('Vendor Neutrality'), `${repoRelative(repo, 'AGENTS.md')} should include vendor-neutrality policy`);
  expect(readme.includes('Agent-Assisted Development'), `${repoRelative(repo, 'README.md')} should describe agent-assisted development entrypoints`);
  expect(contributing.includes('AcornOps workspace repository'), `${repoRelative(repo, 'CONTRIBUTING.md')} should point cross-repo work to the workspace`);
  expect(packageJson.scripts?.check === 'node scripts/check-docs.mjs', `${repoRelative(repo, 'package.json')} should expose docs structural checks`);
  expect(Boolean(packageJson.scripts?.validate), `${repoRelative(repo, 'package.json')} should expose docs validation`);
  expect(Boolean(packageJson.scripts?.links), `${repoRelative(repo, 'package.json')} should expose link validation`);
  expect(docsConfig.name === 'AcornOps', `${repoRelative(repo, 'docs.json')} should identify AcornOps docs`);
  expect(Boolean(docsConfig.navigation), `${repoRelative(repo, 'docs.json')} should define Mintlify navigation`);
}

function checkStaticInfrastructureRepo(repo) {
  for (const file of staticInfrastructureRequiredFiles) {
    expectRepoFile(repo, file);
  }

  const agents = readRepo(repo, 'AGENTS.md');
  const readme = readRepo(repo, 'README.md');
  const index = readRepo(repo, 'index.yaml');

  expect(agents.split('\n').length <= 140, `${repoRelative(repo, 'AGENTS.md')} should remain short`);
  expect(!agents.includes('/Users/'), `${repoRelative(repo, 'AGENTS.md')} should use portable relative links`);
  expect(agents.includes('Agent-Assisted Development'), `${repoRelative(repo, 'AGENTS.md')} should describe agent-assisted development entrypoints`);
  expect(agents.includes('acornops-workspace'), `${repoRelative(repo, 'AGENTS.md')} should point cross-repo agent work to the workspace root`);
  expect(agents.includes('.agents/skills/shared'), `${repoRelative(repo, 'AGENTS.md')} should describe shared skills`);
  expect(agents.includes('.agents/skills/local'), `${repoRelative(repo, 'AGENTS.md')} should describe local skills`);
  expect(readme.includes('helm repo add acornops'), `${repoRelative(repo, 'README.md')} should document the Helm repository install path`);
  expect(readme.includes('acornops.github.io/charts'), `${repoRelative(repo, 'README.md')} should document the public GitHub Pages URL`);
  expect(index.includes('apiVersion: v1'), `${repoRelative(repo, 'index.yaml')} should be a Helm repository index`);
  expect(index.includes('entries:'), `${repoRelative(repo, 'index.yaml')} should define Helm chart entries`);
}

for (const repo of loadWorkspace()) {
  checkCommonRepoRules(repo);
  if (docsSiteRepos.has(repo.name)) {
    checkDocsSiteRepo(repo);
  } else if (staticInfrastructureRepos.has(repo.name)) {
    checkStaticInfrastructureRepo(repo);
  } else {
    checkStandardRepo(repo);
  }
}

if (failures.length > 0) {
  console.error('Platform harness checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Platform harness checks passed.');
