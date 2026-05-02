# Changelog

All notable changes to `fidgetcoding-refero-mcp` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-01

Initial release. Wraps the (undocumented) `styles.refero.design` API and exposes it to Claude Code as an MCP server.

### Added

- **6 MCP tools:**
  - `refero_search` — natural-language or keyword search across a local mirror of the Refero catalog. Uses OpenAI `text-embedding-3-small` against each style's `northStar` summary when `OPENAI_API_KEY` is set; falls back to keyword scoring otherwise.
  - `refero_get` — fetch full detail (`fullResult.designSystem`, `raw` tokens, `meta`) for one style by uuid, hostname, or site name.
  - `refero_similar` — return Refero's free, server-side similarity ranking for a style id or site name.
  - `refero_list` — paginated browse of the local catalog mirror with optional theme/tag filters.
  - `refero_design_md` — generate a DESIGN.md from `style.fullResult.designSystem`. Returns the markdown body; if `save_to_project` is passed and `REFERO_MCP_VAULT_DIR` is set, also writes to `<vault>/05-Projects/<NAME>/DESIGN.md`.
  - `refero_refresh` — walk the paginated `/api/styles` endpoint, mirror locally, refresh embeddings for new entries.
- **Empirical API surface document** at `docs/api-surface.md` covering both endpoints, all observed query parameters (and which ones are silently ignored), full response shapes, the date-format inconsistency between list and detail, and pagination semantics.
- **Local catalog mirror** under `REFERO_CACHE_DIR` (default `~/.refero-cache`), keyed by style UUID with `createdAt` normalized to ISO 8601.
- **Polite refresh strategy** — 250ms delay between page fetches, single retry on `5xx`, no retry on `4xx`.
- **DESIGN.md generation** from `style.fullResult.designSystem` — dos, donts, tags, theme, role-tagged colors, fonts. Output is compatible with the `/stitch-design-taste` and `/design-taste-frontend` skills.
- **Configurable vault root** via `REFERO_MCP_VAULT_DIR` so `save_to_project` writes to the right place for any user, not just the author.

### Notes

- No public Refero API doc exists as of this release. The contract is empirically derived; see `docs/api-surface.md` for the investigation log.
- Server-side filters (`?search=`, `?q=`, `?colorScheme=`) are silently ignored by Refero — the MCP filters and ranks client-side against the local mirror.
- Rate limits are unobserved; the MCP self-imposes a 250ms inter-page delay during catalog refreshes as a politeness floor.

[0.1.0]: https://github.com/lorecraft-io/refero-design-mcp/releases/tag/v0.1.0
