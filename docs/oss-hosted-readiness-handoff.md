# OSS hosted-readiness implementation handoff

Status: implementation and local acceptance complete. All material review findings
are resolved. Release activation remains an operator action.

## Delivered scope

The implementation follows the [approved plan](oss-hosted-readiness-plan.md):
optional external policy control, independent administrative/external suspension
holds, and five independent execution pools: Chat, Agent, Workflow, auto-triage
and Insights. Each pool has its own concurrent and outstanding limits. Workflow
children consume Workflow capacity. Omitted limits remain unlimited, and capacity
enforcement is disabled by default. There is no aggregate pool cap, billing,
pricing, monthly allowance or mandatory hosted dependency.

The control plane owns transactional admission, versioned policy receipts,
durable cancellation/delivery, fenced execution grants and bounded operation
records. Engine and gateway enforce the matching authority contract and recover
durable queues and explicit approval/dependency continuations. Consoles provide
safe suspended-workspace discovery and versioned administrative policy actions.
Compose, Helm and public/runtime documentation describe coordinated activation.

## Workspace and integration

All changes are uncommitted on `feat/oss-hosted-readiness` in the parent and seven
child worktrees under `/Users/tjtanjin/Desktop/acornops/hosted-readiness`.
The original `acornops-workspace` checkouts are untouched. No remote issue, PR,
push, merge or deployment was performed. Local dependency symlinks and generated
test results are not deliverables and must not be staged.

Integration order: control-plane migrations/contracts, execution-engine and
llm-gateway, both consoles, then deployment configuration and public docs. Release
the services as a compatible set and follow the
[activation and rollback runbook](../acornops-deployment/docs/hosted-readiness.md).
Published image pins are unchanged: compatible release builds must exist before
activation. All replica peer addresses must be supplied; the CLI cannot discover
an omitted replica. Prepare and verify with admission/dispatch gates closed.
Rollback preserves holds, receipts, reservations and operation uncertainty.

## Validation evidence

Commands run from the named repository, with existing dependencies provisioned.
PostgreSQL/Redis checks used disposable local services, separate test databases
and temporary upgrade schemas; existing user platform containers were untouched.
Both disposable test stacks were stopped and removed after acceptance. Final
documentation-only edits passed the parent and affected component harness checks.

| Repository/check | Command | Result |
| --- | --- | --- |
| Control plane | `npm run validate` with `NODE_ENV=test`, disposable `DATABASE_URL`, `CONTROL_PLANE_TEST_DATABASE_URL`, `CONTROL_PLANE_MIGRATION_TEST_DATABASE_URL` and `REDIS_URL` | 1,284 tests plus static/SQL upgrades, authz/membership, contracts, OpenAPI, harness and build passed after the final native-tool correction |
| Compiled rollout CLI | `CONTROL_PLANE_ROLLOUT_TEST_COMPILED=true node --import tsx --test test/workspace-capacity-rollout-postgres.test.ts` with the disposable test database | Passed; prepare/backfill, peer verification, drain rejection and deactivate |
| Real replicas | `node --import tsx test/integration/capacity-replicas.ts` with disposable PostgreSQL/Redis | Passed; two CP HTTP processes and two actual Redis-backed engine workers, 3/12 Chat admissions, independent Agent work, four settled attempts and both engines used |
| Execution engine | `task validate` | 284 unit tests, 29 keyless evaluations, lint, contracts and harness passed |
| Engine Docker integration | `docker compose -p acornops-hosted-engine-integration -f tmp/hosted-readiness/engine-integration.yaml up -d --build`, then `docker compose -p acornops-hosted-engine-integration -f tmp/hosted-readiness/engine-integration.yaml exec -T execution-engine pytest tests/test_integration.py -q` from the parent | Five tests passed; disposable stack subsequently removed |
| LLM gateway | `task validate` | 723 unit tests, 52 keyless evaluations, lint, contracts and harness passed |
| Management console | `VITE_APP_DATA_MODE=control-plane npm run validate` | 1,074 tests and canonical UI/build/contract checks passed |
| Management browser | `FIXTURE_APP_PORT=44961 npx playwright test --config=playwright.fixtures.config.ts tests/fixtures/workspace-suspension.spec.ts --retries=0` | Five suspension/deep-link/login/restore scenarios passed |
| Platform Admin | `ADMIN_CONSOLE_DATA_MODE=control-plane npm run validate` | 93 tests, 27-route/8-scope contracts, requirements, build and smoke checks passed |
| Platform Admin browser | `PLAYWRIGHT_MODULE_PATH=../management-console/node_modules/playwright/index.mjs node scripts/verify-hosted-policy-browser.mjs` (the executed environment used the equivalent absolute module path) | Five pools, explicit downgrade retention, exact-name versioned holds and compact layout passed |
| Deployment | `task validate` | Compose, Helm, release matrix and production edge/image checks passed |
| Standalone service Compose | `docker compose config --quiet` in CP, EE and gateway | Passed |
| Public docs | `npm run validate` and `npm run links` | Build and broken-link checks passed |
| Parent workspace | `task validate` | Harness and cross-repository checks passed |

The [progress ledger](oss-hosted-readiness-progress.md) and task reports retain
the review/fix sequence. Policy, capacity, execution, console and rollout scoped
reviews are clean. The [whole-change review](hosted-final-review.md) found one
additional native-tool operation boundary omission, now fixed and independently
[re-reviewed](hosted-final-rereview.md): 17 PostgreSQL regressions passed. The
[native fix report](hosted-native-fix-report.md) records the reproduced failures,
30-test targeted pass and final full validation. Final `git diff --check` passed
in the parent and every affected child. The deployment catalogue-change ordering
correction was separately rechecked against the startup and CLI guards.

## Evidence limits

The real replica probe uses a deterministic operation body, not live LLM or MCP
credentials. Provider/MCP transport boundaries have separate deterministic
regressions. Console browser checks use isolated fixtures/mock BFF, not a live
production OIDC session; no full visual snapshot refresh or assistive-technology
audit was performed. No production load, staging soak or live-provider acceptance
is claimed. The operator runbook owns the remaining release activation procedure.

## Documentation map

- [Control-plane runtime invariants](../control-plane/docs/workspace-execution-capacity.md)
- [Deployment and rollback](../acornops-deployment/docs/hosted-readiness.md)
- [Console behavior and evidence](hosted-task-3-report.md)
- [Execution/gateway changes and review fixes](hosted-task-2-report.md)
- [Policy API review](hosted-task-1-rereview-2.md)
