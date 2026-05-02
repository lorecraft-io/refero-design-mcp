/**
 * refero-mcp — resolver tests (src/resolver.ts).
 *
 * Verifies the contract documented in src/resolver.ts:
 *   resolveStyle(input: string, catalog: StyleListItem[]): StyleListItem | null
 *
 * Order-of-precedence (canonical, per source comments):
 *   1. UUID exact match on `id`.
 *   2. Hostname / URL match (input may be "https://x.com", "x.com",
 *      "www.x.com"); ties broken by shortest URL pathname, then alpha.
 *   3. Site name — exact case-insensitive.
 *   4. Substring or fuzzy (Levenshtein <= 2). Tiebreak by alpha siteName.
 *   5. null.
 *
 * The fuzzy threshold is 2 edits, so "Curser" → "Cursor" (1 edit) MUST
 * resolve. Empty / non-string input always returns null without throwing.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveStyle } from "../src/resolver.js";
import type { StyleListItem, StylesListResponse } from "../src/types.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadCatalog(): StyleListItem[] {
  const raw = fs.readFileSync(
    path.join(TEST_DIR, "fixtures", "catalog.json"),
    "utf8",
  );
  return (JSON.parse(raw) as StylesListResponse).styles;
}

const catalog = loadCatalog();

describe("resolveStyle — UUID", () => {
  it("matches an exact UUID", () => {
    const cursor = resolveStyle(
      "4e3b4717-84c8-4599-baaf-a343c3d619b6",
      catalog,
    );
    expect(cursor?.siteName).toBe("Cursor");
  });

  it("matches a UUID case-insensitively", () => {
    const cursor = resolveStyle(
      "4E3B4717-84C8-4599-BAAF-A343C3D619B6",
      catalog,
    );
    expect(cursor?.siteName).toBe("Cursor");
  });

  it("returns null when the UUID does not exist in the catalog", () => {
    const result = resolveStyle(
      "00000000-0000-0000-0000-000000000000",
      catalog,
    );
    expect(result).toBeNull();
  });
});

describe("resolveStyle — siteName (case-insensitive)", () => {
  it("matches the exact siteName", () => {
    expect(resolveStyle("Cursor", catalog)?.siteName).toBe("Cursor");
  });

  it("matches lowercase", () => {
    expect(resolveStyle("cursor", catalog)?.siteName).toBe("Cursor");
  });

  it("matches uppercase", () => {
    expect(resolveStyle("CURSOR", catalog)?.siteName).toBe("Cursor");
  });

  it("matches an internally-uppercased siteName", () => {
    expect(resolveStyle("elevenlabs", catalog)?.siteName).toBe("ElevenLabs");
  });
});

describe("resolveStyle — URL / hostname", () => {
  it("matches a full https URL", () => {
    expect(resolveStyle("https://cursor.com", catalog)?.siteName).toBe(
      "Cursor",
    );
  });

  it("matches a bare hostname", () => {
    expect(resolveStyle("cursor.com", catalog)?.siteName).toBe("Cursor");
  });

  it("matches a www-prefixed hostname", () => {
    expect(resolveStyle("www.cursor.com", catalog)?.siteName).toBe("Cursor");
  });

  it("matches an http URL with a trailing slash", () => {
    expect(resolveStyle("http://cursor.com/", catalog)?.siteName).toBe(
      "Cursor",
    );
  });

  it("matches a URL with a path component", () => {
    expect(resolveStyle("https://cursor.com/pricing", catalog)?.siteName).toBe(
      "Cursor",
    );
  });
});

describe("resolveStyle — fuzzy (Levenshtein <= 2)", () => {
  it("resolves a single-edit typo", () => {
    expect(resolveStyle("Curser", catalog)?.siteName).toBe("Cursor");
  });

  it("resolves a transposition that lands within 2 edits", () => {
    // "Stirpe" vs "Stripe" — 2 edits via swap-as-two-substitutions.
    expect(resolveStyle("Stirpe", catalog)?.siteName).toBe("Stripe");
  });

  it("returns null for inputs with no plausible match", () => {
    expect(
      resolveStyle("zxcvbnmqwerty-not-a-real-thing", catalog),
    ).toBeNull();
  });
});

describe("resolveStyle — degenerate inputs", () => {
  it("returns null on empty string", () => {
    expect(resolveStyle("", catalog)).toBeNull();
  });

  it("returns null on whitespace-only input", () => {
    expect(resolveStyle("   ", catalog)).toBeNull();
  });

  it("returns null when called with non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveStyle(null as any, catalog)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolveStyle(undefined as any, catalog)).toBeNull();
  });

  it("returns null on an empty catalog", () => {
    expect(resolveStyle("Cursor", [])).toBeNull();
  });
});

describe("resolveStyle — determinism (alpha tiebreak)", () => {
  it("returns the same answer across repeated runs (alpha tiebreak)", () => {
    // Synthetic catalog with two equally-close fuzzy candidates so the
    // tiebreak is the only thing distinguishing them.
    const tieCatalog: StyleListItem[] = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        url: "https://zorba.example",
        siteName: "Zorba",
        northStar: "",
        colorScheme: "light",
        colors: [],
        fonts: [],
        // The remaining StyleListItem fields are not consulted by resolver.
      } as StyleListItem,
      {
        id: "22222222-2222-2222-2222-222222222222",
        url: "https://aorba.example",
        siteName: "Aorba",
        northStar: "",
        colorScheme: "light",
        colors: [],
        fonts: [],
      } as StyleListItem,
    ];

    // "orba" is equidistant from both (both contain it as substring →
    // distance 0); alpha tiebreak → "Aorba" wins.
    const r1 = resolveStyle("orba", tieCatalog);
    const r2 = resolveStyle("orba", tieCatalog);
    const r3 = resolveStyle("orba", tieCatalog);

    expect(r1).not.toBeNull();
    expect(r1?.siteName).toBe(r2?.siteName);
    expect(r2?.siteName).toBe(r3?.siteName);
    expect(r1?.siteName).toBe("Aorba"); // alphabetical
  });
});
