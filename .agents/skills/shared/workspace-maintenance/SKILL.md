---
name: acornops-workspace-maintenance
description: Maintain the AcornOps workspace harness and developer entrypoint. Use when editing workspace.yaml, Taskfile.yml, root README/AGENTS/CLAUDE files, .gitignore, change-sets, shared skills, shared GitHub templates, workspace scripts, harness checks, sync tooling, CI policy, or Codex hook configuration. Do not use for product code inside child repositories.
---

# Inputs

- requested workspace behavior or policy change
- current `workspace.yaml`, Taskfile, root docs, scripts, and harness checks
- child repository dirty state when sync or validation may touch child repos
- compatibility impact for agents and developers

# Procedure

1. Confirm the change belongs to the parent workspace, not a child product repo.
2. Inspect existing scripts, Task tasks, docs, and harness checks before adding new patterns.
3. Keep developer-facing commands Task-first and scripts as stable lower-level APIs.
4. Preserve child repository independence: do not track child repo contents in the parent.
5. Update harness checks when adding required files, policy text, shared templates, or scripts.
6. Run targeted workspace validation and report any existing unrelated blockers separately.

# Outputs

- workspace files changed and reason
- developer or agent workflow impact
- commands added or changed
- validation commands and outcomes
- child repo sync impact, if any
