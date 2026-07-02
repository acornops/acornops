# Conventional Commits

AcornOps repositories use Conventional Commits 1.0.0 for commit subjects and
pull request titles.

Reference: https://www.conventionalcommits.org/en/v1.0.0/

## Required Format

```text
type(scope): summary
type: summary
type(scope)!: summary
type!: summary
```

The subject must start with a type, may include a scope, may include `!` for a
breaking change, and must use `: ` before the summary.

Examples:

```text
feat(control-plane): add job retry policy
fix(gateway): preserve streaming error metadata
docs(workspace): clarify developer setup
ci: validate conventional PR titles
```

Breaking changes must be marked with `!` in the subject or with a
`BREAKING CHANGE:` footer.

## Default Types

Use these types unless a repository documents an additional type:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `ci`
- `build`
- `perf`
- `style`
- `revert`

## Enforcement

The workspace provides `scripts/harness/check-conventional-commits.mjs` for
commit-message and PR-title validation. The root workspace CI validates pull
request titles and pushed commit messages with this script.

The shared `.githooks/commit-msg` hook runs the same checker against Git's
commit message file before a local commit is accepted. Configure the hook for
the parent workspace and child repositories with:

```bash
task hooks:setup
```

Child repositories should adopt the same rule in their local CI or commit
workflow. Existing historical commits are not rewritten; enforcement applies to
new commits and pull requests.
