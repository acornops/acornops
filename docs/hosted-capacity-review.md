# Hosted capacity primitive review

Reviewed 6 September 2026 on `feat/oss-hosted-readiness` in the hosted-readiness worktree. Scope: reservation/operation repository primitives, capacity maintenance, execution-access middleware and capacity controller, migrations 008/009/011, capacity PostgreSQL tests, and the new concurrency-one delegation test. The approved contract is `docs/oss-hosted-readiness-plan.md`. No production code edits; policy, EE/GW/UI and new rollout work were outside this review.

Four concrete defects require correction.

## P1 — Transaction-start time lets an expired worker regain execution authority

Location: `control-plane/src/store/repository-run-capacity.ts:74-76` (also renewal at 123-124 and operation deadlines in `repository-capacity-operations.ts:9-14`).

Every primitive starts a transaction before acquiring the workspace lock. PostgreSQL `NOW()` remains the transaction start time after a lock wait. Consequently the new live-authority check in `releaseRunCapacity(..., 'parked')` accepts an owner whose lease has expired in real time, if the transaction began before expiry. That changes the attempt back to executable and grants a replacement worker. `renew` and `operations/begin` use the same check; deadlines created with `NOW()` also lose the lock-wait duration.

Real PostgreSQL reproduction:

1. Reserve/grant an attempt, then set its lease expiry to wall-clock +300 ms.
2. Hold its workspace row lock on another connection.
3. Begin `releaseRunCapacity(runId, owner, generation, 'parked')`, letting it wait on that lock.
4. Wait 600 ms and independently confirm `lease_expires_at < clock_timestamp()`.
5. Release the lock. The park call succeeds. `acquireRunCapacity(runId, 'replacement')` grants generation 2.

Observed: `CLOCK: park transaction waited across lease expiry and succeeded; new worker => {"status":"granted","generation":2,"pool":"agent","leaseSeconds":30}`.

Use wall-clock time obtained after locking for authority/queue eligibility checks and newly issued lease/operation deadlines. Add a two-connection regression that blocks park, renew and begin across expiry and requires rejection. Migration 011 changes admission defaults only, so does not fix this.

## P1 — Suspension permanently strands parked coordinators and outstanding capacity

Location: `control-plane/src/services/workspace-capacity-maintenance.ts:17-23`, `36`, `39-60`.

A dependency-parked coordinator has workflow status `running`, reservation state `parked`, and no worker lease. Suspension converts its run to `cancelling`, sends best-effort EE cancellation, and deletes its only continuation. If the engine has no task (normal after durable parking/process restart) or cancellation cannot be delivered, no callback settles it. Both later maintenance selectors exclude the combination `cancelling` + `parked`: the expiry scan only considers executing or queued reservations and the terminal scan excludes cancelling runs. It therefore consumes outstanding capacity indefinitely, including after restore.

Real PostgreSQL reproduction: create a running coordinator, acquire and park its grant, persist a dependency continuation, suspend its workspace, return HTTP 404 to EE cancel requests, then execute maintenance twice. Observed state:

```json
{"status":"cancelling","state":"parked","lease_expires_at":null,"settled_at":null,"continuation":false}
```

Cancellation must durably terminalize work that has no execution owner or in-flight operation, and settle its reservation. Reconciliation must handle unreachable workers and parked attempts independently of callback delivery, while preserving active-operation uncertainty. Test suspension of a parked parent with the engine unavailable, both before and after restore.

## P1 — Timestamp precision loss prevents lifecycle outbox completion and starves later holds

Location: `control-plane/src/services/workspace-capacity-maintenance.ts:13-14`, `37`; producer is migration 009.

The query reads PostgreSQL `requested_at` into a JavaScript `Date`. PostgreSQL stores microseconds, while the pg Date representation preserves only milliseconds. The completion update compares `requested_at=$2` using that truncated value, so ordinary trigger-generated timestamps do not match. These outbox entries remain pending and are retried forever. Because the reader orders oldest first and limits to 50, fifty such completed-in-practice entries prevent newer suspension cancellation from being processed. Execution boundary denial still exists, but durable job/approval cancellation and capacity cleanup stop progressing for later workspaces.

Real PostgreSQL reproduction: use a deterministic sub-millisecond timestamp, read it through pg normally, then execute the exact completion UPDATE. Observed:

```text
exact=2026-09-05 21:12:19.917123+00
JS=2026-09-05T21:12:19.917Z
completion updated rows=0
```

Use an exact outbox version/identity or retain the timestamp as PostgreSQL text through the read/update roundtrip. Preserve the equality guard so completing an older hold cannot mark a newer concurrent suspension complete. Include a microsecond timestamp regression and a >50-workspace progress test.

## P2 — Pre-step approval consumes the eligible queue deadline before work is eligible

Location: `control-plane/src/store/repository-run-capacity.ts:58-60`, `105-106`; supporting caller `repository-automation-approvals.ts:319-328`.

The reservation starts its 600-second queue deadline at acceptance even when a Workflow awaits pre-step approval. Such approvals remain valid for 15 minutes (`repository-workflow-run-approvals.ts:61`). Maintenance exempts `waiting_for_approval` from expiration, but approval only changes the run to queued and never updates reservation eligibility/deadline. Approving during minutes 10–15 therefore produces a queued attempt that immediately receives `blocked` from acquire, or is failed by the next maintenance pass. This contradicts preserving existing approval expiry and measuring the eligible queue interval.

Real PostgreSQL reproduction: create a reserved Workflow in waiting_for_approval, age its queue deadline past expiry, call the actual `applyAutomationApprovalOutcome` with an approved pre-step outcome, then acquire. Observed: `APPROVAL: approved pre-step run with expired admission deadline => {"status":"blocked"}`.

Represent approval waiting independently from eligible queue time, and start/rebase the eligible deadline transactionally on the relevant approval transition without creating a new reservation. Test a still-valid approval after 11 minutes and successful acquisition of the same attempt.

## Validation evidence and limits

The real PostgreSQL probe ran with isolated random-ID fixtures in `hosted_runtime_test`, with parent authorization and no concurrent root database tests. It invoked production repository functions and production maintenance. Maintenance candidate reads were scoped to the fixture and unrelated conversation dispatch/receipt cleanup were bypassed; EE cancellation was stubbed to HTTP 404. Fixtures were deleted in `finally`; no TRUNCATE was used.

Final command, exit 0:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx /private/tmp/hosted-capacity-review-probe.mts > /private/tmp/hosted-capacity-review-probe.log 2>&1
```

Reproducer: `/private/tmp/hosted-capacity-review-probe.mts`. Exact output: `/private/tmp/hosted-capacity-review-probe.log`. An initial sandboxed invocation could not reach the local database; it was rerun with escalation. Two fixture-only setup failures (missing requested_at default in the test database and duplicate root attempt number) were corrected before the successful run. Migration 011 had not been applied to this runtime fixture; the probe supplied requested_at explicitly. None of these four defects depend on that missing default.

The initial suspected unlocked expiry-selector/renewal race was not promoted to a separate finding: under ordinary uncontended acquisition rules, expired ownership cannot renew. The reproduced transaction-time defect above supplies the concrete reachable authority bypass.

Existing tests cover grant races, operation retention, ordinary expired-owner rejection, rapid restore, and successful parent parking/resumption, but not these four cases. Full validate, SQL upgrade checks and EE/GW integration were not run because this was a bounded read-only review with a shared database. Docs impact: this review artifact only. No commits or PRs created.
