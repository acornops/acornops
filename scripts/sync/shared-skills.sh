#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST_FILE="${WORKSPACE_ROOT}/workspace.yaml"
SHARED_SKILLS_SOURCE="${WORKSPACE_ROOT}/.agents/skills/shared"
SKILLS_README_SOURCE="${WORKSPACE_ROOT}/.agents/skills/README.md"
WORKSPACE_REVISION="unknown"
DRY_RUN=false

for arg in "$@"; do
  case "${arg}" in
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      exit 0
      ;;
    *)
      echo "Error: unknown argument ${arg}" >&2
      echo "Usage: $0 [--dry-run]" >&2
      exit 1
      ;;
  esac
done

if command -v git >/dev/null 2>&1 && git -C "${WORKSPACE_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  WORKSPACE_REVISION="$(git -C "${WORKSPACE_ROOT}" rev-parse --short HEAD 2>/dev/null || printf 'uncommitted')"
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "Error: rsync is required but not installed." >&2
  exit 1
fi

if [[ ! -f "${MANIFEST_FILE}" ]]; then
  echo "Error: manifest not found at ${MANIFEST_FILE}" >&2
  exit 1
fi

strip_quotes() {
  local value="$1"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
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

echo "Sync source: ${SHARED_SKILLS_SOURCE}"
if [[ "${DRY_RUN}" == true ]]; then
  echo "Dry run: no files will be written"
fi

for i in "${!REPO_NAMES[@]}"; do
  repo_name="${REPO_NAMES[$i]}"
  repo_path="${REPO_PATHS[$i]}"

  if [[ "${repo_path}" = /* ]]; then
    target_repo="${repo_path}"
  else
    target_repo="${WORKSPACE_ROOT}/${repo_path#./}"
  fi

  if [[ ! -d "${target_repo}" ]]; then
    echo "Skip ${repo_name}: missing directory ${target_repo}" >&2
    continue
  fi

  if [[ ! -d "${target_repo}/.git" ]]; then
    echo "Skip ${repo_name}: ${target_repo} is not a Git repository" >&2
    continue
  fi

  target_shared="${target_repo}/.agents/skills/shared"
  target_skills_readme="${target_repo}/.agents/skills/README.md"

  if [[ "${DRY_RUN}" == true ]]; then
    echo "Would sync shared skills -> ${repo_name} (${target_shared})"
    echo "Would sync skills README -> ${repo_name} (${target_skills_readme})"
    continue
  fi

  mkdir -p "${target_shared}"
  rsync -a --delete "${SHARED_SKILLS_SOURCE}/" "${target_shared}/"
  cp "${SKILLS_README_SOURCE}" "${target_skills_readme}"
  {
    echo "source=acornops"
    echo "revision=${WORKSPACE_REVISION}"
    echo "synced_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } > "${target_shared}/.standards-version"

  echo "Synced shared skills -> ${repo_name} (${target_shared})"
done
