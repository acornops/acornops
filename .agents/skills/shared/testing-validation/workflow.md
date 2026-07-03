# Testing Validation Workflow

1. Map changed behavior to the repository's validation entrypoints.
2. Run unit tests for changed logic.
3. Run integration tests when contracts, networking, or persistence change.
4. For deployment changes, run compose or manifest validation.
5. Record exact commands and non-zero exits.
6. Block completion when required checks fail.
7. Include skipped checks, reasons, and residual risk in handoff evidence.
