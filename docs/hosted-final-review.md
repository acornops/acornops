# Final whole-change review

Current disposition: the native-tool finding below is resolved by the
[scoped re-review](hosted-final-rereview.md). This report preserves the original
finding and reproduction; final validation is recorded in the
[handoff](oss-hosted-readiness-handoff.md).

Reviewed 6 September 2026 against `docs/oss-hosted-readiness-plan.md` and
`docs/hosted-final-review-brief.md`, including the final scoped review dispositions.
Scope: uncommitted parent harness and seven component worktrees on
`feat/oss-hosted-readiness`. No product edits, database mutations, external
requests, subagents, commits, pushes or deployments were performed.

## Finding

### P1 — Fence control-plane native tools at their actual operation boundary

Location: `control-plane/src/routes/internal-execution.ts:34`, calling
`src/controllers/internal-platform-native-tool-controller.ts:66`.

The native tool route adds `requireExecutionAccess`, but the subsequent executor
receives only the run and arguments, without owner/generation or operation
ownership. Unlike MCP/provider calls, `documents.create` and `http.fetch.get`
never enter `workspace_run_operations`. The controller awaits run lookups after
middleware authorization. A suspension or lease loss during those awaits does
not prevent the subsequent native operation.

A deterministic independent probe calls the actual middleware and controller,
with database/repository dependencies mocked. It authorizes a live generation,
changes the workspace to suspended during the awaited `repo.getRun`, and calls
`documents.create` with Markdown output. The real executor and document
repository still issue the document INSERT and return HTTP 200. The probe also
asserts one lifecycle check and zero operation-ledger queries:

```text
{"status":200,"insertsAfterSuspension":1,"operationQueries":0,"lifecycleChecks":1}
```

Reproduce from `control-plane`:

```sh
NODE_ENV=test node --import tsx /private/tmp/hosted-final-native-probe.ts
```

The probe passed (exit 0), confirming the unwanted behavior. It does not connect
to PostgreSQL or send a network request. The document insert is at
`src/store/repository-generated-documents.ts:97` (workflow equivalent at line 60).
Neither insert serializes authority validation with the write.

The parallel Fetch path has an additional awaited DNS boundary at
`src/services/fetch-http.ts:156`, followed by `https.request` at line 184 with no
fresh lifecycle/owner validation. Source tracing confirms this path bypasses the
gateway's corrected dispatch hook. Consequently native requests can begin after
suspension/authority loss; an in-flight native request also lacks the operation
record needed to retain concurrent capacity after its worker lease expires.

Carry immutable owner/generation into native execution. For document creation,
validate lifecycle and current execution ownership under the workspace lock in
the same transaction as the insert. For Fetch, authorize and begin a bounded
operation after DNS and immediately before actual HTTP dispatch, and finish it
on completion/cleanup. Lifecycle checks must continue with limits disabled.
Cover suspension and lease loss after initial route authorization, delayed DNS,
and operation accounting through lease expiry.

## Overall readiness

**Not ready for hosted handoff until this native-tool boundary is corrected and
independently rechecked.** No additional material finding was established in the
other examined cross-repository seams. Previously resolved policy receipt,
transaction-clock, parked-cancellation, approval-resume, durable Redis refill,
provider/MCP dispatch, Insights-header, Helm and console findings remain closed;
this finding concerns a separate CP-owned execution path.

The review examined reservation producers and pool classification, independent
hold/cancellation cutoffs, lease/operation settlement, durable conversation and
workflow delivery, dependency and approval continuation, Redis queue/resume
ownership, gateway operation hooks, access-state and admin policy projections,
Compose/Helm wiring, rollout preparation/verification and the operator guidance.
The delivery workers correctly distinguish engine acknowledgement from actual
`run_started` execution. Rollout guidance explicitly requires coherent builds,
all replica peer addresses, closed gates and preserved uncertainty ledgers.

## Evidence and limits

Independent checks in this review: the native-operation probe above and
`git diff --check` in all seven children (all passed). The parent harness's
27-route adjustment agrees with the approved admin UI expansion.

Read the existing scoped review evidence and progress ledger: CP 1,267 tests and
SQL upgrade validation; EE 284 plus 29 keyless; GW 723 plus 52 keyless; the real
two-CP/two-Redis-engine probe; five Docker integration tests; deployment, parent
harness/contracts and public-doc build/link checks. Those are recorded upstream
validation, not fresh executions by this reviewer. The replica probe uses a
deterministic operation body; it is not a real-provider end-to-end test.

Task 3 browser/full-validation and the final vendored public-doc mirror were
still being completed while this review ran. Their final evidence must be
included in the handoff. This review does not claim independent browser,
assistive-technology, full-suite or live-provider validation. Existing user
platform services were untouched.
