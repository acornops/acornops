# Docs Maintenance

AcornOps treats documentation and agent guidance as maintained engineering
surfaces. The docs-maintenance workflow prepares a deterministic evidence
bundle in the GitHub Actions runner's temporary directory, passes that bundle
to a GitHub Copilot cloud agent task, and then lets the temporary files expire
with the runner.

## Schedule

The parent workspace workflow lives at:

```text
.github/workflows/docs-maintenance.yml
```

It runs weekly at Saturday 00:17 Asia/Singapore, which is Friday 16:17 UTC in
GitHub cron syntax:

```yaml
cron: "17 16 * * 5"
```

The workflow can also be started manually with `workflow_dispatch`. Manual runs
support these inputs:

- `base_sha`: explicitly sets the start of the maintenance window
- `fallback_commits`: sets the fallback history depth when no previous
  successful docs-maintenance run is available (default `20`)
- `copilot_model`: overrides the Copilot coding agent model

When `base_sha` is omitted, the workflow resolves the maintenance window base in
this order:

1. the most recent successful `docs-maintenance.yml` run on the same branch with
   a different `head_sha`
2. `HEAD~<fallback_commits>` when that commit exists locally
3. the repository root commit

If the selected base commit is missing locally or is not an ancestor of `HEAD`,
the workflow falls back to the repository merge base or, if needed, the root
commit.

## Temporary Evidence Bundle

The workflow writes the evidence bundle under:

```text
${{ runner.temp }}/docs-maintenance-evidence
```

The bundle is not committed and is not uploaded as a GitHub Actions artifact.
It is read by the Copilot task dispatcher in the same job and then discarded
when the runner is cleaned up. The bundle contains:

- base and head commits
- commit log for the maintenance window
- changed files and name-status diff
- diff stat
- changed-file categories
- validation signals from `package.json`, `Taskfile.yml`, and `workspace.yaml`

The collector script is:

```text
scripts/docs-maintenance/collect-evidence.mjs
```

## Copilot Task

After building the temporary evidence bundle, the workflow calls GitHub's Agent
Tasks API through:

```text
scripts/docs-maintenance/start-copilot-task.mjs
```

The workflow expects this secret:

```text
COPILOT_AGENT_PAT
```

Use a fine-grained personal access token for the user whose Copilot entitlement
should run the task. The token needs `Agent tasks` repository permission with
read and write access for the target repository. GitHub currently documents the
start-task endpoint as public preview and available to Copilot Business or
Copilot Enterprise users.

The default model is:

```text
gpt-5.4
```

Override the model with the manual workflow input or a repository/organization
variable named:

```text
COPILOT_AGENT_MODEL
```

Only use model IDs documented by GitHub for Copilot cloud agent tasks and
available under the authenticated account's plan and organization policy.

Before the agent creates a branch, commit, or pull request, it checks:

- changed files affect docs, agent guidance, validation, setup, contracts,
  operations, security, or reliability
- the evidence points to a specific durable doc or harness file
- the update can be scoped to that file instead of a broad rewrite

If no evidence-backed updates are needed, the task ends without creating a
branch, commit, or pull request.

When updates are needed, keep the resulting pull request and commit history
docs-maintenance specific:

- use a Conventional Commit pull request title beginning with `docs:`
- make every commit subject a Conventional Commit
- if an initial planning commit is needed, use exactly
  `docs: plan docs maintenance task`
- use the docs-maintenance pull request template when available
- record the evidence reviewed, docs impact, validation commands run, skipped
  checks, and residual risk
- run the repository validation command when discoverable, or explain why it
  could not run

## Guardrails

- Do not run broad documentation rewrites from the scheduled workflow.
- Make only evidence-backed documentation or agent-guidance updates.
- Keep child repository workflows and secrets repository-owned.
- Use the docs-maintenance issue or pull request templates when human or agent
  follow-up is required.

## Next Step

After the parent workflow is stable, add small caller workflows to one or two
child repositories. Child repositories should provide their own
`COPILOT_AGENT_PAT` secret or inherit an organization secret scoped to the
repositories that should run docs maintenance.
