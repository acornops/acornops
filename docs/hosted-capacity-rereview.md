# Hosted capacity primitive re-review

Reviewed 6 September 2026 on `feat/oss-hosted-readiness`. Scope: the four findings in `hosted-capacity-review.md`, admission/dispatch gates, bounded authority 503 responses, and the chat approval retry correction made during this re-review. Read `hosted-capacity-fix-brief.md` and `hosted-capacity-fix-report.md`. No production files changed by this reviewer.

**No unresolved findings in this scoped re-review.** All four original defects are corrected in the reviewed source and covered by independently rerun regressions.

## Findings disposition

| Original finding | Disposition and evidence |
| --- | --- |
| P1: transaction-start time preserves expired authority after lock wait | Resolved. Reservation ownership checks and issued leases/operation deadlines use `clock_timestamp()`. Real separate-connection tests hold the workspace lock across expiry and verify park, renew and begin all reject the old owner. Existing operation-retention tests still pass. |
| P1: suspension strands parked coordinators and outstanding capacity | Resolved. Maintenance terminalizes parked attempts and independently reconciles cancelling attempts with no live lease or unfinished bounded operation. Tests use an unavailable EE, confirm parent cancellation and reservation settlement without callback, retain uncertainty through the operation deadline, and fence attempts after restore. |
| P1: timestamp truncation prevents outbox completion/starves newer holds | Resolved. Hold timestamps and execution admission identity are read as PostgreSQL text and round-trip without losing microseconds. The guarded completion comparison preserves a superseding hold. Tests drain 52 holds, preserve a newer hold arriving during processing, and discriminate admission immediately before/after a cutoff within one millisecond. |
| P2: valid approval after ten minutes cannot acquire | Resolved. The shared approval transition updates eligibility/deadline within the same transaction only when the run leaves `waiting_for_approval`; it reuses the reservation. Workflow approval after eleven minutes acquires successfully without changing the fifteen-minute approval expiry. Workflow/chat replay preserves the exact rebased deadline. |

## Gates and authority failures

`reserveRunCapacity` checks admission under the workspace lock after matching an existing reservation's identity. Closed admission rejects a new attempt with retryable `WORKSPACE_ADMISSION_PAUSED` 503 and preserves identical delivery replay. `acquireRunCapacity` returns wait for new queued/parked acquisition while dispatch is closed; existing valid ownership can renew, finish operations and release. Insights defers new model work when dispatch is closed even with enforcement disabled.

Unexpected capacity endpoint and execution-access lookup/transaction failures produce a fixed `WORKSPACE_CAPACITY_UNAVAILABLE` 503 envelope with `retryable: true`. Known `WorkspaceCapacityError` statuses and codes remain intact. The focused boundary tests verify acquire, renew and operation-begin failures at identity and transaction stages, plus middleware refusing to call downstream after lookup failure. The error payload does not expose the injected private SQL diagnostics.

One gate interaction needed an additional correction during re-review: chat approval originally moved a run to dispatching and then called direct dispatch, which failed during quiescence without retaining a new delivery intent. Root corrected this by transactionally rearming the conversation outbox on the first approval transition and invoking the outbox worker, which respects the gate. I reviewed that patch and tested the previously delivered-outbox case independently against PostgreSQL.

The independent probe verified:

- Closed dispatch: approval rearmed the original delivered outbox row, rebased the same reservation, and sent zero downstream requests.
- Approval replay while closed did not rebase the deadline again.
- Reopening with a downstream 503 retained the delivery as failed for retry.
- The next due tick delivered the same run; run/workspace/target identities in the actual dispatch payload were correct.
- Approval replay after successful delivery produced no further dispatch and left the exact deadline unchanged.

The upsert's existing payload remains valid for this worker: it loads and dispatches the persisted run, and does not read the outbox payload's optional resume field.

## Independent validation

After the final chat outbox correction, this command passed **21/21**, exit 0:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test --test-concurrency=1 test/workspace-capacity-fixes-postgres.test.ts test/workspace-capacity-boundaries.test.ts test/workspace-run-capacity-postgres.test.ts > /private/tmp/capacity-rereview-targeted-final.log 2>&1
```

An earlier independent run before the chat correction also passed 21/21: `/private/tmp/capacity-rereview-targeted.log`.

The additional approval gate/retry probe passed, exit 0:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx /private/tmp/capacity-rereview-chat-gate.ts > /private/tmp/capacity-rereview-chat-gate.log 2>&1
```

The probe used random-ID fixtures, production approval/reservation/outbox functions and a stubbed downstream HTTP response. Worker candidate selection was scoped to the probe workspace. Fixtures were deleted in `finally`; no TRUNCATE was used. Initial `.mts` harness execution loaded mixed TSX module forms and did not share mutable test configuration with the production imports; the successful `.ts` harness uses the repository's `.js` import convention. That harness setup failure is not a product finding. Expected injected HTTP 503/404 warning logs are not test failures.

Database access has been released to root. Full validate was not repeated by this reviewer: the fix report records its earlier 1,264/1,264 full pass, and the later chat patch received the scoped rerun above. SQL upgrade/rollout, EE/GW, UI and root's subsequent Insights supersession changes remain outside this bounded review; this is not a full hosted rollout approval. Docs impact: this review artifact only. No commit or PR created.
