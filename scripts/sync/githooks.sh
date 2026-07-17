#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST_FILE="${WORKSPACE_ROOT}/workspace.yaml"
HOOKS_SOURCE="${WORKSPACE_ROOT}/.githooks"
DRY_RUN=false

usage() {
  cat <<'USAGE'
Usage: ./scripts/sync/githooks.sh [--dry-run]

Configure Git core.hooksPath for the workspace and configured child
repositories so they use the workspace-owned .githooks directory.
USAGE
}

for arg in "$@"; do
  case "${arg}" in
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument ${arg}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${MANIFEST_FILE}" ]]; then
  echo "Error: manifest not found at ${MANIFEST_FILE}" >&2
  exit 1
fi

if [[ ! -d "${HOOKS_SOURCE}" ]]; then
  echo "Error: Git hooks directory not found at ${HOOKS_SOURCE}" >&2
  exit 1
fi

if [[ ! -x "${HOOKS_SOURCE}/commit-msg" ]]; then
  echo "Error: ${HOOKS_SOURCE}/commit-msg must exist and be executable" >&2
  exit 1
fi

shopt -s nullglob
for hook_file in "${HOOKS_SOURCE}"/*; do
  if [[ -f "${hook_file}" && ! -x "${hook_file}" ]]; then
    echo "Error: Git hook ${hook_file} must be executable" >&2
    exit 1
  fi
done
shopt -u nullglob

strip_quotes() {
  local value="$1"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

configure_hooks_path() {
  local repo_name="$1"
  local repo_path="$2"

  if [[ ! -d "${repo_path}" ]]; then
    echo "Skip ${repo_name}: missing directory ${repo_path}" >&2
    return
  fi

  if [[ ! -d "${repo_path}/.git" ]]; then
    echo "Skip ${repo_name}: ${repo_path} is not a Git repository" >&2
    return
  fi

  if [[ "${DRY_RUN}" == true ]]; then
    echo "Would configure Git hooks -> ${repo_name} (${HOOKS_SOURCE})"
    return
  fi

  git -C "${repo_path}" config core.hooksPath "${HOOKS_SOURCE}"
  echo "Configured Git hooks -> ${repo_name} (${HOOKS_SOURCE})"
}

REPO_NAMES=()
REPO_PATHS=()
CURRENT_NAME=""
CURRENT_PATH=""

flush_current() {
  if [[ -z "${CURRENT_NAME}" ]]; then
    return
  fi

  local resolved_path="${CURRENT_PATH}"
  if [[ -z "${resolved_path}" ]]; then
    resolved_path="./${CURRENT_NAME}"
  fi

  REPO_NAMES+=("${CURRENT_NAME}")
  REPO_PATHS+=("${resolved_path}")

  CURRENT_NAME=""
  CURRENT_PATH=""
}

while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
  line="${raw_line%%#*}"

  if [[ "${line}" =~ ^[[:space:]]*-[[:space:]]*name:[[:space:]]*(.+)[[:space:]]*$ ]]; then
    flush_current
    CURRENT_NAME="$(strip_quotes "${BASH_REMATCH[1]}")"
    continue
  fi

  if [[ "${line}" =~ ^[[:space:]]*path:[[:space:]]*(.+)[[:space:]]*$ ]]; then
    CURRENT_PATH="$(strip_quotes "${BASH_REMATCH[1]}")"
    continue
  fi
done < "${MANIFEST_FILE}"

flush_current

if [[ ${#REPO_NAMES[@]} -eq 0 ]]; then
  echo "Error: no repositories parsed from ${MANIFEST_FILE}" >&2
  exit 1
fi

echo "Git hooks source: ${HOOKS_SOURCE}"
if [[ "${DRY_RUN}" == true ]]; then
  echo "Dry run: no Git config will be written"
fi

configure_hooks_path "acornops" "${WORKSPACE_ROOT}"

for i in "${!REPO_NAMES[@]}"; do
  repo_name="${REPO_NAMES[$i]}"
  repo_path="${REPO_PATHS[$i]}"

  if [[ "${repo_path}" = /* ]]; then
    target_repo="${repo_path}"
  else
    target_repo="${WORKSPACE_ROOT}/${repo_path#./}"
  fi

  configure_hooks_path "${repo_name}" "${target_repo}"
done
