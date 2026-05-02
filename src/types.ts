/**
 * refero-mcp — canonical type definitions for styles.refero.design.
 *
 * Empirically reverse-engineered against the live API; there is no public
 * schema. Treat this file as the single source of truth for HTTP shapes.
 *
 * Behavioral quirks captured in types:
 *  - `nextCursor` is always `null`. Pagination is page-based via `nextPage`.
 *  - Server-side filters (`?search=`, `?q=`, `?colorScheme=`) are silently
 *    ignored. The MCP must mirror the catalog locally.
 *  - `createdAt` is **inconsistent**: list returns `"YYYY-MM-DD HH:MM:SS"`
 *    UTC, detail returns ISO 8601. Type as `string` and normalize in code.
 *  - Several detail-only fields (`raw.gradients`, `raw.shapes`, `raw.spacing`,
 *    `raw.typography`, `fullResult.screenshot`, `meta.telemetry`) have not
 *    been schema-locked yet; typed as `unknown` so consumers must narrow.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Light or dark color scheme as reported by Refero. */
export type ColorScheme = "light" | "dark";

/** Hex string, e.g. `"#ff00aa"`. Refero does not guarantee case or `#` prefix
 *  consistency — normalize before comparing. */
export type HexColor = string;

/** ISO 8601 (`2026-05-01T15:04:05.000Z`) on `/api/styles/{uuid}` detail,
 *  or space-separated UTC (`"2026-05-01 15:04:05"`) on `/api/styles?page=N`
 *  list responses. Always store as a raw string and parse on read. */
export type ReferoTimestamp = string;

/** Named color paint as exposed on the list/preview projection. */
export interface NamedColor {
  name: string;
  hex: HexColor;
}

// ---------------------------------------------------------------------------
// LIST projection — `GET /api/styles?page=N`
// ---------------------------------------------------------------------------

export interface StyleListItem {
  id: string;
  url: string;
  siteName: string;

  // Static asset URLs (preview imagery)
  screenshotUrl: string;
  thumbnailUrl: string;
  iconUrl: string | null;

  // Loop preview video (small)
  previewVideoUrl: string;
  previewVideoPosterUrl: string;
  previewVideoWidth: number;
  previewVideoHeight: number;

  // Detail preview video (large)
  previewVideoDetailUrl: string;
  previewVideoDetailPosterUrl: string;
  previewVideoDetailWidth: number;
  previewVideoDetailHeight: number;

  previewVideoDurationMs: number;

  colorScheme: ColorScheme;
  colors: NamedColor[];
  fonts: string[];

  /** Poetic vibe summary written by Refero — the primary natural-language
   *  search anchor. Always present on list items. */
  northStar: string;

  createdAt: ReferoTimestamp;
}

export interface StylesListResponse {
  styles: StyleListItem[];
  /** Always `null` in observed responses. Reserved for forward compatibility. */
  nextCursor: string | null;
  /** Increment until empty; cap reached when `nextPage` is `null`. */
  nextPage: number | null;
}

// ---------------------------------------------------------------------------
// DETAIL projection — `GET /api/styles/{uuid}`
// ---------------------------------------------------------------------------

/** Single color token in `fullResult.raw.colors.tokens[]`. */
export interface ColorToken {
  hex: HexColor;
  oklch: { c: number; h: number; l: number };
  /** Surface usage hints, e.g. `["button","nav","heading"]`. */
  contexts: string[];
  frequency: number;
  confidence: number;
  prominence: number;
  /** CSS properties this token tends to bind to,
   *  e.g. `["borderColor","boxShadow"]`. */
  properties: string[];
}

/** Refined design-system summary used to generate DESIGN.md. */
export interface DesignSystemColor {
  hex: HexColor;
  name: string;
  role: string;
  group: string;
}

export interface DesignSystem {
  dos: string[];
  donts: string[];
  tags: string[];
  theme: ColorScheme;
  colors: DesignSystemColor[];
  fonts?: string[];
}

/** Top-level extraction metadata. */
export interface FullResultMeta {
  url: string;
  siteName: string;
  extractedAt: ReferoTimestamp;
  durationMs: number;
  viewport: { width: number; height: number };
  elementCount: number;
  /** Refero internal telemetry blob — not schema-locked. */
  telemetry: unknown;
}

/** Raw extraction buckets. Only `colors.tokens` is currently typed; the
 *  others are intentionally `unknown` until the shapes stabilize. */
export interface FullResultRaw {
  colors: {
    tokens: ColorToken[];
    /** Refero may attach summary/aggregate fields here in the future. */
    [key: string]: unknown;
  };
  gradients: unknown;
  shapes: unknown;
  spacing: unknown;
  typography: unknown;
}

export interface FullResult {
  meta: FullResultMeta;
  raw: FullResultRaw;
  designSystem: DesignSystem;
  /** Per-page screenshot capture metadata. Not schema-locked. */
  screenshot: unknown;
}

/** Detail projection extends the list projection with industry, capture
 *  metadata, and the full extraction payload. */
export interface FullStyle extends StyleListItem {
  /** e.g. `"ai"`, `"finance"`, `"saas"`. */
  industry: string;
  previewVideoCapturedAt: ReferoTimestamp;
  /** NOTE: detail uses ISO 8601 even though list uses
   *  `"YYYY-MM-DD HH:MM:SS"`. Already typed as `string` upstream. */
  createdAt: ReferoTimestamp;
  fullResult: FullResult;
}

export interface StyleDetailResponse {
  style: FullStyle;
  /** Refero's own similarity ranking — useful as a free recommendation
   *  signal alongside our embedding-based search. */
  similar: StyleListItem[];
}

// ---------------------------------------------------------------------------
// MCP-internal projections
// ---------------------------------------------------------------------------

/** Local catalog entry used by the search index. Built from the list
 *  projection plus optionally enriched detail fields. */
export interface CatalogEntry {
  id: string;
  url: string;
  siteName: string;
  northStar: string;
  colorScheme: ColorScheme;
  colors: NamedColor[];
  fonts: string[];
  /** Only present once detail has been fetched at least once. */
  industry?: string;
  /** Local cache pointers (relative to `REFERO_CACHE_DIR`). */
  cache?: {
    listFetchedAt: ReferoTimestamp;
    detailFetchedAt?: ReferoTimestamp;
    designMdPath?: string;
  };
}

/** Embedding vector for a catalog entry. The dim is whatever the embedding
 *  model produces — store alongside the model name to detect regressions. */
export interface CatalogEmbedding {
  id: string;
  model: string;
  dim: number;
  vector: number[];
}

/** Result of a natural-language search query. */
export interface SearchHit {
  entry: CatalogEntry;
  /** Cosine similarity in `[-1, 1]`, or rank score when no embedding model
   *  is configured (lexical fallback). */
  score: number;
  /** Optional human-readable reason for the match (used by tools). */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Refero error envelope (best-effort — observed shape may evolve)
// ---------------------------------------------------------------------------

export interface ReferoErrorBody {
  error?: string;
  message?: string;
  statusCode?: number;
}

/** Thrown by the HTTP client when Refero returns a non-2xx response. */
export class ReferoApiError extends Error {
  public readonly status: number;
  public readonly body: ReferoErrorBody | string | null;

  constructor(
    message: string,
    status: number,
    body: ReferoErrorBody | string | null,
  ) {
    super(message);
    this.name = "ReferoApiError";
    this.status = status;
    this.body = body;
  }
}
