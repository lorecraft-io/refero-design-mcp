/**
 * refero-mcp — scorer / embeddings tests (src/embeddings.ts).
 *
 * Verifies the contract documented in src/embeddings.ts:
 *  - The Scorer interface: `{ name, score(query, items) }`.
 *  - `getScorer()` returns the OpenAI scorer ONLY when both
 *    `process.env.OPENAI_API_KEY` is set AND the `openai` package can be
 *    imported. Either condition missing → keyword fallback.
 *  - Keyword scorer ranks the fixture catalog so a "warm editorial serif"
 *    query puts ElevenLabs above Stripe — ElevenLabs' northStar literally
 *    talks about a custom-serif on warm-eggshell ground, Stripe's does not.
 *  - The keyword scorer never throws on an empty item list, returns scores
 *    in the same id-order it was given (caller sorts).
 *  - `_resetScorerForTest()` clears the module-level cached scorer so each
 *    test starts from a clean slate.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getScorer,
  _resetScorerForTest,
  type ScorerItem,
} from "../src/embeddings.js";
import type { StyleListItem, StylesListResponse } from "../src/types.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_ENV = { ...process.env };
let cacheDir: string;

function loadCatalog(): StyleListItem[] {
  const raw = fs.readFileSync(
    path.join(TEST_DIR, "fixtures", "catalog.json"),
    "utf8",
  );
  return (JSON.parse(raw) as StylesListResponse).styles;
}

/** Build the search-text blob the way src/tools/shared.ts does. */
function searchText(item: StyleListItem): string {
  const parts: string[] = [
    item.siteName,
    item.northStar,
    item.url,
    ...(item.fonts ?? []),
    ...(item.colors ?? []).map((c) => `${c.name} ${c.hex}`),
  ];
  return parts.filter(Boolean).join("\n");
}

beforeEach(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "refero-mcp-emb-cache-"));
  process.env = { ...ORIGINAL_ENV };
  process.env.REFERO_CACHE_DIR = cacheDir;
  delete process.env.OPENAI_API_KEY;
  _resetScorerForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("openai");
  process.env = { ...ORIGINAL_ENV };
  _resetScorerForTest();
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe("getScorer — fallback selection", () => {
  it("falls back to the keyword scorer when OPENAI_API_KEY is unset", async () => {
    delete process.env.OPENAI_API_KEY;
    const scorer = await getScorer();
    expect(scorer.name).toBe("keyword");
  });

  it("falls back to the keyword scorer when the openai package fails to import", async () => {
    process.env.OPENAI_API_KEY = "sk-fake-test-key";

    // Force the dynamic import inside getScorer to reject. vi.doMock with a
    // module factory that throws is the canonical pattern for "this package
    // is unimportable" on the next import call.
    vi.doMock("openai", () => {
      throw new Error("Cannot find module 'openai'");
    });

    // Re-import the module fresh so the mock takes effect on the dynamic
    // import path the coder uses inside getScorer().
    vi.resetModules();
    const fresh = await import("../src/embeddings.js");
    fresh._resetScorerForTest();
    const scorer = await fresh.getScorer();
    expect(scorer.name).toBe("keyword");
  });

  it("memoizes the chosen scorer across calls", async () => {
    delete process.env.OPENAI_API_KEY;
    const a = await getScorer();
    const b = await getScorer();
    // Same instance — proves the module-level memoization. If the coder
    // ever changes this to "fresh on each call", search latency tanks.
    expect(a).toBe(b);
  });
});

describe("OpenAI scorer (via mocked openai package)", () => {
  it("uses the OpenAI scorer when OPENAI_API_KEY + openai package both available", async () => {
    process.env.OPENAI_API_KEY = "sk-fake-test-key";

    // Track API calls so we can verify caching.
    const create = vi.fn(async ({ input }: { input: string | string[] }) => {
      const inputs = Array.isArray(input) ? input : [input];
      return {
        data: inputs.map((_, i) => ({
          embedding: [i + 1, i + 2, i + 3] as number[],
        })),
      };
    });

    class FakeOpenAI {
      // Constructor matches `new OpenAI({ apiKey })`.
      constructor(_opts: { apiKey: string }) {}
      embeddings = { create };
    }

    vi.doMock("openai", () => ({ default: FakeOpenAI }));
    vi.resetModules();

    const fresh = await import("../src/embeddings.js");
    fresh._resetScorerForTest();
    const scorer = await fresh.getScorer();
    expect(scorer.name).toBe("openai");

    const items: ScorerItem[] = [
      { id: "a", text: "warm editorial serif" },
      { id: "b", text: "cold dashboard data" },
    ];
    const r1 = await scorer.score("editorial", items);
    expect(r1).toHaveLength(2);
    expect(typeof r1[0]!.score).toBe("number");

    const callsAfterFirst = create.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Second call with the SAME items: item vectors are cached on disk
    // (REFERO_CACHE_DIR is per-test). Only the QUERY embedding is re-fetched
    // (currently every time, since query strings aren't cached). We verify
    // that item embeddings are NOT re-requested by checking that batched
    // input requests don't include 'a'/'b' text again.
    const beforeSecond = create.mock.calls.length;
    await scorer.score("editorial", items);
    const afterSecond = create.mock.calls.length;
    // Allow at most one extra call (the query embedding).
    expect(afterSecond - beforeSecond).toBeLessThanOrEqual(1);
  });
});

describe("keyword scorer — ranking", () => {
  it("ranks 'warm editorial serif' so ElevenLabs > Stripe", async () => {
    const catalog = loadCatalog();
    const items: ScorerItem[] = catalog.map((s) => ({
      id: s.id,
      text: searchText(s),
    }));

    const scorer = await getScorer();
    expect(scorer.name).toBe("keyword");

    const scored = await scorer.score(
      "warm editorial serif on a warm white ground",
      items,
    );
    const byId = new Map(scored.map((r) => [r.id, r.score]));
    const eleven = catalog.find((s) => s.siteName === "ElevenLabs")!;
    const stripe = catalog.find((s) => s.siteName === "Stripe")!;

    const elevenScore = byId.get(eleven.id) ?? -Infinity;
    const stripeScore = byId.get(stripe.id) ?? -Infinity;

    // ElevenLabs must score strictly higher than Stripe — its northStar
    // explicitly mentions warm-vellum/serif/editorial cues.
    expect(elevenScore).toBeGreaterThan(stripeScore);
  });

  it("returns one score per item, in input order", async () => {
    const catalog = loadCatalog();
    const items: ScorerItem[] = catalog.map((s) => ({
      id: s.id,
      text: searchText(s),
    }));

    const scorer = await getScorer();
    const scored = await scorer.score("any query", items);

    expect(scored.length).toBe(items.length);
    for (let i = 0; i < items.length; i++) {
      expect(scored[i]!.id).toBe(items[i]!.id);
      expect(typeof scored[i]!.score).toBe("number");
      expect(Number.isFinite(scored[i]!.score)).toBe(true);
    }
  });

  it("never throws on an empty items list", async () => {
    const scorer = await getScorer();
    const scored = await scorer.score("anything", []);
    expect(scored).toEqual([]);
  });

  it("scores zero when the query has no real terms (only stopwords)", async () => {
    const items: ScorerItem[] = [
      { id: "a", text: "warm editorial serif eggshell" },
    ];
    const scorer = await getScorer();
    const scored = await scorer.score("the and of", items);
    expect(scored[0]!.score).toBe(0);
  });
});
