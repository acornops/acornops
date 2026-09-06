# Hosted capacity primitive corrections

The capacity review fixes are implemented in the control-plane worktree on `feat/oss-hosted-readiness`. No commits or PRs were created. Root-owned rollout, deployment, and subsequent Insights coalescing changes are tracked separately.

## Changes

- Reservation and operation authority checks, queue eligibility checks, and issued deadlines use PostgreSQL `clock_timestamp()`. Lock waits cannot preserve an expired worker's authority. Settlement still retains unfinished operations through their bounded deadlines.
- Suspension terminalizes dependency-parked coordinators and reconciles cancelling runs whose workers and operations no longer have live authority. Reservations settle without requiring an Execution Engine callback; in-flight uncertainty remains charged.
- Lifecycle hold processing retains `requested_at` as PostgreSQL text through all cutoff comparisons and guarded completion. Completion cannot acknowledge a newer hold, and the latest persisted cutoff continues fencing old attempts after restore. Execution identity lookup also preserves microseconds.
- Workflow and chat approval resume share a transactionally guarded transition that rebases queue eligibility only when leaving `waiting_for_approval`. Replaying the same resume does not extend the deadline or reserve another outstanding slot. Approval expiry is unchanged.
- Admission quiescence rejects new reservations with `WORKSPACE_ADMISSION_PAUSED` (503) under the workspace lock, after the existing-reservation identity check. Dispatch quiescence returns `wait` for fresh queued/parked acquisition, permits existing authority renewal/release, and defers newly due Insights work even with capacity enforcement disabled.
- Capacity HTTP endpoints and execution-access middleware map unexpected authority/database failures to the bounded retryable `WORKSPACE_CAPACITY_UNAVAILABLE` 503 envelope. Known capacity errors retain their status and code; no downstream operation is authorized on failure.
- Snapshot unit fixtures now supply the active-workspace row required by the existing workspace lock in snapshot ingest.

## Regression evidence

New regressions live in `control-plane/test/workspace-capacity-fixes-postgres.test.ts` and `control-plane/test/workspace-capacity-boundaries.test.ts`. They run production repositories, approval resume, and maintenance against isolated PostgreSQL fixtures, plus local HTTP authority endpoints with failing database connections. No tests truncate the shared test database in these new suites.

The initial red run reproduced all three lock-wait authority failures, the eleven-minute approval deadline failure, missing admission and dispatch gates, and 52 lifecycle holds remaining pending. The disabled-enforcement Insights regression also failed before the dispatch guard was added.

The targeted final run passed 21/21 tests, covering the existing capacity primitive suite as well as:

- Real separate-connection workspace lock waits crossing lease expiry for park, renew, and operation begin.
- A still-valid fifteen-minute pre-step approval resolved after eleven minutes, preserving its original expiry and reusing the attempt; duplicate resume leaves the exact queue deadline unchanged.
- Chat approval resume dispatching once and preserving its rebased queue deadline on replay.
- Parked parent cancellation without a live EE task, rapid restoration, and settlement without a callback.
- Unfinished operation retention after suspension/restore until the operation deadline passes.
- More than 50 microsecond-precision holds draining across batches; a newer suspension arriving during processing cannot be marked completed by the older worker.
- Admission immediately after a hold within the same millisecond is permitted, while admission immediately before it is fenced.
- Closed admission/dispatch gates, disabled-enforcement Insights deferral, and retryable bounded failures from acquire/renew/begin and execution-access middleware.

## Commands and outcomes

Test services: PostgreSQL `127.0.0.1:55438/hosted_runtime_test`, user/password `hosted_test`; Redis `127.0.0.1:56438`. Commands requiring localhost service access were run with authorized sandbox escalation.

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 npm run db:migrate
```

Passed; applied migrations 011 and 012 to this test database.

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test --test-concurrency=1 test/workspace-capacity-fixes-postgres.test.ts test/workspace-capacity-boundaries.test.ts test/workspace-run-capacity-postgres.test.ts
```

Passed 21/21. Output: `/private/tmp/capacity-targeted-final.log`.

```sh
NODE_ENV=test node --import tsx --test --test-concurrency=1 test/repository-virtual-machines.test.ts test/snapshot-normalized-repository.test.ts
```

Passed 12/12 after correcting workspace-lock fixtures.

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 npm run validate
```

Passed, exit 0: 1,264/1,264 tests, type checking, style, migration checks, authorization, membership, event durability, contracts, OpenAPI, harness, and build. Output: `/private/tmp/capacity-full-validate-final.log`.

The first full run passed 1,258/1,262 tests; four snapshot fixture failures were corrected before the successful repeat. Earlier output: `/private/tmp/capacity-full-validate.log`.

Separately, `migrations:check`, `authz:check`, `membership:check`, `run-events:check`, `contracts:check`, and `openapi:check` passed. The first harness check found oversized auto-triage/delegation test files; root corrected those before the successful full validation. SQL upgrade/reset checks and Compose cross-service validation remain root-owned and were not run by this bounded subtask. `git diff --check` passed. Test database access is released for root's remaining validation.

Expected 404 cancellation responses are deliberately injected by the parked/uncertain-worker regressions and produce cancellation warning logs. They do not indicate a test failure.
