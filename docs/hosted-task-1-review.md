# Policy foundation review

Reviewed 6 September 2026 against control-plane base `abefb7c`, the approved
`oss-hosted-readiness-plan.md`, task 1 brief, and task 1 implementation report.
Scope is the policy-owned files named in that report. Concurrent runtime changes,
migrations 008/009, and consumer implementations are outside this review.
No product files were edited and no commits were made.

## Findings

### P2: Receipt identity omits the credential and operation

Location: `control-plane/src/store/repository-workspace-policy.ts:49` and
`control-plane/migrations/control-plane/007_workspace_policy.sql:18`.

The approved identity is token/workspace/operation/request ID. The lookup and
primary key instead use only workspace/request ID. Including operation in the
body hash does not provide a separate operation namespace: it makes the second
operation conflict. Credential identity is absent from both lookup and hash.

Reproduced against PostgreSQL with a fresh workspace:

1. Token A suspends the external hold using request `event-1`, expected version 0.
2. Token B submits the identical body. It receives success at version 1 from A's
   receipt, instead of evaluating its own request and rejecting the stale version.
3. Token A restores the external hold using `event-1`, expected version 1. This
   distinct operation fails with `IDEMPOTENCY_CONFLICT`.

Independent controllers or operations that reuse an upstream event ID interfere
with each other, and another credential's request is treated as an already
audited success. Add token identity and operation to receipt storage, lookup and
uniqueness, and test cross-token and cross-operation cases. OpenAPI's current
“Workspace-scoped idempotency key” description also needs to match the approved
identity.

### P2: Successful policy audits no longer identify the changed values

Location: `control-plane/src/store/repository-workspace-policy.ts:87`.

The new authoritative admin event records versions, source and `changed`, but
omits the old/new plan keys, quota overrides and hold/lifecycle values. The
controller contributes only ticketRef. The prior plan/quota controllers recorded
the old/new values in the protected audit.

Reproduction: change a workspace's quota override from null to `members: 5` and
query its `admin.workspace.quotas.update` event. Metadata contains only source,
changed, correlationId, policyVersion, policyRequestId and beforePolicyVersion;
neither the affected quota nor its new value appears. This was observed against
PostgreSQL. For legacy requests without requestId there is no receipt containing
the before/after response either, so the change cannot be reconstructed from its
durable governance records.

Persist a bounded, explicit policy delta in the same authoritative event. Keep
private reasons protected and avoid copying arbitrary request bodies. Tests
should assert the relevant before/after values, not just audit row counts.

### P2: Rejected policy mutations lost protected failure audit records

Location: `control-plane/src/controllers/admin-workspace-policy-controller.ts:35`
and `control-plane/src/store/repository-workspace-policy.ts:56`.

The previous controllers wrote failure events for wrong workspace-name
confirmation, duplicate lifecycle operations and over-limit plan/quota requests.
The replacement transaction throws before its only audit insert, and the
controller's catch only formats the error. These attempts now leave no protected
admin failure event. This regresses existing behavior and the documented security
model that mutating admin requests write `admin_audit_events`.

Reproduction: on a fresh workspace submit suspend with an incorrect workspace
name, then query protected audit events for that workspace. The operation fails
at the name check before any audit insert. The same control flow applies to an
over-limit downgrade. This finding is verified by the code path; the focused
tests currently assert the error response only.

Preserve failure auditing outside the rolled-back state transaction, using the
verified actor identity and bounded failure metadata. Do not make successful
mutation auditing best-effort or weaken its existing atomic rollback guarantee.

## Explicit specification gaps

- The approved plan says receipts are retained for 30 days. The implementation
  retains them until workspace deletion and has no expiry lookup or cleanup.
  The task report acknowledges the implementation gap, but describes retention
  as requiring a future agreement even though the approved duration already
  exists. Implement the agreed retention contract or obtain an explicit change;
  any expiry path must retain expected-version protection against stale replay.
- Migration 007 backfills suspended rows with a null `public_reason`, rather than
  the approved generic public reason. Timestamp preservation and conservative
  admin-hold assignment are otherwise present.
- `planKey: "constructor"` passes the API's key format and the new configured-plan
  guard because the catalogue is a normal object with inherited properties.
  A real database mutation attempt throws `TypeError` instead of
  `WORKSPACE_PLAN_NOT_CONFIGURED`. The underlying object-lookup defect already
  existed in `repository-quotas.ts` at the base, so this is a pre-existing defect
  exposed by the new explicit unknown-plan contract, not a newly introduced
  regression. Use own-property lookup or a Map and add a regression case.

## Validation and positive findings

The focused suite passed **39 tests, zero failures or skips**:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test test/workspace-policy-postgres.test.ts test/workspace-policy.test.ts test/admin-controller-security.test.ts test/admin-token.test.ts
```

Log: `/private/tmp/hosted-policy-review-tests.log`. The first sandboxed attempt
failed with local-connect EPERM; the approved rerun against the disposable local
fixture passed. An additional temporary inline Node fixture reproduced the
receipt behavior, missing audit values and inherited-plan-key error; that
workspace and user were removed afterward.

The implementation locks the workspace before reading a receipt or applying
preconditions. State, successful admin audit, sanitized tenant event and receipt
commit in one transaction. Existing tests verify audit failure rollback,
concurrent duplicate requests, no-op version checking, composed holds, stable
effective onset, preserved overrides, resource downgrade rejection/retention and
five-pool execution usage. Scope alternatives retain the primary BFF human scope,
recent authentication and CSRF checks. Execution configuration rejects partial,
unknown, fractional and inverted pairs.

Missing focused coverage includes receipt credential/operation namespaces,
failure audit preservation, audit delta contents, migration upgrades from legacy
suspended fixtures, receipt expiry, and execution-limit downgrade rejection.
Typecheck/style/build and wider admin/quota validation were reported by the
implementer but were not independently repeated here. Full validation and
cross-repository integration were not rerun because runtime work remains in
progress outside this review's scope.
