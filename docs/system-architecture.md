# AcornOps System Architecture

This is the canonical whole-platform architecture map for developers working in
the AcornOps workspace. Component-level internals remain in each child
repository's `ARCHITECTURE.md`; deployment mechanics live in
`acornops-deployment/docs/deployment-architecture.md`.

## Developer Reading Path

1. Read this file to understand how the platform fits together.
2. Use `workspace.yaml` to find the local path and validation command for each
   repository.
3. Read the affected component repository's `README.md`, `AGENTS.md`, and
   `ARCHITECTURE.md` before changing implementation code.
4. Read `acornops-deployment/docs/deployment-architecture.md` when the question
   is about Compose, Kubernetes, ingress, release wiring, or operating the
   assembled stack.

## Logical Architecture

```mermaid
flowchart LR
    User[Operator Browser]
    PlatformAdmin[Platform Administrator Browser]
    Console[Management Console]
    AdminConsole[Platform Admin Console + BFF]
    CP[Control Plane]
    CPDB[(Control Plane Postgres)]
    CPRedis[(Control Plane Redis)]
    EE[Execution Engine]
    GW[LLM Gateway]
    GWDB[(Gateway Postgres)]
    GWRedis[(Gateway Redis)]
    OIDC[OIDC Provider]
    Providers[LLM Providers]
    Agent[AgentK]
    AgentV[AgentV]
    Cluster[Workload Cluster]
    LinuxVM[Linux/systemd VM]
    RemoteMCP[Remote MCP Servers]

    User --> Console
    Console -->|/api/v1| CP
    PlatformAdmin -->|admin.acornops.dev| AdminConsole
    PlatformAdmin -->|OIDC login + opaque admin session| CP
    AdminConsole -->|governance-only /admin/v1 allowlist| CP
    User --> OIDC
    OIDC --> CP

    CP --> CPDB
    CP --> CPRedis
    CP -->|dispatch run| EE
    CP -->|admin / tool registry| GW
    CP -->|run-scoped token| GW

    EE -->|stream / tool call| GW
    GW --> Providers
    GW --> RemoteMCP
    GW --> GWDB
    GW --> GWRedis

    Agent -->|outbound WebSocket| CP
    Agent --> Cluster
    AgentV -->|outbound WebSocket| CP
    AgentV --> LinuxVM
    CP -->|JSON-RPC tool relay| Agent
    CP -->|JSON-RPC tool relay| AgentV
```

## How The Pieces Fit

The management console is the operator-facing browser application. It talks to
the control plane through `/api/v1` and depends on the control plane for
authentication state, workspace and target APIs, run orchestration, and
agent-backed operations.

The platform admin console is a separate governance application and
server-side BFF. It talks only to an explicit allowlist of `/admin/v1`
control-plane endpoints for workspace identity, existing workspace access,
plans, lifecycle state, and platform administration audit. It does not expose workspace
logs, targets, runs, tools, workspace audit, impersonation, or workload-control
operations. Its browser never receives the control-plane admin bearer token;
production authorization requires both that BFF credential and a dedicated
OIDC-authenticated human session with one of three fixed platform roles.

The control plane is the public application boundary. It owns authenticated
HTTP APIs, session handling, workspace state, target registration, run state,
agent WebSocket ownership, and cross-service orchestration. It persists durable
application state in Postgres and uses Redis for runtime coordination such as
agent ownership, fanout, and scheduler leases.

The execution engine is the run worker. The control plane dispatches work to it;
the execution engine drives the run lifecycle, streams reasoning/tool events,
and reports state transitions back to the control plane.

The LLM gateway is the model and tool broker. It normalizes provider calls,
enforces gateway policy, brokers MCP tool calls, stores gateway metadata, and
connects to remote MCP servers and external LLM providers. The control plane
uses gateway admin APIs to register tools and issues run-scoped credentials for
execution-time access.

AgentK and AgentV are outbound-only target agents. They connect back to
the control plane over WebSocket, publish target snapshots, and receive
JSON-RPC tool calls relayed by the control plane. AgentK operates inside
workload clusters; AgentV runs as a Linux/systemd process for VM targets.

The deployment repository assembles these services into runnable topologies. It
does not own component runtime code; it owns Compose and Kubernetes wiring,
environment templates, ingress/proxy behavior, release compatibility metadata,
and operator runbooks.

## Primary Runtime Flows

### Operator Session

1. The operator opens the management console.
2. The console sends API requests to the control plane.
3. The operator authenticates through the configured OIDC provider.
4. The control plane establishes the application session and serves workspace,
   target, run, and configuration APIs to the console.

### Run Execution

1. The console requests a run through the control plane.
2. The control plane validates workspace, target, and session boundaries.
3. The control plane dispatches the run to the execution engine.
4. The execution engine calls the LLM gateway for model streaming and tool
   execution.
5. The execution engine posts run events and terminal state back to the control
   plane.
6. The console reads live or replayed run state from the control plane.

### Agent Tooling

1. AgentK or AgentV connects outbound to the control plane WebSocket endpoint.
2. The agent publishes target identity, health, capabilities, and snapshots.
3. The control plane records target state and routes target-scoped tool calls.
4. The agent executes allowed JSON-RPC tools against its local target.
5. Tool results flow back through the control plane to the requesting run or UI.

### Gateway Tooling

1. The control plane registers gateway-visible tools and MCP servers through
   gateway admin APIs.
2. The execution engine calls the gateway with run-scoped credentials.
3. The gateway applies policy, calls configured LLM providers, and brokers MCP
   tool calls when the model requests tools.
4. Gateway stream events return to the execution engine and then back to the
   control plane as run events.

### Tool Result Evidence And Artifacts

Tool results deliberately have separate reasoning and operator views. AgentK
redacts at the source and returns a bounded typed model projection alongside a
complete redacted result. The control plane relays that MCP envelope unchanged,
and the LLM gateway validates its advertised output schema, transmitted context
size, independently computed result ceilings, and registry-owned retention
policy. Invalid AgentK envelopes fail closed.
The Agent WebSocket and trusted control-plane-to-gateway MCP hop each use a
3 MiB transport ceiling, leaving bounded envelope headroom around the separate
2 MiB complete-result limit.
The gateway-to-execution-engine normalized response has its own 5 MiB ceiling
because generic MCP content can occupy both contract views before structural
fallback runs.

The execution engine independently revalidates producer projections and sends
only compact evidence through its 48 KiB active ledger. Eligible complete
results are uploaded to the control plane, redacted again, capped at 2 MiB,
gzip-compressed, and retained for seven days. A strict control-plane event
allowlist and independent 12 KiB check keep run events and SSE limited to
compact evidence plus artifact metadata;
the management console downloads a full redacted artifact lazily through
workspace data-read authorization. Unknown non-AgentK results use deterministic
structural compaction and are not retained unless the server is explicitly
trusted by a future registry policy.
Tool fields, logs, and resource content remain untrusted data throughout model
reasoning; embedded text cannot override user intent, approvals, or safety
rules.

Write failures after dispatch are treated as uncertain at every boundary.
AgentK, the gateway, and the execution engine preserve `outcome: unknown`, stop
the run, and require target inspection before retry. Approval recovery reuses a
completed stored receipt and never redispatches the same completed approval.
Successful write projections include an exact-target `get_resource`
verification instruction before remediation is reported complete.

The result contract is a coordinated clean cutover and is not safe for a live
mixed-version rolling deployment. Database migrations are additive and run
first, but run dispatch must then be drained while all dependent services are
replaced, AgentK reconnects, and built-in tools resynchronize. Read-only
contract checks run before writes reopen; the guarded Pod remediation smoke
runs afterward. Contract failure requires full-matrix rollback while dispatch
remains closed.

## Public And Internal Boundaries

Production public route hostnames:

- `console.acornops.dev/` serves the management console.
- `admin.acornops.dev/` serves the platform admin console.
- `api.acornops.dev/api` serves the control plane API and agent WebSocket route.
- `console.acornops.dev/api` remains available for same-origin browser session flows.
- `docs.acornops.dev/` serves the public documentation site.
- Root `acornops.dev` is reserved outside the platform API surface.

Internal-only services:

- execution-engine
- llm-gateway
- Postgres
- Redis

## Repository Ownership

- `management-console`: browser UI and nginx production image.
- `platform-admin-console`: platform-governance UI and admin API BFF with a
  deny-by-default `/admin/v1` endpoint allowlist.
- `control-plane`: auth, workspaces, sessions, run state, agent
  bridge, and orchestration API.
- `execution-engine`: run worker and durable execution callbacks.
- `llm-gateway`: LLM provider gateway, MCP broker, secrets backend,
  and gateway policy.
- `agentk`: workload-cluster agent and agent Helm chart.
- `agentv`: read-only Linux/systemd VM agent, packaging, and local
  mock collectors.
- `acornops-deployment`: full-stack deployment tracks, platform Helm chart,
  runbooks, and release matrix.
- `docs-website`: public documentation site.
- `charts`: public classic Helm chart repository mirror for packaged platform
  and agent charts.

## Deployment Tracks

The system can be assembled in several ways, all owned by
`acornops-deployment`:

- local full-stack development with source bind mounts and local support
  services
- Docker-on-VM production deployment
- central Kubernetes platform deployment
- workload-cluster agentk rollout
- Linux/systemd AgentV installation

Use `acornops-deployment/docs/deployment-architecture.md` for topology,
ingress, state, HA, and operator details for those tracks.
