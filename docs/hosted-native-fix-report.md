# Native tool authority correction

The final P1 native-tool finding is corrected in the control-plane worktree on `feat/oss-hosted-readiness`. No commits, external HTTP requests, or deployments were made by this subtask.

## Implementation

Both `internal-platform-native-tool-controller.ts` and the builtin native branch in `internal-mcp-bridge-controller.ts` capture an immutable owner/generation pair from the authenticated request before asynchronous run lookups. They pass that pair through `workspace-native-tool-executor.ts` and preserve capacity error envelopes.

`native-execution-authority.ts` checks workspace lifecycle, the persisted suspension cutoff, and current reservation ownership under the workspace lock. Cutoff comparisons remain inside PostgreSQL and retain microsecond precision. With capacity enforcement disabled, lifecycle and cutoff checks still run.

Both generated-document creation paths render and validate the source first, then enter that authority transaction and insert using its transaction client. The workspace lock stays held through the insert and commit. Document idempotency remains based on run/tool-call identity. Document creation needs no separate uncertainty ledger because its authority check and durable write commit atomically.

Fetch now invokes a hook after DNS and directly before `https.request`. The hook validates native authority and begins a bounded operation using the same transaction. `beginCapacityOperation` accepts an existing transaction client to avoid opening a nested transaction while holding the workspace lock. Fetch recalculates the remaining request timeout after authorization; no request is opened if the total deadline has elapsed. Response completion, errors, timeouts, and synchronous request-construction failures enter cleanup. Request destruction precedes finishing the exact operation belonging to the captured owner/generation. An unfinished request remains charged after worker lease expiry until request cleanup or its bounded deadline.

## Reproduction and targeted evidence

`test/native-tool-capacity-postgres.test.ts` uses the authorized isolated PostgreSQL test database and actual repositories/controllers. DNS and HTTPS request construction are stubbed, so no external destination is contacted. The initial corrected-fixture red run failed all ten original cases for the expected reasons:

- Both controller entrypoints inserted a document after suspension, lease expiry, and rapid suspend/restore following initial route authorization.
- Fetch attempted a socket after each of those changes during awaited DNS.
- An in-flight Fetch had no operation record and could not retain uncertain capacity.

Initial evidence: `/private/tmp/native-authority-red.log`. One earlier fixture setup attempt lacked its reservation; the fixture was corrected before recording the behavioral failures.

The final targeted run passed **30/30 tests**: 17 native-authority regressions and 13 existing native-document/Fetch tests. Beyond the reproduced failures, these verify immutable controller authority despite a later request-header/owner change, disabled-mode suspension/cutoff fencing, cleanup after synchronous request construction failure, in-flight retention across lease expiry, existing document idempotency, and Fetch response policy.

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test --test-concurrency=1 test/native-tool-capacity-postgres.test.ts test/internal-mcp-bridge-regression.test.ts test/agent-chat-native-runtime.test.ts test/services/fetch-http.test.ts
```

Passed, exit 0. Output: `/private/tmp/native-authority-targeted.log`.

`npm run typecheck`, `npm run style:check`, `npm run harness:check`, and `git diff --check` passed before full validation.

## Full validation

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_MIGRATION_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_rollout_test REDIS_URL=redis://127.0.0.1:56438 npm run validate
```

Passed, exit 0: **1,284/1,284 tests**, migration-chain static and SQL upgrade checks, type checking, style, authorization, workspace membership, event durability, contracts, OpenAPI, harness, and build. Output: `/private/tmp/native-authority-full-validate.log`. SQL upgrade checks used a uniquely named temporary schema in `hosted_rollout_test`; runtime fixtures used `hosted_runtime_test`. Final `git diff --check` passed, and the test database sessions are released.

## Scope and remaining evidence

The independent final reviewer is rechecking this bounded fix. Root owns the final handoff and durable runtime-guide updates. This subtask does not claim new Compose, browser, live-provider, or real external HTTP validation. The existing cross-service evidence remains in the overall hosted-readiness handoff. No production service or database was touched.
