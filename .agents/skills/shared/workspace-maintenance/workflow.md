# Workspace Maintenance Workflow

Use this workflow for root `acornops-workspace` changes.

## Scope Check

Workspace-owned changes include:

- `workspace.yaml`
- `Taskfile.yml`
- root `README.md`, `AGENTS.md`, and `CLAUDE.md`
- `.gitignore`, `.github/`, and workspace CI policy
- `scripts/harness`, `scripts/workspace`, `scripts/sync`, and `scripts/lib`
- `.agents/skills/shared`
- `docs/agent-harness/`
- `change-sets/`

Product implementation changes belong in child repositories and should be
committed separately.

## Edit Rules

1. Prefer existing script and Task naming patterns.
2. Keep Task commands human-facing and scripts automation-friendly.
3. Update `scripts/harness/check-agent-harness.sh` for new required workspace
   files, docs, or policies.
4. If shared skills change, run `./scripts/sync/shared-skills.sh --dry-run`
   before syncing.
5. Verify child repo directories remain ignored by the parent.

## Validation

Run the narrowest useful checks first:

```bash
./scripts/harness/check-agent-harness.sh
node scripts/harness/check-conventional-commits.mjs --message "<type(scope): summary>"
```

Run broader checks when the change touches harness adoption, contracts, or shared
skills:

```bash
node scripts/harness/check-platform-harness.mjs
node scripts/harness/check-platform-contracts.mjs
```
