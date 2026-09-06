# OSS hosted readiness implementation

Approved 6 September 2026. Branch: `feat/oss-hosted-readiness`.

## Contract

AcornOps remains independently self-hostable. An optional external controller uses named scoped admin tokens and supported APIs, never database access. Billing, pricing, customer spend, admission rates and mandatory cloud dependencies are excluded.

Each workspace plan has five independent execution pools: `chat`, `agent`, `workflow`, `autoTriage`, `insights`. Each pool has `maxConcurrentRuns` and `maxOutstandingRuns`. No borrowing or aggregate workspace cap. Both values are positive integers with outstanding >= concurrent, or both null. Omitted pools normalize to null pairs. Hosted configurations require all five finite pairs. Classification is immutable and assigned server-side: Workflow children remain Workflow; auto-triage never charges Chat.

Policy reads expose configured plans, effective resource/execution limits, explicit resource overrides, usage by pool, policy version and active suspension holds. Narrow scopes: `admin:workspace:policy:read`, `admin:workspace:plan:write`, `admin:workspace:external-hold:write`. Preserve human-session roles, MFA, CSRF and recent authentication. Machine mutations require request IDs and expected policy versions; broad legacy callers remain compatible.

Mutations lock the workspace, resolve idempotency before preconditions, recheck usage, and commit changes, successful admin audit and receipt together. Receipt identity is token/workspace/operation/request ID; different content conflicts. Replays return the original outcome, never restore older state. Retain receipts for 30 days; required versions protect against expired old requests. Overrides survive plan assignment. Explicit `retain_existing` downgrades retain resources and let active work drain. Default remains `reject`.

Suspension has exactly two holds: admin and external. Lifecycle is their OR. Existing suspended rows become admin holds with original timestamps and generic public reasons. Legacy source defaults to admin; external credentials must select external. Clearing either hold cannot clear the other. Private reasons remain exclusively administrative. Cancel accepted queued work and request controlled cancellation of running work. No restoration replay. Completion and cleanup callbacks remain available.

Minimal member access-state and opt-in list projection expose suspension without weakening active workload authorization. Console guards prevent workload mounting/fetches behind the blocking modal and clear existing data/streams on suspension. The admin UI shows read-only overrides and five-pool usage; override editing remains API-only. Amend its human/executable requirements, BFF allowlist and projections together.

Outstanding reservations are transactional at acceptance, including pre-run auto-triage and persisted Insights attempt identities. Future schedule definitions and unaccepted coalesced activity markers are not attempts. Automatic capacity-denied launches record bounded skipped outcomes. Accepted work has a 600-second eligible queue deadline; approvals preserve existing expiry. Intentional retries are new attempts; delivery retries and approval/dependency resumes reuse the original reservation. Settled needs-review work releases capacity without permitting automatic uncertain-write retries.

PostgreSQL is authoritative for capacity ownership. Grants bind attempt, worker and generation; begin/finish operation records bound in-flight uncertainty. New provider/tool calls validate authority at actual dispatch, and stale callbacks cannot resurrect work. Lease defaults: 30 seconds, renew every 10 seconds, reconcile every 10 seconds. Expiry alone never permits duplicate execution. Local scheduling remains bounded. Coordinators persist dependency continuations and release both execution gates while waiting; child settlement durably resumes the same attempt. Required child denial fails explicitly.

## Delivery and validation

1. Transactional policy, five-pool catalogue, holds and narrow API contracts.
2. Membership-only discovery and suspension enforcement at HTTP, streams, jobs, agents and operations.
3. Transactional reservations at every admission path and durable dispatch.
4. Distributed grants, fenced operations, bounded workers and dependency continuation.
5. Both console integrations, contract mirrors, deployment activation/BYOK and coherent operator docs.
6. Review, SQL upgrade tests, real PostgreSQL/Redis concurrent tests with two control planes/engines, browser tests and full affected repository validation.

All component versions and catalogue hashes must agree before activation. Roll out additive migrations and compatible components, close admission/dispatch, settle operations and backfill retained attempts, reconcile and activate. Suspension is enforced even with capacity limits inactive. Rollback requires compatible suspension/grant semantics and closed dispatch; preserve ledgers and uncertainty evidence.

Baseline: workspace 7f33856, control-plane abefb7c, engine b418891, gateway d98b355, management 00bc694, admin 0ed183d, deployment 764ad37. Before implementation: 54 control-plane focused tests, 259 engine unit tests, 57 gateway tests, control-plane type/contracts/static migrations, console contracts and admin requirements passed. Distributed and browser acceptance still require implementation evidence.
