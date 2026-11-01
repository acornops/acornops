import assert from 'node:assert/strict';
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const source = fileURLToPath(new URL('../../', import.meta.url));
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function workspace(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'acornops-harness-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'workspace');
  // Copy only parent-owned files, using working-tree contents so the real gates
  // under review run without needing any child checkout or installed dependency.
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: source, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    const original = path.join(source, file);
    if (lstatSync(original).isSymbolicLink()) symlinkSync(readlinkSync(original), path.join(root, file));
    else copyFileSync(original, path.join(root, file));
  }
  execFileSync('git', ['init', '--quiet', root], { env: gitEnv });
  const run = (command, args) => spawnSync(command, args, { cwd: root, env: gitEnv, encoding: 'utf8' });
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), value);
  };
  return { root, directory, run, write };
}

function passed(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('parent ignores absent, directory and linked children without ignoring unrelated paths', (t) => {
  const { root, directory, run, write } = workspace(t);
  const harness = () => run('bash', ['scripts/harness/check-agent-harness.sh']);
  passed(harness());
  write('agentv/untracked-child.txt', 'child-owned');
  passed(harness());
  passed(run('git', ['check-ignore', '-q', 'agentv/untracked-child.txt']));
  rmSync(path.join(root, 'agentv'), { recursive: true });
  mkdirSync(path.join(directory, 'linked-child'));
  for (const name of ['agentv', 'platform-admin-console']) {
    symlinkSync('../linked-child', path.join(root, name));
    passed(run('git', ['check-ignore', '-q', name]));
  }
  passed(harness());
  write('unrelated.txt', 'parent-owned');
  write('examples/agentv/fixture.txt', 'parent-owned');
  for (const file of ['unrelated.txt', 'examples/agentv/fixture.txt']) {
    assert.equal(run('git', ['check-ignore', '-q', file]).status, 1, file);
  }
});

test('parent still rejects tracked child content and tracked child symlinks', (t) => {
  for (const name of ['agentv', 'platform-admin-console']) {
    const { root, directory, run, write } = workspace(t);
    write(`${name}/tracked.txt`, 'must not become parent content');
    passed(run('git', ['add', '--force', `${name}/tracked.txt`]));
    let result = run('bash', ['scripts/harness/check-agent-harness.sh']);
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes(`Child repository ${name}/ must not be tracked`), result.stdout);
    passed(run('git', ['rm', '--cached', `${name}/tracked.txt`]));
    rmSync(path.join(root, name), { recursive: true });
    mkdirSync(path.join(directory, 'linked-child'));
    symlinkSync('../linked-child', path.join(root, name));
    passed(run('git', ['add', '--force', name]));
    result = run('bash', ['scripts/harness/check-agent-harness.sh']);
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes(`Child repository ${name}/ must not be tracked`), result.stdout);
  }
});

test('platform counts follow the child contract while invalid or drifting counts fail', (t) => {
  const { root, run, write } = workspace(t);
  const child = 'platform-admin-console';
  write('workspace.yaml', `repositories:\n  - name: ${child}\n    path: ./${child}\n`);
  // Minimal documented standard-repository harness, independent of child product code.
  const docs = ['ARCHITECTURE.md', 'docs/DESIGN.md', 'docs/PLANS.md', 'docs/QUALITY_SCORE.md', 'docs/RELIABILITY.md',
    'docs/SECURITY.md', 'docs/design-docs/index.md', 'docs/design-docs/core-beliefs.md', 'docs/product-specs/index.md',
    'docs/product-specs/component-charter.md', 'docs/references/index.md', 'docs/generated/README.md',
    'docs/exec-plans/active/README.md', 'docs/exec-plans/completed/README.md', 'docs/exec-plans/tech-debt-tracker.md',
    'docs/contracts/README.md'];
  for (const file of docs) write(`${child}/${file}`, '# Fixture\n');
  write(`${child}/AGENTS.md`, 'Agent-Assisted Development in the `acornops` repository.\n.agents/skills/shared\n.agents/skills/local\ndocs/AGENT_HANDOFF.md\n');
  write(`${child}/README.md`, '# Agent-Assisted Development\n');
  write(`${child}/docs/index.md`, 'AGENT_HANDOFF.md\nQUALITY_SCORE.md\nRELIABILITY.md\nSECURITY.md\n');
  write(`${child}/docs/AGENT_HANDOFF.md`, 'Use Conventional Commits 1.0.0; include exact commands run.\nVendor Neutrality\n');
  for (const directory of ['.agents', '.github']) cpSync(path.join(root, directory), path.join(root, child, directory), { recursive: true });
  write(`${child}/.agents/skills/shared/.standards-version`, 'source=acornops\nrevision=fixture\nsynced_at=2026-11-01\n');
  write(`${child}/.agents/skills/local/platform-admin-change/SKILL.md`, 'name: platform-admin-change\nClassify the request\nEXC-*\nBLOCK-*\nnpm run requirements:check\n');
  write(`${child}/docs/product-specs/current-requirements.md`, '## Authority And Change Protocol\nhistorical evidence, not current requirements\n## Superseded And Excluded Behavior\n## Contract-Blocked Capabilities\n');
  write(`${child}/scripts/check-requirements.mjs`, '// Child-owned runtime/evidence checker placeholder.\n');
  const scripts = { 'requirements:check': 'node scripts/check-requirements.mjs', validate: 'npm run requirements:check', 'validate:ci': 'npm run requirements:check' };
  write(`${child}/package.json`, JSON.stringify({ scripts }));
  const baseline = { authority: 'docs/product-specs/current-requirements.md', expectedRuntime: { adminRouteCount: 2, allowedScopeCount: 1 },
    required: Array(10).fill({}), excluded: Array(10).fill({}), blocked: Array(4).fill({}) };
  const contract = { platformAdminPaths: ['GET /admin/v1/me', 'GET /admin/v1/system/readiness'], requiredScopes: ['admin:self'] };
  const check = () => {
    write(`${child}/docs/product-specs/requirements-baseline.json`, JSON.stringify(baseline));
    write(`${child}/docs/contracts/manifest.json`, JSON.stringify({ counterparts: { 'control-plane': contract } }));
    return run(process.execPath, ['scripts/harness/check-platform-harness.mjs']);
  };
  passed(check());
  for (const [field, entries] of [['adminRouteCount', 'platformAdminPaths'], ['allowedScopeCount', 'requiredScopes']]) {
    const count = baseline.expectedRuntime[field];
    const rejectsCount = () => {
      const result = check();
      assert.equal(result.status, 1, `${field}=${baseline.expectedRuntime[field]} must fail`);
      assert.ok(result.stderr.includes(`requirements ${field === 'adminRouteCount' ? 'route' : 'scope'} count must match`), result.stderr);
    };
    for (const invalid of [undefined, 0, -1, 1.5, String(count), count + 1]) {
      baseline.expectedRuntime[field] = invalid;
      rejectsCount();
    }
    baseline.expectedRuntime[field] = count;
    const original = contract[entries];
    for (const invalid of [undefined, [], 'invalid']) {
      contract[entries] = invalid;
      rejectsCount();
    }
    baseline.expectedRuntime[field] = 0;
    contract[entries] = [];
    rejectsCount();
    baseline.expectedRuntime[field] = count;
    contract[entries] = original;
  }
  contract.platformAdminPaths.push('GET /admin/v1/users');
  baseline.expectedRuntime.adminRouteCount = 3;
  passed(check());
  scripts.validate = 'echo bypass';
  write(`${child}/package.json`, JSON.stringify({ scripts }));
  const bypass = check();
  assert.equal(bypass.status, 1);
  assert.ok(bypass.stderr.includes('validate must run requirements:check'), bypass.stderr);
});
