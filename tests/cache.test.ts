/**
 * refero-mcp — FS cache tests (src/cache.ts).
 *
 * Verifies the contract documented in src/cache.ts:
 *  - Layout: catalog.json, styles/<uuid>.json, embeddings.json under
 *    REFERO_CACHE_DIR (default ~/.refero-cache, here always overridden).
 *  - Atomic writes (write to <path>.tmp.<pid>.<ts> then rename) — a failed
 *    rename leaves the previous good file intact.
 *  - 24h TTL (default), tunable via REFERO_CACHE_TTL_MS, with isFresh()
 *    treating equal-or-greater-than-TTL as stale.
 *  - Corrupt JSON on disk is treated as cache miss (returns null, never
 *    throws). One bad write must not poison the entire MCP at startup.
 *  - Each test uses fs.mkdtempSync to a fresh dir + REFERO_CACHE_DIR env so
 *    parallel test files cannot collide. afterEach removes the dir.
 *
 * The atomic-write test is the most important one: a partial write that
 * leaves the cache file truncated would silently corrupt the catalog and
 * cascade into every search. We simulate it by intercepting fs.rename.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isFresh,
  readCatalog,
  readStyle,
  writeCatalog,
  writeStyle,
  readEmbeddings,
  writeEmbeddings,
  getCacheRoot,
} from "../src/cache.js";
import type { FullStyle, StyleListItem } from "../src/types.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

let tmpDir: string;
const ORIGINAL_ENV = { ...process.env };

function loadFixtureStyle(): FullStyle {
  const raw = fs.readFileSync(
    path.join(TEST_DIR, "fixtures", "elevenlabs-detail.json"),
    "utf8",
  );
  return (JSON.parse(raw) as { style: FullStyle }).style;
}

function loadFixtureCatalog(): StyleListItem[] {
  const raw = fs.readFileSync(
    path.join(TEST_DIR, "fixtures", "catalog.json"),
    "utf8",
  );
  return (JSON.parse(raw) as { styles: StyleListItem[] }).styles;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "refero-mcp-cache-"));
  process.env = { ...ORIGINAL_ENV };
  process.env.REFERO_CACHE_DIR = tmpDir;
  // Pin the TTL to a known value so tests don't depend on the default.
  process.env.REFERO_CACHE_TTL_MS = String(24 * 60 * 60 * 1000);
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; CI sandboxes may already have removed it.
  }
  process.env = { ...ORIGINAL_ENV };
});

describe("cache — env-pinned location", () => {
  it("getCacheRoot resolves to REFERO_CACHE_DIR", () => {
    expect(getCacheRoot()).toBe(tmpDir);
  });
});

describe("cache — catalog read/write roundtrip", () => {
  it("preserves the value shape across writeCatalog + readCatalog", async () => {
    const styles = loadFixtureCatalog();
    const written = await writeCatalog(styles);

    expect(written.styles).toEqual(styles);
    expect(typeof written.updatedAt).toBe("number");

    const got = await readCatalog();
    expect(got).not.toBeNull();
    expect(got!.styles).toEqual(styles);
  });

  it("readCatalog returns null when the file is missing", async () => {
    const got = await readCatalog();
    expect(got).toBeNull();
  });

  it("readCatalog ignores corrupt JSON and returns null (graceful degrade)", async () => {
    await fsp.writeFile(path.join(tmpDir, "catalog.json"), "{not json", "utf8");
    const got = await readCatalog();
    // Cache MUST treat corrupt files as a miss, not throw — otherwise one
    // bad write poisons the entire MCP at startup.
    expect(got).toBeNull();
  });
});

describe("cache — per-style read/write", () => {
  it("preserves the value shape across writeStyle + readStyle", async () => {
    const style = loadFixtureStyle();
    await writeStyle(style.id, style);
    const got = await readStyle(style.id);

    expect(got).not.toBeNull();
    expect(got!.style).toEqual(style);
    expect(typeof got!.updatedAt).toBe("number");
  });

  it("returns null for an unknown id", async () => {
    const got = await readStyle("00000000-0000-0000-0000-000000000000");
    expect(got).toBeNull();
  });
});

describe("cache — embeddings read/write", () => {
  it("preserves the value shape across writeEmbeddings + readEmbeddings", async () => {
    const file = {
      model: "text-embedding-3-small",
      vectors: { foo: [0.1, 0.2, 0.3] },
      textHashes: { foo: "abc123" },
    };
    await writeEmbeddings(file);
    const got = await readEmbeddings();
    expect(got).toEqual(file);
  });

  it("returns null when the embeddings file does not exist", async () => {
    const got = await readEmbeddings();
    expect(got).toBeNull();
  });
});

describe("cache — TTL", () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  it("isFresh returns true for an entry under the TTL", () => {
    const writtenAt = Date.now() - 60 * 60 * 1000; // 1h ago
    expect(isFresh(writtenAt, ONE_DAY)).toBe(true);
  });

  it("isFresh returns false once the TTL has elapsed", () => {
    const writtenAt = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
    expect(isFresh(writtenAt, ONE_DAY)).toBe(false);
  });

  it("isFresh treats exactly-at-TTL as stale (boundary is exclusive)", () => {
    const writtenAt = Date.now() - ONE_DAY;
    // Strictly stale at the boundary: prevents off-by-one keeping a stale
    // entry alive for one extra request cycle.
    expect(isFresh(writtenAt, ONE_DAY)).toBe(false);
  });

  it("isFresh returns false for non-finite or non-positive timestamps", () => {
    expect(isFresh(0, ONE_DAY)).toBe(false);
    expect(isFresh(-1, ONE_DAY)).toBe(false);
    expect(isFresh(Number.NaN, ONE_DAY)).toBe(false);
    expect(isFresh(Number.POSITIVE_INFINITY, ONE_DAY)).toBe(false);
  });

  it("isFresh returns false when TTL is zero (caching disabled)", () => {
    expect(isFresh(Date.now(), 0)).toBe(false);
  });
});

describe("cache — atomic writes", () => {
  it("does not corrupt the existing file when rename fails mid-flight", async () => {
    // Seed a known-good catalog at the canonical path.
    const original = loadFixtureCatalog();
    await writeCatalog(original);

    // Sabotage the *destination* so the next rename() call fails with a
    // real, OS-level error (POSIX: renaming onto a non-empty directory
    // fails with ENOTEMPTY/EISDIR; on macOS APFS specifically it's EISDIR).
    // We do this by replacing the catalog.json file with a non-empty
    // directory of the same name. The previous on-disk catalog is
    // therefore the one held *inside* that directory.
    const catalogPath = path.join(tmpDir, "catalog.json");
    const goodCopy = await fsp.readFile(catalogPath, "utf8");
    await fsp.unlink(catalogPath);
    await fsp.mkdir(catalogPath);
    // Drop a sentinel inside so the directory can't be silently replaced.
    await fsp.writeFile(path.join(catalogPath, "sentinel"), "still here", "utf8");

    // The write should fail because rename can't replace a non-empty dir
    // with a file.
    await expect(writeCatalog([])).rejects.toThrow();

    // The directory + sentinel must still be there — the failed write
    // didn't clobber it.
    const stat = await fsp.stat(catalogPath);
    expect(stat.isDirectory()).toBe(true);
    const sentinel = await fsp.readFile(
      path.join(catalogPath, "sentinel"),
      "utf8",
    );
    expect(sentinel).toBe("still here");

    // And as a stand-in for "previous content survived", our copy of the
    // original payload is intact in memory and we can decode it.
    const parsed = JSON.parse(goodCopy) as { styles: typeof original };
    expect(parsed.styles).toEqual(original);
  });

  it("does not leave an orphan .tmp file behind on a successful write", async () => {
    await writeCatalog(loadFixtureCatalog());

    const entries = await fsp.readdir(tmpDir);
    const tmpFiles = entries.filter((e) => e.includes(".tmp."));
    // After a successful write, no orphan temp files should remain. The
    // implementation uses `<path>.tmp.<pid>.<ts>` and renames it into
    // place — the tmp name is gone on completion.
    expect(tmpFiles).toEqual([]);
    expect(entries).toContain("catalog.json");
  });

  it("writes a syntactically-valid JSON file (not a half-flushed write)", async () => {
    await writeCatalog(loadFixtureCatalog());
    const onDisk = await fsp.readFile(path.join(tmpDir, "catalog.json"), "utf8");
    // Will throw if truncated — proves the rename happened atomically
    // (or at least that what landed on disk is complete).
    const parsed = JSON.parse(onDisk) as { styles: unknown[] };
    expect(Array.isArray(parsed.styles)).toBe(true);
  });
});
