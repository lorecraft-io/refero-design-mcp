/**
 * refero-mcp — environment-driven configuration loader.
 *
 * All runtime knobs live in env vars so the MCP can be configured purely via
 * the host's MCP `env` block (claude_desktop_config.json / settings.json),
 * with no on-disk config file required.
 *
 * Defaults are chosen so a zero-config install does the right thing for a
 * single-user local install:
 *   - Talk to the production Refero base URL.
 *   - Cache the catalog under `~/.refero-cache` so multiple vaults share it.
 *   - 24-hour cache TTL — Refero's catalog grows slowly (~200 styles in
 *     beta), so daily refresh is plenty.
 *
 * Required vars:
 *   - none. Everything has a default. The MCP boots without an OpenAI key
 *     and falls back to lexical search.
 *
 * Optional vars:
 *   - REFERO_API_BASE       Override the base URL (e.g. for a staging mirror).
 *   - REFERO_MCP_VAULT_DIR  Where `write_design_md` drops generated files.
 *                           If unset, write tools require an absolute path arg.
 *   - OPENAI_API_KEY        Enables embedding-backed semantic search.
 *   - REFERO_CACHE_DIR      Override the catalog mirror location.
 *   - REFERO_CACHE_TTL_MS   How long a cached `/api/styles?page=N` response
 *                           is considered fresh, in milliseconds.
 */

import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Production Refero base URL. */
export const DEFAULT_REFERO_API_BASE = "https://styles.refero.design";

/** Default cache directory: `~/.refero-cache`. Picked over `XDG_CACHE_HOME`
 *  on purpose — most refero-mcp users are macOS where XDG isn't standard. */
export const DEFAULT_REFERO_CACHE_DIR = join(homedir(), ".refero-cache");

/** Default cache TTL for catalog list pages: 24 hours. */
export const DEFAULT_REFERO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Resolved config shape
// ---------------------------------------------------------------------------

export interface ReferoConfig {
  /** Base URL of the Refero HTTP API. No trailing slash. */
  apiBase: string;

  /** Absolute path of the vault directory the MCP is allowed to write into.
   *  `null` means writes must specify an absolute target path explicitly. */
  vaultDir: string | null;

  /** OpenAI API key for embedding-backed semantic search. `null` falls back
   *  to lexical search. Never logged, never persisted. */
  openAiApiKey: string | null;

  /** Absolute path to the catalog mirror cache directory. */
  cacheDir: string;

  /** Cache TTL for catalog list pages, in milliseconds. Always >= 0;
   *  a value of 0 disables caching (every call re-fetches). */
  cacheTtlMs: number;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export interface LoadConfigOptions {
  /** Override `process.env` — primarily for tests. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve config from the environment with defaults applied.
 *
 * Pure / side-effect-free: reads env, returns config. Callers are responsible
 * for `mkdir -p` on `cacheDir` before writing to it.
 *
 * Validation:
 *   - `REFERO_API_BASE` must be a valid `http(s)` URL if set.
 *   - `REFERO_MCP_VAULT_DIR` must be an absolute path if set.
 *   - `REFERO_CACHE_DIR` must be an absolute path if set.
 *   - `REFERO_CACHE_TTL_MS` must parse to a non-negative integer if set.
 *
 * Invalid values throw — better to fail loud at boot than to silently
 * fall back and confuse downstream behavior.
 */
export function loadConfig(options: LoadConfigOptions = {}): ReferoConfig {
  const env = options.env ?? process.env;

  return {
    apiBase: resolveApiBase(env.REFERO_API_BASE),
    vaultDir: resolveVaultDir(env.REFERO_MCP_VAULT_DIR),
    openAiApiKey: nonEmpty(env.OPENAI_API_KEY),
    cacheDir: resolveCacheDir(env.REFERO_CACHE_DIR),
    cacheTtlMs: resolveCacheTtl(env.REFERO_CACHE_TTL_MS),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveApiBase(raw: string | undefined): string {
  const value = nonEmpty(raw);
  if (value === null) return DEFAULT_REFERO_API_BASE;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `REFERO_API_BASE is not a valid URL: ${JSON.stringify(value)}`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `REFERO_API_BASE must be http(s); got ${parsed.protocol}`,
    );
  }
  // Normalize: strip trailing slash so callers can `${base}/api/...`.
  return value.replace(/\/+$/, "");
}

function resolveVaultDir(raw: string | undefined): string | null {
  const value = nonEmpty(raw);
  if (value === null) return null;
  if (!isAbsolutePath(value)) {
    throw new Error(
      `REFERO_MCP_VAULT_DIR must be an absolute path; got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function resolveCacheDir(raw: string | undefined): string {
  const value = nonEmpty(raw);
  if (value === null) return DEFAULT_REFERO_CACHE_DIR;
  if (!isAbsolutePath(value)) {
    throw new Error(
      `REFERO_CACHE_DIR must be an absolute path; got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function resolveCacheTtl(raw: string | undefined): number {
  const value = nonEmpty(raw);
  if (value === null) return DEFAULT_REFERO_CACHE_TTL_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `REFERO_CACHE_TTL_MS must be a non-negative integer; got ${JSON.stringify(value)}`,
    );
  }
  return parsed;
}

/** Cross-platform absolute-path check (POSIX `/foo` or Windows `C:\foo`). */
function isAbsolutePath(value: string): boolean {
  if (value.startsWith("/")) return true;
  // Windows drive letter
  if (/^[A-Za-z]:[\\/]/.test(value)) return true;
  // UNC path
  if (value.startsWith("\\\\")) return true;
  return false;
}
