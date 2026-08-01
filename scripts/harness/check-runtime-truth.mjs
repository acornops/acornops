#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const sourceRoots = [
  'control-plane/src',
  'execution-engine/execution_engine',
  'llm-gateway/app',
  'management-console/src'
];

const defaultDeploymentFiles = [
  'control-plane/docker-compose.yml',
  'control-plane/docker-compose.override.yml',
  'control-plane/.env.example',
  'llm-gateway/docker-compose.yml',
  'llm-gateway/docker-compose.override.yml',
  'acornops-deployment/compose/local/compose.source.yaml',
  'acornops-deployment/compose/vm-prod/compose.yaml',
  'acornops-deployment/env/local/.env.example',
  'acornops-deployment/env/local/.env.agent.example'
];

const productionDeploymentFiles = [
  'control-plane/docker-compose.yml',
  'acornops-deployment/compose/vm-prod/compose.yaml',
  'acornops-deployment/kubernetes/helm/acornops-platform/templates/configmap.yaml'
];

function filesUnder(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (absolutePath) => {
    for (const entry of readdirSync(absolutePath)) {
      const child = path.join(absolutePath, entry);
      const stat = statSync(child);
      if (stat.isDirectory() && entry !== '__pycache__' && entry !== 'node_modules') visit(child);
      else if (stat.isFile()) files.push(path.relative(root, child));
    }
  };
  visit(absoluteRoot);
  return files;
}

function checkFile(relativePath, rules) {
  if (!existsSync(path.join(root, relativePath))) return;
  const content = readFileSync(path.join(root, relativePath), 'utf8');
  for (const rule of rules) {
    if (rule.pattern.test(content)) failures.push(`${relativePath}: ${rule.message}`);
  }
}

const runtimeRules = [
  {
    pattern: /\b(?:agent-workflow-orchestrator|agent-cluster-triage|agent-release-coordinator|agent-incident-reporter)\b/,
    message: 'legacy built-in Agent identity appears in production runtime code'
  },
  {
    pattern: /\b(?:repositoryOperator|repository-review|github-official|gitlab-zereight)\b|Repository Reviewer|Repository review/,
    message: 'repository-review template or provider-profile identity appears in production runtime code'
  },
  {
    pattern: /\bsystem_orchestrator\b/,
    message: 'legacy system_orchestrator kind appears in production runtime code'
  },
  {
    pattern: /\b(?:createDefaultAgentDefinitions|createDefaultWorkflowDefinitions)\b/,
    message: 'frontend/runtime default definition factory is forbidden'
  },
  {
    pattern: /\b(?:mock-mcp|get_weather|remote-mcp-server)\b/,
    message: 'test-only MCP fixture identity appears in production runtime code'
  },
  {
    pattern: /https?:\/\/(?:mock-mcp|mock\.)[^\s'"`]*/,
    message: 'fixture URL appears in production runtime code'
  },
  {
    pattern: /\bbuiltInOnly\b/,
    message: 'target chat/runtime still contains the removed builtInOnly restriction'
  },
  {
    pattern: /\b(?:orchestratorAgentId|orchestrator_agent_id)\b/,
    message: 'Retired Workflow orchestrator field appears in production runtime code'
  },
  {
    pattern: /\ballowedTools\s*:\s*\[(?!\s*\])/,
    message: 'literal operational tool grants must be resolved by the live catalog/compiler'
  },
  {
    pattern: /\ballowed_tools\s*=\s*\[(?!\s*\])/,
    message: 'literal operational tool grants must be resolved by the live catalog/compiler'
  }
];

for (const sourceRoot of sourceRoots) {
  for (const file of filesUnder(sourceRoot)) {
    if (/\.(?:test|spec)\.[^.]+$/.test(file) || file.startsWith('control-plane/src/docs/openapi/')) continue;
    if (file.startsWith('management-console/src/fixtures/')) continue;
    checkFile(file, runtimeRules);
  }
}

const frontendDataMode = readFileSync(path.join(root, 'management-console/src/config/appDataMode.ts'), 'utf8');
const frontendMain = readFileSync(path.join(root, 'management-console/src/main.tsx'), 'utf8');
const frontendFixtureBrowser = readFileSync(path.join(root, 'management-console/src/fixtures/browser.ts'), 'utf8');
if (!frontendDataMode.includes("value !== 'mock' && value !== 'control-plane'")) {
  failures.push('management-console: frontend data mode must accept only mock or control-plane');
}
if (!frontendDataMode.includes('production && value === \'mock\'')) {
  failures.push('management-console: production builds must reject frontend mock mode');
}
if (!frontendMain.includes('await startFixtureWorker()') || frontendMain.indexOf('await startFixtureWorker()') > frontendMain.indexOf('root.render(')) {
  failures.push('management-console: fixture worker must start before React mounts');
}
if (!frontendFixtureBrowser.includes("url.pathname.startsWith('/api/')") || !frontendFixtureBrowser.includes('throw new Error(')) {
  failures.push('management-console: frontend fixture transport must fail closed for unmatched API requests');
}

const deploymentRules = [
  ...runtimeRules,
  {
    pattern: /\bmock-mcp\b/,
    message: 'mock MCP is present in a default deployment profile'
  },
  {
    pattern: /seed_db\.py/,
    message: 'normal startup invokes the removed gateway seed script'
  },
  {
    pattern: /ACORNOPS_DEV_SEED_[A-Z_]*API_KEY/,
    message: 'default deployment exposes fake/provider seed credential inputs'
  },
  {
    pattern: /\b(?:sk-(?:test|fake|dummy)|(?:test|fake|dummy)[-_](?:provider[-_])?(?:api[-_]?)?key)\b/i,
    message: 'default deployment contains a fake provider credential'
  }
];

for (const file of defaultDeploymentFiles) checkFile(file, deploymentRules);

for (const file of productionDeploymentFiles) {
  checkFile(file, [{
    pattern: /SEED_DEVELOPMENT_DATA\s*[:=]\s*["']?true\b/i,
    message: 'development cluster seeding is enabled in a production deployment'
  }]);
}

const localCompose = readFileSync(path.join(root, 'acornops-deployment/compose/local/compose.source.yaml'), 'utf8');
const localUp = readFileSync(path.join(root, 'acornops-deployment/scripts/local-up.sh'), 'utf8');
const deploymentTaskfile = readFileSync(path.join(root, 'acornops-deployment/Taskfile.yml'), 'utf8');
if (!localCompose.includes('SEED_DEVELOPMENT_DATA: ${SEED_DEVELOPMENT_DATA:-true}')
  || !localCompose.includes('SEED_VM_AGENT_KEY: ${SEED_VM_AGENT_KEY:-ak_local_vm_dev_shared_key}')) {
  failures.push('acornops-deployment: normal local Compose must seed both development target types');
}
if (!localCompose.includes('- cluster-fixture') || !deploymentTaskfile.includes('local-up-cluster-fixture:')) {
  failures.push('acornops-deployment: the AgentK-only cluster fixture path must remain available');
}
if (!localUp.includes('export SEED_DEVELOPMENT_DATA=true')
  || !localUp.includes('export SEED_VM_AGENT_KEY="${LOCAL_VM_AGENT_KEY}"')
  || !localUp.includes('if profile_enabled cluster-fixture; then')) {
  failures.push('acornops-deployment: local-up must seed both targets and retain the AgentK-only profile');
}

const migrationRules = [
  {
    pattern: /\b(?:agent-workflow-orchestrator|agent-cluster-triage|agent-release-coordinator|agent-incident-reporter|cluster-triage|repository-operation|incident-report-pdf)\b/,
    message: 'legacy built-in Agent/workflow identity may appear only in the one-time cleanup migration'
  },
  {
    pattern: /\b(?:system_orchestrator|specialist_agent|acornops-cluster-agent)\b/,
    message: 'legacy Agent kind or fabricated target integration may appear only in the one-time cleanup migration'
  },
  {
    pattern: /INSERT\s+INTO\s+(?:agent_definitions|workflow_definitions|workspace_skills)/i,
    message: 'database migrations must not seed Agent, workflow, or skill definitions'
  },
  {
    pattern: /\b(?:mock-mcp|get_weather|remote-mcp-server)\b/,
    message: 'test-only MCP fixtures are forbidden in production migrations'
  },
  {
    pattern: /\b(?:repositoryOperator|repository-review|github-official|gitlab-zereight)\b|Repository Reviewer|Repository review/,
    message: 'repository-review template or provider-profile identities are forbidden in migrations'
  }
];
const controlPlaneMigrations = filesUnder('control-plane/migrations/control-plane')
  .filter((file) => file.endsWith('.sql'));
if (controlPlaneMigrations.length !== 1
  || !controlPlaneMigrations[0].endsWith('/001_initial_schema.sql')) {
  failures.push('control-plane: unreleased schema must contain only 001_initial_schema.sql');
}
for (const file of controlPlaneMigrations) {
  checkFile(file, migrationRules);
}

const targetToolSync = readFileSync(
  path.join(root, 'control-plane/src/services/target-built-in-tool-sync.ts'),
  'utf8'
);
if (/refreshAgentReadiness|refreshWorkflowReadiness|repository-(?:agents|workflows)/.test(targetToolSync)) {
  failures.push('control-plane: target connector lifecycle must not refresh Agent or Workflow readiness');
}
const workspaceMcpSpecs = readFileSync(
  path.join(root, 'control-plane/src/services/workspace-mcp-tool-specs.ts'),
  'utf8'
);
if (/listWorkspaceTargetSnapshot|resolveTargetRunTools|listTargetMcpTools/.test(workspaceMcpSpecs)) {
  failures.push('control-plane: Targets MCP catalog must not be derived from workspace target inventory');
}

const targetsCatalog = readFileSync(
  path.join(root, 'control-plane/src/services/targets-mcp-catalog.ts'),
  'utf8'
);
const catalogToolNames = new Set(
  [...targetsCatalog.matchAll(/^\s+name: '([^']+)',?$/gm)].map((match) => match[1])
);
const agentkIndex = readFileSync(path.join(root, 'agentk/src/tools/index.ts'), 'utf8');
const agentkToolNames = new Set();
for (const match of agentkIndex.matchAll(/import \{ (\w+Tool) \} from '\.\/atomic\/([^']+)'/g)) {
  const definitionFile = match[2].replace(/\.js$/, '.ts');
  const definition = readFileSync(path.join(root, `agentk/src/tools/atomic/${definitionFile}`), 'utf8');
  const name = definition.match(new RegExp(`export const ${match[1]}: ToolDefinition = \\{[\\s\\S]*?name: '([^']+)'`))?.[1];
  if (name) agentkToolNames.add(name);
}
const agentvTools = readFileSync(path.join(root, 'agentv/src/tools/index.ts'), 'utf8');
const agentvToolNames = new Set(
  [...agentvTools.matchAll(/define\(\{ name: '([^']+)'/g)].map((match) => match[1])
);
for (const name of new Set([...agentkToolNames, ...agentvToolNames])) {
  if (!catalogToolNames.has(name)) {
    failures.push(`control-plane: stable Targets MCP catalog is missing connector tool ${name}`);
  }
}
for (const name of catalogToolNames) {
  if (!agentkToolNames.has(name) && !agentvToolNames.has(name)) {
    failures.push(`control-plane: stable Targets MCP catalog contains unknown connector tool ${name}`);
  }
}

for (const file of filesUnder('control-plane/src')) {
  if (file === 'control-plane/src/store/repository-agents.ts'
    || file === 'control-plane/src/store/repository-workflows.ts') continue;
  checkFile(file, [{
    pattern: /INSERT\s+INTO\s+(?:agent_definitions|workflow_definitions)/i,
    message: 'definition rows may only be inserted by the common Agent/workflow repositories'
  }]);
}

for (const file of filesUnder('control-plane/src')) {
  if (file === 'control-plane/src/services/automation-definition-service.ts'
    || file === 'control-plane/src/store/repository-agents.ts'
    || file === 'control-plane/src/store/repository-workflows.ts') continue;
  checkFile(file, [{
    pattern: /\bcreate(?:Agent|Workflow)Definition\s*\(/,
    message: 'definitions must be created through the common definition service'
  }]);
}

if (failures.length) {
  console.error('Runtime truth checks failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Runtime truth checks passed.');
