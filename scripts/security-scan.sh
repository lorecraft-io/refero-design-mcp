#!/usr/bin/env bash
# security-scan.sh — full-tree gitleaks scan for refero-mcp
#
# Used by:
#   - .husky/pre-commit (staged scan happens there; this is the full-tree scan)
#   - CI (if/when wired into ci.yml)
#   - manual local audit
#
# Exits non-zero on findings.
#
# Author: Nate Davidovich (Lorecraft LLC)

set -euo pipefail

# Resolve repo root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[security-scan] ERROR: gitleaks not found on PATH." >&2
  echo "[security-scan] Install: brew install gitleaks  (macOS) or see https://github.com/gitleaks/gitleaks" >&2
  exit 127
fi

CONFIG="${REPO_ROOT}/.gitleaks.toml"
if [ ! -f "${CONFIG}" ]; then
  echo "[security-scan] ERROR: missing ${CONFIG}" >&2
  exit 2
fi

echo "[security-scan] scanning ${REPO_ROOT} with config ${CONFIG}…"

# --no-banner keeps log clean for CI; --redact ensures any finding doesn't echo
# the secret itself into the log. --no-git scans the working tree (so this
# works on pre-`git init` scaffolds and inside CI checkouts that may have a
# shallow clone).
gitleaks detect \
  --source "${REPO_ROOT}" \
  --config "${CONFIG}" \
  --no-banner \
  --redact \
  --no-git

echo "[security-scan] clean."
