# Cold-start verification — refero-mcp v0.1.0 (2026-05-01)

## Verdict: PASS

A clean-room install of `fidgetcoding-refero-mcp@0.1.0` from the `npm pack` tarball into a fresh tmp dir boots over stdio, completes the MCP `initialize` handshake, and returns all 6 expected tools on `tools/list`.

## Steps

1. **`npm pack` → tarball size**
   - Output: `fidgetcoding-refero-mcp-0.1.0.tgz`
   - Package size: **37.9 kB** (57 files, 141.0 kB unpacked)
   - shasum: `3e01de2b7252fef056e1b8b6490a8454f77cb92f`

2. **Install in tmp dir → success**
   - tmp dir: `mktemp -d` then `npm init -y` + `npm install <tarball>`
   - Result: `added 117 packages, audited 118 packages in 3s`
   - `found 0 vulnerabilities`
   - One npm warning (informational, upstream): `node-domexception@1.0.0` deprecated — does not affect refero-mcp.
   - Package root contains: `dist/ LICENSE package.json README.md`
   - `dist/` contains: `cli.js`, `server.js`, `refero.js`, `cache.js`, `config.js`, `design-md.js`, `embeddings.js`, `index.js`, `path-safety.js`, `resolver.js`, `types.js`, plus `tools/` directory and matching `.d.ts` + `.js.map` files for each.

3. **Boot via stdio → success**
   - With **closed stdin** (`< /dev/null`): process exits cleanly with `EXIT_CODE=0`. This is correct stdio-MCP behavior: when the client closes stdin the server shuts down. The literal copy/paste from the task spec (`node ... < /dev/null & sleep 2; ps -p $PID`) reports `BOOT_FAIL` for this reason — it's not a bug, just an artifact of feeding `/dev/null` to a stdio server.
   - With **stdin held open** (`(sleep 5; echo) | node dist/cli.js &`): pid stayed alive past 2s → `BOOT_OK_WITH_OPEN_STDIN`. No stderr output. This is the realistic Claude-Desktop / MCP-client scenario.

4. **MCP handshake → response excerpt**

   Request:
   ```json
   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cold-start-test","version":"1"}}}
   ```

   Response:
   ```json
   {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"refero","version":"0.1.0"}},"jsonrpc":"2.0","id":1}
   ```

   Server identifies as `refero@0.1.0`, advertises `tools` capability, agrees on protocol `2024-11-05`.

5. **`tools/list` → 6 tools returned**

   Sent `initialize` + `notifications/initialized` + `tools/list`. Server returned all 6 expected tools:

   | # | Name | One-liner |
   |---|---|---|
   | 1 | `refero_search` | Natural-language search over styles.refero.design (embeddings when `OPENAI_API_KEY` set, BM25-lite fallback otherwise; 24h auto-refresh). |
   | 2 | `refero_get` | Fetch full design system by uuid / hostname / site name (Levenshtein-2 fuzzy match). |
   | 3 | `refero_design_md` | Render a style as agent-friendly `DESIGN.md` (frontmatter, north star, colors, fonts, dos/donts, tags). Optional `save_to_project` writes to `<vault>/05-Projects/<NAME>/DESIGN.md`. |
   | 4 | `refero_similar` | Refero's own "similar styles" list for a given style. |
   | 5 | `refero_list` | Browse the local catalog mirror with optional theme/tag filters; paginated, stably ordered. |
   | 6 | `refero_refresh` | Force a full re-fetch of the catalog and overwrite the local mirror. |

   Each tool returns a complete `inputSchema` (JSON Schema with required fields, enums for `theme`, additionalProperties locked to `false`). No truncation, no malformed JSON, no orphan tools.

## Notes

- **Boot semantics caveat for the runbook.** A literal `node dist/cli.js < /dev/null &` will exit immediately and look like a failure. Future cold-start scripts should hold stdin open (`(sleep N; echo) | node dist/cli.js`) or write at least one JSON-RPC line before backgrounding. The behavior under a real MCP client (Claude Desktop, Cline, etc.) is correct — those clients keep stdin open for the lifetime of the session.
- **No env vars required to boot.** Server initialized successfully without `OPENAI_API_KEY` or any catalog state. First `refero_search` call would trigger lazy catalog mirror + fallback to BM25 ranking; not exercised in this cold-start pass since the goal was protocol-level verification.
- **No stderr noise.** Initialize and `tools/list` both produced clean single-line JSON-RPC responses on stdout with nothing on stderr. Logs are quiet by default — friendly for MCP-client log panes that surface stderr as errors.
- **Package shape is tight.** Only `dist/`, `LICENSE`, `package.json`, `README.md` ship. No `src/`, no tests, no `.git`, no scripts. 37.9 kB packed is reasonable for a 6-tool MCP with embeddings + cache + DESIGN.md rendering.
- **Cleanup verified.** tmp dir removed, `fidgetcoding-refero-mcp-0.1.0.tgz` removed from repo root, helper files in `/tmp/` removed. No `src/` modifications. Repo working tree unchanged except for this file.
