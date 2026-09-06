# Task 2 report: execution authority and gateway boundary

Implemented in the existing `feat/oss-hosted-readiness` child worktrees. No commits,
pushes, subagents, real provider credentials, or infrastructure changes. Existing
`.venv` symlinks are validation dependencies and are excluded from the changed-file list.

## Result

- Added capacity mode configuration and additive dispatch/health capability version 1.
  Wire `contract_version: 2` remains unchanged; enabled dispatches require matching
  `capacity_contract_version: 1` and `capacity_enabled: true`.
- Engine acquires before bootstrap, renews every 10 seconds, cancels further work on
  lease loss, and releases only after run cleanup unwinds. Approval/dependency pauses
  release as parked; authority loss releases as settling. Cleanup retains the original
  owner/generation in task context and Redis-backed retry records.
- Runnable tasks are bounded by `MAX_CONCURRENT_RUNS`; accepted local scheduled plus
  queued work is bounded. A capacity waiter returns to the queue without retaining a
  local semaphore. Initial queue expiry is 600 seconds. Uncertain acquire retries keep
  the same owner identity; no upstream operation is retried under an uncertain ID.
- Coordinator dependency waits persist the complete open ReAct transcript and pending
  tool-call position before releasing gates. Resume injects child results without
  repeating delegation. Immediate required-child admission denial produces
  `REQUIRED_CHILD_CAPACITY_DENIED`; required children that fail/cancel later fail the
  parent instead of allowing a success result.
- Gateway lifecycle checks use only verified JWT run/workspace claims and run even when
  capacity counters are disabled. Enabled provider/MCP requests register bounded
  begin/finish operations around dispatch, including error/cancellation cleanup.
  Builtin MCP forwards owner/generation with its existing JWT, without a duplicate
  gateway registration at that hop. Existing MCP generation/approval/scope checks remain.
- Provider HTTP hooks prevent hidden SDK replays after uncertain dispatch. Definitive
  HTTP 400 validation corrections finish the rejected operation and use a fresh ID.
  Workspace-secret lookup followed by optional self-hosted platform default is unchanged.

## CP/deployment contract

Contracts follow `docs/hosted-task-2-brief.md` exactly: acquire/renew/release and
operations/begin/finish under `/internal/v1/runs/:runId/capacity`, plus
`authorize {workspaceId}`. Authorize returns `{status:"ok",capacityEnabled,contractVersion:1}`.
Gateway requires `ORCH_BASE_URL` and `ORCH_SERVICE_TOKEN`; root confirmed these are wired
in both Compose and Helm using the existing CP service credential.

`GET /health` is public and advertises only `capacity_contract_version: 1` and
`capacity_enabled` alongside existing health fields. Dependency POST sends generation 0
while disabled (root confirmed the nonnegative schema); continuation GET accepts the
`kind:"dependency"` discriminator. Manifests add `workspaceCapacityContractVersion` and
`workspaceCapacityHeaders`; their existing execution contract metadata is untouched.

## Recovery semantics and limits

Enabled queued recovery deliberately does not treat an old Redis lock as CP authority:
it queues the durable run and must acquire a valid CP grant before work. Competing-owner
`blocked` responses evict only the local cache, never overwriting the valid owner's
Redis state. This allows a later dependency-resume dispatch on that replica to reload
fresh durable state. Disabled mode retains owner-aware Redis deduplication. Redis lock
release uses atomic compare-and-delete, and cleanup authority records expire with the
configured terminal-commit retention window.

A run that never received a grant cannot fabricate cleanup owner/generation headers;
CP maintenance owns authoritative queue expiry and lifecycle reconciliation. Arbitrary
in-flight work after process death is not replayed: CP lease/operation maintenance
settles it, while explicit dependency/approval checkpoints can resume. These interactions
have deterministic unit coverage but still require root's real-database/replica acceptance.

## Validation

- Both repositories: `task validate` passed, including Ruff, contract and harness checks.
- Engine: 280 unit tests passed; 29 keyless evaluations passed. The suite includes 21
  capacity regressions, and `Taskfile.yml` now includes that module in canonical validation.
- Gateway: 719 unit tests passed; 52 keyless evaluations passed. Existing workspace-key
  isolation/fallback and MCP permission regressions remain in the passing full suite.
- `git diff --check` passed in both repositories.
- Engine `task test` was attempted but could not access the Docker daemon socket from
  the default sandbox (`operation not permitted`). No container integration acceptance
  is claimed. Root owns the disposable DB/replica acceptance pass.
- Engine emits the existing Starlette/httpx TestClient deprecation warning; no test failures.

The initial test-first batches failed for missing capacity behavior; subsequent failures
covered overload retry, required-child terminal handling, uncertain-acquire recovery,
provider compatibility operation IDs, and stale-owner resume caching before their fixes.

## Exact changed files

### execution-engine

- `execution-engine/Taskfile.yml`
- `execution-engine/docs/OPERATIONS.md`
- `execution-engine/docs/contracts/README.md`
- `execution-engine/docs/contracts/manifest.json`
- `execution-engine/docs/index.md`
- `execution-engine/execution_engine/agent/react_engine.py`
- `execution-engine/execution_engine/agent/tool_context.py`
- `execution-engine/execution_engine/agent/tools.py`
- `execution-engine/execution_engine/app.py`
- `execution-engine/execution_engine/config.py`
- `execution-engine/execution_engine/durability.py`
- `execution-engine/execution_engine/gateway_client.py`
- `execution-engine/execution_engine/models.py`
- `execution-engine/execution_engine/orchestrator_client.py`
- `execution-engine/execution_engine/run_registry.py`
- `execution-engine/execution_engine/worker.py`
- `execution-engine/tests/test_unit.py`
- `execution-engine/docs/exec-plans/active/workspace-execution-authority.md`
- `execution-engine/execution_engine/capacity.py`
- `execution-engine/tests/test_capacity.py`

### llm-gateway

- `llm-gateway/app/api/handlers_health.py`
- `llm-gateway/app/api/handlers_llm_stream.py`
- `llm-gateway/app/api/handlers_tool_call.py`
- `llm-gateway/app/config/settings.py`
- `llm-gateway/app/outbound_tls.py`
- `llm-gateway/docs/OPERATIONS.md`
- `llm-gateway/docs/contracts/README.md`
- `llm-gateway/docs/contracts/manifest.json`
- `llm-gateway/docs/index.md`
- `llm-gateway/test/conftest.py`
- `llm-gateway/test/test_outbound_tls.py`
- `llm-gateway/app/execution_capacity.py`
- `llm-gateway/docs/exec-plans/active/workspace-execution-authority.md`
- `llm-gateway/test/test_execution_capacity.py`

## Review fix round 1 — 6 September 2026

Addressed all four reproduced findings in `hosted-task-2-review.md`:

1. **Resume during cleanup:** introduced a bounded pending-resume handoff. Approval
   and dependency resume requests retain the current task's pause state until grant
   release completes, then enqueue exactly once. Resume intent is separately durable
   and timestamped, so a restart can recover an acknowledged resume; a different
   replica retries the explicitly requested resume while the previous owner unwinds.
2. **MCP after handshake:** operation registration moved to the real remote transport's
   post-initialize `tools/call` callback. Both lifecycle-disabled and lease-enabled
   regression cases stop before the actual tool call after authority changes during
   initialization. Builtin MCP also registers immediately before its HTTP request;
   its definite endpoint-rejection fallback receives a fresh operation ID.
3. **First provider ownership check:** operation context entry no longer begins an
   operation. The first actual provider HTTP request now performs lifecycle authorization
   and `operations/begin`, just as subsequent definitive-400 corrections do. A lease
   invalidated between context entry and HTTP dispatch causes zero provider requests.
4. **Durable queue refill:** startup incrementally scans Redis and fills only free local
   slots; task completion and the periodic delivery loop refill those slots. A regression
   consolidates five durable queued runs into a replacement with two queue slots and
   verifies all five are eventually scheduled without growing the initial local batch.

Additional product files introduced/changed during this round:

- `execution-engine/execution_engine/run_scheduling.py` (new focused scheduling module)
- `execution-engine/execution_engine/{app,capacity,durability,run_registry}.py`
- `llm-gateway/app/execution_capacity.py`
- `llm-gateway/app/internal_transport.py`
- `llm-gateway/app/mcp/transports/http_transport.py`
- Both repositories' existing capacity tests, engine Redis test double, and operations docs.

Verification after these fixes:

- Engine `task validate`: **284 unit tests + 29 keyless evaluations passed**, including
  25 capacity tests. Ruff, contracts, and harness checks passed. The prior TestClient
  deprecation warning remains.
- Gateway `task validate`: **723 unit tests + 52 keyless evaluations passed**, including
  10 execution-capacity tests. Ruff, contracts, and harness checks passed.
- The review's local resume and refill regressions and the actual provider/MCP
  dispatch-boundary regressions were observed failing before their fixes.
- MCP tests use the real MCP session/HTTP transport with the strict local MockTransport
  peer; provider tests use actual HTTPX request hooks with a local MockTransport. No
  provider keys or external services were used. CP contracts are unchanged.
- No commits, pushes, subagents, or distributed-acceptance claims. Root's real CP/Redis
  replica probe remains separate acceptance evidence.
