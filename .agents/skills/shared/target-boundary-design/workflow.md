# Target Boundary Design Workflow

Use this workflow before changing shared target concepts or adding a new target
type such as VMs.

## Classify the Change

- Shared target model: identity, display metadata, target type, capabilities,
  lifecycle state, health state, and target-neutral routing inputs.
- Kubernetes-specific implementation: kubeconfig, Kubernetes RBAC, namespaces,
  manifests, Helm, cluster agent behavior, Kubernetes API clients, and pod-level
  execution details.
- VM-specific implementation: SSH or AgentV credentials, host probes, OS or
  cloud policy, VM bootstrap, VM runner behavior, and VM lifecycle hooks.
- Future extension point: capability interfaces and adapter contracts that let
  new target types attach without changing shared orchestration.

## Required Checks

1. Search for existing `cluster`, `kubernetes`, `target`, and capability naming
   in the affected repositories.
2. Decide whether the user-facing term should remain `cluster` for
   compatibility, become `target`, or be shown as target-type-specific copy.
3. Keep shared data models free of Kubernetes SDK, kubeconfig, namespace,
   manifest, or RBAC types unless the model is explicitly Kubernetes-owned.
4. Keep target-specific secrets out of shared payloads except through declared
   credential references or secret handles.
5. Define capability behavior for supported, unsupported, degraded, and unknown
   states.
6. If an API, DTO, schema, manifest, or generated client changes, apply
   `acornops-contract-change`.

## Handoff Evidence

Include:

- the boundary table
- files where shared target surfaces changed
- files where target-specific behavior stayed isolated
- migration notes for existing Kubernetes cluster workflows
- unsupported capability behavior
- validation commands and skipped checks
