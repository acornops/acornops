# Contract Change Workflow

Use this workflow when an AcornOps change modifies a boundary between
repositories.

## Identify the Boundary

- Producer: service or repository that owns the API, event, schema, or manifest.
- Consumers: repositories that call, render, deploy, or validate that boundary.
- Contract artifacts: `docs/contracts/manifest.json`, OpenAPI files, DTOs,
  generated clients, schema tests, mapper tests, and the boundary brief in
  `docs/contracts/README.md`.
- Target contract artifacts: target model APIs, target capability payloads,
  registration schemas, health/status payloads, credential references, and
  target routing request/response shapes.

## Required Coordination

1. Inspect the producer implementation and manifest/OpenAPI/schema sources together.
2. Inspect every declared consumer in the manifest.
3. Update mirrored manifests and generated/reference sources when both sides must agree.
4. Update the contract README only for durable invariants, auth boundaries,
   ownership rules, rollout constraints, or non-obvious behavior.
5. Add or update tests at the producer/consumer boundary.
6. Keep breaking changes explicit with rollout and merge order.
7. For target model or capability changes, verify the shared target boundary and
   adapter boundary are documented by the relevant target skills.

## Validation

Run repo-local contract checks for every affected repository, then run from the
workspace root:

```bash
node scripts/harness/check-platform-contracts.mjs
```

If the platform contract check fails, do not treat the change as complete until
the mismatch is resolved or the blocker is called out with exact files.
