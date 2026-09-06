# Task 2 independent review

Reviewed 6 September 2026 against `oss-hosted-readiness-plan.md`,
`hosted-task-2-brief.md`, and the implementation report. Scope: the execution-engine
and llm-gateway working-tree changes and new files; control-plane was read only to
verify concrete contracts. Product files were not changed. No subagents, live
provider calls, credentials, or infrastructure were used.

**Result: changes required.** Four reproducible gaps remain in dispatch fencing,
approval resumption, and durable queue recovery. Existing focused tests pass.

## Findings

### 1. [P1] A resume accepted during cleanup is dropped and changes parked release into settlement

Locations: `execution-engine/execution_engine/app.py:227–231`,
`execution-engine/execution_engine/run_registry.py:374–375`, and
`execution-engine/execution_engine/capacity.py:111–118`.

The worker publishes `WAITING_FOR_APPROVAL` before its event flushing and client
cleanup finish. If approval resumption is dispatched during this interval,
`start_run` changes that same `RunState` to `QUEUED`. `enqueue` finds the original
task in `_scheduled`, returns success, and adds no queue entry. After cleanup,
`execute_with_capacity` sees `QUEUED` instead of the pause status and releases the
grant as `settling`. `execution_done` only removes the scheduled ID. The accepted
resume never runs, and CP acquisition cannot resume a settling reservation.

This is an ordinary race when approval arrives while event delivery is slow; the
same local scheduling race applies to a dependency resume delivered before the
previous task unwinds. The registry needs to retain a pending resume and preserve
the current task's park outcome until its release completes.

Deterministic reproduction executed against `Worker`, `RunRegistry`, and the real
`start_run` handler:

1. Enable capacity; use `RunRegistry(1)`, a compatible target `RunRequest`, and an
   `AsyncMock` CP client granting generation 1.
2. Dispatch and dequeue the run, leaving its ID in `_scheduled`.
3. Replace only `_do_execute_run` with a coroutine that sets
   `WAITING_FOR_APPROVAL`, signals an event, and waits on a cleanup gate.
4. Start `worker.execute_run(state)`, wait for that signal, and dispatch the same
   request through `start_run` before opening the cleanup gate.
5. Observe the accepted resume and the final capacity release:

```text
resume response: 202 local status: RunStatus.QUEUED queue: 0
release: ('r', 'release', {'ownerId': '<owner>', 'generation': 1, 'state': 'settling'})
```

### 2. [P1] Remote MCP dispatch is authorized before initialization, allowing calls after suspension

Location: `llm-gateway/app/api/handlers_tool_call.py:333–357`; the target-scope
branch at lines 552 onward has the same arrangement. The relevant existing
transport is `app/mcp/transports/http_transport.py:303–308,351–370`.

The handler enters `execution_authority.operation` before DNS/egress preparation,
circuit-breaker work, and MCP session initialization. The actual `tools/call`
request occurs later in `session.send_request`, without another execution
authority check. Unlike provider clients, this transport has no execution
authority request hook. Suspending the workspace while `initialize` is pending
therefore still permits a new remote tool call. Enabled mode likewise uses the
grant checked before initialization. This misses the approved actual-dispatch
boundary in both capacity modes.

Reproduction used the **real MCP session/HTTP transport**, the repository's
`StrictStreamableMcpServer` and `transport_for` test helpers, and a local
`httpx.MockTransport`. No external MCP service was contacted. The mock authority
returns active initially and would reject every authorization after the server
responds to `initialize`. A server wrapper flips suspension on that response.
Only egress target preparation was replaced with a fixed
`ValidatedMcpRequestTarget` to avoid DNS. Entering the same authority context used
by the handler and invoking the real transport produced:

```text
MCP authorization calls: [('authorize', False)]
suspended after initialize; subsequent methods:
['initialize', 'notifications/initialized', 'tools/call']
MCP result isError: False
```

Expected: zero `tools/call` requests after suspension. Recheck lifecycle and, when
enabled, begin the tool operation at the actual call boundary after setup.

### 3. [P1] The first provider request does not validate ownership at actual dispatch

Location: `llm-gateway/app/execution_capacity.py:107–108`, with operation creation
at lines 78–84 and its handler call at
`app/api/handlers_llm_stream.py:493–496`.

`operation()` calls `operations/begin` before entering the adapter. At the first
actual SDK request, `provider_dispatch_hook` calls `authorize`, but skips
`operations/begin` because `operation.payload` is already populated. The current
CP `authorize {workspaceId}` contract checks persisted identity and lifecycle;
it does **not** validate owner, generation, or lease. A lease lost between those
two points is therefore not rejected at dispatch. The hook's fresh-generation
check is reached only after a definitive HTTP 400 cleared the existing payload.

Reproduction used a CP stub that always implements the existing lifecycle-only
`authorize` response, and rejects `operations/begin` when a simulated lease is
invalid. Enter the enabled operation context while valid, invalidate the lease,
then invoke the real `provider_dispatch_hook(httpx.Request(...))`. It returned
normally and allowed dispatch:

```text
Provider actual dispatch allowed after lease invalidation; calls:
[('authorize', True), ('operations/begin', True), ('authorize', False)]
```

Here the booleans are lease validity, not lifecycle state. Expected: ownership
validation at the first dispatch, with no provider call after loss. Defer the
initial begin to this hook or use an equally authoritative dispatch-boundary
check; a lifecycle-only call cannot supply this guarantee.

### 4. [P2] Startup recovery silently leaves excess durable queued runs unscheduled

Location: `execution-engine/execution_engine/run_registry.py:469–478`.
Recovery is called only on startup (`execution_engine/app.py:57–74`); the periodic
background loop retries commits, not queued recovery.

`recover_stale_active_runs` loads every durable queued run but ignores a false
return from bounded `enqueue`. Once `2 * MAX_CONCURRENT_RUNS` slots are occupied,
the remaining accepted runs stay in Redis with no future refill action when
local slots become free. This occurs when a replacement replica recovers the
shared queued work of multiple failed replicas, or concurrency is reduced at
restart. CP queue expiry eventually fails these accepted runs rather than using
the newly free execution slots. Retain a bounded local queue backed by a durable
refill mechanism, instead of treating this one-time scan as full recovery.

Reproduction used the repository's `tests.test_unit.durability_store` and actual
registry methods, with capacity enabled:

1. Create three old `RunRegistry(1, shared_store)` instances, each accepting and
   enqueuing a different run.
2. Create one replacement `RunRegistry(1, shared_store)` and call
   `recover_stale_active_runs(AsyncMock())`.
3. It sees three durable queued runs but enqueues only two. Drain those two using
   `dequeue`, `task_done`, and `execution_done`; the remaining run is never added.

```text
durable accepted queued runs: 3 recovered runnable queue: 2
queue after recovered runs drain: 0
```

## Confirmed behavior and review limits

- Task-local owner/generation headers are attached to CP and gateway clients;
  authority loss blocks non-cleanup requests, while event/commit retries load
  saved identity. Atomic Redis compare-and-delete prevents deleting another
  owner's lock.
- The ReAct dependency checkpoint resumes the open turn without replaying the
  earlier delegation; required immediate capacity denial generates an explicit
  terminal error. Acquire/wait, lease-loss cancellation, parked release, and
  dispatch capability validation have passing targeted coverage.
- An already-failed required child can currently produce a successful local
  ReAct final response without parking. This was investigated but is **not**
  reported as an end-to-end spec failure: CP `commitRun` invokes
  `coordinationCompletionFailure` and converts the authoritative coordinator
  outcome to `failed` with `REQUIRED_DELEGATION_FAILED`.
- The initial operation denial paths make zero provider/tool calls; hidden
  provider replay is rejected, and definitive HTTP 400 correction uses a fresh
  operation ID. The findings above concern changes of authority during setup,
  which the existing tests do not exercise.
- This review does not claim PostgreSQL/Redis replica acceptance or full
  integration validation. No Docker suite was run. Full `task validate` results
  in the implementation report were not independently repeated; this review
  ran focused tests and explicit boundary reproductions.

## Validation evidence

All commands ran with the existing Python 3.12 `.venv` links, on
`feat/oss-hosted-readiness`; engine HEAD `b418891`, gateway HEAD `d98b355`, plus
their uncommitted Task 2 changes.

| Working directory | Command | Result |
| --- | --- | --- |
| `execution-engine` | `.venv/bin/python -m pytest tests/test_capacity.py -q` | 21 passed; existing Starlette/httpx deprecation warning |
| `llm-gateway` | `.venv/bin/python -m pytest test/test_execution_capacity.py test/test_outbound_tls.py -q` | 18 passed |
| Both child repositories | `git diff --check` | Passed |
| `execution-engine` | Inline `.venv/bin/python` harnesses using actual registry/handler/worker and ReAct classes described above | Reproduced dropped resume and missing queue refill; CP mitigation checked for required-child failure |
| `llm-gateway` | Inline `.venv/bin/python` harness using real MCP session transport with `StrictStreamableMcpServer`, and real provider request hook | Reproduced post-suspension MCP call and post-lease-loss provider dispatch |

Only this review document was written. No commits or pushes.
