/**
 * Shared helpers for tool handlers.
 *
 * - `ensureCatalog()` returns a fresh catalog (refreshing from the network if
 *   stale or absent).
 * - `ensureStyle()` ensures a single FullStyle is in the cache, fetching if
 *   missing/stale.
 * - `toShorthand()` projects a StyleListItem (+ optional score) to the
 *   compact shape used by search/similar/list responses.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import {
  isFresh,
  readCatalog,
  readStyle,
  writeCatalog,
  writeStyle,
} from "../cache.js";
import { getById, listPage } from "../refero.js";
import type {
  ColorScheme,
  FullStyle,
  StyleListItem,
} from "../types.js";

/** Compact projection used by search, similar, list. */
export interface StyleShorthand {
  id: string;
  siteName: string;
  url: string;
  northStar: string;
  theme: ColorScheme;
  tags: string[];
  thumbnailUrl: string;
  score?: number;
}

/** Full-style shorthand used by `refero_get`. */
export interface FullStyleShorthand {
  id: string;
  siteName: string;
  url: string;
  northStar: string;
  theme: ColorScheme;
  industry: string;
  colors: FullStyle["fullResult"]["designSystem"]["colors"];
  fonts: string[];
  designSystem: FullStyle["fullResult"]["designSystem"];
  screenshotUrl: string;
  thumbnailUrl: string;
}

const PAGE_FETCH_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function toShorthand(
  item: StyleListItem,
  opts: { score?: number; tags?: string[] } = {},
): StyleShorthand {
  return {
    id: item.id,
    siteName: item.siteName,
    url: item.url,
    northStar: item.northStar,
    theme: item.colorScheme,
    tags: opts.tags ?? [],
    thumbnailUrl: item.thumbnailUrl,
    ...(opts.score !== undefined ? { score: opts.score } : {}),
  };
}

export function toFullStyleShorthand(full: FullStyle): FullStyleShorthand {
  const ds = full.fullResult.designSystem;
  return {
    id: full.id,
    siteName: full.siteName,
    url: full.url,
    northStar: full.northStar,
    theme: ds.theme ?? full.colorScheme,
    industry: full.industry,
    colors: ds.colors ?? [],
    fonts: ds.fonts ?? full.fonts ?? [],
    designSystem: ds,
    screenshotUrl: full.screenshotUrl,
    thumbnailUrl: full.thumbnailUrl,
  };
}

/**
 * Walk every page of `/api/styles?page=N` until exhausted. Used by both
 * `refero_refresh` and the lazy refresh path inside `ensureCatalog`.
 */
export async function fetchFullCatalog(): Promise<{
  styles: StyleListItem[];
  pagesFetched: number;
}> {
  const seen = new Map<string, StyleListItem>();
  let page = 1;
  let pagesFetched = 0;
  // Hard cap so a server-side bug can't run us forever.
  const MAX_PAGES = 200;

  while (page > 0 && page <= MAX_PAGES) {
    const res = await listPage(page);
    pagesFetched++;
    const items = Array.isArray(res.styles) ? res.styles : [];
    for (const item of items) {
      if (!item || typeof item.id !== "string") continue;
      seen.set(item.id, item);
    }
    if (items.length === 0) break;
    if (res.nextPage === null || res.nextPage === undefined) break;
    page = res.nextPage;
    await sleep(PAGE_FETCH_DELAY_MS);
  }

  return { styles: Array.from(seen.values()), pagesFetched };
}

/**
 * Return the catalog, refreshing from the network if it's stale or missing.
 * Pass `forceRefresh: true` to skip the freshness check.
 */
export async function ensureCatalog(
  opts: { forceRefresh?: boolean } = {},
): Promise<StyleListItem[]> {
  if (!opts.forceRefresh) {
    const cached = await readCatalog();
    if (cached && isFresh(cached.updatedAt)) {
      return cached.styles;
    }
  }
  const { styles } = await fetchFullCatalog();
  await writeCatalog(styles);
  return styles;
}

/**
 * Return a FullStyle for `id`, fetching + caching if missing or stale.
 */
export async function ensureStyle(id: string): Promise<FullStyle> {
  const cached = await readStyle(id);
  if (cached && isFresh(cached.updatedAt)) {
    return cached.style;
  }
  const res = await getById(id);
  await writeStyle(id, res.style);
  return res.style;
}

/** Build the text blob a Scorer searches over for a given list item. */
export function searchText(item: StyleListItem): string {
  const parts: string[] = [
    item.siteName,
    item.northStar,
    item.url,
    ...(item.fonts ?? []),
    ...(item.colors ?? []).map((c) => `${c.name} ${c.hex}`),
  ];
  return parts.filter(Boolean).join("\n");
}

/** Theme/tag filters shared by search and list. */
export function applyFilters(
  styles: StyleListItem[],
  filters: { theme?: ColorScheme; tags?: string[] },
  tagsForId?: Map<string, string[]>,
): StyleListItem[] {
  let result = styles;
  if (filters.theme) {
    result = result.filter((s) => s.colorScheme === filters.theme);
  }
  if (filters.tags && filters.tags.length > 0) {
    const wanted = filters.tags.map((t) => t.toLowerCase());
    result = result.filter((s) => {
      const tags = (tagsForId?.get(s.id) ?? []).map((t) => t.toLowerCase());
      // List-only items have no tags. Only filter them in if we have detail.
      if (tags.length === 0) return false;
      return wanted.every((w) => tags.includes(w));
    });
  }
  return result;
}
