# MCP credential ownership decision record

## Decision

Authenticated MCP installations use one explicit `credential_mode`: `workspace`
or `individual`. Unauthenticated installations use `none`. Authentication
format (`auth_type`) remains independent from ownership.

- Workspace connections use the canonical installation owner and require
  `manage_mcp` for mutation. User and service-identity runs may resolve them.
- Individual connections use the exact authenticated user ID. Only that user
  may mutate or resolve the connection; service identities fail closed.
- There is no fallback between owner types and no public connection inventory.
- Catalog endpoints may restrict supported modes and recommend a default.
- Connection responses expose mode, status, management scope, permission, and
  auth format only. They never expose secret names, values, owner IDs, or tool
  snapshots.
- Workspace credentials should be dedicated least-privilege service or bot
  credentials. Individual credentials remain invisible to administrators.
- `manage_mcp` is the initial workspace-credential permission. A dedicated
  permission can be introduced after a separate authorization review.
- Public connection timestamps are omitted from the initial contract.

## Storage model

```mermaid
erDiagram
  MCP_INSTALLATION ||--o{ MCP_CONNECTION : owns
  MCP_INSTALLATION {
    uuid id
    string workspace_id
    string destination_identity
    string auth_type
    string credential_mode
    boolean credential_transitioning
  }
  MCP_CONNECTION {
    uuid id
    uuid server_id
    string workspace_id
    string owner_type
    string owner_id
    string status
    json verified_tool_names
    datetime verified_at
    string error_code
  }
```

The plaintext value exists only in the configured encrypted secret backend. Its
deterministic identity is:

```text
mcp_credential::{workspace_id}::{server_id}::installation
mcp_credential::{workspace_id}::{server_id}::user::{user_id}
```

The database stores no arbitrary secret reference. `verified_tool_names` is a
credential-specific authorization snapshot, not a second installation catalog.

## Connection lifecycle

```mermaid
sequenceDiagram
  actor Caller
  participant CP as Control plane
  participant GW as Gateway connection service
  participant Secrets as Encrypted secret backend
  participant MCP as Remote MCP server
  Caller->>CP: PUT installation connection (credential + consent)
  CP->>CP: Authorize resolved owner
  CP->>GW: PUT exact owner connection
  GW->>GW: Rate limit and acquire owner lock
  GW->>Secrets: Store candidate credential
  GW->>MCP: tools/list using common header builder
  alt verification succeeds
    GW->>GW: Save connected + exact tool snapshot
  else verification fails
    GW->>GW: Save bounded error state
  else persistence/backend failure
    GW->>Secrets: Restore previous value or delete candidate
    GW->>GW: Restore previous connection state
  end
  GW-->>CP: Secret-free connection status
  CP-->>Caller: Secret-free connection status
```

Verify repeats authenticated discovery with the stored exact-owner credential.
Disconnect acquires the same owner lock, deletes that deterministic secret, and
then deletes its connection row. Installation deletion enumerates every owner,
attempts each secret deletion, and only then removes installation metadata.

## Runtime resolution

```mermaid
sequenceDiagram
  participant Run as Authorized run
  participant GW as Gateway
  participant DB as Connection store
  participant Secrets as Encrypted secret backend
  participant MCP as Remote MCP server
  Run->>GW: Invoke exact server ID + tool name
  GW->>GW: Reject disabled or transitioning installation
  GW->>GW: Resolve none, installation owner, or exact user owner
  GW->>DB: Read exact connection
  GW->>GW: Require connected state and exact verified tool
  GW->>Secrets: Read deterministic exact-owner secret
  GW->>GW: Build public + platform + auth headers
  GW->>MCP: Invoke tool
```

`individual` plus a non-user principal returns
`MCP_INDIVIDUAL_USER_PRINCIPAL_REQUIRED`. Missing, erroneous, or tool-incomplete
connections fail before contacting the remote server.

Interactive target chat may degrade by omitting credential-dependent MCP tools
whose exact connection is missing, erroneous, or tool-incomplete for the pinned
user. The same tools are removed from model schemas and run-token authority, and
the capability preview reports the omission. An explicitly referenced tool,
installation-level failure, workflow, schedule, or automation remains
fail-closed.

## Ownership transitions

Relational metadata and the encrypted secret backend cannot share one atomic
transaction. The gateway therefore sets `credential_transitioning` before
cleanup. Readiness, connection mutation, and runtime invocation reject a
transitioning installation. If cleanup fails, the flag remains set and the
installation stays blocked for an explicit retry; old credentials never become
fallback candidates.

```mermaid
sequenceDiagram
  participant Admin
  participant GW as Gateway
  participant DB as Database
  participant Secrets as Encrypted secret backend
  Admin->>GW: Change workspace to individual (expected revision)
  GW->>DB: Set credential_transitioning
  GW->>Secrets: Delete workspace secret
  GW->>DB: Delete workspace connection
  GW->>DB: Set individual mode and clear transitioning
  GW-->>Admin: Individual connection missing
```

```mermaid
sequenceDiagram
  participant Admin
  participant GW as Gateway
  participant DB as Database
  participant Secrets as Encrypted secret backend
  Admin->>GW: Change individual to workspace (expected revision)
  GW->>DB: Set credential_transitioning
  loop Every individual connection
    GW->>Secrets: Delete exact user secret
    GW->>DB: Delete exact user connection
  end
  GW->>DB: Set workspace mode and clear transitioning
  GW-->>Admin: Workspace connection missing
  Admin->>GW: Connect and verify workspace credential
```

The management console confirms both destructive transitions and immediately
opens the existing credential dialog for the new owner mode. Until connection
verification succeeds, fail-closed workflows, schedules, automations, and
explicit tool references remain blocked. Interactive target chat may proceed
without the unavailable installation tools.

## Security invariants

- Credential plaintext is accepted only by connection mutation, never by MCP
  installation create/update.
- Verification and runtime use the same header builder and validated ordering:
  public headers, platform headers, then authentication.
- Credentials, resulting authentication headers, secret references, owner IDs,
  upstream error bodies, and verified-tool snapshots are excluded from public
  responses, audit metadata, and structured logs.
- Connect and verify share one owner-scoped mutation quota. Redis is the
  production limiter; an in-memory implementation is the development/test
  fallback.
- URL, authentication metadata, public-header, catalog-trust, and ownership
  changes invalidate connections under a fail-closed transition.
