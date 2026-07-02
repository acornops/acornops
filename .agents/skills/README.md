# AcornOps Skills

Shared skills live in `.agents/skills/shared`. Repo-local skills belong in
`.agents/skills/local`.

In `acornops-workspace`, `.agents/skills/shared` is the upstream source that is
synced into child repositories. In child repositories,
`.agents/skills/shared` is generated output; do not edit it directly. Update
the workspace copy, run `./scripts/sync/shared-skills.sh --dry-run`, review the
target repositories, then run the sync intentionally.

The parent workspace does not keep a `.agents/skills/local` directory. Child
repositories may use `.agents/skills/local` for repository-owned skills.

## Shared Skill Boundaries

- `contract-change`: API, schema, manifest, OpenAPI, DTO, generated-client, and
  cross-repository integration-boundary changes.
- `codex-goals`: drafting or refining Codex `/goal` commands with evidence,
  boundaries, iteration policy, and blocked stop conditions.
- `cross-repo-change`: branch, change-set, validation, merge-order, and PR
  coordination across multiple repositories.
- `observability`: logs, metrics, health checks, retries, timeouts, and runtime
  diagnosability.
- `open-pr`: per-repo commits, draft PRs, related PR links, and validation
  evidence.
- `pr-review`: structured pull request review and risk assessment.
- `security-baseline`: auth, secrets, RBAC, privileged operations, and unsafe
  defaults.
- `testing-validation`: choosing and running risk-appropriate validation after a
  change is implemented.
- `workspace-maintenance`: root workspace manifest, Taskfile, scripts, harness
  checks, shared skills, shared GitHub templates, CI policy, and setup/update
  tooling.
