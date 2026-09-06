# Hosted runtime and rollout scoped review

Reviewed 6 September 2026 against `docs/oss-hosted-readiness-plan.md`. Scope: control-plane admission/classification, Insights attempt ownership, durable delivery, lifecycle boundaries, coordinator continuation, rollout CLI and deployment wiring. This is not the final whole-branch review. Previously independently reviewed policy/capacity primitives and the ongoing EE/GW and console scopes are excluded except where needed to verify a CP integration boundary.

## Findings

### P1 — Forward Insights execution ownership to the gateway

`control-plane/src/services/target-insights/checkpoint-worker.ts:158` sends only Authorization and Content-Type to `generations:stream`. Although `withInsightsCapacity` obtains a generation and passes `execution` into `streamGatewayJsonPatch`, the request omits `x-acornops-execution-owner` and `x-acornops-execution-generation`. With capacity enabled, `llm-gateway/app/execution_capacity.py:72` rejects that request with HTTP 409 before provider work. Consequently all Insights generation attempts fail after activation.

Executable reproduction, run in `llm-gateway` (authorization is mocked successful to isolate the missing-header integration contract):

```sh
.venv/bin/python - <<'PY'
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from app.execution_capacity import execution_authority
from app.config.settings import settings
async def main():
    with patch.object(settings, 'WORKSPACE_CAPACITY_ENABLED', True), patch.object(execution_authority, 'authorize', AsyncMock()):
        dispatched = False
        try:
            async with execution_authority.operation(SimpleNamespace(run_id='insights-run', workspace_id='workspace-1'), {'authorization':'Bearer redacted', 'content-type':'application/json'}, 30000):
                dispatched = True
        except HTTPException as error:
            print(error.status_code, error.detail, dispatched)
            assert error.status_code == 409 and not dispatched
asyncio.run(main())
PY
```

Observed: `409 Execution owner and generation required False`. Forward the obtained ownership headers and add an enabled-capacity checkpoint-worker gateway integration assertion.

### P1 — Put the control-plane URL in the gateway ConfigMap data

`acornops-deployment/kubernetes/helm/acornops-platform/templates/configmap.yaml:172` inserts `ORCH_BASE_URL` under the execution-engine ConfigMap's `metadata`; the execution engine already has the correct value under `data`. The gateway ConfigMap does not receive this variable. The gateway therefore defaults to `http://control-plane:8081`, while Helm creates a release-prefixed service. Its new mandatory authority calls cannot resolve the intended CP service, blocking generation/tool dispatch even with capacity disabled.

Executed:

```sh
helm template review kubernetes/helm/acornops-platform > /private/tmp/hosted-review-helm.yaml
```

Render succeeded. Evidence in the rendered file:

- Line 855: `metadata.ORCH_BASE_URL: "http://review-acornops-platform-control-plane:8081"` on the execution-engine ConfigMap.
- Line 870: the existing correct execution-engine `data.ORCH_BASE_URL`.
- Lines 898–946: gateway ConfigMap has no `ORCH_BASE_URL`.
- Line 965: actual service name is `review-acornops-platform-control-plane`.
- Gateway settings default is `http://control-plane:8081` at `llm-gateway/app/config/settings.py:89`.

Move the new URL field into gateway ConfigMap `data`; retain the existing execution-engine field. Verify the rendered gateway environment resolves the rendered CP service name.

## Other reviewed paths and limits

Inspected each production run insertion path, server-owned pool assignments, transactional conversation outbox acceptance, automatic admission denial handling, Insights supersession and settlement, stream polling, agent tool/snapshot checks, callback cleanup gating, dependency continuation persistence/redispatch, and rollout prepare/verify/deactivate plus startup checks. No additional material finding established in that inspection. The unused exported `addRun` helper has no production call site and is not reported as an admission bypass.

Read existing rollout tests covering catalogue/mode disagreement and retained queued-run backfill. No PostgreSQL tests were run by this reviewer, and neither `hosted_runtime_test` nor `hosted_rollout_test` was touched. Root owns the concurrent full CP validation and actual two-CP/two-EE Redis probe; those results are not independently claimed here. Helm rendering and the isolated gateway header reproduction above were executed successfully. Product files were not edited.
