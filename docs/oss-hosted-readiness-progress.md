# Execution ledger — docs/oss-hosted-readiness-plan.md

Implementation is in sibling isolated worktrees under `/Users/tjtanjin/Desktop/acornops/hosted-readiness`, all on `feat/oss-hosted-readiness`. Original checkouts are untouched. Dependencies reuse existing node_modules/.venv via local ignored symlinks.

## Preflight

| Phase | Internal consistency | Shared interfaces |
| --- | --- | --- |
| Policy | Five independent pools replace the original aggregate pair | Emits policy snapshot, resolver and holds for every later phase |
| Suspension | Cleanup remains permitted; restored work is not replayed | Lifecycle state consumed by admission and execution |
| Admission | Pre-run jobs retain stable identities; no double charging | Ledger consumed by grants and terminal callbacks |
| Execution | Dependency waits must release local and distributed gates | Extends engine/gateway/CP contracts together |
| Consoles/deployment | Explicit override display supersedes admin exclusion; edits remain API-only | Uses policy/access-state contracts; activates compatible services only |
| Verification | Mock evidence cannot substitute for DB/replicas/browser | Tests all preceding phases |

Ruling: use independent pools as requested in the approved discussion; the pasted proposal's aggregate-cap acceptance rows are superseded.
Ruling: use the supported existing Python 3.12.11 virtualenv for unit checks; containers are necessary for integration, not unit tests.

## Progress

- Setup: isolated worktrees created; no implementation complete yet.

### Continued implementation
- Task 1 policy foundation implemented; 86 targeted tests pass. Independent policy review in progress. Full shared CP validation remains red (runtime fixture changes and test DB configuration); no handoff claim.
- Root capacity runtime WIP includes admissions, leases/operations, suspension outbox, safe access-state and stream cutoff, auto-triage and persisted Insights identity. Four real PostgreSQL capacity tests pass, including reproduced/fixed repeated-settlement lease release regression. Terminal cleanup now retains live leases and settled rows cannot be resurrected by release.
- Task 2 Python execution/gateway brief prepared; authority endpoint contract recorded there. UI/deployment/durable dispatch and coordinator continuations still outstanding.

- Task 1 fix round1: receipt identity token/workspace/operation/request, informative success/failure audits,30day retention/cleanup, migrated default public reason;93targeted passed. Re-review found expired versionless restore replay.
- Task 1 fix round2: requestId always requires expectedPolicyVersion while both omitted legacy stays compatible;96targeted passed independently; review clean in hosted-task-1-rereview-2.md. Task1 complete (uncommitted worktree changes; report and review retained).
- Task2 dispatched to execution_authority, owning EE+GW only. Brief includes gateway authorize and dependency continuation exact API.
- Root full CP suite at runtime pass2:1239/1239passed with DATABASE_URL/CONTROL_PLANE_TEST_DATABASE_URL postgres://hosted_test:hosted_test@127.0.0.1:55438/hosted_runtime_test. Runtime DB is separate from policy hosted_test to avoid fixture interference. Later root changes still need fresh validation.
- Root added durable conversation outbox acceptance+worker, dependency save/read/delete+maintenance redispatch, cleanup-only callback guard, actual local agent tool boundary lifecycle check, automatic capacity-denied outcomes, and migration011 clock_timestamp defaults (not yet applied). Root type and harness passed before latest additions; final full gates remain outstanding.
- Independent capacity review reproduced four defects; fixes pending docs/hosted-capacity-fix-brief.md (transaction clock/parked cancellation/microsecond cutoff/approval queue deadline). No claim of runtime completeness until fixed/re-reviewed.
- Added rollout skeleton: flags admission/dispatch(defaulttrue), migration012 shared activationcatalogue+verification marker, startupgate and CLI prepare/verify/deactivate. Must test; root owns it. Migration011/012 notyetapplied at this entry. Deployment Compose/Helm flags+GWORCHcredentials wired; validations/docs in progress.

- Task2 EE+GW implementation completed; final reports280EEunit+29keyless,719GWunit+52keyless, both taskvalidate pass. execution_review independently reviewing now.
- Capacity fix implementer capacity_fixes owns4reviewfindings plusadmission/dispatchgateauthority and503mapping; hosted_runtime_test assignedtoit. Migrations011/012 applied there.
- Root created separate hosted_rollout_test DB; rollout CLI PostgreSQL+mockpeer integration passes (incompatiblepeer,backfill,verify,activedrainrejection,deactivate). Externalcontroller fixture retries exactversionedrequest testpasses; credentialsnotpersisted.
- Deployment taskvalidate passes includingComposeprofiles/Helm/releasematrix/prodexposure. Publicdocs validatepassed with cachewriteescalation, brokenlinks passed. New deploymentrunbook,finite5poolexample,publiccapacitypage,admin/suspensiondocs added.
- Task3 consolebrief prepared, notdispatched untilcurrentimplementer completes. UI andactualtwoCP/twoEEend-to-end tests remain outstanding. Activation/backfill needsfinalreview alongsideallruntime changes.

### Review fixes and replica validation
- Capacity re-review is clean: all four original defects fixed, plus durable chat approval delivery survives a closed dispatch gate, transient 503 and replay. Independent 21-test rerun and PostgreSQL retry probe passed.
- Task 2 round 1 fixed dropped approval/dependency resumes, provider/MCP dispatch fencing and bounded Redis refill. Full engine validation: 284 tests plus 29 keyless evaluations; gateway: 723 plus 52. Scoped re-review clean (25 engine and 50 gateway tests plus explicit queue/fallback probes).
- Root fixed superseded Insights reservation identity and stale output checks, removed duplicate auto-triage conversation dispatch, preserved dispatching until engine start, added workflow delivery recovery and retained-chat outbox backfill. PostgreSQL regressions pass.
- Real replica probe passed with two control-plane HTTP processes and two real Redis-backed engine workers sharing PostgreSQL: exactly 3/12 Chat admissions, independent Agent concurrency, four completed attempts with one operation each and work on both engines. Its operation body is deterministic; gateway/provider boundary tests remain separate.
- Isolated Docker engine integration stack built and canonical suite passed 5/5. Existing user platform containers were untouched.
- Runtime/rollout review found missing Insights owner headers and misplaced Helm gateway authority URL. Both fixed, targeted regression checks passed, scoped re-review clean.
- SQL upgrade checker now follows named migration 006 before the new chain and verifies legacy suspension timestamps, receipt preservation, cancellation backfill and disabled rollout defaults through 012. Isolated schema upgrade passed.
- Task 3 console implementation is active. Parent contract mirrors currently agree. Final full checks and whole-branch review still required; no final handoff claim.

- Final backend validation: control-plane `npm run validate` passed 1,267/1,267 tests, live SQL upgrade checks, contracts/OpenAPI/harness and build (`/private/tmp/hosted-control-plane-final-3.log`). The compiled production rollout CLI additionally passed its PostgreSQL/mock-peer integration test.
- Final deployment validation passed after Helm authority correction. Standalone CP/EE/GW Compose render checks passed. Parent `task validate` passed after updating the approved PAC route-count guard from 25 to 27. Public docs build and broken-link checks passed.
- Task 3 product edits are stable and fresh console review is active while its implementer completes browser validation.

- Final console validation passed: management 1,074 tests plus five browser scenarios; Platform Admin 93 tests plus policy browser checks. Scoped console review is clean; `hosted-task-3-report.md` records commands and limits.
- Whole-change review found one additional P1: CP native documents/Fetch bypassed authority checks at the actual operation boundary. Reproduction confirmed a document insert after suspension; a narrow correction and regression checks are in progress. No other new material finding was established.
- Final documentation review corrected the activated-catalogue rollout order: close gates and drain using the current mode/catalogue before switching either. Deployment/public guides agree; scoped recheck is clean. Public `npm run validate` and `npm run links`, deployment harness and engine/gateway harness checks passed after documentation cleanup.

### Final acceptance
- Native authority correction passed 30 targeted tests; independent re-review passed all 17 new live-PostgreSQL regressions. Documents validate/write atomically; Fetch registers after DNS and cleans up its bounded operation. No remaining material review finding.
- Final control-plane `npm run validate` exited 0: 1,284 tests, static and live SQL upgrade checks, authz/membership/events, contracts, OpenAPI, harness and build. Log: `/private/tmp/native-authority-full-validate.log`.
- Final parent `task validate` and all eight worktree `git diff --check` checks passed. Full component/browser/deployment/public-doc evidence is consolidated in `oss-hosted-readiness-handoff.md`. Implementation is complete, uncommitted on the shared feature branch; no merge, push or deployment performed.
- Cleanup completed: only the owned disposable PostgreSQL/Redis containers/network were removed; the engine integration stack had already been removed. Final documentation harness checks passed in the parent, CP, engine, gateway and deployment.
