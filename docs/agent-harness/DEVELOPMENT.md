# Workspace Agent Harness Development

## Scope

The parent workspace repository owns shared AcornOps agent harness standards,
reusable skills, shared GitHub templates, and sync tooling.

It does not own repository-specific architecture, contracts, product behavior,
or local validation commands.

## Local Development

Bootstrap missing child repositories:

```bash
task setup
task workspace:bootstrap -- --dry-run
./scripts/workspace/bootstrap.mjs --dry-run
./scripts/workspace/bootstrap.mjs
```

Check local tools, remotes, and checkout readiness:

```bash
./scripts/workspace/doctor.mjs
```

Validate workspace standards:

```bash
./scripts/harness/check-agent-harness.sh
node scripts/harness/check-runtime-truth.mjs
```

Or with Task:

```bash
task validate
```

Preview shared skill sync:

```bash
./scripts/sync/shared-skills.sh --dry-run
```

Apply shared skill sync:

```bash
./scripts/sync/shared-skills.sh
```

Preview shared Claude settings sync:

```bash
./scripts/sync/claude-settings.sh --dry-run
```

Apply shared Claude settings sync:

```bash
./scripts/sync/claude-settings.sh
```

Preview shared GitHub issue and pull request template sync:

```bash
./scripts/sync/github-templates.sh --dry-run
```

Apply shared GitHub template sync:

```bash
./scripts/sync/github-templates.sh
```

## Change Rules

- Update `docs/agent-harness/harness-adoption-guide.md` and
  `scripts/harness/check-platform-harness.mjs` when changing required
  repository harness shape.
- Update `.github/PULL_REQUEST_TEMPLATE/` and `.github/ISSUE_TEMPLATE/` when
  changing shared pull request or issue intake shape.
- Update `.agents/skills/README.md` when changing shared skill layout guidance.
- Update `scripts/harness/check-agent-harness.sh` when adding required
  workspace files or policy text.
- Update `scripts/harness/check-runtime-truth.mjs` when production runtime
  identities, catalog authority rules, or default deployment fixture policy
  changes. Browser-only management-console fixtures may live under
  `management-console/src/fixtures` when guarded by the enforced `mock` data
  mode and a fail-closed transport. Local full-stack startup may seed the
  deterministic Kubernetes and VM targets with local-only Agent keys. The
  `cluster-fixture` profile remains available when only AgentK should connect.
  Production deployment files must keep all development seeding disabled.
- Update `docs/agent-harness/harness-adoption-guide.md` when the product-repo adoption model changes.
- Keep shared issue templates free of default labels or assignees unless the
  corresponding repository settings are managed across all child repositories.
- Keep `.github/workflows/docs-maintenance.yml` constrained to evidence-backed
  documentation and agent-guidance updates.
- Do not put product-specific decisions in the parent workspace repository.

## Documentation Harness

The workspace repo is the upstream source for doc structure. Product repos should enforce the adopted structure with their own `harness:check` or `task harness-test` command.

## Documentation Drift Control

Treat documentation as part of feature acceptance. When a standards change
affects repo shape, shared skills, validation flow, agent handoff, sync
behavior, or required files, update the relevant durable docs and harness checks
in the same change.

If docs are intentionally unchanged, record `Docs impact: none` and the reason in handoff evidence.
