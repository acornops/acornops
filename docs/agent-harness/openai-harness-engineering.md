# OpenAI-Oriented Harness Engineering

This project treats agent harness engineering as a first-class engineering surface: a repo should be easy for an AI coding agent to enter, understand, modify, validate, and hand off without relying on hidden context.

## OpenAI Reference Point

OpenAI describes Codex as a coding agent that can work in local tools or delegated cloud environments, navigate a repository, edit files, run commands, and execute tests. See:

- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [OpenAI Codex CLI - Getting Started](https://help.openai.com/en/articles/11096431)

AcornOps adapts that model into repo-local harness rules so agents have stable entry points and mechanical validation.

## AcornOps Harness Principles

1. Every repo has stable entry points: `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/index.md`, and a canonical validation command.
2. Development and operations knowledge is explicit: `docs/DEVELOPMENT.md` and `docs/OPERATIONS.md`.
3. Whole-system context has one owner: `docs/system-architecture.md` in the
   workspace root.
4. Agent instructions stay vendor-neutral. Do not add required vendor-specific files such as `CLAUDE.md`, `GEMINI.md`, `.cursor`, or `.cursorrules`.
5. Handoff evidence names exact commands run and outcomes.
6. Harness checks enforce structure so documentation drift fails local validation.
7. Documentation is part of feature acceptance: feature, API, configuration, deployment, operations, security, and reliability changes update the nearest durable docs in the same change.

## Drift Control

When behavior changes:

- update the nearest durable repository docs in the same change
- prefer one canonical owner and links over duplicated prose
- record `Docs impact: none` with the reason when docs are intentionally unchanged
- include docs impact in handoff evidence

When a doc structure changes:

- update the relevant repository docs
- update the repository harness check
- update the workspace harness docs when the structure is shared
- update `scripts/harness/check-agent-harness.sh`
- run the repository validation command

This keeps future agent-authored documentation changes inside the same structure instead of letting each repo drift independently.
