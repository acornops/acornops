import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const gate = fileURLToPath(new URL('./check-platform-contracts.mjs', import.meta.url));
const counterparts = [
  ['agentv/src/windows/fixtures/snapshot-contract.json', 'control-plane/test/fixtures/windows-snapshot-contract.json'],
  ['agentv/scripts/windows-tests/generated-command-fixtures.json', 'control-plane/test/fixtures/windows-generated-commands.json'],
  ['agentv/docs/contracts/windows-read-runtime.md', 'control-plane/docs/contracts/windows-read-runtime.md']
];

test('the workspace gate rejects drift in every Windows fixture and runtime counterpart', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'windows-contract-gate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repos = ['control-plane', 'management-console', 'platform-admin-console', 'execution-engine', 'llm-gateway', 'agentk', 'agentv'];
  function write(relative, content) {
    const filename = path.join(root, relative);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, content);
  }
  for (const repo of repos) write(`${repo}/docs/contracts/manifest.json`, JSON.stringify({
    repo, version: 1, counterparts: Object.fromEntries(repos.filter((name) => name !== repo).map((name) => [name, {}]))
  }));
  for (const pair of counterparts) for (const filename of pair) write(filename, 'canonical\n');
  const run = () => spawnSync(process.execPath, [gate], { cwd: root, encoding: 'utf8' });
  assert.equal(run().status, 0);
  for (const [left, right] of counterparts) {
    write(right, 'drift\n');
    const result = run();
    assert.equal(result.status, 1, `must reject drift in ${right}`);
    assert.ok(result.stderr.includes(left), result.stderr);
    assert.ok(result.stderr.includes(right), result.stderr);
    write(right, 'canonical\n');
  }
  rmSync(path.join(root, counterparts[0][1]));
  assert.equal(run().status, 1, 'must reject a missing counterpart');
});
