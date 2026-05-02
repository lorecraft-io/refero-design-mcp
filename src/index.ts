/**
 * refero-mcp — public package entry point.
 *
 * Re-exports the stable surface for programmatic consumers. The MCP server
 * itself is launched via `dist/cli.js` (see `bin` in package.json).
 *
 * Anything not re-exported here is internal and may change without a
 * semver bump.
 */

// ---------------------------------------------------------------------------
// Types — canonical Refero API shapes + MCP-internal projections.
// ---------------------------------------------------------------------------
export type {
  // Shared primitives
  ColorScheme,
  HexColor,
  ReferoTimestamp,
  NamedColor,

  // List projection
  StyleListItem,
  StylesListResponse,

  // Detail projection
  ColorToken,
  DesignSystemColor,
  DesignSystem,
  FullResultMeta,
  FullResultRaw,
  FullResult,
  FullStyle,
  StyleDetailResponse,

  // MCP-internal projections
  CatalogEntry,
  CatalogEmbedding,
  SearchHit,

  // Error envelope
  ReferoErrorBody,
} from "./types.js";

export { ReferoApiError } from "./types.js";

// ---------------------------------------------------------------------------
// Config — env-driven runtime configuration.
// ---------------------------------------------------------------------------
export type { ReferoConfig } from "./config.js";
export {
  loadConfig,
  DEFAULT_REFERO_API_BASE,
  DEFAULT_REFERO_CACHE_DIR,
  DEFAULT_REFERO_CACHE_TTL_MS,
} from "./config.js";

// ---------------------------------------------------------------------------
// Server — MCP server factory. Implementation is owned by the Coder agent;
// this barrel re-exports whatever they expose from `./server.ts`.
// ---------------------------------------------------------------------------
export * from "./server.js";
