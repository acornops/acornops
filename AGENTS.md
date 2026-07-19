# AcornOps Repository Agent Entry Point

Use this file as the map for cross-repository work from the canonical AcornOps
repository and its local workspace.
Durable repository-specific knowledge belongs in each child repository.

## Start Here

- [Workspace Manifest](workspace.yaml)
- [Workspace README](README.md)
- [Developer Getting Started](docs/developer-getting-started.md)
- [System Architecture](docs/system-architecture.md)
- [Change Sets](change-sets/README.md)
- [Standards Development](docs/agent-harness/DEVELOPMENT.md)
- [Harness Adoption Guide](docs/agent-harness/harness-adoption-guide.md)
- [Agent Handoff Policy](docs/agent-harness/agent-handoff-policy.md)
- [Conventional Commits](docs/agent-harness/conventional-commits.md)
- [Docs Maintenance](docs/agent-harness/docs-maintenance.md)
- [Repository Capability Summary](docs/agent-harness/repository-capability-summary.md)
- [Skill Authoring Guide](docs/agent-harness/skill-authoring-guide.md)
- [Shared Skills](.agents/skills/shared/)

## Workspace Ownership

- This parent repository owns cross-repository orchestration, shared skills,
  shared GitHub templates, and cross-repo agent policy.
- Child repositories own product code, service architecture, service contracts,
  local validation, and local skills.
- Parent-level `security/`, `security-completed/`, and `optimizations/` folders
  are local review artifacts and are intentionally ignored by this repository.
- Do not stage child repository directories in the parent repository.
- Do not commit submodules for child repositories unless the user explicitly asks
  for an integration snapshot model.

## Child Repositories

The active child repositories are declared in [workspace.yaml](workspace.yaml):

- `acornops-deployment`
- `control-plane`
- `docs-website`
- `execution-engine`
- `agentk`
- `agentv`
- `llm-gateway`
- `management-console`
- `charts`

When working inside a child repo, read that repo's `AGENTS.md`.

## Cross-Repository Change Rules

- Use `task setup` as the developer-friendly first-run command when Task is
  installed.
- Use `./scripts/workspace/bootstrap.mjs --dry-run` to inspect missing child
  repository checkouts, and `./scripts/workspace/bootstrap.mjs` to clone them.
- Use `./scripts/workspace/doctor.mjs` when checking whether a developer or
  agent workspace is ready for multi-repo work.
- Use one shared branch slug across all affected child repositories. Prefer
  descriptive `feat/`, `fix/`, `docs/`, or `chore/` branch slugs, and avoid
  agent/tool-specific prefixes.
- Use Conventional Commits for commit subjects and pull request titles.
- Prefer a central tracking issue for work that touches multiple repositories.
- Use `./scripts/workspace/status.mjs` before and after multi-repo work.
- Use `./scripts/workspace/branch.mjs` to create matching branches in affected repos.
- Use `./scripts/workspace/change-set.mjs` to record coordinated work.
- Use `./scripts/workspace/pr-plan.mjs` before publishing related PRs.
- Open draft PRs per affected child repository.
- Link related PRs in every PR body.
- Include the intended merge order when PRs depend on each other.
- Include validation evidence, skipped checks, docs impact, residual risks,
  branch names, and PR links in the handoff.

## Shared Skills

- Parent shared skills live in `.agents/skills/shared`.
- Repo-local skills live in each child repo at `.agents/skills/local`.
- The parent workspace does not use `.agents/skills/local`; workspace skills are
  shared by default and live in `.agents/skills/shared`.
- Do not edit generated child repo `.agents/skills/shared` files directly.
  Update parent shared skills here and run `./scripts/sync/shared-skills.sh`.
- Agent tools may not auto-discover nested skills. When a task matches a skill
  description, open the relevant `SKILL.md` and follow it before editing.

## Useful Workspace Commands

- `task setup` when validating developer onboarding changes
- `./scripts/workspace/doctor.mjs` for local workspace readiness
- `./scripts/workspace/status.mjs` for workspace state inspection
- `task runtime-truth:check` to reject runtime fixture identities, fallback definitions, and Workflow V1 branches
- `task validate` for the workspace validation entrypoint

## High-Risk Areas

- Parent `.gitignore` rules that could accidentally expose child repo contents.
- Sync scripts that delete or overwrite destination files.
- GitHub template sync accidentally touching child repository workflows.
- Broad shared guidance that conflicts with repo-local ownership.
- Skill descriptions that trigger too broadly.
- Cross-repo PRs without related PR links or merge order.

## Documentation Hygiene

- Keep this file short. Push durable details into linked docs.
- Update `workspace.yaml` when adding, removing, or renaming child repos.
- Update `docs/agent-harness/repository-capability-summary.md` when repository
  validation commands or responsibilities change.
- Update `docs/agent-harness/harness-adoption-guide.md` when changing the
  workspace or repo-local harness model.
