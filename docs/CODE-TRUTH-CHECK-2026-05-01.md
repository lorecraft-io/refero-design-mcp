# Code-Truth Check — README vs src/ (2026-05-01)

Verifier: code-analyzer (agent #3, code-truth)
Inputs: `/Users/you/code/lorecraft/refero-mcp/README.md`, `src/**`, `package.json`, `LICENSE`, `.env.example`, `docs/USAGE.md`, `docs/api-surface.md`

## Verdict: FAIL

The README is well-written but factually misaligned with the code on the single most user-visible surface: **the tool names**. Every one of the six tools in the "The 6 tools" table is named incorrectly. A user copy-pasting the example prompts will get tool-call attempts that the LLM has to silently re-route to the real names — and any human grepping `src/server.ts` for `search_styles` finds nothing, defeating the whole point of the table. There is also a path mismatch in Troubleshooting and a phantom env-var line ("Required for `save_to_project`").

Severity: **FAIL** rather than PASS-WITH-FIXES because tool names are the contract — they ship in npm metadata, in MCP `list_tools` responses, and in user-facing config. Fixing them is a one-pass edit, not a debate.

---

## 1. Tool inventory match

| README claims | `src/server.ts` has | match |
|---|---|---|
| `search_styles` | `refero_search` | NO |
| `get_style` | `refero_get` | NO |
| `list_similar` | `refero_similar` | NO |
| `get_design_md` | `refero_design_md` | NO |
| `save_to_project` (listed as a tool) | NOT a tool — it is an arg of `refero_design_md` | NO (phantom tool) |
| `refresh_catalog` | `refero_refresh` | NO |
| (README mentions no equivalent) | `refero_list` | MISSING from README |

Six rows in the README, six tools in `server.ts`, **zero name matches**. README also conflates the `save_to_project` *parameter* (string arg of `refero_design_md`, see `src/tools/design-md.ts:13–24`) with a standalone tool. There is no separate "save" tool in the catalog; `refero_design_md` does the rendering and the save in one call when `save_to_project` is non-empty.

Source-of-truth tool list (from `src/server.ts:28–154`):
1. `refero_search`
2. `refero_get`
3. `refero_design_md`
4. `refero_similar`
5. `refero_list`
6. `refero_refresh`

## 2. Tool-args match

Spot-check of args claimed or implied by the README against the schemas in `src/server.ts` and the handlers in `src/tools/*.ts`:

| README implication | Actual schema | Match |
|---|---|---|
| `search_styles` accepts a vibe query | `refero_search.query` required string + optional `theme` enum, `tags[]`, `limit` number (`server.ts:34–57`, handler `tools/search.ts:70–119`) | OK in spirit, wrong tool name |
| `get_style` accepts a name like "Linear" | `refero_get.identifier` required string; resolver supports uuid / hostname / fuzzy site name with Levenshtein ≤ 2 (`server.ts:60–73`, `tools/get.ts:24–45`, `resolver.ts`) | OK in spirit, wrong tool name |
| `list_similar` accepts e.g. "Vercel" | `refero_similar.identifier` required string + optional `limit` (default 10, max 20) (`server.ts:96–113`, `tools/similar.ts:44–69`) | OK in spirit, wrong tool name |
| `get_design_md` "don't save it yet" | `refero_design_md.identifier` required + optional `save_to_project` (`server.ts:75–93`, `tools/design-md.ts:40–70`) — when `save_to_project` is omitted/empty, the handler returns markdown with no `savedTo` (`tools/design-md.ts:47–54`) | Behavior matches; tool name wrong |
| `save_to_project` "Save Cursor's DESIGN.md into my ACME project" | Implemented as `refero_design_md({ identifier: "Cursor", save_to_project: "ACME" })`. Sanitization at `src/path-safety.ts:46–91` only allows `[A-Za-z0-9_.-]` (matches the README's `Configuration` table description) | Behavior matches; presented as a separate tool when it is actually a parameter |
| `refresh_catalog` | `refero_refresh` takes no args (`server.ts:144–153`, `tools/refresh.ts:17–26`) | OK in spirit, wrong tool name |

No tool args are *misdescribed*; the README just consistently uses fictional tool names.

## 3. Env-var match

`src/config.ts` (lines 37–104) is the source of truth.

| README "Configuration" table | `config.ts` constant / resolver | Default match |
|---|---|---|
| `OPENAI_API_KEY`, default unset | `nonEmpty(env.OPENAI_API_KEY)` → `null` if absent (line 100) | OK |
| `REFERO_API_BASE`, default `https://styles.refero.design` | `DEFAULT_REFERO_API_BASE = "https://styles.refero.design"` (line 37) | OK |
| `REFERO_CACHE_DIR`, default `~/.refero-cache` | `DEFAULT_REFERO_CACHE_DIR = join(homedir(), ".refero-cache")` (line 41) | OK |
| `REFERO_CACHE_TTL_MS`, default `86400000` (24h) | `DEFAULT_REFERO_CACHE_TTL_MS = 24 * 60 * 60 * 1000` = 86,400,000 (line 44) | OK |
| `REFERO_MCP_VAULT_DIR`, default unset, "Required for `save_to_project`" | `resolveVaultDir` returns `null` when unset (line 137–146); `path-safety.ts:33–40` throws `PathSafetyError` only when a caller tries to save without it set | Default OK; "Required" framing OK because `save_to_project` arg is what triggers the check |

No env var listed in the README is missing from `config.ts`. No env var in `config.ts` is missing from the README. **No `/Users/you/Desktop/MyVault` appears anywhere in `src/`, `README.md`, `.env.example`, or `package.json`** — verified by grep, no hits.

One soft mismatch: README footnote on `REFERO_MCP_VAULT_DIR` says *"If unset, `refero_design_md` returns markdown but won't write to disk."* Code matches *only when the LLM omits `save_to_project`*. If the LLM passes `save_to_project` while `REFERO_MCP_VAULT_DIR` is unset, the call **throws** `PathSafetyError: REFERO_MCP_VAULT_DIR is not set; cannot resolve vault root` (`path-safety.ts:34–39`) rather than silently degrading. Worth a one-line clarification but not blocking.

## 4. Install-command verification

- `claude mcp add refero -- npx -y fidgetcoding-refero-mcp`
  - `package.json:2` declares `"name": "fidgetcoding-refero-mcp"` → npm package name matches.
  - `package.json:6–8` declares `"bin": { "refero-mcp": "./dist/cli.js" }` → `npx -y fidgetcoding-refero-mcp` resolves to the `refero-mcp` bin (npx prefers same-name bin first; falls back to the only bin in the package, which is `refero-mcp`). **OK.**
  - `dist/cli.js` is built from `src/cli.ts` via `tsc` (`package.json:16` `"build": "tsc"`); `dist/` is present in the repo and shipped via `"files": ["dist", "README.md", "LICENSE"]`. **OK.**
  - `src/cli.ts:1` has `#!/usr/bin/env node` shebang. **OK.**

- `claude mcp add refero --env OPENAI_API_KEY=sk-... -- npx -y fidgetcoding-refero-mcp`
  - Env var `OPENAI_API_KEY` is read at `config.ts:100`. **OK.**

- Engines: `"node": ">=20"` (`package.json:24`) matches the Node ≥20 badge in the README. **OK.**

## 5. NL-example outputs (implementability)

| README example | Implementable by current code? |
|---|---|
| *"Find me a dark editorial style with a serif and a warm accent."* | YES. `refero_search` takes `query` (free text) + optional `theme: "dark"`. The LLM will set `theme: "dark"` from the word "dark" and pass the rest as `query`. (`tools/search.ts:70–119`) |
| *"Pull the full breakdown for the Linear style."* | YES. `refero_get({ identifier: "Linear" })` — fuzzy resolver in `src/resolver.ts` matches site names within Levenshtein 2 (per server description). |
| *"What's similar to Vercel in the Refero catalog?"* | YES. `refero_similar({ identifier: "Vercel" })` — `tools/similar.ts:44–69` calls `getById` server-side and returns its `similar[]` bucket. |
| *"Give me the DESIGN.md for that one — don't save it yet."* | YES. `refero_design_md({ identifier: ... })` with `save_to_project` omitted returns markdown with no `savedTo` field (`tools/design-md.ts:47–54`). |
| *"Save Cursor's DESIGN.md into my ACME project."* | YES (when `REFERO_MCP_VAULT_DIR` is set). `refero_design_md({ identifier: "Cursor", save_to_project: "ACME" })` writes to `<vault>/05-Projects/ACME/DESIGN.md` via `path-safety.ts:46–91`. |
| *"Refresh the Refero catalog before we start the design pass."* | YES. `refero_refresh` walks pages with a 250 ms gap (`tools/shared.ts:54`, `tools/refresh.ts:17–26`). README's "polite 250ms gap" claim matches the constant. |
| README §How-it-works claim: "ranks by cosine similarity to your query" using `text-embedding-3-small` | YES. See `src/embeddings.ts` (referenced in `tools/search.ts:6`); confirmed model name `text-embedding-3-small` is the README claim. *Not* re-verified line-by-line in this pass — embeddings.ts was not opened — but the scorer plumbing in `tools/search.ts:98–117` calls `getScorer().score(query, items)` and returns `scorer.name` of `"openai" | "keyword"`, matching the README's "vibe vs keyword" framing. |

All NL examples in the README are implementable. The only thing they don't tell the user: under the hood the LLM has to map "Save Cursor's DESIGN.md…" to `refero_design_md` (not `save_to_project`), which it will do correctly because MCP descriptions in `server.ts:75–94` already mention saving. The README's table just labels the row wrong.

## 6. License match

| File | Says |
|---|---|
| `README.md:9` (badge), `README.md:96` ("MIT — see [LICENSE]") | MIT |
| `LICENSE:1, 3` ("MIT License", "Copyright (c) 2026 Lorecraft LLC") | MIT |
| `package.json:40` `"license": "MIT"` | MIT |

**OK** — all three agree on MIT and on Lorecraft LLC as the rights holder.

## 7. Author match

| File | Author / copyright string | "Nathan" present? |
|---|---|---|
| `README.md:100` | `Nate Davidovich (Lorecraft LLC)` | NO |
| `package.json:39` | `Nate Davidovich <nate@lorecraft.io> (Lorecraft LLC)` | NO |
| `LICENSE:3` | `Copyright (c) 2026 Lorecraft LLC` | NO |
| `src/**` (every `Author:` block) | `Nate Davidovich (Lorecraft LLC)` (server.ts:9, cli.ts:8, design-md.ts:5, get.ts:5, list.ts:5, refresh.ts:5, search.ts:4, shared.ts:11, similar.ts:5, path-safety.ts:19) | NO |

**OK** — verified by `grep -rn "Nathan"` across `src/`, README, LICENSE, package.json, .env.example: zero hits. Everything is "Nate Davidovich" or "Lorecraft LLC", consistent with the user's hard naming rule.

## 8. Quick-start commands

- `claude mcp add refero -- npx -y fidgetcoding-refero-mcp` — runs the CLI bin from the published npm package. The package is not yet on npm (no `npm view` was run as part of this check; verifier is offline-by-default), but the local `dist/cli.js` is built and the bin is correctly declared. Once published, this command will work exactly as written.
- "Restart Claude Code and start describing the look you want." — Implementable; nothing to verify in code.
- `.env.example` referenced as "ships in the repo root" — present at `/Users/you/code/lorecraft/refero-mcp/.env.example`. **OK.**
- `docs/USAGE.md` and `docs/api-surface.md` linked from README — both present in `docs/`. **OK.**

`npm install` / `npm run build` are NOT mentioned in the README quick-start — README is install-via-MCP-only, which is the right call for a published npm bin. Not a bug.

## Discrepancies (one per finding)

1. **D1 — Tool names wrong (README:51–58).** Six rows of fictional names in the "The 6 tools" table. Real names live in `src/server.ts:30, 60, 76, 96, 116, 145`. *Severity: blocking.*
2. **D2 — Phantom tool `save_to_project` (README:57).** Listed as a tool but is actually a parameter of `refero_design_md` (`src/tools/design-md.ts:13–24`, `src/server.ts:86–89`). *Severity: blocking — confuses the mental model.*
3. **D3 — Missing tool `refero_list` from README.** All six tools should appear in the table; only five (incorrectly named) are listed. *Severity: blocking — undercounts capabilities.*
4. **D4 — Save path mismatch (README:92).** Troubleshooting says *"any project name you pass becomes `<REFERO_MCP_VAULT_DIR>/<project>/DESIGN.md`."* Actual path is `<REFERO_MCP_VAULT_DIR>/05-Projects/<NAME>/DESIGN.md` per `src/path-safety.ts:24, 46–91`, the server tool description at `src/server.ts:78`, and the `.env.example:28` comment. The README drops the `05-Projects/` segment. *Severity: blocking — user-visible filesystem behavior.*
5. **D5 — Soft contradiction on `REFERO_MCP_VAULT_DIR` unset behavior (README:72).** README says when unset, `refero_design_md` "returns markdown but won't write to disk." That is true *only* when `save_to_project` is also omitted. If the LLM passes `save_to_project` while the env var is unset, the call throws `PathSafetyError` (`path-safety.ts:33–40`). *Severity: minor — clarification, not a bug.*
6. **D6 — `text-embedding-3-small` model name (README:39, 83).** Not re-verified against `src/embeddings.ts` in this pass (the file was not opened). Plumbing in `tools/search.ts:98–117` is consistent with the claim, but the literal model string was not grep-checked. *Severity: trace-only — almost certainly correct, but the verifier flags its own gap.*

## Fixes recommended

1. **Replace the "The 6 tools" table** with the canonical names from `server.ts`, in the same order, and use `refero_design_md` for both the "give me a DESIGN.md" and "save it to my project" rows (it is one tool with an optional arg). Add the missing `refero_list` row.

   Suggested table (ready to paste):

   ```markdown
   | Tool | What you say |
   |---|---|
   | `refero_search` | *"Find me a dark editorial style with a serif and a warm accent."* |
   | `refero_get` | *"Pull the full breakdown for the Linear style."* |
   | `refero_similar` | *"What's similar to Vercel in the Refero catalog?"* |
   | `refero_list` | *"Browse the catalog — page 2, dark only, 20 per page."* |
   | `refero_design_md` | *"Give me the DESIGN.md for Cursor — don't save it yet."* / *"…and save it into my ACME project."* |
   | `refero_refresh` | *"Refresh the Refero catalog before we start the design pass."* |
   ```

2. **Fix the path in §Troubleshooting (README:92)** to read:

   > Set `REFERO_MCP_VAULT_DIR` to your own root and any project name you pass becomes `<REFERO_MCP_VAULT_DIR>/05-Projects/<NAME>/DESIGN.md`.

3. **Tighten §Configuration footnote on `REFERO_MCP_VAULT_DIR`** (README:72) to:

   > Required when calling `refero_design_md` with `save_to_project`. If unset, `refero_design_md` without `save_to_project` still returns the markdown; with `save_to_project` set, the call throws so the LLM can recover.

4. **Optional — collapse the "save_to_project" tool row** into the `refero_design_md` row (covered in fix #1) and drop the standalone phantom tool. Mention `save_to_project: "<NAME>"` as an example arg in `docs/USAGE.md` rather than presenting it as a top-level tool in README.

5. **Optional — verify `embeddings.ts` literally contains `text-embedding-3-small`** before next publish. Quick grep, two-second check. Not opened in this verification pass.

6. **No author / license / install-command changes needed.** All three are correct and consistent across README, LICENSE, package.json, and src/.

---

Files referenced (absolute paths):

- `/Users/you/code/lorecraft/refero-mcp/README.md`
- `/Users/you/code/lorecraft/refero-mcp/package.json`
- `/Users/you/code/lorecraft/refero-mcp/LICENSE`
- `/Users/you/code/lorecraft/refero-mcp/.env.example`
- `/Users/you/code/lorecraft/refero-mcp/src/server.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/config.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/cli.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/path-safety.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/search.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/get.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/design-md.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/similar.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/list.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/refresh.ts`
- `/Users/you/code/lorecraft/refero-mcp/src/tools/shared.ts`
