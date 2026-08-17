/**
 * refero-mcp — integration tests for the 6 MCP tool handlers.
 *
 * Each tool is exercised end-to-end with:
 *  - REFERO_CACHE_DIR pointed at a per-test mkdtempSync directory
 *  - REFERO_MCP_VAULT_DIR pointed at a per-test vault root
 *  - `fetch` stubbed to serve fixture catalog + fixture details
 *  - OPENAI_API_KEY unset → keyword scorer
 *
 * No test touches the user's real ~/.refero-cache/ or MyVault vault.
 *
 * Tools under test (from src/tools/):
 *   handleSearch    — natural-language ranked results
 *   handleGet       — detail by uuid|siteName|url
 *   handleDesignMd  — render DESIGN.md, optionally save_to_project
 *   handleSimilar   — Refero's own similarity ranking
 *   handleList      — paginated catalog browse
 *   handleRefresh   — walks all pages until empty, repopulates the cache
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { handleSearch } from "../src/tools/search.js";
import { handleGet, IdentifierNotFoundError } from "../src/tools/get.js";
import { handleDesignMd } from "../src/tools/design-md.js";
import { handleSimilar } from "../src/tools/similar.js";
import { handleList } from "../src/tools/list.js";
import { handleRefresh } from "../src/tools/refresh.js";
import { _resetScorerForTest } from "../src/embeddings.js";
import { PathSafetyError } from "../src/path-safety.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_ENV = { ...process.env };

function loadFixture<T>(name: string): T {
  const raw = fs.readFileSync(path.join(TEST_DIR, "fixtures", name), "utf8");
  return JSON.parse(raw) as T;
}

let cacheDir: string;
let vaultRoot: string;

beforeEach(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "refero-mcp-tools-cache-"));
  vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "refero-mcp-tools-vault-"));
  fs.mkdirSync(path.join(vaultRoot, "05-Projects", "ACME"), {
    recursive: true,
  });

  process.env = { ...ORIGINAL_ENV };
  process.env.REFERO_CACHE_DIR = cacheDir;
  process.env.REFERO_MCP_VAULT_DIR = vaultRoot;
  process.env.REFERO_CACHE_TTL_MS = String(24 * 60 * 60 * 1000);
  delete process.env.OPENAI_API_KEY; // force keyword scorer

  _resetScorerForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  _resetScorerForTest();

  for (const dir of [cacheDir, vaultRoot]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
  process.env = { ...ORIGINAL_ENV };
});

/**
 * Stub `fetch` to serve our static fixtures based on the requested URL.
 * Pages beyond the first return empty so `refresh` can terminate.
 */
interface CatalogFixture {
  styles: Array<{ id: string; siteName: string; url: string }>;
  nextCursor: null;
  nextPage: number | null;
}
interface DetailFixture {
  style: { id: string };
  similar: unknown[];
}

function stubFetchWithFixtures(): ReturnType<typeof vi.fn> {
  const catalog = loadFixture<CatalogFixture>("catalog.json");
  const elevenDetail = loadFixture<DetailFixture>("elevenlabs-detail.json");
  const cursorDetail = loadFixture<DetailFixture>("cursor-detail.json");

  const detailById: Record<string, DetailFixture> = {
    "031056ff-7af1-46db-8daa-115f731c5d26": elevenDetail,
    "4e3b4717-84c8-4599-baaf-a343c3d619b6": cursorDetail,
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/styles?page=")) {
      const pageStr = new URL(url).searchParams.get("page") ?? "1";
      const page = Number(pageStr);
      if (page === 1) {
        return new Response(
          JSON.stringify({
            styles: catalog.styles,
            nextCursor: null,
            nextPage: 2,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // Subsequent pages are empty → refresh / fetchFullCatalog terminates.
      return new Response(
        JSON.stringify({ styles: [], nextCursor: null, nextPage: null }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const detailMatch = url.match(/\/api\/styles\/([^/?#]+)/);
    if (detailMatch) {
      const id = detailMatch[1]!;
      const body = detailById[id];
      if (body) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response('{"error":"not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("unexpected fetch in test", { status: 500 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("handleSearch", () => {
  it("returns top-N ranked results for a natural-language query", async () => {
    stubFetchWithFixtures();
    const out = await handleSearch({
      query: "warm editorial serif on warm white",
      limit: 3,
    });

    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.length).toBeLessThanOrEqual(3);
    expect(out.scorer).toBe("keyword");
    expect(out.results[0]).toHaveProperty("score");
    expect(out.results[0]).toHaveProperty("siteName");
  });

  it("ranks ElevenLabs first for a serif/editorial query", async () => {
    stubFetchWithFixtures();
    const out = await handleSearch({
      query: "warm editorial serif on warm vellum",
      limit: 5,
    });
    // The fixture northStar for ElevenLabs explicitly mentions
    // "Waldenburg ... eggshell ground" — the strongest match in the
    // trimmed catalog.
    expect(out.results[0]?.siteName).toBe("ElevenLabs");
  });

  it("filters by theme (light vs dark)", async () => {
    stubFetchWithFixtures();
    const out = await handleSearch({
      query: "anything",
      limit: 5,
      theme: "light",
    });
    for (const hit of out.results) {
      expect(hit.theme).toBe("light");
    }
  });

  it("rejects an empty query", async () => {
    stubFetchWithFixtures();
    await expect(handleSearch({ query: "" })).rejects.toThrow(/query/);
  });

  it("rejects a non-numeric limit", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleSearch({ query: "x", limit: "five" as any }),
    ).rejects.toThrow(/limit/);
  });

  it("rejects a non-string query", async () => {
    stubFetchWithFixtures();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(handleSearch({ query: 123 as any })).rejects.toThrow(/query/);
  });

  it("rejects an invalid theme", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleSearch({ query: "x", theme: "neon" as any }),
    ).rejects.toThrow(/theme/);
  });

  it("rejects non-array tags", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleSearch({ query: "x", tags: "not-an-array" as any }),
    ).rejects.toThrow(/tags/);
  });

  it("clamps the limit to MAX_LIMIT", async () => {
    stubFetchWithFixtures();
    const out = await handleSearch({ query: "anything", limit: 500 });
    // Trimmed catalog has 5 entries — clamping is hard to assert directly,
    // but we at least ensure no throw and length <= 5 (catalog size).
    expect(out.results.length).toBeLessThanOrEqual(5);
  });

  it("returns zero results when filters exclude everything", async () => {
    stubFetchWithFixtures();
    // theme:light + a tag that nothing matches → empty.
    const out = await handleSearch({
      query: "anything",
      theme: "light",
      tags: ["zzzz-no-such-tag-anywhere"],
    });
    expect(out.count).toBe(0);
    expect(out.results).toEqual([]);
  });

  it("filters by tags via heuristic match against siteName/northStar", async () => {
    stubFetchWithFixtures();
    // 'cursor' appears literally in the Cursor entry's siteName.
    const out = await handleSearch({
      query: "anything",
      tags: ["cursor"],
    });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results[0]?.siteName).toBe("Cursor");
  });
});

describe("handleGet — identifier resolution", () => {
  it("resolves by UUID", async () => {
    stubFetchWithFixtures();
    const out = await handleGet({
      identifier: "031056ff-7af1-46db-8daa-115f731c5d26",
    });
    expect(out.siteName).toBe("ElevenLabs");
    expect(out.id).toBe("031056ff-7af1-46db-8daa-115f731c5d26");
  });

  it("resolves by siteName (case-insensitive)", async () => {
    stubFetchWithFixtures();
    const out = await handleGet({ identifier: "elevenlabs" });
    expect(out.siteName).toBe("ElevenLabs");
  });

  it("resolves by URL", async () => {
    stubFetchWithFixtures();
    const out = await handleGet({ identifier: "https://cursor.com" });
    expect(out.siteName).toBe("Cursor");
  });

  it("throws IdentifierNotFoundError on a no-match identifier", async () => {
    stubFetchWithFixtures();
    await expect(
      handleGet({ identifier: "completely-unknown-thing" }),
    ).rejects.toBeInstanceOf(IdentifierNotFoundError);
  });

  it("rejects empty identifier", async () => {
    stubFetchWithFixtures();
    await expect(handleGet({ identifier: "" })).rejects.toThrow(/identifier/);
  });
});

describe("handleDesignMd", () => {
  it("returns markdown when no save_to_project is given", async () => {
    stubFetchWithFixtures();
    const out = await handleDesignMd({ identifier: "elevenlabs" });
    expect(typeof out.markdown).toBe("string");
    expect(out.markdown.startsWith("---\n")).toBe(true);
    expect(out.savedTo).toBeUndefined();
    expect(out.siteName).toBe("ElevenLabs");
  });

  it("writes DESIGN.md to <vault>/05-Projects/<NAME>/ when save_to_project is given", async () => {
    stubFetchWithFixtures();

    const out = await handleDesignMd({
      identifier: "elevenlabs",
      save_to_project: "ACME",
    });

    const expected = path.join(
      vaultRoot,
      "05-Projects",
      "ACME",
      "DESIGN.md",
    );
    expect(out.savedTo).toBe(expected);
    expect(fs.existsSync(expected)).toBe(true);

    const onDisk = fs.readFileSync(expected, "utf8");
    expect(onDisk).toBe(out.markdown);
  });

  it("creates the project directory when it doesn't already exist", async () => {
    stubFetchWithFixtures();
    const out = await handleDesignMd({
      identifier: "elevenlabs",
      save_to_project: "BRAND-NEW-PROJECT",
    });
    const expected = path.join(
      vaultRoot,
      "05-Projects",
      "BRAND-NEW-PROJECT",
      "DESIGN.md",
    );
    expect(out.savedTo).toBe(expected);
    expect(fs.existsSync(expected)).toBe(true);
  });

  it("throws PathSafetyError on a path-traversal project name", async () => {
    stubFetchWithFixtures();
    await expect(
      handleDesignMd({
        identifier: "elevenlabs",
        save_to_project: "../../../etc",
      }),
    ).rejects.toBeInstanceOf(PathSafetyError);
  });

  it("throws PathSafetyError on an absolute project name", async () => {
    stubFetchWithFixtures();
    await expect(
      handleDesignMd({
        identifier: "elevenlabs",
        save_to_project: "/tmp/evil",
      }),
    ).rejects.toBeInstanceOf(PathSafetyError);
  });
});

describe("handleSimilar", () => {
  it("returns Refero's own similarity ranking from the detail response", async () => {
    stubFetchWithFixtures();
    const out = await handleSimilar({ identifier: "elevenlabs" });
    expect(Array.isArray(out.results)).toBe(true);
    // Our fixture trims similar[] to 3 entries.
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.length).toBeLessThanOrEqual(3);
    expect(out.results[0]).toHaveProperty("siteName");
    expect(out.styleId).toBe("031056ff-7af1-46db-8daa-115f731c5d26");
  });

  it("honors the limit argument", async () => {
    stubFetchWithFixtures();
    const out = await handleSimilar({ identifier: "elevenlabs", limit: 1 });
    expect(out.results.length).toBe(1);
  });

  it("throws IdentifierNotFoundError on a no-match identifier", async () => {
    stubFetchWithFixtures();
    await expect(
      handleSimilar({ identifier: "completely-unknown-thing" }),
    ).rejects.toBeInstanceOf(IdentifierNotFoundError);
  });
});

describe("handleList — pagination", () => {
  it("returns the seeded styles on page 1, with totalPages calculated", async () => {
    stubFetchWithFixtures();
    const out = await handleList({ page: 1, limit: 20 });

    // Trimmed fixture has 5 styles; everything fits on page 1.
    expect(out.total).toBe(5);
    expect(out.totalPages).toBe(1);
    expect(out.count).toBe(5);
    expect(out.styles.length).toBe(5);
  });

  it("paginates across multiple pages when limit < total", async () => {
    stubFetchWithFixtures();
    const p1 = await handleList({ page: 1, limit: 2 });
    expect(p1.total).toBe(5);
    expect(p1.totalPages).toBe(3);
    expect(p1.count).toBe(2);

    const p3 = await handleList({ page: 3, limit: 2 });
    expect(p3.count).toBe(1); // remainder

    const p4 = await handleList({ page: 4, limit: 2 });
    expect(p4.count).toBe(0); // out of range, but no throw
  });

  it("filters by theme", async () => {
    stubFetchWithFixtures();
    const out = await handleList({ theme: "light", limit: 50 });
    for (const s of out.styles) {
      expect(s.theme).toBe("light");
    }
  });

  it("rejects an invalid theme", async () => {
    stubFetchWithFixtures();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(handleList({ theme: "neon" as any })).rejects.toThrow(/theme/);
  });

  it("rejects a non-array tags arg", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleList({ tags: "nope" as any }),
    ).rejects.toThrow(/tags/);
  });

  it("rejects a non-numeric page", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleList({ page: "five" as any }),
    ).rejects.toThrow(/page/);
  });

  it("rejects a page < 1", async () => {
    stubFetchWithFixtures();
    await expect(handleList({ page: 0 })).rejects.toThrow(/page/);
  });

  it("rejects a non-numeric limit", async () => {
    stubFetchWithFixtures();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleList({ limit: "five" as any }),
    ).rejects.toThrow(/limit/);
  });

  it("filters by tags via heuristic match", async () => {
    stubFetchWithFixtures();
    const out = await handleList({ tags: ["cursor"], limit: 20 });
    expect(out.styles.length).toBeGreaterThan(0);
    expect(out.styles[0]?.siteName).toBe("Cursor");
  });
});

describe("handleRefresh", () => {
  it("walks all pages until nextPage is null and writes the catalog", async () => {
    const fetchMock = stubFetchWithFixtures();

    const out = await handleRefresh({});

    // Should have visited at least page 1 and the empty terminator.
    const listCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/styles?page="),
    );
    expect(listCalls.length).toBeGreaterThanOrEqual(2);

    expect(out.totalStyles).toBe(5);
    expect(out.pagesFetched).toBeGreaterThanOrEqual(2);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);

    // catalog.json must now exist under the env-pinned cache dir.
    expect(fs.existsSync(path.join(cacheDir, "catalog.json"))).toBe(true);
  });
});
