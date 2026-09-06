# Policy foundation re-review, fix round 2

Reviewed 6 September 2026. Scope is the final expired-versionless-restore finding
and direct regressions from its fix. Root runtime work and previously resolved
items were not reopened. No product code was edited and no commits were made.

## Result

**The remaining finding is closed. No new actionable findings in this scope.**

All four request schemas require expectedPolicyVersion whenever requestId is
supplied. The common mutation controller and repository independently enforce
that condition for broad credentials as well as narrow credentials. The
repository check at `src/store/repository-workspace-policy.ts:47` runs before
receipt lookup and state mutation, so an old versionless request is rejected
whether its receipt is fresh, expired or already removed by cleanup.

The new PostgreSQL regression seeds an expired old-format restore receipt,
creates a newer suspension hold, and verifies that the versionless retry fails
with POLICY_PRECONDITION_REQUIRED while the hold and version remain unchanged.
It also verifies that an intentional legacy restore omitting both preconditions
still succeeds. Schema coverage checks all four operations, and controller
coverage checks broad-credential rejection.

Valid versioned retries retain the existing receipt-first replay behavior.
The approved compatibility path that omits both fields remains available.
Producer documentation explains that old versionless receipt clients must read
current policy and submit a new request ID with the observed version. OpenAPI
includes the corresponding conditional requirement. Schema failures use the
standard validation envelope; controller/repository checks use
POLICY_PRECONDITION_REQUIRED, as stated in the updated implementation report.

## Independent validation

Passed **96 tests, zero failures or skips** against the disposable PostgreSQL
fixture:

```sh
NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test test/workspace-policy-postgres.test.ts test/workspace-policy.test.ts test/admin-*.test.ts test/quota.test.ts
```

Log: `/private/tmp/hosted-policy-rereview-2-tests.log`.

Full runtime validation, typecheck, style, build and consumer integration were
not rerun for this narrowly scoped re-review. The implementation report records
the implementer's checks; this result does not approve unfinished runtime work.
