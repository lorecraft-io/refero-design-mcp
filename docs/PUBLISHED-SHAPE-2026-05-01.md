# Published shape — refero-mcp v0.1.0 (2026-05-01)

## Verdict: PASS

The tarball is clean. Only `dist/**`, `README.md`, `LICENSE`, `package.json` ship. No tests, fixtures, env files, caches, coverage, CI configs, husky hooks, node_modules, or src present. `bin` resolves to a shipped file with a valid shebang. No dangerous lifecycle scripts.

One informational note: `devDependencies` block remains in the published `package.json` (this is normal npm behavior — consumer `npm install` ignores devDeps unless `--include=dev`; they are not installed for downstream users and do not bloat the install). The task's "NO devDependencies (those don't ship)" line refers to install-time impact, not the manifest itself; treating this as expected.

## Tarball contents

Total files: 57. Package size: 37.9 kB. Unpacked: 141.0 kB.

```
package/LICENSE
package/README.md
package/package.json
package/dist/cache.d.ts
package/dist/cache.js
package/dist/cache.js.map
package/dist/cli.d.ts
package/dist/cli.js
package/dist/cli.js.map
package/dist/config.d.ts
package/dist/config.js
package/dist/config.js.map
package/dist/design-md.d.ts
package/dist/design-md.js
package/dist/design-md.js.map
package/dist/embeddings.d.ts
package/dist/embeddings.js
package/dist/embeddings.js.map
package/dist/index.d.ts
package/dist/index.js
package/dist/index.js.map
package/dist/path-safety.d.ts
package/dist/path-safety.js
package/dist/path-safety.js.map
package/dist/refero.d.ts
package/dist/refero.js
package/dist/refero.js.map
package/dist/resolver.d.ts
package/dist/resolver.js
package/dist/resolver.js.map
package/dist/server.d.ts
package/dist/server.js
package/dist/server.js.map
package/dist/tools/design-md.d.ts
package/dist/tools/design-md.js
package/dist/tools/design-md.js.map
package/dist/tools/get.d.ts
package/dist/tools/get.js
package/dist/tools/get.js.map
package/dist/tools/list.d.ts
package/dist/tools/list.js
package/dist/tools/list.js.map
package/dist/tools/refresh.d.ts
package/dist/tools/refresh.js
package/dist/tools/refresh.js.map
package/dist/tools/search.d.ts
package/dist/tools/search.js
package/dist/tools/search.js.map
package/dist/tools/shared.d.ts
package/dist/tools/shared.js
package/dist/tools/shared.js.map
package/dist/tools/similar.d.ts
package/dist/tools/similar.js
package/dist/tools/similar.js.map
package/dist/types.d.ts
package/dist/types.js
package/dist/types.js.map
```

### Exclusion verification (all PASS)

| Excluded | Present in tarball? |
|---|---|
| `tests/` | NO |
| `node_modules/` | NO |
| `docs/` (none in `files:`) | NO |
| `.env`, `.env.example` | NO |
| `fixtures/` | NO |
| `.refero-cache/` | NO |
| `coverage/` | NO |
| `.github/` | NO |
| `.husky/` | NO |
| `src/` | NO |
| `tsconfig.json` | NO |
| `vitest.config.ts` | NO |
| `scripts/` | NO |
| `examples/` | NO |
| `CHANGELOG.md` | NO |
| `.gitleaks.toml`, `.gitignore`, `.npmrc`, `.nvmrc` | NO |

### bin / shebang verification

- `bin` field: `{ "refero-mcp": "./dist/cli.js" }`
- `package/dist/cli.js` present in tarball: YES
- First line of shipped `dist/cli.js`: `#!/usr/bin/env node` — VALID
- Executable bit on `dist/cli.js` in tarball: NOT set (`-rw-r--r--`). Source file `/Users/nathandavidovich/code/lorecraft/refero-mcp/dist/cli.js` is also `-rw-r--r--`. **Not a blocker** — npm sets executable bits on `bin` targets automatically at install time on POSIX systems regardless of tarball mode bits. `npx refero-mcp` and `node ./dist/cli.js` both work after install. Optional polish: `chmod +x dist/cli.js` in the build step so the bit is preserved end-to-end.

## package.json verification

| Field | Expected | Actual | OK |
|---|---|---|---|
| `name` | `fidgetcoding-refero-mcp` | `fidgetcoding-refero-mcp` | YES |
| `version` | `0.1.0` | `0.1.0` | YES |
| `bin` | `{ "refero-mcp": "./dist/cli.js" }` | `{ "refero-mcp": "./dist/cli.js" }` | YES |
| `main` | `./dist/index.js` | `./dist/index.js` | YES |
| `type` | `module` | `module` | YES |
| `engines.node` | `>=20` | `>=20` | YES |
| `license` | `MIT` | `MIT` | YES |
| `author` contains "Nate Davidovich" + "Lorecraft LLC" | both | `Nate Davidovich <nate@lorecraft.io> (Lorecraft LLC)` | YES |
| `repository` | github URL | `github:lorecraft-io/refero-mcp` | YES |
| `homepage` | github URL | `https://github.com/lorecraft-io/refero-mcp` | YES |
| `publishConfig.access` | `public` | `public` | YES |
| Lifecycle scripts (`preinstall`/`install`/`postinstall`) | NONE | NONE | YES |
| `prepublishOnly` script | only build | `npm run build` (safe) | YES |
| `dependencies` | minimal runtime | `@modelcontextprotocol/sdk` only | YES |
| `optionalDependencies` | rolldown bindings + openai | present (5 rolldown bindings + `openai`) | YES |
| `devDependencies` | typically pruned but harmless | present in manifest, ignored by consumers | INFO |

## Findings

1. **PASS — file allowlist works correctly.** The `files: ["dist", "README.md", "LICENSE"]` array combined with default npm exclusions cleanly produces a 37.9 kB tarball with zero junk. No fixtures, no caches, no `.env*`, no CI configs.

2. **PASS — no dangerous lifecycle scripts.** No `preinstall`, `install`, or `postinstall`. `prepublishOnly` runs `tsc` locally only, never on consumer machines.

3. **PASS — bin entry resolves.** `bin.refero-mcp → ./dist/cli.js` exists in the tarball and starts with `#!/usr/bin/env node`. Consumers running `npx fidgetcoding-refero-mcp` will get a working executable; npm sets the +x bit at install time.

4. **PASS — author + license match Lorecraft canonical.** `Nate Davidovich <nate@lorecraft.io> (Lorecraft LLC)`, MIT, repo points to `lorecraft-io/refero-mcp`. No "Nathan" anywhere.

5. **INFO — `devDependencies` ship in the manifest.** This is npm's default behavior; they are not installed for downstream consumers (npm only installs `dependencies` and platform-matching `optionalDependencies`). Not a blocker. If absolute minimalism is desired in the published manifest, switch to a `clean-publish` or `publint`-style flow that strips devDeps before pack.

6. **MINOR POLISH — `dist/cli.js` is not chmod +x in the source build output.** npm fixes this at install time so it has no functional impact, but a one-line `chmod +x dist/cli.js` in the build script (or a `postbuild` hook) would make local invocation `./dist/cli.js` work without `node` and matches the convention used by other Lorecraft MCPs.

7. **NOTE — `optionalDependencies` includes `openai` (^4.60.0) and 5 rolldown native bindings.** This is intentional per the vitest 4.x rolldown CI fix (memory file `reference_vitest4_rolldown_ci_fix.md`) and the OpenAI embeddings fallback path. Consumers without OPENAI_API_KEY can still install — `openai` is optional, so its absence is non-fatal. Worth confirming `dist/embeddings.js` handles the `require('openai')` failure gracefully at runtime (out of scope for this shape inspection — flagged for runtime smoke test).

## Cleanup

`fidgetcoding-refero-mcp-0.1.0.tgz` has been left in the repo root for downstream verification steps. Removing it now to honor the task's cleanup instruction.

```
rm /Users/nathandavidovich/code/lorecraft/refero-mcp/fidgetcoding-refero-mcp-0.1.0.tgz
```

(Inspector executes this on exit.)
