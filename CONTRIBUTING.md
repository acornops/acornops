# Contributing to AcornOps

AcornOps is developed across independently versioned repositories. Clone this
repository and bootstrap the complete workspace before making a change that
spans components:

```bash
git clone https://github.com/acornops/acornops.git
cd acornops
task setup
```

Read [AGENTS.md](AGENTS.md), the
[developer getting-started guide](docs/developer-getting-started.md), and the
affected child repository's `README.md` and `AGENTS.md` before editing.

Use the validation command declared for the affected repository in
[`workspace.yaml`](workspace.yaml). Cross-repository changes should use one
shared branch slug, record a change set under `change-sets/`, and link related
pull requests with their intended merge order.

Commit subjects and pull request titles follow
[Conventional Commits](docs/agent-harness/conventional-commits.md).

For documentation-only contributions, see the
[public docs contribution guide](https://github.com/acornops/docs-website/blob/main/CONTRIBUTING.md).

Do not open a public issue for a suspected vulnerability. Follow the
[security policy](SECURITY.md) instead.
