# Shared Sync Strategy

The workspace has separate sync scripts for separate ownership surfaces:

- `scripts/sync/shared-skills.sh` syncs shared agent skills.
- `scripts/sync/github-templates.sh` syncs shared GitHub issue and pull request
  templates.
- `scripts/sync/claude-settings.sh` syncs the shared `.claude/settings.json`.
- `scripts/sync/githooks.sh` configures repositories to use the shared
  `.githooks` directory.

Keep these scripts separate so a change to one surface cannot accidentally
overwrite another.

## Git Hook Setup

`scripts/sync/githooks.sh` configures the parent workspace and child
repositories to use the workspace-owned `.githooks` directory through Git's
local `core.hooksPath` setting.

Preview configuration changes first:

```bash
./scripts/sync/githooks.sh --dry-run
```

Apply configuration:

```bash
./scripts/sync/githooks.sh
```

### What It Configures

```text
core.hooksPath -> <workspace>/.githooks
```

The script writes local Git config only. It does not copy hook files into child
repositories and does not create commits. New hook files can be added to
`.githooks/` later without changing each repository's Git config again.

### What It Does Not Sync

- child repository `.git/hooks` files
- GitHub branch protection or repository settings
- standalone child-repository hook installation outside the workspace checkout

Run this setup again after moving the workspace directory, after cloning a new
child repository, or after adding a new local clone to `workspace.yaml`.

The shared `.githooks/pre-commit` hook runs only in the parent workspace repo
and delegates to `node scripts/harness/check-sync-drift.mjs --staged`. When
staged changes touch a shared sync surface, the checker verifies the relevant
child repository outputs or local hook configuration. If they are stale, it
fails with the exact sync command to run instead of modifying files during
commit.

The hook is the normal enforcement point, so agents and developers do not need
to memorize every sync trigger. When it blocks a commit, run the sync command it
prints, review the resulting repository changes, then retry the commit.

To audit all sync surfaces without staging a commit, run:

```bash
node scripts/harness/check-sync-drift.mjs --all
```

The shared `.githooks/pre-push` hook delegates to
`node scripts/harness/pre-push-validate.mjs`. Before push, it runs available
repo-local lint/style checks, repo-local harness checks, and the workspace
platform harness that enforces shared harness shape such as `AGENTS.md` line
limits. It intentionally does not run full unit tests or builds; those stay in
repo validation and CI.

## Shared Skill Sync

`scripts/sync/shared-skills.sh` distributes workspace-owned shared skills into
configured child repositories.

Preview changes first:

```bash
./scripts/sync/shared-skills.sh --dry-run
```

Apply changes:

```bash
./scripts/sync/shared-skills.sh
```

Limit sync to specific repositories by name:

```bash
./scripts/sync/shared-skills.sh --dry-run docs-website
```

## What It Syncs

```text
.agents/skills/shared/ -> <repo>/.agents/skills/shared/
.agents/skills/README.md -> <repo>/.agents/skills/README.md
```

The destination shared directory is replaced with `rsync --delete` so removed
shared skills disappear from product repositories. The skills README is copied
from the workspace source so parent and child repositories describe the same
shared/local skill boundary.

After syncing, the script writes:

```text
<repo>/.agents/skills/shared/.standards-version
```

This records the workspace repository and git revision used for the sync.
The platform harness check compares `.agents/skills/shared` and
`.agents/skills/README.md` in every configured child repository against the
workspace source. A missing skill, stale workflow, extra shared-skill file, or
stale `.standards-version` revision fails
`node scripts/harness/check-platform-harness.mjs`.

## What It Does Not Sync

- repo-local `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/`
- `scripts/`
- `.agents/skills/local`
- CI workflows
- repository contracts

Those files are repository-owned and should be changed intentionally in each
standalone GitHub repository.

## Recommended Repo Setup

Each product repository should have:

```text
.agents/skills/shared  # generated from this repo
.agents/skills/local   # owned by the product repo
```

Do not edit files under `.agents/skills/shared` inside product repos. Make shared
changes in the parent workspace repo, sync, review diffs, then commit each
product repository separately.

## Claude Settings Sync

`scripts/sync/claude-settings.sh` distributes the workspace-owned
`.claude/settings.json` into configured child repositories.

Preview changes first:

```bash
./scripts/sync/claude-settings.sh --dry-run
```

Apply changes:

```bash
./scripts/sync/claude-settings.sh
```

### What It Syncs

```text
.claude/settings.json -> <repo>/.claude/settings.json
```

### What It Does Not Sync

- `.claude/settings.local.json` (machine-specific: absolute paths and personal
  permissions that must stay per-machine and gitignored)
- `.claude/skills` and any other child-owned `.claude` contents

The script copies only `.claude/settings.json` and never runs `rsync --delete`
against child `.claude` directories. Review child repository diffs before
committing synced settings changes.

## GitHub Template Sync

`scripts/sync/github-templates.sh` distributes workspace-owned issue and pull
request templates into configured child repositories.

Preview changes first:

```bash
./scripts/sync/github-templates.sh --dry-run
```

Apply changes:

```bash
./scripts/sync/github-templates.sh
```

Limit sync to specific repositories by name:

```bash
./scripts/sync/github-templates.sh --dry-run docs-website control-plane
```

### What It Syncs

```text
.github/pull_request_template.md
.github/PULL_REQUEST_TEMPLATE/cross-repo.md
.github/PULL_REQUEST_TEMPLATE/docs-maintenance.md
.github/ISSUE_TEMPLATE/cross-repo-change.md
.github/ISSUE_TEMPLATE/docs-maintenance.md
```

`.github/pull_request_template.md` is the auto-loaded default pull request
template. Files under `.github/PULL_REQUEST_TEMPLATE/` are selected explicitly
by template name.

Synced templates intentionally avoid default labels and assignees. Labels,
assignees, branch protection, and repository settings remain child-repository
configuration.

### What It Does Not Sync

- `.github/workflows`
- branch protection or repository settings
- repository labels, milestones, projects, or assignees
- child-owned issue templates outside the allowlist
- child-owned pull request templates outside the allowlist
- generated release notes or discussion templates

The script copies only the allowlisted files and never runs `rsync --delete`
against child `.github` directories. Review child repository diffs before
committing synced template changes.
The platform harness check compares these allowlisted template files in every
configured child repository against the workspace source so missing or stale
templates fail local validation.

## Organization Defaults

GitHub supports a public organization-level `.github` repository for default
community health files, including issue and pull request templates. Those
defaults apply only when a repository does not define its own corresponding
template files.

AcornOps uses explicit sync for now because each child repository should carry
the active templates in its own history, and because synced files can be
reviewed with normal repository PRs. An organization-level `.github` repository
is still useful for future shared workflow templates, reusable workflows, and
fallback community health defaults.
