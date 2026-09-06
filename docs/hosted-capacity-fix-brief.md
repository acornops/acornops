# Capacity primitive review fixes

Own only CP runtime primitive fixes in /Users/tjtanjin/Desktop/acornops/hosted-readiness/control-plane plus ../docs/hosted-capacity-fix-report.md. Read AGENTS/shared/local skills and ../docs/hosted-capacity-review.md (4realPGreproductions). No subagents/commits. Root owns deployment and rollout CLI/module; EE/GW agent finished before dispatch.

Fix all4findings testfirst:
1 PG NOW transactiontimestamp afterworkspace lock wait permitsauthority afterexpiry. Use actual statement/wall clock for all lease/deadline authority comparisons/updates; preserve noexpiredtakeover and uncertainoperations untildeadline. Tests actualmulti-connectionblock acrossdeadline.
2 suspension of dependencyparkedparent statusrunning mustterminalcancel andreleaseoutstanding without needing nonexistentEEcallback; retainboundedexecutingoperations ifany. queuedwaitingapproval andparkedstatussafe. Currentcancelintentoutboxrestoration cutoffmusthold.
3 exactrequested_at tokenprecision foroutbox completion andallcutoffcomparisons; PostgreSQLmicroseconds cannotroundthrough JSDate. Return text timestamps/exactserializedtoken and test multiple batches>50workspaces/newholdsupersedesold whileworkerprocessing; no lastcompletedcutoffoverwrite. Keepoutbox persisted latestcutoff so restoresneverrevivepreholdattempts.
4 pre-stepapproval fifteenminoutlives queue600s; only reseteligibility/deadline whenexistingapprovalresolved firsttime (idempotent resumedattempt mustnotkeepresetting), preserveapprovalexpiry and sameoutstanding. Includeworkflow+chatapproval paths.

Also wire rootnewquiescenceflags atauthorityboundaries:
- WORKSPACE_ADMISSION_ENABLED defaulttrue: reserveRunCapacity rejects NEW reservations503 WORKSPACE_ADMISSION_PAUSED; identical existingreservationdelivery mayreturnexisting. Resourcepolicy/read unaffected. This mustexecuteunderworkspacelock afterduplicatecheck.
- WORKSPACE_DISPATCH_ENABLED defaulttrue: acquireRunCapacity returnswait whileclosed; alreadyexecutinggrant renewal/cleanupallowed soactiveworkcandrain. Insights wrapper disabled mode mustdefer newlydue modelwork whiledispatchclosed; do notbypass flag via directGW. Existing dispatch client+workersalreadygate.
- Startup rolloutmodule separate root-owned (workspace-capacity-rollout.ts/migration012); do notedit CLI/rollout unlesscriticalnotifyroot.

Testallfixes with hosted_runtime_test DB localhost55438 credentials hosted_test/hosted_test, NODE_ENV=test DATABASE_URL==CONTROL_PLANE_TEST_DATABASE_URL,REDIS_URLlocalhost56438. DatabasefixturesTRUNCATE onlyyourtests whileownerrootnotrunningSQL. Rootwillnotifywhenfree. Newmigrations011/012 mayneedapply; coordinate. RunfullCPvalidate andreportactual failures; contractrootlaterOpenAPIneedsnewroutesexpected. Preserve newerrootruntimefiles. Scopefocusedhelpersallowed.

Authority API availability: map unexpected database/authority lookup failures at capacity endpoints and requireExecutionAccess to a bounded WORKSPACE_CAPACITY_UNAVAILABLE503 envelope (retryable true), preserving known403/404/409. Never fail open. Do not expose raw SQL/errors. Verify acquire/renew/begin failclosed with no downstream work. Public admission persistence failures still rollback atomically.
