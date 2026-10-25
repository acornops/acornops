# Opt-in admin-managed model IDs

Status: approved by the user on 2026-10-25; implementation pending.

## Intent and scope

Allow a platform administrator to add compatible model IDs without another
application release, while deployment operators retain control of whether this
capability is available. Preserve existing provider adapters, credentials,
defaults, permissions, audit records, and version-conflict handling.

This is a bounded extension of AI Policy, plus a focused chat recovery fix. It
touches control-plane, platform-admin-console, management-console, and the
deployment chart. It does not introduce a registry service, database migration,
new provider, model discovery, pricing catalog, capability editor, SDK upgrade,
or automatic model/default migration. Release and demo rollout are separate.

## Approaches

1. Keep deployment-owned model IDs: least code, but each new ID requires a
   deployment configuration change. Does not meet the requested runtime editing.
2. Opt-in extension of the existing policy: keep the current locked-down default
   and explicitly permit additional IDs for existing deployment-enabled providers.
   This is the selected approach; it reuses existing storage and governance.
3. Fully admin-owned model registry: more lifecycle and compatibility machinery,
   and changes the deployment authority model. Not selected; unnecessary here.

## Proposed policy and admin experience

- Add a deployment-controlled `allowAdditionalModels` boolean under AI Policy,
  defaulting to false. Existing `runtimeEditable` remains an independent gate.
  With opt-in off, admins still only narrow the deployment's model list.
- When opted in, the existing AI Policy section offers an Add model action with
  an existing-provider selector and exact model-ID field. Provider choices are
  limited to supported providers already permitted by the deployment. No custom
  provider names, base URLs, credentials, or transport options are accepted.
- Additions are staged in the existing editor and saved through the existing
  versioned, audited setting mutation. Adding an ID does not change a default.
  Server validation is authoritative: reject unsupported/disallowed providers,
  empty or malformed IDs, duplicates, and excessive ID lengths/counts. Preserve
  case; use bounded identifier strings, not arbitrary configuration objects.
- Keep `providerModels` as the enabled allowlist. Store additional model IDs in
  optional provider-scoped metadata in the same AI-policy JSON value. This small
  distinction preserves a disabled custom ID so it can be re-enabled after a
  reload. Use the existing enable/disable controls; do not add a deletion system.
- The selectable catalog is deployment IDs plus permitted additional IDs;
  execution uses only the enabled subset. Retain existing default/last-model
  safeguards. Reasoning constraints remain deployment-bounded.
- Existing records need no backfill. Older clients that omit the new metadata
  must not erase it during an otherwise valid write. Missing capability metadata
  in an older server response means the Add action is unavailable.
- Turning opt-in off stops additional IDs being used without deleting their
  stored definitions. Reset is the existing explicit return to deployment
  defaults and clears the runtime additions; its explanation must say so.
- Model compatibility and account access are not verified by saving an ID. The
  helper text states that the ID must work with the existing provider adapter.
  No paid test call or automatic provider-model discovery is introduced.

Implementation detail proposed here, rather than previously requested by the
user: optional catalog metadata is necessary because today's `providerModels`
stores enabled choices, not disabled definitions. Exact field names and bounds
will be finalized in the implementation plan and producer contract.

## Disabled-model behavior: evidence and change

The backend already rejects disabled models. However, the shared chat resolver
currently selects the workspace default or first ready model when a prior
selection is unavailable, potentially changing providers. It shows a fallback
notice for a prior explicit selection; a new chat with an unavailable default
can fall back without that notice. Kubernetes and VM chats refresh settings and
restore the draft after a policy rejection. Agent chats retain the draft and
show the error but do not refresh the model list on that path.

Change only the shared selection/recovery path:

- Preserve an unavailable provider/model selection and identify it in the
  existing picker. Display actionable inline guidance: the model is unavailable
  for this workspace and another model must be selected to continue.
- Block sending until the user explicitly picks an available, configured model.
  Keep the picker operable. Keep the draft, transcript, attachments, and active
  run cancellation available. Do not auto-retry or automatically switch models,
  providers, or saved workspace defaults.
- A new chat uses a valid workspace default normally. An unavailable default
  requires explicit selection instead of choosing the first available model.
- Preserve existing credential-setup guidance; distinguish missing credentials
  from a policy-disabled model. If no usable choices remain, explain that an
  administrator must configure an available model/provider.
- A reasoning-only policy change must not replace an otherwise valid provider
  or model. Retain supported reasoning normalization with truthful notice text.
- Reuse policy-rejection detection to refresh AI settings in Agent chats as
  target chats already do. A change while a page is open may first be detected
  on the next send; this extension adds no polling or push-notification system.
  The server rejects that attempt, and recovery requires explicit resubmission.
- Apply the same behavior to Agent, Kubernetes, and VM chat through the shared
  view. Do not promise revocation of an already authorized in-flight provider
  request or rewrite pinned workflow configurations.

## Compatibility and rollout

Default-off deployments retain their current model-governance rules. The
intentional user-visible behavior change is that unavailable chat models no
longer automatically switch to a replacement.

Deploy all updated control-plane replicas before enabling the extension or
saving additional-ID metadata, then deploy the compatible admin/chat clients.
Older control-plane versions use a strict AI-policy schema and cannot safely
read the extended record. A rollback therefore requires restoring an
old-schema-compatible policy first; simply turning the flag off is not an old
binary rollback procedure. Document this explicitly. No stored workspace
default or conversation selection is automatically migrated.

## Validation and documentation

- Policy tests: default-off behavior, opt-in/provider enforcement, ID validation,
  disabled/re-enabled additions, default validity, retained deployment reasoning
  limits, legacy records and writes, reset, and opt-in removal.
- Governance/contract tests: existing scopes and fixed routes, viewer/auditor
  restrictions, optimistic conflicts, audit behavior, bounded response
  projection, and producer/consumer contract parity.
- Chat tests: removed model/provider, invalid default, no usable models,
  credential absence, reasoning-only changes, explicit replacement, draft and
  attachment retention, no automatic resend, and stale-policy recovery in all
  three chat surfaces.
- Run affected unit, type, build, fixture, translation, accessibility, chart,
  and contract checks. Browser-check the existing admin form and shared chat
  picker using local fixtures/disposable local data; no paid provider requests.
- Update the AI Policy requirement (`REQ-SET-001`), producer/consumer contracts,
  deployment configuration and rollback guidance, and chat behavior docs.
  Preserve governance boundaries (`REQ-BND-001/002/003`, `REQ-AUTH-001`), key
  handling (`REQ-SET-002`), and the existing design vocabulary (`REQ-UX-001`).

Baseline evidence: 19 existing tests across the shared chat helpers, chat-submit
logic, and AI readiness passed on 2026-10-25. These verify current behavior,
not completion of this proposed change. No implementation or deployment has
been performed for this extension.
