/**
 * Filesystem cache for the refero catalog, per-style detail, and embeddings.
 *
 * Layout (default ~/.refero-cache/, override REFERO_CACHE_DIR):
 *   catalog.json                      — { updatedAt, styles[] }
 *   styles/<uuid>.json                — full style detail
 *   embeddings.json                   — { model, vectors }
 *
 * All writes are atomic: write to <path>.tmp then rename. TTL default 24h
 * (override REFERO_CACHE_TTL_MS). Both knobs come from `loadConfig()`.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig } from "./config.js";
import type { FullStyle, StyleListItem } from "./types.js";

function cacheRoot(): string {
  return loadConfig().cacheDir;
}

function ttlMs(): number {
  return loadConfig().cacheTtlMs;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function atomicWrite(path: string, data: string): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, data, "utf8");
  await rename(tmp, path);
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    if (!existsSync(path)) return null;
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as T;
  } catch {
    // Corrupt cache file — treat as absent. Caller will refetch.
    return null;
  }
}

export interface CatalogFile {
  updatedAt: number;
  styles: StyleListItem[];
}

export interface StyleCacheFile {
  updatedAt: number;
  style: FullStyle;
}

export interface EmbeddingsFile {
  model: string;
  /** id -> vector. */
  vectors: Record<string, number[]>;
  /** id -> sha256 of the text the vector was computed from. */
  textHashes?: Record<string, string>;
}

const CATALOG_PATH = (): string => join(cacheRoot(), "catalog.json");
const STYLE_PATH = (id: string): string => join(cacheRoot(), "styles", `${id}.json`);
const EMBEDDINGS_PATH = (): string => join(cacheRoot(), "embeddings.json");

export function isFresh(updatedAt: number, ttl: number = ttlMs()): boolean {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false;
  // TTL of 0 disables caching — treat any age as stale.
  if (ttl <= 0) return false;
  return Date.now() - updatedAt < ttl;
}

export async function readCatalog(): Promise<CatalogFile | null> {
  return readJsonOrNull<CatalogFile>(CATALOG_PATH());
}

export async function writeCatalog(styles: StyleListItem[]): Promise<CatalogFile> {
  const file: CatalogFile = { updatedAt: Date.now(), styles };
  await atomicWrite(CATALOG_PATH(), JSON.stringify(file));
  return file;
}

export async function readStyle(id: string): Promise<StyleCacheFile | null> {
  return readJsonOrNull<StyleCacheFile>(STYLE_PATH(id));
}

export async function writeStyle(id: string, style: FullStyle): Promise<void> {
  const file: StyleCacheFile = { updatedAt: Date.now(), style };
  await atomicWrite(STYLE_PATH(id), JSON.stringify(file));
}

export async function readEmbeddings(): Promise<EmbeddingsFile | null> {
  return readJsonOrNull<EmbeddingsFile>(EMBEDDINGS_PATH());
}

export async function writeEmbeddings(file: EmbeddingsFile): Promise<void> {
  await atomicWrite(EMBEDDINGS_PATH(), JSON.stringify(file));
}

/** Resolve the on-disk cache root (useful for diagnostics). */
export function getCacheRoot(): string {
  return cacheRoot();
}

/** Default TTL in ms (effective). */
export function getTtlMs(): number {
  return ttlMs();
}
