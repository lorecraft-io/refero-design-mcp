/**
 * refero-mcp — unit tests for `refero_facets`.
 *
 * The facet math is pure, so these run against the fixture catalog directly
 * without stubbing fetch or touching the cache.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { rankFacet, computeFacets } from "../src/tools/facets.js";
import type { StyleListItem, StylesListResponse } from "../src/types.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadCatalog(): StyleListItem[] {
  const raw = fs.readFileSync(path.join(TEST_DIR, "fixtures", "catalog.json"), "utf8");
  return (JSON.parse(raw) as StylesListResponse).styles;
}

const style = (over: Partial<StyleListItem>): StyleListItem =>
  ({
    id: "x",
    url: "https://example.com",
    siteName: "Example",
    colorScheme: "light",
    colors: [],
    fonts: [],
    northStar: "",
    ...over,
  }) as StyleListItem;

describe("rankFacet", () => {
  it("counts occurrences and sorts by frequency", () => {
    expect(rankFacet(["Inter", "Inter", "Geist", "Inter", "Geist", "Mono"], 10)).toEqual([
      { value: "Inter", count: 3 },
      { value: "Geist", count: 2 },
      { value: "Mono", count: 1 },
    ]);
  });

  it("folds case when counting but keeps first-seen casing for display", () => {
    const [top] = rankFacet(["Inter", "inter", "INTER"], 10);
    expect(top).toEqual({ value: "Inter", count: 3 });
  });

  it("breaks frequency ties alphabetically so output is stable", () => {
    expect(rankFacet(["b", "a", "c"], 10).map((f) => f.value)).toEqual(["a", "b", "c"]);
  });

  it("respects the limit", () => {
    expect(rankFacet(["a", "b", "c", "d"], 2)).toHaveLength(2);
  });

  it("ignores blank, whitespace-only, and non-string values", () => {
    expect(rankFacet(["", "   ", null as unknown as string, 7 as unknown as string], 10)).toEqual([]);
  });

  it("trims surrounding whitespace before counting", () => {
    expect(rankFacet([" Inter ", "Inter"], 10)).toEqual([{ value: "Inter", count: 2 }]);
  });

  it("returns an empty list for empty input", () => {
    expect(rankFacet([], 10)).toEqual([]);
  });
});

describe("computeFacets", () => {
  it("reports the number of styles it summarised", () => {
    const styles = loadCatalog();
    expect(computeFacets(styles, 25).total).toBe(styles.length);
  });

  it("extracts real font stacks from the fixture catalog", () => {
    const facets = computeFacets(loadCatalog(), 25);
    expect(facets.fonts.length).toBeGreaterThan(0);
    expect(facets.fonts.map((f) => f.value)).toContain("Inter");
    for (const f of facets.fonts) expect(f.count).toBeGreaterThan(0);
  });

  it("extracts named colors from the fixture catalog", () => {
    const facets = computeFacets(loadCatalog(), 25);
    expect(facets.colors.length).toBeGreaterThan(0);
    expect(facets.colors.every((c) => typeof c.value === "string" && c.value.length > 0)).toBe(true);
  });

  it("counts themes", () => {
    const facets = computeFacets(
      [
        style({ colorScheme: "light" }),
        style({ colorScheme: "light" }),
        style({ colorScheme: "dark" }),
      ],
      25,
    );
    expect(facets.themes).toEqual([
      { value: "light", count: 2 },
      { value: "dark", count: 1 },
    ]);
  });

  it("applies the limit to fonts and colors", () => {
    const facets = computeFacets(
      [style({ fonts: ["a", "b", "c"], colors: [{ name: "x", hex: "#000000" }] })],
      2,
    );
    expect(facets.fonts).toHaveLength(2);
  });

  it("caps themes independently of the caller's limit", () => {
    // Only two possible values exist, so a limit of 1 must not hide one.
    const facets = computeFacets([style({ colorScheme: "light" }), style({ colorScheme: "dark" })], 1);
    expect(facets.themes).toHaveLength(2);
  });

  it("survives styles missing fonts or colors entirely", () => {
    const facets = computeFacets(
      [style({ fonts: undefined as unknown as string[], colors: undefined as unknown as [] })],
      25,
    );
    expect(facets.fonts).toEqual([]);
    expect(facets.colors).toEqual([]);
    expect(facets.total).toBe(1);
  });

  it("skips color entries with no name", () => {
    const facets = computeFacets(
      [style({ colors: [{ name: "", hex: "#fff" }, { name: "Ink", hex: "#000" }] as never })],
      25,
    );
    expect(facets.colors).toEqual([{ value: "Ink", count: 1 }]);
  });

  it("returns zeroed facets for an empty catalog", () => {
    expect(computeFacets([], 25)).toEqual({ total: 0, themes: [], fonts: [], colors: [] });
  });

  it("produces values that are usable as refero_search queries", () => {
    // The contract this tool sells: every returned facet is a plain string that
    // searchText() already indexes, so it round-trips into search.
    const facets = computeFacets(loadCatalog(), 25);
    for (const f of [...facets.fonts, ...facets.colors]) {
      expect(typeof f.value).toBe("string");
      expect(f.value.trim()).toBe(f.value);
      expect(f.value.length).toBeGreaterThan(0);
    }
  });
});
