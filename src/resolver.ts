/**
 * Identifier resolution.
 *
 * Pure function — accepts uuid, hostname/URL, or site name and returns the
 * matching catalog item (or null). Used by every tool that takes an
 * `identifier` argument.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import type { StyleListItem } from "./types.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function parseHostname(input: string): string | null {
  let candidate = input.trim();
  if (!candidate) return null;
  // If it doesn't have a scheme, prepend one so URL parses.
  if (!/^https?:\/\//i.test(candidate)) {
    // Anything that looks like host[/path]
    if (/^[\w-]+(\.[\w-]+)+/.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return null;
    }
  }
  try {
    const u = new URL(candidate);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function itemHostname(item: StyleListItem): string | null {
  try {
    return new URL(item.url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
      if ((curr[j] ?? Infinity) < rowMin) rowMin = curr[j] ?? rowMin;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? max + 1;
}

/**
 * Resolve a free-form identifier against a catalog. Returns null if no match.
 * No I/O — caller supplies the catalog.
 */
export function resolveStyle(input: string, catalog: StyleListItem[]): StyleListItem | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. UUID exact match.
  if (looksLikeUuid(trimmed)) {
    return catalog.find((s) => s.id.toLowerCase() === trimmed.toLowerCase()) ?? null;
  }

  // 2. Hostname / URL match.
  const host = parseHostname(trimmed);
  if (host) {
    const hits = catalog.filter((s) => itemHostname(s) === host);
    if (hits.length > 0) {
      // Prefer the one whose url path is shortest (closest to root).
      hits.sort((a, b) => {
        try {
          const al = new URL(a.url).pathname.length;
          const bl = new URL(b.url).pathname.length;
          if (al !== bl) return al - bl;
        } catch {
          /* fallthrough to lex tiebreak */
        }
        return a.siteName.localeCompare(b.siteName);
      });
      return hits[0] ?? null;
    }
  }

  // 3. Site name — exact case-insensitive.
  const lcName = trimmed.toLowerCase();
  const exact = catalog.filter((s) => s.siteName.toLowerCase() === lcName);
  if (exact.length > 0) {
    exact.sort((a, b) => a.siteName.localeCompare(b.siteName));
    return exact[0] ?? null;
  }

  // 4. Substring or fuzzy (Levenshtein <= 2). Deterministic tiebreak: lex by
  // siteName.
  type Candidate = { item: StyleListItem; distance: number };
  const candidates: Candidate[] = [];
  for (const item of catalog) {
    const ln = item.siteName.toLowerCase();
    if (ln.includes(lcName) || lcName.includes(ln)) {
      candidates.push({ item, distance: 0 });
      continue;
    }
    const d = levenshtein(ln, lcName, 2);
    if (d <= 2) candidates.push({ item, distance: d });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.item.siteName.localeCompare(b.item.siteName);
  });
  return candidates[0]?.item ?? null;
}
