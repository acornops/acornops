---
name: acornops-contract-change
description: Coordinate AcornOps API and cross-repository contract changes. Use when editing docs/contracts, contract manifests, OpenAPI specs, DTOs, generated clients, request/response schemas, target model APIs, target capability payloads, or code that changes an integration boundary between child repositories. Do not use for purely internal refactors with no public or cross-service behavior change.
---

# Inputs

- changed API, schema, manifest, or integration-boundary files
- producer and consumer repositories from `workspace.yaml`
- existing `docs/contracts/manifest.json`, OpenAPI/schema sources, and any
  boundary notes in `docs/contracts/README.md`
- compatibility, rollout, and validation requirements
- target model and capability compatibility requirements when target behavior changes

# Procedure

1. Identify the contract producer, consumers, and the canonical source of truth.
2. Compare implementation changes against manifest/OpenAPI/schema payloads, routes, events, errors, and auth requirements.
3. Update producer and consumer manifests plus generated/reference sources in the same coordinated change when behavior crosses repo boundaries.
4. Update `docs/contracts/README.md` only when a durable invariant, ownership boundary, auth rule, rollout rule, or non-obvious behavior changes.
5. Preserve backward compatibility unless the user explicitly accepts a breaking change and rollout plan.
6. For target model or capability changes, confirm whether `acornops-target-boundary-design` and `acornops-target-adapter-patterns` also apply.
7. Run affected repo contract checks and `node scripts/harness/check-platform-contracts.mjs` from the workspace root.
8. Record merge order, compatibility notes, docs impact, and residual risk in the handoff.

# Outputs

- producer/consumer impact summary
- changed contract files and implementation files
- compatibility and rollout notes
- required validation command list with outcomes
- cross-repo merge order and PR coordination notes
