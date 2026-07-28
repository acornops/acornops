import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const manifests = {
  'control-plane': readJson('control-plane/docs/contracts/manifest.json'),
  'management-console': readJson('management-console/docs/contracts/manifest.json'),
  'platform-admin-console': readJson('platform-admin-console/docs/contracts/manifest.json'),
  'execution-engine': readJson('execution-engine/docs/contracts/manifest.json'),
  'llm-gateway': readJson('llm-gateway/docs/contracts/manifest.json'),
  'agentk': readJson('agentk/docs/contracts/manifest.json'),
  'agentv': readJson('agentv/docs/contracts/manifest.json')
};

const failures = [];
const workflowTemplateContract = readJson('contracts/workflow-template-conformance.json');

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function expectCounterpart(leftRepo, leftCounterpart, rightRepo, rightCounterpart) {
  const left = manifests[leftRepo]?.counterparts?.[leftCounterpart];
  const right = manifests[rightRepo]?.counterparts?.[rightCounterpart];
  expect(Boolean(left), `Missing manifest contract ${leftRepo} -> ${leftCounterpart}`);
  expect(Boolean(right), `Missing manifest contract ${rightRepo} -> ${rightCounterpart}`);
  if (!left || !right) {
    return;
  }
  expect(
    stable(left) === stable(right),
    `Manifest mismatch between ${leftRepo} -> ${leftCounterpart} and ${rightRepo} -> ${rightCounterpart}`
  );
}

for (const [repoName, manifest] of Object.entries(manifests)) {
  expect(manifest.repo === repoName, `Manifest repo mismatch for ${repoName}`);
  expect(manifest.version === 1, `Manifest version mismatch for ${repoName}`);
}

expectCounterpart('control-plane', 'management-console', 'management-console', 'control-plane');
expectCounterpart('control-plane', 'platform-admin-console', 'platform-admin-console', 'control-plane');
expectCounterpart('control-plane', 'execution-engine', 'execution-engine', 'control-plane');
expectCounterpart('control-plane', 'llm-gateway', 'llm-gateway', 'control-plane');
expectCounterpart('control-plane', 'agentk', 'agentk', 'control-plane');
expectCounterpart('control-plane', 'agentv', 'agentv', 'control-plane');
expectCounterpart('execution-engine', 'llm-gateway', 'llm-gateway', 'execution-engine');
expect(
  stable(readJson('control-plane/test/fixtures/workflow-template-conformance.json')) === stable(workflowTemplateContract),
  'Control-plane workflow template conformance fixture differs from the workspace contract'
);
expect(
  stable(readJson('management-console/src/pages/workflows/workflow-template-conformance.json')) === stable(workflowTemplateContract),
  'Management-console workflow template conformance fixture differs from the workspace contract'
);

if (failures.length > 0) {
  console.error('Cross-repo contract checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Cross-repo contract checks passed.');
