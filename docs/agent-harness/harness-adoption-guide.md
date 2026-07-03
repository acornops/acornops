# Harness Adoption Guide

This guide explains how AcornOps repositories should adopt shared harness
standards without losing repository-specific ownership.

## Model

AcornOps uses three layers:

1. Workspace harness: the parent `acornops` repository.
2. Repo-local harness: each standalone GitHub repository.
3. Platform harness: deployment/integration repository.

The underlying agent-harness rationale is captured in
[`openai-harness-engineering.md`](openai-harness-engineering.md), which maps
OpenAI Codex-style repo navigation, editing, command execution, and test
execution into AcornOps repo-local validation rules.

## Repo-local harness

Each product repository should commit its own:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/index.md`
- `docs/DEVELOPMENT.md`
- `docs/OPERATIONS.md`
- `docs/DESIGN.md`
- `docs/PLANS.md`
- `docs/AGENT_HANDOFF.md`
- `docs/QUALITY_SCORE.md`
- `docs/RELIABILITY.md`
- `docs/SECURITY.md`
- `docs/contracts/README.md`
- `docs/contracts/manifest.json`
- `scripts/check-harness.*`
- `scripts/check-contracts.*`
- one canonical validation command

The repository-local files are authoritative for that repository. Shared
workspace docs define the expected shape, but each repository owns its concrete
architecture, contracts, validation scripts, and operating details.

The public documentation site is a docs-site harness profile, not a product
service profile. It should still commit `AGENTS.md`, shared skills, GitHub
templates, and one canonical validation command, but it does not need the full
repo-local `docs/` knowledge-base tree because its root MDX files are the
published documentation surface.

For whole-system topology, use one canonical owner instead of duplicating large
diagrams in every repo. In AcornOps, that owner is
`docs/system-architecture.md` in the workspace root; component repos should link
to it from their docs index. Deployment-specific topology lives in
`acornops-deployment/docs/deployment-architecture.md`.

## Shared skills

Shared skills are synced into:

```text
.agents/skills/shared
```

Repo-specific skills stay in:

```text
.agents/skills/local
```

Shared skills are synced with `rsync --delete` only inside the shared skills
directory. Do not place repo-owned skills or custom files under
`.agents/skills/shared`.

The sync writes `.agents/skills/shared/.standards-version` so a product repo can
see which standards revision last populated shared skills.
`scripts/harness/check-platform-harness.mjs` compares the synced shared skills
and skills README against the workspace source so stale or partially synced
child repositories fail platform harness validation.

## Shared GitHub templates

Workspace-owned pull request and issue templates live in the parent repository
under:

```text
.github/PULL_REQUEST_TEMPLATE
.github/ISSUE_TEMPLATE
```

Sync them into child repositories with:

```bash
./scripts/sync/github-templates.sh --dry-run
./scripts/sync/github-templates.sh
```

The GitHub template sync copies only allowlisted template files. It does not
sync `.github/workflows`, delete child-owned `.github` files, or replace
repository-specific automation. Shared issue templates do not set default
labels or assignees; those are repository-specific GitHub settings.
`scripts/harness/check-platform-harness.mjs` also compares these allowlisted
templates against every workspace child repository, including the docs-site
profile.

## Validation Strategy

Every repository should expose one obvious validation command:

- JavaScript/TypeScript: usually `npm run validate`
- Python service: usually `task validate`
- Deployment/integration: usually `task validate`

That command should run the repository's local checks only. Cross-repo checks
belong in the deployment or platform harness.

Unit tests, integration tests, contract checks, smoke tests, hooks, and CI gates
are part of the harness.

Use Markdown for:

- when a deeper check is required
- what risk or contract the check covers
- what evidence belongs in the handoff

Use executable checks for deterministic rules.

Documentation is also part of the harness. Changes to features, APIs,
configuration, deployment behavior, operations, security, or reliability should
update the nearest durable doc in the same change. If no docs change is needed,
the handoff should include `Docs impact: none` with the reason.

Contract READMEs should be boundary briefs, not generated reference manuals.
Put endpoint, event, field, and schema coverage in `manifest.json`, OpenAPI,
DTOs, generated clients, and executable checks. Keep README prose for durable
invariants, ownership boundaries, auth rules, rollout constraints, and
non-obvious cross-service behavior.

## Reconciling shared and local checks

Shared standards define shape and expectations:

- required docs exist
- development and operations guides exist
- contracts have a documented owner and manifest
- high-risk areas are listed in the repo entrypoint
- shared skills follow metadata rules
- validation entrypoints are discoverable
- handoff evidence names exact commands and outcomes
- commit and pull request title guidance is discoverable

Local repositories define substance:

- local build, test, and validation entrypoints
- handoff requirements
- architecture boundaries
- service-specific contract checks
- development and operations details
- UI smoke tests
- migration and rollout checks
- domain-specific security rules

If shared and local guidance conflict, repo-local `AGENTS.md` wins for that
repository. Update this workspace repository only when the conflict reveals a
better organization-wide rule.

## Recommended update flow

1. Update shared skills, GitHub templates, harness docs, or harness checks here.
2. Run `./scripts/harness/check-agent-harness.sh`.
3. Sync shared skills with `./scripts/sync/shared-skills.sh` when needed.
4. Sync GitHub templates with `./scripts/sync/github-templates.sh` when needed.
5. Sync Claude settings with `./scripts/sync/claude-settings.sh` when needed.
6. In each affected product repo, review generated diffs.
7. Run that repo's local validation command.
8. Commit product repo changes separately.

## What not to centralize

Do not centralize:

- service architecture docs
- contract manifests owned by product repos
- CI workflows that need repository secrets or runtime assumptions
- local skills
- local validation scripts
- product decisions and UX rules

Also do not centralize vendor-specific agent instruction files. `AGENTS.md`
stays the generic repository entrypoint.

Centralizing these would make standalone repositories less legible to agents and
reviewers.
