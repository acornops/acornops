# AcornOps Repository Capability Summary

This summary describes the current AcornOps repository responsibilities and
validation surfaces. Keep it current when a repository changes its canonical
validation command, runtime responsibility, or deployment model.

## Repository: acornops-deployment
Purpose: Distribution and operations layer for full-stack local bring-up, Docker-on-VM production deployment, and cluster-agent rollout orchestration.
Primary Language: Bash + YAML
Framework: Taskfile + Docker Compose orchestration
Build Command: `task validate` (compose render validation) and `task local-up` or `task prod-up` for runtime assembly; local startup includes seeded Kubernetes/VM targets with AgentK/AgentV
Test Command: `task validate`
Deployment Model: Docker Compose profiles (`local`, `prod`), central Kubernetes platform Helm chart, and workload-cluster agentk Helm rollout
Infrastructure Tools: Docker Compose, Task, Helm, kubectl, Kubernetes manifests

## Repository: control-plane
Purpose: Authoritative backend control plane for auth/session handling, workspace/target management, target-native chat, Workflow V2 scope compilation and delegation, run orchestration, and AgentK/AgentV websocket routing.
Primary Language: TypeScript
Framework: Node.js + Express
Build Command: `npm run build`
Test Command: `npm run test`
Canonical Validation: `npm run validate`
Deployment Model: Docker Compose service with Postgres/Redis and optional OIDC/integration profiles
Infrastructure Tools: Docker Compose, Postgres, Redis, OIDC providers (Dex/Keycloak)

## Repository: llm-gateway
Purpose: LLM inference gateway and MCP tool broker with auth/policy enforcement, secret management, provider abstraction, and live catalog-backed exact tool references. Normal startup creates no MCP integration or provider credential.
Primary Language: Python
Framework: FastAPI + SQLAlchemy + Alembic
Build Command: `docker compose up -d --build` (component-local) or image build via `deployments/Dockerfile.gateway`
Test Command: `task validate`
Canonical Validation: `task validate`
Deployment Model: Docker Compose with gateway/postgres/redis/init job, plus GHCR image publish workflow
Infrastructure Tools: Docker Compose, GitHub Actions, Alembic migrations, optional HashiCorp Vault

## Repository: docs-website
Purpose: Public AcornOps documentation site for operator, deployment, API, and integration guidance.
Primary Language: MDX
Framework: Mintlify
Build Command: `npm run check`
Test Command: `npm run check` and `npm run links`
Canonical Validation: `npm run validate`
Deployment Model: Public documentation site served from the `acornops/docs` repository
Infrastructure Tools: Mintlify, npm

## Repository: management-console (mapped to local `management-console`)
Purpose: Operator-facing management console/UI for workspaces, clusters, diagnostics, sessions, and run traces.
Primary Language: TypeScript
Framework: React + Vite
Build Command: `npm run build`
Test Command: `npm run test`
Canonical Validation: `npm run validate`
Deployment Model: Docker multi-stage build with Nginx runtime, local Vite dev mode via compose override
Infrastructure Tools: Docker Compose, Nginx, Vite

## Repository: agentk
Purpose: Cluster-resident outbound-only Kubernetes agent for telemetry snapshots, live target-capability advertisement, and JSON-RPC tool execution.
Primary Language: TypeScript
Framework: Node.js + ws + `@kubernetes/client-node`
Build Command: `npm run build`
Test Command: `npm test` and `npm run test:e2e`
Canonical Validation: `npm run validate`
Deployment Model: Kubernetes manifests (`deploy/rbac.yaml`, `deploy/deployment.yaml`) and Docker Compose local mock platform
Infrastructure Tools: Kubernetes RBAC/Deployment manifests, Docker Compose, k3d in CI

## Repository: agentv
Purpose: Outbound-only Linux/systemd AgentV for read-only host snapshots, diagnostics, live target-capability advertisement, and JSON-RPC tool execution.
Primary Language: TypeScript
Framework: Node.js + ws with Linux/systemd collector adapters
Build Command: `npm run build`
Test Command: `npm test`
Canonical Validation: `npm run validate`
Deployment Model: systemd install assets for Linux VMs plus Docker-backed local mock VM fixtures
Infrastructure Tools: systemd, Docker Compose local mock service, fixture-backed collector tests

## Repository: execution-engine
Purpose: Run execution worker service that manages run lifecycle, reasoning loop, tool calls, and event/commit callbacks.
Primary Language: Python
Framework: FastAPI
Build Command: `task build` or `docker compose up -d --build`
Test Command: `task unit-test` and `task test` (integration in container)
Canonical Validation: `task validate`
Deployment Model: Docker Compose service with local mock orchestrator/gateway harness
Infrastructure Tools: Docker Compose, Task, Ruff, Pytest, GitHub Actions

## Repository: charts
Purpose: Public classic Helm chart repository mirror for AcornOps chart packages.
Primary Language: YAML + Markdown
Framework: Static Helm repository index
Build Command: N/A
Test Command: N/A
Canonical Validation: N/A
Deployment Model: GitHub Pages serving `index.yaml` and packaged chart archives
Infrastructure Tools: Helm, GitHub Pages, GitHub Actions
