/**
 * refero-mcp — config loader tests (src/config.ts).
 *
 * Verifies the contract documented in src/config.ts:
 *  - Reads env, returns a fully-resolved ReferoConfig.
 *  - Defaults: apiBase = production, vaultDir = null, cacheDir = ~/.refero-cache,
 *    cacheTtlMs = 24h.
 *  - Validation throws fast on bad values rather than silently falling back.
 *  - `options.env` overrides `process.env` for testability.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { describe, expect, it } from "vitest";

import {
  loadConfig,
  DEFAULT_REFERO_API_BASE,
  DEFAULT_REFERO_CACHE_DIR,
  DEFAULT_REFERO_CACHE_TTL_MS,
} from "../src/config.js";

describe("loadConfig — defaults", () => {
  it("uses production defaults when env is empty", () => {
    const cfg = loadConfig({ env: {} });
    expect(cfg.apiBase).toBe(DEFAULT_REFERO_API_BASE);
    expect(cfg.cacheDir).toBe(DEFAULT_REFERO_CACHE_DIR);
    expect(cfg.cacheTtlMs).toBe(DEFAULT_REFERO_CACHE_TTL_MS);
    expect(cfg.vaultDir).toBeNull();
    expect(cfg.openAiApiKey).toBeNull();
  });

  it("treats whitespace-only env values as unset", () => {
    const cfg = loadConfig({
      env: {
        REFERO_API_BASE: "   ",
        REFERO_CACHE_DIR: "  ",
        OPENAI_API_KEY: "",
      },
    });
    expect(cfg.apiBase).toBe(DEFAULT_REFERO_API_BASE);
    expect(cfg.cacheDir).toBe(DEFAULT_REFERO_CACHE_DIR);
    expect(cfg.openAiApiKey).toBeNull();
  });
});

describe("loadConfig — REFERO_API_BASE validation", () => {
  it("strips a trailing slash", () => {
    const cfg = loadConfig({
      env: { REFERO_API_BASE: "https://staging.example.com/" },
    });
    expect(cfg.apiBase).toBe("https://staging.example.com");
  });

  it("accepts http URLs", () => {
    const cfg = loadConfig({
      env: { REFERO_API_BASE: "http://localhost:8080" },
    });
    expect(cfg.apiBase).toBe("http://localhost:8080");
  });

  it("throws on an invalid URL", () => {
    expect(() =>
      loadConfig({ env: { REFERO_API_BASE: "not-a-url" } }),
    ).toThrow(/REFERO_API_BASE/);
  });

  it("throws on a non-http(s) protocol", () => {
    expect(() =>
      loadConfig({ env: { REFERO_API_BASE: "file:///etc/passwd" } }),
    ).toThrow(/http/);
  });
});

describe("loadConfig — vaultDir validation", () => {
  it("returns null when REFERO_MCP_VAULT_DIR is unset", () => {
    const cfg = loadConfig({ env: {} });
    expect(cfg.vaultDir).toBeNull();
  });

  it("accepts an absolute path", () => {
    const cfg = loadConfig({
      env: { REFERO_MCP_VAULT_DIR: "/Users/test/vault" },
    });
    expect(cfg.vaultDir).toBe("/Users/test/vault");
  });

  it("throws on a relative path", () => {
    expect(() =>
      loadConfig({ env: { REFERO_MCP_VAULT_DIR: "relative/vault" } }),
    ).toThrow(/REFERO_MCP_VAULT_DIR/);
  });
});

describe("loadConfig — cacheDir validation", () => {
  it("accepts an absolute path", () => {
    const cfg = loadConfig({
      env: { REFERO_CACHE_DIR: "/tmp/refero-cache" },
    });
    expect(cfg.cacheDir).toBe("/tmp/refero-cache");
  });

  it("throws on a relative path", () => {
    expect(() =>
      loadConfig({ env: { REFERO_CACHE_DIR: "relative/cache" } }),
    ).toThrow(/REFERO_CACHE_DIR/);
  });
});

describe("loadConfig — cacheTtlMs validation", () => {
  it("accepts a non-negative integer", () => {
    const cfg = loadConfig({
      env: { REFERO_CACHE_TTL_MS: "60000" },
    });
    expect(cfg.cacheTtlMs).toBe(60_000);
  });

  it("accepts 0 (caching disabled)", () => {
    const cfg = loadConfig({ env: { REFERO_CACHE_TTL_MS: "0" } });
    expect(cfg.cacheTtlMs).toBe(0);
  });

  it("throws on a negative value", () => {
    expect(() =>
      loadConfig({ env: { REFERO_CACHE_TTL_MS: "-1" } }),
    ).toThrow(/REFERO_CACHE_TTL_MS/);
  });

  it("throws on a non-numeric value", () => {
    expect(() =>
      loadConfig({ env: { REFERO_CACHE_TTL_MS: "tomorrow" } }),
    ).toThrow(/REFERO_CACHE_TTL_MS/);
  });

  it("throws on a non-integer value", () => {
    expect(() =>
      loadConfig({ env: { REFERO_CACHE_TTL_MS: "3.14" } }),
    ).toThrow(/REFERO_CACHE_TTL_MS/);
  });
});

describe("loadConfig — OPENAI_API_KEY", () => {
  it("captures the key when present", () => {
    const cfg = loadConfig({
      env: { OPENAI_API_KEY: "sk-test-key" },
    });
    expect(cfg.openAiApiKey).toBe("sk-test-key");
  });

  it("trims surrounding whitespace", () => {
    const cfg = loadConfig({
      env: { OPENAI_API_KEY: "  sk-padded  " },
    });
    expect(cfg.openAiApiKey).toBe("sk-padded");
  });
});
