# Developer Getting Started

Use the workspace repository as the entrypoint for AcornOps development. It
assembles the child repositories, checks local readiness, and points developers
to repo-local commands without turning product repositories into submodules.

## First-Time Setup

```bash
git clone https://github.com/acornops/acornops.git
cd acornops
task setup
```

`task setup` clones missing child repositories from `workspace.yaml` over HTTPS,
normalizes existing matching GitHub remotes to the workspace manifest, and then
runs the workspace doctor.

## Understand The Platform

Start with [System Architecture](system-architecture.md) after first-time setup.
It explains the component map, primary runtime flows, public/internal
boundaries, repository ownership, and where deployment-specific architecture
lives.

## Agent-Assisted Development

When using Codex, Claude Code, or another coding agent, start the agent from the
workspace root for best results. The root contains the workspace manifest,
shared agent guidance, validation helpers, and cross-repository workflow rules.

For single-repository work, agents should still read that child repository's
`AGENTS.md` before editing files there.

If Task is not installed yet, use the underlying scripts directly:

```bash
./scripts/workspace/bootstrap.mjs
./scripts/workspace/doctor.mjs
```

## Preview Before Cloning

```bash
task workspace:bootstrap -- --dry-run
```

## Daily Checks

```bash
task workspace:status
task workspace:fetch
task validate
```

Use `task workspace:update` when you want to fast-forward local clean default
branches after fetching. It skips repositories with local changes, repositories
that are not on their default branch, and branches with unpushed local commits.

Use `task workspace:doctor` when changing machines, recovering a workspace, or
checking whether remotes and local tools still match the workspace manifest.

## Repo-Local Work

After setup, implementation still happens inside the relevant child repository.
Each product repo owns its runtime, dependency installation, service startup,
and local validation.

```bash
cd control-plane
cat AGENTS.md
npm run validate
```

The workspace should not hide repo-specific setup until those setup commands are
codified in `workspace.yaml` or the child repo itself.
