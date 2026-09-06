# Final native-tool boundary re-review

Reviewed 6 September 2026. Scope: the P1 native-tool authority omission in
`hosted-final-review.md`, its fix, and directly affected native/builtin Fetch and
document behavior. No product edits, subagents, commits, push or deployment.

**The P1 finding is resolved. No new material finding in this scoped re-review.**

Both native and builtin-MCP controllers capture a frozen owner/generation before
awaited run/scope lookups, pass it into the native executor, and return bounded
capacity errors. Both conversation and workflow document repositories now run
the insert on the same transaction/client as workspace-lock lifecycle,
suspension-cutoff and current ownership validation. Suspension cannot commit
between that validation and the document write. Limits-disabled execution still
checks lifecycle and durable cancellation, including rapid suspend/restore.

Fetch resolves and validates DNS first, then the new `beforeRequest` hook checks
current authority and begins its bounded operation before `https.request`.
Operation insertion shares the authority transaction; the immutable generation
and stable tool-call operation ID prevent stale ownership or delivery replay.
The actual request timeout is recalculated after authority lookup, and is no
longer than its operation deadline. Final cleanup destroys the request and
finishes the exact operation, including request-construction failures. Failed
cleanup leaves conservative bounded operation evidence for reconciliation.

## Independent verification

Passed **17/17**, zero failures/skips, against the separate disposable
`hosted_rollout_test` PostgreSQL database, coordinated with root and the
implementer. The suite used real PostgreSQL and mocked DNS/HTTPS; it did not
contact external destinations:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_rollout_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_rollout_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test --test-concurrency=1 test/native-tool-capacity-postgres.test.ts
```

Log: `/private/tmp/hosted-final-native-rereview.log`.

This independently reruns the original post-route-authorization document race
through both controllers, rejecting suspension, lease expiry and rapid restore
with zero document inserts. It also covers immutable identity across awaited
lookup, all three revocations during DNS with zero sockets/operation rows,
lifecycle enforcement with limits disabled, operation retention after lease
expiry until response cleanup, and request-construction error cleanup. The
initial sandbox attempt failed at loopback connection with `EPERM`; the
approved escalated run above passed. No product failure was inferred from that
environment restriction.

`git diff --check` passed. Inspected the new authority helper, both controllers,
native executor, both document transaction paths, shared optional-transaction
operation primitive, Fetch timing/cleanup and all native regression tests.
Document serialization with concurrent suspension is source-verified from the
shared workspace row lock and transaction, rather than a newly executed
concurrent-write test.

## Readiness and limits

This closes the sole P1 blocker in the original final review. Root reports that
the separately reviewed rollout documentation ordering correction is also
closed. Task 3's final report is now available with completed console and
browser evidence; that supersedes the original review's pending-evidence note.
The final handoff still must use the implementer's fresh full CP validation
result after this fix. This reviewer did not rerun the whole platform,
full browser suites, real providers or rollout activation. Existing user
platform services were untouched; the coordinated test database is released.
