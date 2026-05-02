#!/usr/bin/env bash
# dev-bootstrap.sh — get a new contributor from `git clone` to passing tests in one command.
#
# Steps:
#   1. Verify Node >= 20
#   2. Verify npm  >= 10
#   3. npm install
#   4. npm run typecheck
#   5. npm run build
#   6. npm test
#   7. Print next-step banner
#
# Idempotent — safe to re-run. Self-locating — works from any cwd.
#
# Author: Nate Davidovich (Lorecraft LLC)

set -euo pipefail

# ---------------------------------------------------------------------------
# Self-locate: cd to repo root regardless of caller's cwd.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Coloured-but-graceful output. Falls back to plain text in non-TTY / NO_COLOR.
# ---------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_RESET="$(tput sgr0)"
  C_BOLD="$(tput bold)"
  C_DIM="$(tput dim 2>/dev/null || printf '')"
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_BLUE="$(tput setaf 4)"
  C_CYAN="$(tput setaf 6)"
else
  C_RESET=""; C_BOLD=""; C_DIM=""
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""
fi

log()   { printf '%s[dev-bootstrap]%s %s\n' "${C_CYAN}"  "${C_RESET}" "$*"; }
step()  { printf '\n%s[dev-bootstrap] ▸ %s%s\n' "${C_BOLD}${C_BLUE}" "$*" "${C_RESET}"; }
ok()    { printf '%s[dev-bootstrap] ✓ %s%s\n' "${C_GREEN}" "$*" "${C_RESET}"; }
warn()  { printf '%s[dev-bootstrap] ! %s%s\n' "${C_YELLOW}" "$*" "${C_RESET}" >&2; }
fail()  { printf '%s[dev-bootstrap] ✗ %s%s\n' "${C_RED}${C_BOLD}" "$*" "${C_RESET}" >&2; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Compare two semver-ish version strings. Returns 0 if $1 >= $2, else 1.
# Uses sort -V which is portable across macOS (BSD) and Linux (GNU).
version_ge() {
  local have="$1" want="$2"
  # If the smallest of {have, want} == want, then have >= want.
  [ "$(printf '%s\n%s\n' "$have" "$want" | sort -V | head -n1)" = "$want" ]
}

# Strip a leading "v" if present (Node prints "v20.11.1").
strip_v() { printf '%s' "${1#v}"; }

# ---------------------------------------------------------------------------
# 1. Verify Node >= 20
# ---------------------------------------------------------------------------
step "Checking Node.js (need >= 20)"
if ! command -v node >/dev/null 2>&1; then
  fail "node not found on PATH."
  echo "      Install Node 20+ via nvm (https://github.com/nvm-sh/nvm) or your package manager." >&2
  echo "      Then re-run: scripts/dev-bootstrap.sh" >&2
  exit 1
fi

NODE_VERSION_RAW="$(node --version 2>/dev/null || echo "v0.0.0")"
NODE_VERSION="$(strip_v "${NODE_VERSION_RAW}")"
log "node: ${C_BOLD}${NODE_VERSION_RAW}${C_RESET}"

if ! version_ge "${NODE_VERSION}" "20.0.0"; then
  fail "Node ${NODE_VERSION_RAW} is too old — refero-mcp requires Node >= 20."
  echo "      Upgrade via nvm:  nvm install 20 && nvm use 20" >&2
  echo "      Or via Homebrew:  brew install node@20" >&2
  exit 1
fi
ok "Node ${NODE_VERSION_RAW}"

# ---------------------------------------------------------------------------
# 2. Verify npm >= 10
# ---------------------------------------------------------------------------
step "Checking npm (need >= 10)"
if ! command -v npm >/dev/null 2>&1; then
  fail "npm not found on PATH."
  echo "      npm normally ships with Node — try reinstalling Node 20+." >&2
  exit 1
fi

NPM_VERSION="$(npm --version 2>/dev/null || echo "0.0.0")"
log "npm:  ${C_BOLD}${NPM_VERSION}${C_RESET}"

if ! version_ge "${NPM_VERSION}" "10.0.0"; then
  fail "npm ${NPM_VERSION} is too old — refero-mcp requires npm >= 10."
  echo "      Upgrade:  npm install -g npm@latest" >&2
  exit 1
fi
ok "npm ${NPM_VERSION}"

# ---------------------------------------------------------------------------
# 3. npm install (idempotent: npm handles already-installed deps)
# ---------------------------------------------------------------------------
step "Installing dependencies (npm install)"
if ! npm install; then
  fail "npm install failed."
  echo "      Common causes:" >&2
  echo "        - Mismatched Node version — check Node version, retry." >&2
  echo "        - Stale lockfile     — try: rm -rf node_modules package-lock.json && npm install" >&2
  echo "        - Network / registry — try: npm config get registry" >&2
  exit 1
fi
ok "Dependencies installed"

# ---------------------------------------------------------------------------
# 4. Typecheck
# ---------------------------------------------------------------------------
step "Type-checking (npm run typecheck)"
if ! npm run typecheck --silent; then
  fail "TypeScript typecheck failed. Fix the errors above and re-run."
  exit 1
fi
ok "Typecheck clean"

# ---------------------------------------------------------------------------
# 5. Build
# ---------------------------------------------------------------------------
step "Building (npm run build)"
if ! npm run build --silent; then
  fail "Build failed. Check tsc output above."
  exit 1
fi
ok "Build artifacts in ${REPO_ROOT}/dist"

# ---------------------------------------------------------------------------
# 6. Test
# ---------------------------------------------------------------------------
step "Running tests (npm test)"
if ! npm test --silent; then
  fail "Tests failed. See vitest output above."
  exit 1
fi
ok "All tests passed"

# ---------------------------------------------------------------------------
# 7. Success banner + next steps
# ---------------------------------------------------------------------------
printf '\n%s════════════════════════════════════════════════════════════════%s\n' "${C_GREEN}${C_BOLD}" "${C_RESET}"
printf '%s ✓ refero-mcp is ready.%s  Node %s · npm %s\n' "${C_GREEN}${C_BOLD}" "${C_RESET}" "${NODE_VERSION_RAW}" "${NPM_VERSION}"
printf '%s════════════════════════════════════════════════════════════════%s\n' "${C_GREEN}${C_BOLD}" "${C_RESET}"
printf '\n%sNext steps:%s\n' "${C_BOLD}" "${C_RESET}"
printf '  %snpm run dev%s          — run the MCP CLI from source (tsx)\n'        "${C_CYAN}" "${C_RESET}"
printf '  %snpm run test:watch%s   — vitest in watch mode\n'                     "${C_CYAN}" "${C_RESET}"
printf '  %snpm run build%s        — compile TS to dist/\n'                      "${C_CYAN}" "${C_RESET}"
printf '  %sscripts/security-scan.sh%s — full-tree gitleaks audit\n'             "${C_CYAN}" "${C_RESET}"
printf '\n%sHappy hacking.%s\n\n' "${C_DIM}" "${C_RESET}"
