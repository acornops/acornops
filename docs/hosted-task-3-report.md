# Hosted Task 3: console integration report

Implemented in management-console and platform-admin-console on the approved hosted-readiness branch. No commits, pushes, subagents or changes to the existing Docker platform were made by this task.

## Behavior and requirement impact

Management console discovers minimal member access-state before workload bootstrap, keeps suspended memberships in the directory/selectors without inferred permissions or fabricated counts, and replaces workload content with an accessible blocking screen showing only the safe name/public reason. HTTP403 and SSE suspension signals latch the originating workspace, abort tracked requests/streams, invalidate session/composer/VM caches, remount surviving active content, and refresh safe state. A 15-second idle check has a 10-second request bound. Restore uses an explicit fresh overview navigation and never replays old actions. Password-login and deep-link fixture flows preserve the suspended destination.

Platform Admin replaces the read-only exclusion of REQ-WSP-002/EXC-015 and updates DEV-014, human requirements and executable evidence. Override editing and its mutation endpoint remain excluded/API-only. The panel shows effective resource limits, explicit overrides, all five independent execution pools, and separate admin/external holds. REQ-WSP-004/EXC-016/EXC-017 retain deterministic reasons and exact-name lifecycle confirmation. Policy writes use observed versions and request IDs; an identical retry retains the same payload/ID, a version conflict fetches and displays the complete latest policy for another deliberate confirmation, and over-limit downgrades require explicit retain_existing acceptance. Restore removes only the admin hold and reports a still-suspended policy truthfully.

The browser still calls only same-origin admin-console-api. The two added fixed BFF reads use existing human governance scopes; machine credentials never reach the frontend. Strict request schemas exclude external-hold writes and quota editing. Explicit response projections strip tenant records and private reasons while retaining policy/changed mutation results. Admin auth, MFA, CSRF and recent-auth enforcement are unchanged.

## Final validation evidence

All commands below exited zero after final fixes:

- In management-console: `VITE_APP_DATA_MODE=control-plane npm run validate` — 212 test files, 1074 tests; UI package, design/adoption, typecheck, membership, contracts, harness, production build, bundle budgets and route smoke passed.
- In management-console: `FIXTURE_APP_PORT=44961 npx playwright test --config=playwright.fixtures.config.ts tests/fixtures/workspace-suspension.spec.ts --retries=0` — 5 passed. Covers overview/cluster/agent suspended deep links with zero workload requests, idle current-tab suspension removing workload UI, explicit fresh restoration and password login to a suspended deep link.
- In platform-admin-console: `ADMIN_CONSOLE_DATA_MODE=control-plane npm run validate` — 93 tests; lint, contracts (27 routes/8 scopes), requirements, harness, build and static/API/denial smoke passed.
- In platform-admin-console: `PLAYWRIGHT_MODULE_PATH=/Users/tjtanjin/Desktop/acornops/hosted-readiness/management-console/node_modules/playwright/index.mjs node scripts/verify-hosted-policy-browser.mjs` — passed five-pool rendering, reject-to-retain_existing downgrade confirmation, fresh intent IDs, exact-name versioned admin hold suspend/restore and compact viewport overflow checks. Desktop/mobile screenshots are under platform-admin-console/test-results; mobile rendering was visually inspected.
- Both repositories: `git diff --check` — passed.

Focused HTTP tests include the actual producer SSE frame with no workspace ID, pre-fetch rejection of suspended workspace/current-run requests, active-stream abort and latched suspension until explicit fresh loading. BFF tests verify privacy projections and rejection of external source, absent version/ID and override fields. Parent commissioned an independent console review; findings on delayed public reasons, fabricated directory counts, background cache clearing, stale-policy review visibility and contradictory baseline wording were fixed.

## Earlier failures and limitations

Initial admin tests could not bind localhost under the sandbox; reruns with authorized escalation passed. Existing shared UI packages required building before tests. Stale route-count baselines, generated public-operation inventory and local source-size budgets were corrected; no check was bypassed or budget raised. Initial browser port4188 was occupied; it was left untouched and tests ran on44961 or ephemeral ports.

The management fixture browser emitted font allow-list warnings because node_modules is a preexisting symlink into another checkout; the five behavior tests passed and production build/route checks passed. No broad visual snapshot refresh or validate:full was run. Browser policy interactions use the isolated mock BFF, not production OIDC or a live control-plane database; live human-auth/session integration and two-hold backend transactional behavior remain part of parent integration evidence. Request ID retry and stale-version logic have implementation/contract evidence; the browser script currently covers a capacity-conflict new intent rather than a transport-loss retry or concurrent external-hold scenario.

Deploy the compatible control-plane access-state and policy endpoints before these consoles. Suspended-member discovery intentionally fails closed if unavailable. The preexisting untracked node_modules symlinks are local environment support and must not enter commits. Generated test-results are ignored. Reverting the UI does not reverse backend holds or policy changes.

## Modified files

management-console:

- `management-console/docs/DEVELOPMENT.md`
- `management-console/docs/OPERATIONS.md`
- `management-console/docs/contracts/README.md`
- `management-console/docs/contracts/control-plane-public-operations.json`
- `management-console/docs/contracts/manifest.json`
- `management-console/docs/exec-plans/active/hosted-console-integration.md`
- `management-console/src/App.tsx`
- `management-console/src/app/AppDesktopSidebar.tsx`
- `management-console/src/app/AppMobileNavigation.tsx`
- `management-console/src/app/WorkspaceSuspendedScreen.tsx`
- `management-console/src/app/appNavigationGuards.ts`
- `management-console/src/app/logoutAppSession.ts`
- `management-console/src/app/useAuthenticatedSessionLifecycle.ts`
- `management-console/src/app/useWorkspaceAccessMonitor.ts`
- `management-console/src/app/workspacePermissions.ts`
- `management-console/src/fixtures/router.ts`
- `management-console/src/hooks/sessionDataCache.ts`
- `management-console/src/hooks/useAppRouter.ts`
- `management-console/src/pages/WorkspacesPage.tsx`
- `management-console/src/services/control-plane/http.ts`
- `management-console/src/services/control-plane/workspaceAccessApi.ts`
- `management-console/src/services/control-plane/workspaceAccessState.test.ts`
- `management-console/src/services/control-plane/workspaceAccessState.ts`
- `management-console/src/services/controlPlaneApi.ts`
- `management-console/src/types.ts`
- `management-console/tests/fixtures/workspace-suspension.spec.ts`

platform-admin-console:

- `platform-admin-console/.gitignore`
- `platform-admin-console/DESIGN.md`
- `platform-admin-console/docs/DEVELOPMENT.md`
- `platform-admin-console/docs/OPERATIONS.md`
- `platform-admin-console/docs/contracts/README.md`
- `platform-admin-console/docs/contracts/manifest.json`
- `platform-admin-console/docs/exec-plans/active/hosted-console-integration.md`
- `platform-admin-console/docs/product-specs/current-requirements.md`
- `platform-admin-console/docs/product-specs/requirements-baseline.json`
- `platform-admin-console/lib/admin-contract.mjs`
- `platform-admin-console/lib/admin-route-policy.mjs`
- `platform-admin-console/lib/mock-admin-store.mjs`
- `platform-admin-console/scripts/check-harness.mjs`
- `platform-admin-console/scripts/verify-hosted-policy-browser.mjs`
- `platform-admin-console/src/components/WorkspacePolicy.tsx`
- `platform-admin-console/src/pages/WorkspacesPage.tsx`
- `platform-admin-console/test/admin-route-policy.test.mjs`
- `platform-admin-console/test/react-ui.test.ts`
- `platform-admin-console/test/requirements-baseline.test.mjs`
- `platform-admin-console/test/server.test.mjs`
