# Task 2 scoped re-review — fix round 1

Reviewed 6 September 2026. Scope was limited to the four findings in
`hosted-task-2-review.md`, their fixes, new regression tests, and directly affected
behavior. Read the appended implementation report and inspected the actual Python
changes. No product files were edited; no subagents, provider credentials, network
services, or containers were used.

**Result: all four original findings are resolved. No additional blocking finding
was identified in this scoped re-review.** This is not a fresh review of the full
hosted-readiness change or independent distributed acceptance.

## Finding disposition

| Original finding | Disposition and evidence |
| --- | --- |
| P1: approval resume is lost during cleanup | Fixed. `execution-engine/execution_engine/run_scheduling.py:39` records pending resume intent without changing an unwinding task's pause status. `finish_execution` at line 55 runs after the worker's capacity cleanup, then queues the resume exactly once. The parameterized regression sends two resume requests during cleanup for both approval and dependency pauses; it verifies a parked release, preserved pause state until release, and one queued resume afterward. |
| P1: remote MCP call proceeds after suspension during initialization | Fixed. `llm-gateway/app/mcp/transports/http_transport.py:355` calls `begin_dispatch` in the post-initialization tool callback, before `session.send_request`. The real MCP session/HTTP transport tests invalidate lifecycle with capacity disabled and ownership with capacity enabled during `initialize`; neither sends `tools/call`. A successful case verifies initialization precedes begin, tools/call follows begin, and exactly one matching finish occurs. |
| P1: first provider dispatch misses ownership validation | Fixed. `llm-gateway/app/execution_capacity.py:66` now prepares context without beginning an operation. The actual HTTP request hook at line 119 calls `begin_dispatch`, which checks lifecycle and begins the operation against current owner/generation. A real HTTPX request-hook regression invalidates the lease after context entry and confirms zero provider requests. Existing uncertain-replay rejection and fresh-operation HTTP 400 correction tests also pass. |
| P2: durable queued recovery never refills excess work | Fixed. `execution-engine/execution_engine/run_scheduling.py:69` loads candidates incrementally into available local slots. Completion invokes refill, and `execution_engine/app.py:128` also refills periodically. The regression recovers five runs through a two-slot local queue without initially loading all five. An additional independent harness ran the actual worker loop, persisted running/completed transitions, and confirmed all five execute once and leave an empty queue. |

## Additional checks around the fixes

- The durable resume regression retains the resume timestamp separately while the
  original worker is paused. A replacement registry recovers that acknowledged
  intent and retries a blocked acquisition before a later grant. The test verifies
  no execution on the blocked acquisition and one execution after grant.
- The original run-ID deduplication, foreign Redis-lock ownership, grant loss,
  cancel cleanup, queued deadline, and dependency transcript regressions remain
  passing in the engine capacity module.
- The MCP transport suite remains passing, including session/protocol handling,
  bounded responses, and transport error behavior.
- An independent local HTTPX harness exercised the newly fenced builtin-MCP
  endpoint fallback. A definitive 404 from `/mcp/tools/call` finishes the first
  operation; the fallback `/mcp` request receives a distinct operation ID and its
  own finish. Both requests succeeded through mock transport, with this order:

```text
authorize → authorize → operations/begin → HTTP /mcp/tools/call
→ operations/finish → authorize → operations/begin → HTTP /mcp
→ operations/finish
```

The harness asserted two distinct begin IDs and exact begin/finish ID equality.
No external builtin endpoint was contacted.

## Commands and results

Executed using the existing Python 3.12 `.venv` links and the current uncommitted
`feat/oss-hosted-readiness` Python files.

| Working directory | Command | Result |
| --- | --- | --- |
| `execution-engine` | `.venv/bin/python -m pytest tests/test_capacity.py -q` | 25 passed; existing Starlette/httpx deprecation warning |
| `llm-gateway` | `.venv/bin/python -m pytest test/test_execution_capacity.py test/test_mcp_transport.py test/test_outbound_tls.py -q` | 50 passed |
| Both repositories | `git diff --check` | Passed |
| `execution-engine` | Inline `.venv/bin/python` harness using five shared-store queued runs, `RunRegistry(1)`, actual `Worker.run_loop`, and mocked CP acquisition | All five run IDs executed exactly once; final queue size 0 |
| `llm-gateway` | Inline `.venv/bin/python` harness using `post_builtin_mcp_tool`, actual authority contexts, and HTTPX MockTransport returning 404 then JSON-RPC success | Two distinct operation IDs, correct begin/request/finish ordering, successful result |

The implementation's reported full validation totals (engine 284 unit tests + 29
evaluations; gateway 723 unit tests + 52 evaluations) were not independently
repeated here. Root's real two-control-plane/two-engine/Redis operation probe is
separate evidence and is not attributed to this re-review. Root's concurrent
deployment-only Compose wiring was outside this scope.

Only this re-review document was written. No commits or pushes.
