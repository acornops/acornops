# Task 1 policy foundation report

Implemented the policy foundation and hold API, then fixed all confirmed findings in hosted-task-1-review.md. No commits, pushes or subagents.

## Implemented behavior

- Five normalized execution pools (`chat`, `agent`, `workflow`, `autoTriage`, `insights`), each with a null pair or positive integer concurrency/outstanding limits; partial pairs, unknown fields, fractions and inverted limits are rejected. Existing plan literals may omit executionLimits for TypeScript compatibility, but parsed catalogues and effective limit resolution always normalize it.
- Narrow `admin:workspace:policy:read`, `admin:workspace:plan:write`, and `admin:workspace:external-hold:write` scopes. Token alternatives use the original primary scope for BFF human authorization; recent-auth and CSRF checks remain intact.
- Configured catalogue and bounded policy GET APIs. Explicit resource overrides, normalized execution limits, version, lifecycle/onset, public holds and current usage are included.
- Migration007 adds constrained policy version, admin/external holds, idempotency receipts and immutable plan limit hash registry. Existing suspensions become admin holds, preserving onset when known. Additive migration010 namespaces receipts and fills generic administrator public reasons. It attributes legacy receipts through authoritative success audits where possible; otherwise it preserves them under the unreachable __legacy_unattributed__ credential namespace.
- Workspace-locked transaction checks existing receipt first, then version and confirmation, counts usage, mutates selected policy state, advances version only for changes, and commits authoritative admin audit, sanitized tenant governance audit and receipt atomically. Audit failures roll back. Receipt replay does not repeat either audit. Identity is credential/workspace/operation/request ID. Identical canonical input in that namespace returns the original response for 30 days; different content with the same identity returns IDEMPOTENCY_CONFLICT. Expired receipts do not bypass the expected version. Successful audits include bounded before/after policy facts, and rejected business mutations write protected failure audit records after rollback.
- Version conflicts use WORKSPACE_POLICY_VERSION_CONFLICT. Narrow machine writes require requestId and expectedPolicyVersion. Every caller supplying requestId must supply expectedPolicyVersion; broad legacy calls may omit both. External hold credentials must explicitly select external. Plan/override operations reject external source.
- Plan changes preserve overrides. Resource/execution excess rejects by default; retain_existing permits the change without deleting admitted resources. Clearing one hold retains the other and the original effective onset.
- Parent confirmed compatibility ruling: broad legacy restoration may omit workspaceName, but supplied names must match exactly; narrow external restoration requires a name. Suspension always requires exact name. Existing before/after response fields remain, with additive policy and changed fields; plan responses retain usage/overLimit.
- Catalogue startup preflight checks assigned keys and persists canonical quota/execution-limit hashes. Reusing an existing key with changed limits fails startup; display-name changes remain permitted. Definitions are immutable even after becoming unassigned (stronger than active-only protection).

## Public and internal signatures

- `GET /admin/v1/workspace-plans` -> `{defaultPlanKey, plans}`.
- `GET /admin/v1/workspaces/:workspaceId/policy` -> `{workspaceId, workspaceName, plan, effectiveLimits, quotaOverrides, policyVersion, lifecycleStatus, suspendedAt, publicReason, usage, holds}`.
- Existing plan/quotas/suspend/restore bodies accept requestId, expectedPolicyVersion, overLimitBehavior, source, publicReason, in addition to existing fields.
- `src/types/workspace-policy.ts`: EXECUTION_POOLS, ExecutionPool, ExecutionPoolLimits, ExecutionLimits, ExecutionUsage, resolveExecutionLimits(input?: unknown), WorkspacePolicyError.
- `effectiveWorkspaceLimits(planKey, overrides).executionLimits` returns normalized execution limits.
- `repo.mutateWorkspacePolicy(input: PolicyMutationInput): Promise<PolicyMutationResponse>`; input is workspaceId, operation (`plan|quotas|suspend|restore`), body and `AdminAuditEventInput` produced by adminAuditEventInput. Response has before, after, policy, changed, plus usage/overLimit for plans.
- `repo.getWorkspacePolicy(workspaceId)` and `preflightWorkspacePlanCatalog(queryable = db)`.
- `cleanupWorkspacePolicyReceipts(batchSize = 1000, queryable = db): Promise<number>` in repository-workspace-policy-read.ts deletes one bounded batch of receipts older than 30 days (max batch 10000). Root maintenance invokes this; lookup expires them independently.
- `requireAdminScope(primaryScope, ...machineAlternatives)` preserves the primary human scope.
- Execution usage queries parent's workspace_run_reservations: `settled_at IS NULL` counts outstanding, and unsettled `executing_until IS NOT NULL` counts concurrent, grouped by pool. A to_regclass guard returns five zero pairs until migration008 exists. Migration009 cancellation trigger is parent-owned.

## Changed files

Policy-owned files under control-plane:

- migrations/control-plane/007_workspace_policy.sql, migrations/control-plane/010_workspace_policy_receipt_identity.sql
- src/types/workspace-policy.ts, src/types/contracts.ts
- src/config-admin.ts, src/auth/admin-token.ts, src/infra/db.ts
- src/store/repository-workspace-policy.ts, src/store/repository-workspace-policy-read.ts, src/store/repository-workspace-policy-audit.ts
- src/store/repository-quotas.ts, src/store/repository-admin-workspaces.ts, src/store/repository-admin.ts
- src/store/repository.ts (only policy imports and two properties; shared file)
- src/controllers/admin-workspace-policy-controller.ts, src/controllers/admin-workspace-lifecycle-controller.ts, src/controllers/admin-controller.ts
- src/routes/admin.ts
- src/docs/openapi/admin-workspace-policy-paths.ts, src/docs/openapi/admin-paths.ts, src/docs/openapi/schema-components-admin.ts
- scripts/check-public-openapi.mjs (admin line budget 4200 -> 5400, combined 33000 -> 34200, reflecting two new paths and fully described policy request/response bodies; actual admin artifact 5203 lines)
- docs/contracts/README.md
- test/workspace-policy.test.ts, test/workspace-policy-postgres.test.ts, test/admin-controller-security.test.ts, test/admin-token.test.ts

The repository's `npm run openapi:export` writes to ../docs-website. It regenerated `docs-website/openapi/control-plane-admin.json`; public artifact content stayed unchanged. Parent was notified of this cross-directory generated artifact. No mirrored contract manifests were edited.

## Validation

Tests were written and observed failing before implementation. Initial four config/schema/scope tests failed on missing behavior; the transaction test failed on the absent operation; tenant audit test failed with zero records before transactional tenant auditing was added. Existing controller mock tests were updated to the new transaction boundary, while SQL tests verify confirmation, usage limits, rollback and hold behavior against real PostgreSQL.

Passed:

- `NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test CONTROL_PLANE_TEST_DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test REDIS_URL=redis://127.0.0.1:56438 node --import tsx --test test/workspace-policy-postgres.test.ts test/workspace-policy.test.ts test/admin-*.test.ts test/quota.test.ts` — 96 tests passed, zero failures/skips after re-review fixes. Final log: /private/tmp/hosted-policy-rereview-final.log.
- `npm run typecheck`
- `npm run style:check`
- `npm run build`
- `npm run contracts:check`
- `npm run openapi:export` and `npm run openapi:check`
- `npm run migrations:check` — static chain checks; migration007 was applied with parent's migration008; migration010 was applied with `NODE_ENV=test DATABASE_URL=postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_test REDIS_URL=redis://127.0.0.1:56438 npm run db:migrate`. SQL tests used the migrated database. An isolated rolled-back schema test executed001–007 and010 around explicit legacy receipt/suspension fixtures.

Historical shared-worktree validation (before the review follow-up; superseded by parent's continuing runtime verification):

- `npm run validate > /private/tmp/hosted-policy-validate.log 2>&1` — exit1; 1214 tests, 1025 passed, 182 failed, 7 skipped. This run used normal test environment (no disposable DB override). Failures include runtime mocks that do not support parent's new workspace/capacity SQL and network EPERM for attempted default PostgreSQL connections. Parent owns those parallel runtime areas; no changes made there. Targeted policy/admin/quota tests are green with the disposable fixture.
- `npm run harness:check` — current parallel files src/agent/ws-server.ts and src/config.ts each552 lines against550 budget. Parent notified; neither grew from this policy subtask (config-admin is separate).
- Full compose cross-repository validation and consumer projections are parent-owned and not run by this subtask.

## Remaining concerns

- Parent must finish shared runtime test fixture updates/full validation and address the two shared harness budgets.
- Parent should coordinate the generated docs-website admin OpenAPI artifact and consumer documentation/projections. Policy producer contract documentation is updated.
- Receipt retention is implemented at 30 days. Root maintenance must invoke cleanupWorkspacePolicyReceipts periodically; expiry lookup already enforces the retention boundary even if maintenance is delayed. Unattributable007 receipts remain stored in an unreachable legacy namespace until normal expiry; they are not discarded by migration.
- Existing legacy repository mutation helpers remain exported for compatibility; all four admin HTTP mutation handlers now use the transactional policy operation.
- Catalogue preflight has no hot reload and intentionally requires a new key for changed limit definitions. No placeholder admission-rate, execution-override or future billing fields were added.


## Review follow-up evidence

All six confirmed review items are addressed:

1. Receipt identity now includes credential, workspace, operation and request ID in both lookup and primary key. A second token evaluates its own precondition; the same token can reuse an upstream event ID for a different operation.
2. Protected success audits contain bounded before/after plan keys, explicit quota overrides, effective resource/execution limits, holds, lifecycle/onset and versions. Tenant events receive only this sanitized policy state and public reasons, never private request reasons or tickets.
3. Rejections produce protected failure events outside the rolled-back mutation transaction. These include error code, requested operation/version/plan/overrides, and observed policy/usage when available. Controller-level precondition/source rejections are audited too, without duplicating repository-recorded failures.
4. Receipts expire after 30 days; cleanup is bounded and safe for concurrent maintenance. An expired retry is evaluated against expectedPolicyVersion and cannot receive an old success response.
5. Migration010 fills generic admin public reasons; snapshot reads resolve the same reason for legacy null holds while preserving effective onset. The snapshot exposes effective publicReason.
6. Configured-plan lookups use own-property checks, so constructor is rejected with WORKSPACE_PLAN_NOT_CONFIGURED instead of throwing TypeError.

New regression tests were observed failing before fixes in /private/tmp/hosted-policy-review-red.log. Final 93-test suite includes live cross-token/operation replay, before/after and failure auditing, 30-day cleanup/expiry, inherited keys, isolated additive migration upgrade and execution-limit downgrade rejection/retention. Typecheck, style, build, contracts, static migrations and generated OpenAPI checks passed again. The repository's simplistic style check initially rejected prose containing `public `; the documentation wording was adjusted and style passed.

Parent confirmed its later full-runtime run had 29 failures rather than the historical 182 failures from the unconfigured sandbox run; that runtime work remains outside policy scope. No root runtime files were edited during this review follow-up.


## Re-review follow-up, round 2

Resolved the remaining expired-versionless-restore finding from hosted-task-1-rereview.md. All four policy schemas now require expectedPolicyVersion whenever requestId is supplied. The controller and repository enforce the same condition for broad credentials, before any receipt lookup or mutation, returning POLICY_PRECONDITION_REQUIRED at the controller/repository boundary (schema validation uses the standard validation envelope). Calls omitting both fields retain the authorized legacy behavior.

Safe upgrade behavior is explicit: existing unversioned receipt requests are rejected before replay, whether fresh, expired or removed by cleanup. A client must read current policy and submit a new request ID with the observed version. Thus retrying an old receipt cannot clear a newer hold by becoming an unguarded mutation after 30 days.

Regression tests for all four schemas and an expired old-format restore receipt failed before implementation. Added a broad-controller precondition test. Final 96 tests passed with zero failures/skips using the same disposable fixture command above; log /private/tmp/hosted-policy-rereview-final.log. Typecheck, style, build, contracts, OpenAPI export/check passed. No migration or root runtime change was required for this round. Generated admin OpenAPI was refreshed, and the producer contract documents the transition.
