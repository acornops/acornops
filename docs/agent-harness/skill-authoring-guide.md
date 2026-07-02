# AcornOps Skill Authoring Guide

## Skill Folder Structure

Each skill must use:

```text
<skill-name>/
  SKILL.md
  workflow.md
```

`SKILL.md` is required and must include YAML frontmatter with `name` and `description`.
`workflow.md` is recommended for deterministic execution details.

## Required SKILL.md Format

```markdown
---
name: skill-name
description: Explain exactly when this skill should and should not trigger.
---

Skill instructions for Codex to follow.
```

Use imperative instructions and define explicit inputs/outputs.

## Optional Metadata

Add `agents/openai.yaml` when you want Codex UI metadata or policy controls.

Example:

```yaml
interface:
  display_name: "User-facing name"
  short_description: "Short description"
  default_prompt: "Optional default prompt"
policy:
  allow_implicit_invocation: true
```

## When to Create New Skills

Create a new skill when at least one is true:

- the workflow repeats across tasks or repositories
- the workflow has safety-critical checks that must be standardized
- the workflow needs repository-specific context to avoid mistakes
- the workflow is large enough that reuse materially reduces risk

## Naming Conventions

- use lowercase kebab-case skill names
- keep names action-oriented and specific
- avoid overlapping semantic scope between skills

## Writing Guidance

- keep each skill focused on one job
- prefer instruction-only skills unless deterministic scripts are required
- write concise, imperative procedures
- include concrete outputs that the skill must produce
- keep trigger logic in `description` for reliable implicit invocation

## How to Sync Shared Skills

1. Update `workspace.yaml`.
2. Run:

```bash
./scripts/sync/shared-skills.sh
```

3. Confirm shared skills were copied to each repository under `.agents/skills/shared`.

The sync process uses `rsync --delete` to keep destination shared skills aligned
with the parent workspace repository.
Only `.agents/skills/shared` is synced. Do not put repository-owned skills in
that directory; use `.agents/skills/local` instead.

## Repo-Owned Harness Files

Shared skill files are synced automatically. Repository architecture docs,
contracts, validation scripts, local skills, and workflow details are not synced
because each repository must own them directly.

## How Agents Should Invoke Skills

- apply shared skills first for baseline quality and safety
- apply local repository-owned skills for architecture and domain constraints
- run required validation commands before finalizing changes
- include exact handoff evidence when validation is complete
