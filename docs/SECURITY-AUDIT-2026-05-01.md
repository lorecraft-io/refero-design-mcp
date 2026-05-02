# /safetycheck — refero-mcp v0.1.0 (2026-05-01)

## Verdict: PASS

Clean across every sweep that gates a public npm publish. Tarball ships only `dist/`, `README.md`, `LICENSE`, `package.json`. Zero secrets. Zero hardcoded dev paths in shipped artifacts. Zero npm vulns.

## Sweep results

- gitleaks: PASS (0 findings, 802.65 KB scanned in `--no-git` working-tree mode)
- regex panel: PASS (0 hits across 7 token patterns + BRAIN2 path search)
- npm audit: PASS (0 vulns — info 0 / low 0 / moderate 0 / high 0 / critical 0; 247 deps)
- tarball contents: PASS (57 files, all under `package/dist/**` plus `package/README.md`, `package/LICENSE`, `package/package.json`)
- .gitignore: PASS (all required entries present)
- permissions: PASS (`scripts/security-scan.sh` and `.husky/pre-commit` both `-rwxr-xr-x`)
- hardcoded dev paths: PASS in shipped files (zero hits in `src/path-safety.ts`, `dist/path-safety.js`, `README.md`, `LICENSE`, `package.json`, and confirmed clean inside the actual tarball for `dist/path-safety.js`, `README.md`, `package.json`, `LICENSE`)

## Detailed findings

### gitleaks

Initial `gitleaks detect --source .` reported "not a git repository" — the working tree at `/Users/nathandavidovich/code/lorecraft/refero-mcp` has no `.git` directory (this submodule is tracked from the parent vault repo, not as its own git root). Re-ran with `--no-git` flag to scan the working tree directly:

```
INF scanned ~802652 bytes (802.65 KB) in 83.3ms
INF no leaks found
EXIT=0
```

No findings. Note for future audits: when refero-mcp gets its own dedicated git history (post-publish, when split out), re-run gitleaks without `--no-git` for full-history coverage.

### Regex panel

Custom 8-pattern sweep across the working tree (excluding `node_modules/`, `dist/`, `coverage/`, `.git`):

- `sk-[A-Za-z0-9]{20,}` — 0 hits
- `ghp_[A-Za-z0-9]{36}` — 0 hits
- `glpat-[A-Za-z0-9_-]{20,}` — 0 hits
- `xox[baprs]-[A-Za-z0-9-]+` — 0 hits
- `AKIA[0-9A-Z]{16}` — 0 hits
- `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` (JWT) — 0 hits
- `npm_[A-Za-z0-9]{36}` — 0 hits
- Literal `/Users/nathandavidovich/Desktop/BRAIN2` — 2 hits, both in `docs/REVIEW-2026-05-01.md` (lines 20 and 139), both inside the prior reviewer's prose flagging this exact issue. **Not in any shipped file.** `package.json#files` is `["dist", "README.md", "LICENSE"]`, so `docs/` is excluded from the tarball — verified by inspecting the actual `npm pack` output.

### npm audit

```json
{
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 },
    "dependencies": { "prod": 94, "dev": 125, "optional": 88, "total": 247 }
  }
}
```

Zero vulnerabilities at any severity. Production dep tree is anchored on `@modelcontextprotocol/sdk@^1.0.0`. Optional deps include `openai@^4.60.0` and the rolldown bindings hoisted at the top level (per the morgen-mcp vitest 4.x CI fix).

### Tarball inspection

`npm pack --dry-run` output: 57 files, 37.9 kB packed / 141.0 kB unpacked. Filename `fidgetcoding-refero-mcp-0.1.0.tgz`.

Sorted contents (all `package/` prefixed):

- `package/LICENSE`
- `package/README.md`
- `package/package.json`
- `package/dist/cache.{d.ts,js,js.map}`
- `package/dist/cli.{d.ts,js,js.map}`
- `package/dist/config.{d.ts,js,js.map}`
- `package/dist/design-md.{d.ts,js,js.map}`
- `package/dist/embeddings.{d.ts,js,js.map}`
- `package/dist/index.{d.ts,js,js.map}`
- `package/dist/path-safety.{d.ts,js,js.map}`
- `package/dist/refero.{d.ts,js,js.map}`
- `package/dist/resolver.{d.ts,js,js.map}`
- `package/dist/server.{d.ts,js,js.map}`
- `package/dist/tools/{design-md,get,list,refresh,search,shared,similar}.{d.ts,js,js.map}`
- `package/dist/types.{d.ts,js,js.map}`

Verified: no `tests/`, no `docs/`, no `examples/`, no `.env*`, no fixtures, no `coverage/`, no `node_modules/`, no `scripts/`, no `.husky/`, no `vitest.config.ts`, no `tsconfig.json`, no `package-lock.json`, no `CHANGELOG.md`. Clean.

`dist/cli.js` shebang and header verified — proper `#!/usr/bin/env node` + Lorecraft byline (no "Nathan").

Generated tarball was deleted post-inspection.

### .gitignore audit

All required entries present:

- `node_modules/` — yes
- `dist/` — yes
- `*.tsbuildinfo` — yes
- `.env*` — yes (covers `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development`)
- `coverage/` — yes
- `.refero-cache/` — yes
- `.DS_Store` — yes

Bonus coverage: `*.pem`, `*.key`, `*.cert`, `*.p12`, `*.pfx`, `credentials.json`, `.claude-flow/`, `.ruflo/`, `.claude/`, `.mcp.json`, `CLAUDE.md`, editor cruft, and `refero-mcp.md` (vault-side index note).

### Permissions

- `scripts/security-scan.sh` — `-rwxr-xr-x` (exec bit set)
- `.husky/pre-commit` — `-rwxr-xr-x` (exec bit set)

Both correct.

### Hardcoded dev paths in shipped files

`grep -n "BRAIN2\|nathandavidovich/Desktop"` against `src/path-safety.ts`, `dist/path-safety.js`, `README.md`, `LICENSE`, `package.json` → 0 hits.

Confirmed inside the actual generated tarball (`tar -xOzf … | grep`):

- `package/dist/path-safety.js` — CLEAN
- `package/README.md` — CLEAN
- `package/package.json` — CLEAN
- `package/LICENSE` — CLEAN

The earlier `docs/REVIEW-2026-05-01.md` flag has been resolved in the actual code/dist before this audit ran. The two BRAIN2 references that remain are inside the review document itself describing the now-fixed problem, and that document is not in `files:`, so it never reaches npm.

## Recommendation

**SHIP**

All seven gating sweeps PASS. The tarball is minimal (37.9 kB, 57 files), contains only the four expected top-level entries (`LICENSE`, `README.md`, `package.json`, `dist/`), carries zero secrets, zero high+ vulns, and zero hardcoded developer paths. `.gitignore` is complete, exec bits are correct on `scripts/` and `.husky/`, and the prior reviewer's `path-safety.ts` BRAIN2 default has been remediated upstream of this audit (verified clean in both source and dist).

Cleared for `npm publish --access public` of `fidgetcoding-refero-mcp@0.1.0`.
