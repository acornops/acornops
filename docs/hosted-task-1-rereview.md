# Policy foundation re-review, fix round 1

Reviewed 6 September 2026. Scope: fixes to the previous policy review findings
and their direct regressions, including migration 010 and the updated task 1
report. Root runtime implementation remains outside scope. No product code was
edited and no commits were made.

## Remaining finding

### P2: Expired versionless receipts allow old restores to clear newer holds

Location: `control-plane/src/store/repository-workspace-policy.ts:52` and
`control-plane/src/controllers/admin-workspace-policy-controller.ts:27`.

Receipt lookup now ignores records older than 30 days. However, broad credentials
can still submit requestId without expectedPolicyVersion. On expiry the old
request becomes a fresh mutation with no version check, so a delayed restore
retry can remove a hold created after that restore originally succeeded. This
is a direct regression introduced by expiry; the previous durable receipt would
have returned the original outcome without restoring the newer state.

Confirmed against PostgreSQL using an isolated workspace and a broad credential:

1. Suspend the admin hold (version 1).
2. Restore with `requestId: "old-restore"`, omitting expectedPolicyVersion
   (version 2). This body is allowed by the broad-credential controller path.
3. Suspend again (version 3).
4. Set the old receipt's created_at to 31 days ago to simulate retention expiry.
5. Resend the identical restore request.

Observed result: `before.lifecycleStatus: "suspended"`,
`after.lifecycleStatus: "active"`, `changed: true`, policyVersion 4. The expected
result is that an old idempotent retry cannot clear the newer hold. Cleanup of
the receipt would cause the same behavior. The fixture was removed afterward.

Require expectedPolicyVersion whenever a caller supplies requestId, while
preserving the authorized legacy path that omits both, or provide an equivalent
durable guard that survives expiry. Existing unversioned receipts also need a
defined safe transition if they can exist during upgrade. Add a regression for
this sequence. The current expiry test always supplies a version and therefore
does not cover this case.

## Previous findings resolved

- Receipt storage and lookup now use credential/workspace/operation/request ID.
  Cross-token requests evaluate their own version, and a request ID can be reused
  for a different operation. Migration 010 backfills attribution from the
  original successful audits and preserves unmatched records in a legacy
  namespace.
- Successful protected audits now contain bounded before/after policy state:
  plan key, overrides, effective limits, holds, lifecycle/onset and versions.
  Private request reasons and ticket references are not copied into tenant
  metadata.
- Policy rejections write protected failure events after transaction rollback.
  Controller precondition/source failures are also audited, and auditRecorded
  prevents duplication. Successful mutation/audit/receipt atomicity is retained.
- Generic administrator reasons are backfilled by migration 010 and resolved
  for remaining null admin holds. The upgrade test preserves the legacy onset.
- Own-property catalogue checks now reject `constructor` with
  WORKSPACE_PLAN_NOT_CONFIGURED.
- Thirty-day lookup expiry, bounded cleanup and an expiry index are implemented.
  A cleanup call is present in the parent's maintenance function; the broader
  runtime maintenance implementation was not reviewed here. The versionless
  expiry case above remains open.

## Independent validation

Passed **93 tests, zero failures or skips**:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test test/workspace-policy-postgres.test.ts test/workspace-policy.test.ts test/admin-*.test.ts test/quota.test.ts
```

Log: `/private/tmp/hosted-policy-rereview-tests.log`. This includes real PostgreSQL
receipt identity, success/failure audit, expiry, cleanup, isolated legacy
migration and execution-downgrade tests. A separate inline Node reproduction
confirmed the remaining expiry finding. Full validation, typecheck, style,
build and consumer integration were not rerun in this scoped re-review; the
updated implementation report records the implementer's checks.
