# Cross-repository review: external integration workspace grants

Reviewed on 2026-07-11 at `control-plane` `249eac3`, `management-console` `c41c550`, `docs-website` `7d08814`, and `acornops-deployment` `cdd01ad`.

## Disposition

Hold the merge. All four PRs are open, non-draft, mergeable, and report a clean merge state. Their latest required CI checks pass (with the expected `docs-only` jobs skipped), but the current suites do not exercise the transaction, relink, audit-attribution, or contract-mismatch scenarios below.

Keep the supplied merge order after the blocking findings are fixed:

1. [`control-plane#9`](https://github.com/acornops/control-plane/pull/9)
2. [`management-console#12`](https://github.com/acornops/management-console/pull/12)
3. [`docs-website#5`](https://github.com/acornops/docs-website/pull/5)
4. [`acornops-deployment#5`](https://github.com/acornops/acornops-deployment/pull/5)

## Findings

### Blocking: complete the link and its grants atomically

`control-plane#9` activates the durable link before it replaces the approved grants. `completeExternalIntegrationLinkRequest` in `control-plane/src/controllers/external-integration-link-controller.ts` calls `completeExternalIntegrationLink`, then separately calls `repo.replaceExternalIntegrationWorkspaceGrants`. The underlying `completeExternalIntegrationLinkToken` and `replaceExternalIntegrationWorkspaceGrants` functions in `control-plane/src/store/repository-external-integration-links.ts` each open and commit their own transaction.

For a relink, the first transaction updates the existing `external_integration_user_links` row and consumes the token while the old `external_integration_workspace_grants` rows remain active. A grant-replacement failure therefore leaves the newly linked user paired with stale grants. A bot request in the gap observes the same mismatch. Competing relinks can also interleave: a later completion can update the shared link row before an earlier request performs its delayed grant replacement, allowing the earlier consent selection to overwrite the later one.

Move completion into one repository operation and transaction. It should lock and validate the token, serialize the external identity/link row, update the link, replace all grants, consume the token, and commit together. Any failure must roll back the link, token consumption, and grants as one unit.

### Blocking: put `workspaceGrants` on the completion request schema

The OpenAPI source documents `workspaceGrants` on `POST /api/v1/auth/external-integrations/link/preview` and omits it from `POST /api/v1/auth/external-integrations/link/complete` in `control-plane/src/docs/openapi/auth-chat-paths.ts`. Runtime behavior is the inverse: `externalIntegrationLinkTokenSchema` is strict and preview accepts only `token`, while `externalIntegrationLinkCompletionSchema` accepts `workspaceGrants` in `control-plane/src/controllers/external-integration-link-controller.ts`. The incorrect shape is already present in `docs-website/openapi/control-plane-public.json`; both generated OpenAPI files in `docs-website#5` must be regenerated from the corrected source.

Move the field to the completion request and describe the runtime constraints: at most 250 grants; `workspaceId` length 1–128; at most 20 capabilities per grant; no duplicate workspace IDs; and capability values constrained to the external-integration enum. Make the required/optional status match the completion handler, then regenerate `docs-website/openapi/control-plane-public.json` and `docs-website/openapi/control-plane-admin.json`.

### Required: preserve external actor attribution in workspace audits

External bot authentication already retains `linkId`, `integrationId`, `provider`, and `externalUserId` in `AuthCredential` in `control-plane/src/auth/middleware.ts`. That identity is lost when bot-accessible operations write audit events: `createSession` and the `run.created.v1` path in `control-plane/src/controllers/sessions-controller.ts` pass only `actorUserId: req.auth.userId`. `insertWorkspaceAuditEvent` in `control-plane/src/store/repository-audit-events.ts` consequently defaults these records to actor type `user`.

The storage contract cannot express the correct identity: `WorkspaceAuditActor` and `WorkspaceAuditEventInput` in `control-plane/src/types/domain.ts`, plus the `workspace_audit_events_actor_type_check` constraint in `migrations/control-plane/001_initial_schema.sql`, support only `user`, `system`, and `admin_token`. A bot-created session or run is therefore indistinguishable from the linked user performing the action in the browser.

Add `external_integration` to the workspace audit model and persistence constraints. Preserve the linked AcornOps user ID for accountability while also recording the integration client ID or durable link ID and the external actor type. Thread the credential through every bot-accessible audit call and expose the attribution in audit responses and filters.

### Required: align the external-integration capability contract

`assertExternalIntegrationWorkspaceCapabilities` in `control-plane/src/auth/authorization.ts` validates `allowedCapabilities` against the entire `WORKSPACE_CAPABILITIES` set. `parseExternalIntegrationClients` in `control-plane/src/config-external-integrations.ts` therefore accepts administrative and write capabilities outside the phase-one integration contract. In contrast, `ControlPlaneWorkspaceCapability` and the grant editors in `management-console/src/services/control-plane/externalIntegrationTypes.ts`, `ExternalIntegrationLinkRouteScreen.tsx`, and `UserSettingsPage.tsx` support only:

- `read_workspace_data`
- `create_sessions`
- `create_read_only_runs`

The OpenAPI component schemas in `control-plane/src/docs/openapi/schema-components-workspace.ts` further describe capability arrays as unconstrained strings. Define a dedicated external-integration capability allowlist, use it for config and grant validation, publish the same enum through OpenAPI, and consume that contract in the console types. Document the dependency rules: `create_sessions` requires `read_workspace_data`, and `create_read_only_runs` requires both.

## Testing and documentation gaps

- Replace the source-string assertions in `management-console/src/app/ExternalIntegrationLinkRouteScreen.test.ts` and `src/pages/UserSettingsPage.test.ts` with rendered interaction tests. Cover selecting capabilities, automatic dependency selection/removal, saving, clearing all grants, unlink confirmation, loading/disabled states, and preview, completion, save, refresh, and unlink failures.
- Add control-plane tests proving rollback when grant replacement fails, serialization of concurrent relinks, removal of stale grants, correct external actor attribution for session/run creation, and rejection of every capability outside the dedicated allowlist. The existing `test/external-integration-link.test.ts` and `test/external-integration-link-grants.test.ts` use isolated repository/controller mocks and do not cover the cross-operation transaction boundary.
- Add an exact `EXTERNAL_INTEGRATION_CLIENTS_JSON` descriptor example to the operator-facing `docs-website/configuration.mdx` and Helm documentation in `acornops-deployment/kubernetes/helm/acornops-platform/README.md`. List the valid phase-one combinations explicitly: read only; read plus session creation; or all three capabilities including read-only runs.

## Security and contract assessment

- Pass: descriptors continue to store token hashes rather than raw bearer tokens, and effective workspace authorization remains role- and grant-intersected.
- Fail (blocking): consent persistence is not atomic, so stale or mismatched grants can become active.
- Fail (blocking): the published completion request contract does not describe the request the console sends.
- Required hardening: workspace audit records must distinguish delegated external actions from direct browser-user actions, and capability configuration must be least-privilege and contract-bounded.
