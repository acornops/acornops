# Runtime and rollout fix round 1 rereview

6 September 2026. Scope is the two findings in `hosted-runtime-rollout-review.md` and breakage introduced by their fixes, not a whole-branch review.

**Result: both findings resolved; no new material finding in this scope.**

- Insights: inspected the extracted `control-plane/src/services/target-insights/checkpoint-gateway.ts` and its worker call site. The persisted run identity, granted owner and numeric generation now reach the gateway request in the expected headers. Token claims/body retain the persisted run ID. The extraction retains timeout handling, request content, response validation and stream parsing.
- Helm: inspected and independently rendered the changed ConfigMaps. Both execution engine and gateway now contain the release-specific CP URL in `data`, and neither has that field in `metadata`. The added chart-check assertions distinguish per-component `data` from `metadata`, covering the original misplacement.

Executed verification:

```sh
# control-plane
NODE_ENV=test node --import tsx --test --test-concurrency=1 test/insights-gateway-authority.test.ts test/target-insights-checkpoint-worker.test.ts test/target-insights-checkpoint-outcomes.test.ts
# acornops-deployment
helm template rereview kubernetes/helm/acornops-platform > /private/tmp/hosted-rereview-helm.yaml
```

All 13 targeted tests passed, none skipped. Independently parsed the rendered execution-engine and gateway ConfigMap document blocks, asserting `ORCH_BASE_URL` is absent from metadata and `data` contains `http://rereview-acornops-platform-control-plane:8081`; both passed. Also inspected the root-owned chart-check success log `/private/tmp/hosted-helm-authority-green.log` (not claimed as independently executed).

No product edits, subagents, or database use. Full CP validation, concurrent replica acceptance, ongoing UI contracts and whole-branch approval remain outside this rereview.
