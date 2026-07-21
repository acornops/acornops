<p align="center">
  <img width="220" src="https://raw.githubusercontent.com/acornops/docs-website/main/logo/light.svg" alt="AcornOps" />
</p>

<h1 align="center">AcornOps</h1>

<p align="center">
  <a href="https://github.com/acornops/acornops/actions/workflows/ci.yml"><img src="https://github.com/acornops/acornops/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/contracts-checked-blue.svg" alt="Contracts checked" />
  <img src="https://img.shields.io/badge/commits-conventional-green.svg" alt="Conventional commits" />
</p>

<p align="center">
  Open-source, self-hosted AI-assisted operations for Kubernetes clusters and Linux/systemd VMs.
</p>

<p align="center">
  <a href="https://console.demo.acornops.dev/"><strong>Try the live demo</strong></a>
  ·
  <a href="https://docs.acornops.dev/quickstart">Self-host AcornOps</a>
  ·
  <a href="https://docs.acornops.dev/">Read the docs</a>
  ·
  <a href="https://docs.acornops.dev/integrations">Build an integration</a>
</p>

> [!IMPORTANT]
> AcornOps is under active experimental development. APIs, deployment
> contracts, and upgrade paths may change before a stable release.

AcornOps connects a central operations platform to Kubernetes clusters and
Linux/systemd VMs through outbound target agents. Operators can inspect live
target context, run guided investigations, coordinate controlled remediation,
and automate repeatable operational work from one management console.

The platform keeps operators in control:

- AgentK and AgentV initiate outbound connections to the control plane.
- Linux/systemd built-in tools are read-only.
- Kubernetes writes require explicit RBAC, agent enablement, run permission,
  and tool access.
- Write confirmation is required by default and pauses a run before the
  specific write-capable tool call.
- The LLM gateway enforces run-scoped model and tool access, runtime limits,
  and budgets.
- Remote MCP servers are target-scoped and discovery-first; discovered tools
  stay disabled until reviewed and enabled.

Start with the [public demo](https://console.demo.acornops.dev/), follow the
[quickstart](https://docs.acornops.dev/quickstart), or review the
[system architecture](docs/system-architecture.md).

## Repository Map

AcornOps is split into independently versioned components with explicit
contracts between them.

| Repository | Responsibility |
| --- | --- |
| [`management-console`](https://github.com/acornops/management-console) | Browser experience for workspaces, targets, runs, Agents, Workflows, approvals, and tools |
| [`control-plane`](https://github.com/acornops/control-plane) | Authentication, workspace APIs, target registration, run state, webhooks, and agent coordination |
| [`execution-engine`](https://github.com/acornops/execution-engine) | Durable run execution, streaming events, retries, cancellation, and tool coordination |
| [`llm-gateway`](https://github.com/acornops/llm-gateway) | Model-provider routing, MCP brokering, secrets, and policy enforcement |
| [`agentk`](https://github.com/acornops/agentk) | Outbound Kubernetes discovery, snapshots, logs, and controlled tool execution |
| [`agentv`](https://github.com/acornops/agentv) | Outbound Linux/systemd snapshots, logs, and read-only built-in tools |
| [`acornops-deployment`](https://github.com/acornops/acornops-deployment) | Docker Compose and Kubernetes deployment tracks, compatibility metadata, and runbooks |
| [`charts`](https://github.com/acornops/charts) | Public Helm repository mirror for packaged platform and agent charts |
| [`docs-website`](https://github.com/acornops/docs-website) | Public operator, deployment, integration, architecture, and API documentation |

## Develop AcornOps

This repository is also the developer entry point for working across the
independently versioned AcornOps repositories. It owns the workspace manifest,
setup helpers, shared skills, shared GitHub templates, and cross-repository
documentation. Product repositories are checked out as ignored child
directories and remain independently versioned.

## Workspace Model

AcornOps uses three layers:

1. Workspace harness in this repository.
2. Repo-local harnesses committed to each standalone product repository.
3. Platform and integration checks that validate cross-repository contracts.

Start here when setting up the workspace or checking repository status.
Agent-specific operating rules live in [AGENTS.md](AGENTS.md); `CLAUDE.md`
imports that same file so agent-facing instructions stay in one place.

## Agent-Assisted Development

This workspace is structured for human and agent-assisted development. When
using Codex, Claude Code, or another coding agent, start the agent from the
workspace root for best results. The root contains the workspace manifest,
shared agent guidance, validation helpers, and cross-repository workflow rules
that help agents coordinate changes across child repositories.

For single-repository work, agents should still read that child repository's
`AGENTS.md` before editing files there.

## What Belongs Here

- workspace setup helpers
- shared agent skills used across AcornOps repositories
- workspace manifest and repository capability summary
- synchronization tooling for shared skills, GitHub templates, and Git hooks
- cross-repository harness and contract checks
- vendor-neutral handoff and Conventional Commit policy

## What Stays In Each Product Repo

- service source code and tests
- repo-specific `AGENTS.md`
- architecture and product docs
- contract manifests owned by that repo
- CI workflows and local validation entrypoints
- repo-specific local skills under `.agents/skills/local`
- service-specific runbooks, migrations, and rollout notes
- repository-specific labels and GitHub workflow secrets

## Repository Layout

```text
acornops/
  AGENTS.md
  CLAUDE.md
  workspace.yaml
  .githooks/
  .github/
    ISSUE_TEMPLATE/
    PULL_REQUEST_TEMPLATE/
  .agents/skills/shared/
  docs/
    agent-harness/
  scripts/
    docs-maintenance/
    harness/
    sync/
    workspace/
      *.mjs
    lib/
  change-sets/
  acornops-deployment/  # ignored child repo for deployment and operations
  control-plane/  # ignored child repo for the control plane API
  docs-website/  # ignored child repo for public Mintlify docs
  execution-engine/  # ignored child repo for run execution
  agentk/  # ignored child repo for workload-cluster agents
  agentv/  # ignored child repo for Linux/systemd AgentV work
  llm-gateway/  # ignored child repo for model and MCP brokering
  management-console/  # ignored child repo for the browser console
  charts/  # ignored child repo for the public Helm chart repository
```

Child repositories are intentionally ignored by this parent repository. Do not
stage or commit product repository contents from the workspace repo.

## Getting Started

Clone the workspace:

```bash
git clone https://github.com/acornops/acornops.git
cd acornops
```

Set up the workspace:

```bash
task setup
```

`task setup` clones missing child repositories from `workspace.yaml` over HTTPS,
normalizes existing matching GitHub remotes to the workspace manifest, and then
checks local tools, child repository remotes, workspace status, and shared Git
hook configuration.

Understand the platform:

- [System Architecture](docs/system-architecture.md) explains how the AcornOps
  components, runtime flows, and repository ownership fit together.
- [`workspace.yaml`](workspace.yaml) lists every child repository, local path,
  remote, default branch, and validation command.

Preview clone actions before running setup:

```bash
task workspace:bootstrap -- --dry-run
```

If Task is not installed yet, use the underlying scripts directly:

```bash
./scripts/workspace/bootstrap.mjs
./scripts/workspace/doctor.mjs
./scripts/sync/githooks.sh
```

Dependency installation and service startup stay repo-local because each product
repo owns its own runtime. After bootstrap, read the affected child repo's
README and validation command in `workspace.yaml`.

More detail: [Developer Getting Started](docs/developer-getting-started.md).

## Daily Maintenance

Inspect parent and child repository status:

```bash
task workspace:status
```

Fetch remote refs without changing local branches:

```bash
task workspace:fetch
```

Fast-forward only clean repositories on their default branch:

```bash
task workspace:update
```

`task workspace:update` skips repositories with local changes, repositories on
non-default branches, branches with unpushed commits, and divergent histories.

Configure the workspace-owned Git hooks for the parent and child repositories:

```bash
task hooks:setup
```

The shared hooks run deterministic local checks and print the relevant fix when
they fail. Hook behavior is documented in
[Sync](docs/agent-harness/sync.md).

## Validate

```bash
task validate
```

`task validate` runs the workspace harness and cross-repository checks.

Commit subjects and pull request titles follow
[Conventional Commits](docs/agent-harness/conventional-commits.md).

## Coordinated Changes

For changes that touch more than one product repository:

- identify the affected repositories from `workspace.yaml`
- keep product code changes inside the child repositories
- record coordinated work in `change-sets/` when the work spans repos
- prepare validation evidence for each affected repo
- link related PRs and include merge order when changes depend on each other

Agent-facing workflow details and helper-script usage belong in
[AGENTS.md](AGENTS.md) and the shared skill workflow, not in this developer
README.

More detail:

- [Change Sets](change-sets/README.md)
- [Repository Capability Summary](docs/agent-harness/repository-capability-summary.md)
- [Agent Handoff Policy](docs/agent-harness/agent-handoff-policy.md)
- [Docs Maintenance](docs/agent-harness/docs-maintenance.md)
- [Cross-Repo Skill Workflow](.agents/skills/shared/cross-repo-change/workflow.md)

## Shared Skills

Shared skills are maintained in this workspace and synced into child
repositories when the shared agent guidance changes.

Preview changes first:

```bash
./scripts/sync/shared-skills.sh --dry-run
```

Apply intentionally:

```bash
./scripts/sync/shared-skills.sh
```

The sync command updates only `.agents/skills/shared` and `.agents/skills/README.md`
inside configured child repositories. It never overwrites
`.agents/skills/local`.

The parent workspace does not keep a `.agents/skills/local` directory. Workspace
skills are shared by default; child repositories keep their own local skills.

## Claude Settings

The shared `.claude/settings.json` is maintained in this workspace and synced
into child repositories when it changes:

```bash
./scripts/sync/claude-settings.sh --dry-run
./scripts/sync/claude-settings.sh
```

The sync copies only `.claude/settings.json`. It never syncs the machine-specific
`.claude/settings.local.json`, and never deletes child-owned `.claude` files.

## GitHub Templates

Workspace-owned pull request and issue templates live under `.github/` so the
parent repository can use them directly. They can also be synced into configured
child repositories:

```bash
./scripts/sync/github-templates.sh --dry-run
./scripts/sync/github-templates.sh
```

The GitHub template sync copies only allowlisted issue and pull request template
files. It does not touch child repository workflows or delete child-owned
`.github` files. Shared issue templates intentionally do not set default labels;
labels are repository-specific and should be configured inside each child
repository when needed.
