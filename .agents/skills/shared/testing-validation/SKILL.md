---
name: acornops-testing-validation
description: Select and execute repository-appropriate validation for AcornOps changes. Use when behavior, deployment configuration, operational runtime paths, or completed contract changes need validation evidence. Do not use as the primary workflow for designing API/schema/manifest changes; use acornops-contract-change for that.
---

# Inputs

- changed files and affected runtime paths
- repository build and test commands
- required integration boundaries

# Procedure

1. Map changed files to required validation depth.
2. Run the repository validation entrypoint when it matches the risk.
3. Add targeted checks required by changed behavior.
4. Re-run targeted checks after fixes.
5. Capture exact command outcomes.

# Outputs

- validation report with command list and status
- failure summary with likely root cause
- residual risk list for unexecuted checks
- handoff evidence naming exact commands, outcomes, and skipped checks
