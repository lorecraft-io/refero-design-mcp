# Contributing to refero-mcp

Short version: this is a small MCP server that wraps a beta third-party catalog. Most issues here will be parsing bugs (the Refero API has no public spec) or tool-shape tweaks. PRs welcome, but read this first.

---

## Run it locally

```bash
git clone https://github.com/lorecraft-io/refero-design-mcp.git
cd refero-design-mcp
npm install
npm run build
```

Dev loop:

```bash
npm run dev          # tsx, no build step
npm test             # vitest, full suite
npm run test:watch   # leave running while editing
npm run typecheck    # strict tsc, no emit
```

`npm test` and `npm run typecheck` both must be green before you push. CI runs the same two commands.

---

## Adding a new tool (the 6-tool pattern)

The server registers six tools today: `refero_search`, `refero_get`, `refero_similar`, `refero_list`, `refero_design_md`, `refero_refresh`. If you need a seventh, follow the existing shape — don't invent a new convention.

1. **Handler file.** Create `src/tools/<name>.ts`. Export a single `handle<Name>(args)` function and a typed `<Name>Args` interface. Validate `args` from `unknown` inside the handler — never trust the caller. See `src/tools/get.ts` for the canonical 50-line example.
2. **Shared helpers.** Use `src/tools/shared.ts` (`ensureCatalog`, `ensureStyle`, `toFullStyleShorthand`) instead of touching the cache or resolver directly. Keep tool files thin.
3. **Register in `src/server.ts`.** Add to the `TOOLS` array with a real `description` (1–3 sentences, plain English, mention defaults), a JSON Schema `inputSchema` with `additionalProperties: false`, and wire the case in the `CallToolRequestSchema` switch.
4. **Tests.** Add `tests/<name>.test.ts` with at least one happy path, one bad-input case, and one cache-cold case. Use the fixtures in `tests/fixtures/` — don't hit the live API in tests.
5. **README.** Add a row to the Tools table and, if relevant, a worked prompt to the Usage section. The README is the contract; if it isn't documented, it doesn't exist.
6. **Author header.** Same comment block every file uses: `Author: Nate Davidovich (Lorecraft LLC)`.

Keep handlers pure where you can. Anything network-y goes through `src/refero.ts` or `src/cache.ts`.

---

## Filing an issue

Parsing bugs are the most common failure mode. The Refero API has no public schema, so when shapes drift, the resolver or `design-md` renderer is usually what breaks first.

If you're reporting a parsing bug, **paste the raw `/api/styles/{uuid}` response** (or the relevant slice — the `designSystem` block is usually enough). Without that I'm guessing at what shape upstream sent you.

For everything else: include the tool name, the args you passed, what you got back, and what you expected.

---

## Pushing changes

Lorecraft repos take direct push to main. No PRs, no branch protection, no review queue — collaborators push and we sort it out in commit history if anything breaks.

If you're outside the org, fork it and open a PR. I'll merge it the same day or tell you why not.

Commit messages: present tense, imperative. One-line rationale is fine. CI must pass.

**Do not append `Co-Authored-By: claude-flow <ruv@ruv.net>` to commits.** That email resolves to ruvnet's GitHub profile and attributes the commit to him. Claude Code's default commit template adds it; strip it before you push. Same for any `ruv*` co-author trailer.

---

## License

MIT. By contributing you agree your changes ship under the same license.

Author: **Nate Davidovich** / Lorecraft LLC — `nate@lorecraft.io`
