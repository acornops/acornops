# Platform prompt resource reference contract

The human-authored grammar is `@type[label]`. Types begin with a lowercase
ASCII letter and continue with lowercase letters, digits, `_`, or `-`, to a
maximum of 64 characters. Labels are normalized to Unicode NFC and may escape
only `\\` and `\]`. Empty labels are authoring placeholders. Launch resolution
rejects placeholders, malformed tokens, prompts above 32,768 characters, and
more than 64 references.

The authenticated prompt is the only resource-selection authority. Preview
candidate IDs are display data and are re-resolved and reauthorized at run
creation. Providers receive the authenticated workspace and actor, resolve
labels without cross-workspace disclosure, authorize required operations, and
produce immutable binding snapshots. Generic callers preserve prompt order and
never switch on provider type.

Threat boundaries:

- Mutable or ambiguous labels fail closed; no first-match behavior is allowed.
- Provider outages and timeouts become bounded blocker codes without leaking
  backend details.
- Binding IDs, prompt digests, and canonical binding digests are recomputed at
  service boundaries; duplicate bindings and conflicting runtime projections
  are rejected.
- Context readers accept binding IDs, never arbitrary resource IDs, and enforce
  per-resource and aggregate limits.
- The implicit Workflow session binding ends at the message that initiated the
  run, preventing concurrent later messages from entering its context.
- Scheduled prompts are re-resolved for each occurrence and auto-pause when a
  resource, integration, membership, or permission is no longer valid.
