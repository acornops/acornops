# Open PR Workflow

Use this workflow when publishing AcornOps workspace changes.

## Preflight

From the parent workspace, inspect parent and child repo status:

```bash
./scripts/workspace/status.mjs
```

The parent workspace repo should only be committed when workspace harness files
changed. Child repos should be committed independently.

## Commit Rules

- Use one commit per affected repo unless the repo has clearly separable changes.
- Use Conventional Commit format: `type(scope): summary`.
- Validate commit messages with `node scripts/harness/check-conventional-commits.mjs --message "<subject>"` when publishing from the workspace.
- Never use one generic commit message across all repos.
- Do not stage files that were dirty before the current task unless the user
  explicitly includes them.

## PR Body Template

Generate a plan before publishing:

```bash
./scripts/workspace/pr-plan.mjs <repo...>
```

Use `.github/PULL_REQUEST_TEMPLATE/cross-repo.md` as the body structure.
For single-repo PRs, keep the cross-repo section short and state `None`.

## Publishing

- Prefer draft PRs for agent-created work unless the user asks for ready review.
- Standard publishing path is `scripts/workspace/open-pr.mjs`, which uses GitHub CLI
  `gh` for already committed branches.
- If `gh` is unavailable, use the GitHub connector as the fallback and preserve
  the same PR body structure.
- If a remote repo or authentication is missing, stop after local commits and
  report the exact push or PR creation blocker.
