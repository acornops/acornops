---
name: acornops-open-pr
description: Commit and open AcornOps pull requests from the workspace. Use when the user asks to commit, push, open PRs, publish work, or prepare review across one or more child repositories. Handles per-repo commits, draft PRs, related PR links, and validation evidence. Do not use for code review without publishing; use acornops-pr-review instead.
---

# Inputs

- affected repositories and branch slug
- changed files and staged state per repository
- validation evidence
- related issue or tracking link when available
- related PRs and merge order for cross-repo work

# Procedure

1. Inspect `git status --short --branch` in the parent and every affected child repo.
2. Refuse broad all-repo commits with a generic message; commit each touched repo separately.
3. Confirm each affected repo is on the intended branch, or create the branch when explicitly publishing current work.
4. Review each repo diff before staging; do not stage unrelated user changes.
5. Write a Conventional Commit message per repo based on that repo's diff.
6. Ensure validation evidence exists; run missing required checks before publishing unless the user explicitly waives them.
7. Generate a PR plan with `./scripts/workspace/pr-plan.mjs <repo...>`.
8. Push each affected branch and open a draft PR for each repo using `./scripts/workspace/open-pr.mjs` when `gh` is available, or the GitHub connector as fallback.
9. Include related PR links, tracking issue, validation evidence, docs impact, residual risk, and merge order in every PR body.

# Outputs

- per-repo commit hash and commit message
- pushed branch list
- draft PR links
- related PR matrix and merge order
- validation evidence copied into PR bodies
- skipped checks or publishing blockers
