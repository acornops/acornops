#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

failures=()

expect_file() {
  local file="$1"
  if [[ ! -f "${ROOT_DIR}/${file}" ]]; then
    failures+=("Missing required file ${file}")
  fi
}

expect_dir() {
  local dir="$1"
  if [[ ! -d "${ROOT_DIR}/${dir}" ]]; then
    failures+=("Missing required directory ${dir}")
  fi
}

expect_absent_path() {
  local path="$1"
  if [[ -e "${ROOT_DIR}/${path}" ]]; then
    failures+=("Unexpected retired path ${path}")
  fi
}

expect_executable() {
  local file="$1"
  if [[ ! -x "${ROOT_DIR}/${file}" ]]; then
    failures+=("Required executable file ${file} is missing or not executable")
  fi
}

expect_contains() {
  local file="$1"
  local needle="$2"
  if [[ ! -f "${ROOT_DIR}/${file}" ]]; then
    failures+=("Missing required file ${file}")
    return
  fi
  if ! grep -Fq -- "${needle}" "${ROOT_DIR}/${file}"; then
    failures+=("${file} missing required text: ${needle}")
  fi
}

required_files=(
  "README.md"
  "AGENTS.md"
  "CLAUDE.md"
  "Taskfile.yml"
  ".gitignore"
  ".github/workflows/ci.yml"
  ".github/workflows/docs-maintenance.yml"
  ".github/pull_request_template.md"
  ".github/PULL_REQUEST_TEMPLATE/cross-repo.md"
  ".github/PULL_REQUEST_TEMPLATE/docs-maintenance.md"
  ".github/ISSUE_TEMPLATE/cross-repo-change.md"
  ".github/ISSUE_TEMPLATE/docs-maintenance.md"
  ".githooks/commit-msg"
  ".githooks/pre-commit"
  "workspace.yaml"
  "change-sets/README.md"
  "change-sets/active/.gitkeep"
  "change-sets/completed/.gitkeep"
  "docs/system-architecture.md"
  "docs/developer-getting-started.md"
  ".agents/skills/README.md"
  "scripts/harness/check-agent-harness.sh"
  "scripts/harness/check-conventional-commits.mjs"
  "scripts/harness/check-sync-drift.mjs"
  "scripts/harness/check-platform-contracts.mjs"
  "scripts/harness/check-platform-harness.mjs"
  "scripts/lib/workspace.mjs"
  "scripts/docs-maintenance/collect-evidence.mjs"
  "scripts/docs-maintenance/start-copilot-task.mjs"
  "scripts/sync/claude-settings.sh"
  "scripts/sync/githooks.sh"
  "scripts/sync/github-templates.sh"
  "scripts/sync/shared-skills.sh"
  "scripts/workspace/bootstrap.mjs"
  "scripts/workspace/doctor.mjs"
  "scripts/workspace/fetch.mjs"
  "scripts/workspace/update.mjs"
  "scripts/workspace/status.mjs"
  "scripts/workspace/branch.mjs"
  "scripts/workspace/validate.mjs"
  "scripts/workspace/change-set.mjs"
  "scripts/workspace/pr-plan.mjs"
  "scripts/workspace/open-pr.mjs"
  "docs/agent-harness/agent-handoff-policy.md"
  "docs/agent-harness/conventional-commits.md"
  "docs/agent-harness/DEVELOPMENT.md"
  "docs/agent-harness/docs-maintenance.md"
  "docs/agent-harness/harness-adoption-guide.md"
  "docs/agent-harness/openai-harness-engineering.md"
  "docs/agent-harness/repository-capability-summary.md"
  "docs/agent-harness/skill-authoring-guide.md"
  "docs/agent-harness/sync.md"
)

for file in "${required_files[@]}"; do
  expect_file "${file}"
done

expect_executable ".githooks/commit-msg"
expect_executable ".githooks/pre-commit"
expect_executable "scripts/harness/check-sync-drift.mjs"
expect_executable "scripts/sync/githooks.sh"

expect_dir ".agents/skills/shared"
expect_absent_path "templates"

for skill_dir in "${ROOT_DIR}"/.agents/skills/shared/*; do
  [[ -d "${skill_dir}" ]] || continue
  skill_name="$(basename "${skill_dir}")"
  skill_file="${skill_dir}/SKILL.md"
  workflow_file="${skill_dir}/workflow.md"

  if [[ ! -f "${skill_file}" ]]; then
    failures+=("Skill ${skill_name} missing SKILL.md")
    continue
  fi
  if [[ ! -f "${workflow_file}" ]]; then
    failures+=("Skill ${skill_name} missing workflow.md")
  fi
  if ! grep -Eq '^name: acornops-[a-z0-9-]+$' "${skill_file}"; then
    failures+=("Skill ${skill_name} must use an acornops-* name")
  fi
  if ! grep -Eq '^description: .{40,}$' "${skill_file}"; then
    failures+=("Skill ${skill_name} must include a specific description")
  fi
  if ! grep -Fq "# Inputs" "${skill_file}"; then
    failures+=("Skill ${skill_name} missing Inputs section")
  fi
  if ! grep -Fq "# Procedure" "${skill_file}"; then
    failures+=("Skill ${skill_name} missing Procedure section")
  fi
  if ! grep -Fq "# Outputs" "${skill_file}"; then
    failures+=("Skill ${skill_name} missing Outputs section")
  fi
done

expect_contains ".gitignore" "/control-plane/"
expect_contains ".gitignore" "/docs-website/"
expect_contains ".gitignore" "/security/"
expect_contains ".gitignore" "/change-sets/active/*.md"
expect_contains ".gitignore" "/change-sets/completed/*.md"
expect_contains "CLAUDE.md" "@AGENTS.md"
expect_contains "README.md" "What Stays In Each Product Repo"
expect_contains "README.md" "Agent-Assisted Development"
expect_contains "README.md" "workspace root for best results"
expect_contains "README.md" "task setup"
expect_contains "README.md" "task workspace:bootstrap -- --dry-run"
expect_contains "README.md" "task workspace:fetch"
expect_contains "README.md" "task workspace:update"
expect_contains "README.md" "task hooks:setup"
expect_contains "README.md" "docs/system-architecture.md"
expect_contains "README.md" "./scripts/workspace/doctor.mjs"
expect_contains "README.md" "The sync command updates only"
expect_contains "README.md" "vendor-neutral handoff"
expect_contains "README.md" "Conventional Commits 1.0.0"
expect_contains "README.md" 'The parent workspace does not keep a `.agents/skills/local` directory'
expect_contains "AGENTS.md" "Do not stage child repository directories"
expect_contains "AGENTS.md" "task setup"
expect_contains "AGENTS.md" "central tracking issue"
expect_contains "AGENTS.md" "Conventional Commits"
expect_contains "AGENTS.md" "./scripts/workspace/doctor.mjs"
expect_contains "AGENTS.md" "./scripts/workspace/status.mjs"
expect_contains "AGENTS.md" ".agents/skills/local"
expect_contains "AGENTS.md" 'The parent workspace does not use `.agents/skills/local`'
expect_contains "AGENTS.md" "docs/agent-harness/agent-handoff-policy.md"
expect_contains "workspace.yaml" "control-plane"
expect_contains "workspace.yaml" "management-console"
expect_contains "docs/agent-harness/agent-handoff-policy.md" "Conventional Commits"
expect_contains "docs/agent-harness/conventional-commits.md" "scripts/harness/check-conventional-commits.mjs"
expect_contains "docs/agent-harness/conventional-commits.md" ".githooks/commit-msg"
expect_contains "docs/agent-harness/agent-handoff-policy.md" "exact commands run"
expect_contains "docs/agent-harness/harness-adoption-guide.md" "Repo-local harness"
expect_contains "docs/agent-harness/harness-adoption-guide.md" "Workspace harness"
expect_contains "docs/agent-harness/DEVELOPMENT.md" "Documentation Drift Control"
expect_contains ".github/workflows/ci.yml" "branches: [ main ]"
expect_contains "docs/developer-getting-started.md" "task setup"
expect_contains "docs/developer-getting-started.md" "System Architecture"
expect_contains "docs/developer-getting-started.md" "Agent-Assisted Development"
expect_contains "docs/developer-getting-started.md" "task workspace:fetch"
expect_contains "docs/developer-getting-started.md" "task workspace:update"
expect_contains "docs/developer-getting-started.md" "Repo-Local Work"
expect_contains ".agents/skills/README.md" 'do not edit it directly'
expect_contains ".agents/skills/README.md" 'The parent workspace does not keep a `.agents/skills/local` directory'
expect_contains ".agents/skills/shared/contract-change/SKILL.md" "docs/contracts"
expect_contains ".agents/skills/shared/workspace-maintenance/SKILL.md" "workspace.yaml"
expect_contains ".agents/skills/shared/testing-validation/SKILL.md" "handoff evidence"
expect_contains ".agents/skills/shared/cross-repo-change/SKILL.md" "merge order"
expect_contains ".agents/skills/shared/cross-repo-change/workflow.md" "Avoid agent/tool-specific branch prefixes."
expect_contains ".agents/skills/shared/open-pr/SKILL.md" "draft PR"
expect_contains ".agents/skills/shared/open-pr/workflow.md" "check-conventional-commits.mjs"
expect_contains "scripts/sync/shared-skills.sh" "--dry-run"
expect_contains "scripts/sync/claude-settings.sh" "--dry-run"
expect_contains "scripts/sync/claude-settings.sh" "settings.local.json"
expect_contains "scripts/sync/githooks.sh" "--dry-run"
expect_contains "scripts/sync/githooks.sh" "core.hooksPath"
expect_contains ".githooks/commit-msg" "check-conventional-commits.mjs"
expect_contains ".githooks/pre-commit" "check-sync-drift.mjs"
expect_contains "scripts/harness/check-sync-drift.mjs" "shared-skills.sh --dry-run"
expect_contains "scripts/harness/check-sync-drift.mjs" "github-templates.sh --dry-run"
expect_contains "scripts/harness/check-sync-drift.mjs" "claude-settings.sh --dry-run"
expect_contains "scripts/harness/check-sync-drift.mjs" "githooks.sh --dry-run"
expect_contains "docs/agent-harness/sync.md" "check-sync-drift.mjs --all"
expect_contains "scripts/harness/check-platform-harness.mjs" "docs-website"
expect_contains "scripts/harness/check-platform-harness.mjs" "assertSyncedTree"
expect_contains "scripts/harness/check-platform-harness.mjs" "githubTemplateFiles"
expect_contains "scripts/harness/check-conventional-commits.mjs" "Conventional commit checks passed"
expect_contains ".github/workflows/ci.yml" "Validate pull request title"
expect_contains ".github/workflows/ci.yml" "Validate pushed commit messages"
expect_contains ".github/workflows/docs-maintenance.yml" "17 16 * * 5"
expect_contains ".github/workflows/docs-maintenance.yml" "workflow_dispatch"
expect_contains ".github/workflows/docs-maintenance.yml" "Prepare docs maintenance task"
expect_contains ".github/workflows/docs-maintenance.yml" 'runner.temp'
expect_contains ".github/workflows/docs-maintenance.yml" "collect-evidence.mjs"
expect_contains ".github/workflows/docs-maintenance.yml" "COPILOT_AGENT_PAT"
expect_contains ".github/workflows/docs-maintenance.yml" "start-copilot-task.mjs"
expect_contains ".github/pull_request_template.md" "Docs Impact"
expect_contains ".github/PULL_REQUEST_TEMPLATE/cross-repo.md" "Merge order"
expect_contains ".github/PULL_REQUEST_TEMPLATE/docs-maintenance.md" "Docs Maintenance Evidence"
expect_contains ".github/ISSUE_TEMPLATE/cross-repo-change.md" "Affected Repositories"
expect_contains ".github/ISSUE_TEMPLATE/docs-maintenance.md" "documentation and agent-guidance drift"
expect_contains "scripts/sync/github-templates.sh" "--dry-run"
expect_contains "scripts/sync/github-templates.sh" "never"
expect_contains "scripts/docs-maintenance/collect-evidence.mjs" "Docs maintenance evidence"
expect_contains "scripts/docs-maintenance/start-copilot-task.mjs" "create_pull_request"
expect_contains "scripts/workspace/open-pr.mjs" "gh"
expect_contains "change-sets/README.md" "merge order"
expect_contains "change-sets/README.md" "ignored by default"
expect_contains "docs/agent-harness/sync.md" "./scripts/sync/shared-skills.sh --dry-run"
expect_contains "docs/agent-harness/sync.md" "./scripts/sync/claude-settings.sh --dry-run"
expect_contains "docs/agent-harness/sync.md" "./scripts/sync/githooks.sh --dry-run"
expect_contains "docs/agent-harness/docs-maintenance.md" "COPILOT_AGENT_PAT"
expect_contains "docs/agent-harness/docs-maintenance.md" "not uploaded as a GitHub Actions artifact"
expect_contains "docs/agent-harness/docs-maintenance.md" "If no evidence-backed updates are needed"
expect_contains "docs/agent-harness/docs-maintenance.md" "docs: plan docs maintenance task"

legacy_path_pattern="agent-"standards"/"
if grep -R "${legacy_path_pattern}" \
  "${ROOT_DIR}/README.md" \
  "${ROOT_DIR}/AGENTS.md" \
  "${ROOT_DIR}/Taskfile.yml" \
  "${ROOT_DIR}/scripts" \
  "${ROOT_DIR}/.agents" \
  "${ROOT_DIR}/docs/agent-harness" >/dev/null 2>&1; then
  failures+=("Parent-owned workspace files must not reference legacy standards repository paths")
fi

child_repos=(
  "acornops-deployment"
  "control-plane"
  "docs-website"
  "execution-engine"
  "agentk"
  "agentv"
  "llm-gateway"
  "management-console"
)

if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  for repo in "${child_repos[@]}"; do
    if ! git -C "${ROOT_DIR}" check-ignore -q "${repo}/"; then
      failures+=("Child repository ${repo}/ must be ignored by the parent workspace")
    fi
    if [[ -n "$(git -C "${ROOT_DIR}" ls-files -- "${repo}")" ]]; then
      failures+=("Child repository ${repo}/ must not be tracked by the parent workspace")
    fi
  done
fi

if [[ ${#failures[@]} -gt 0 ]]; then
  echo "Agent harness checks failed:"
  printf ' - %s\n' "${failures[@]}"
  exit 1
fi

echo "Agent harness checks passed."
