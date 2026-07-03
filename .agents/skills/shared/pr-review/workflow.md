# PR Review Workflow

1. Classify changes into application, infrastructure, and docs.
2. Verify required validation evidence for the changed behavior.
3. Review contract-sensitive files first (API routes, schemas, manifests).
4. Review stateful and migration paths for rollback safety.
5. Validate observability impact for changed runtime behavior.
6. Publish findings ordered by severity with clear remediation actions.
