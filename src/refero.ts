/**
 * HTTP client for styles.refero.design.
 *
 * - 10s per-request timeout via AbortSignal.timeout
 * - 3 retries with exponential backoff (1s/2s/4s) on 5xx + network errors
 * - Throws structured ReferoApiError on 4xx (no retry)
 * - User-Agent identifies refero-mcp + repo URL
 * - Honors REFERO_API_BASE env override (via loadConfig)
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { loadConfig } from "./config.js";
import {
  ReferoApiError,
  type StyleDetailResponse,
  type StylesListResponse,
} from "./types.js";

const USER_AGENT = "refero-mcp/0.1.0 (+https://github.com/lorecraft-io/refero-mcp)";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000] as const;

function getBase(): string {
  return loadConfig().apiBase;
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  // Node's fetch surfaces transient network failures as a TypeError with
  // cause set to UND_ERR_*.
  if (err.name === "TypeError" && err.message.toLowerCase().includes("fetch failed")) return true;
  return false;
}

async function readBodyExcerpt(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestJson<T>(path: string): Promise<T> {
  const url = `${getBase()}${path}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      // 4xx: no retry, throw structured error.
      if (res.status >= 400 && res.status < 500) {
        const body = await readBodyExcerpt(res);
        throw new ReferoApiError(
          `Refero API ${res.status} on ${path}: ${res.statusText || "client error"}`,
          res.status,
          body,
        );
      }

      // 5xx: retry with backoff.
      if (attempt < MAX_ATTEMPTS) {
        const delay = BACKOFF_MS[attempt - 1] ?? 4_000;
        await sleep(delay);
        lastError = new ReferoApiError(
          `Refero API ${res.status} on ${path} (attempt ${attempt})`,
          res.status,
          await readBodyExcerpt(res),
        );
        continue;
      }

      const body = await readBodyExcerpt(res);
      throw new ReferoApiError(
        `Refero API ${res.status} on ${path} after ${MAX_ATTEMPTS} attempts`,
        res.status,
        body,
      );
    } catch (err) {
      // ReferoApiError on 4xx is final — re-throw immediately.
      if (err instanceof ReferoApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      // Network/timeout: retry.
      if (isRetryableNetworkError(err) && attempt < MAX_ATTEMPTS) {
        const delay = BACKOFF_MS[attempt - 1] ?? 4_000;
        await sleep(delay);
        lastError = err;
        continue;
      }

      // Last attempt or non-retryable — surface it.
      if (attempt === MAX_ATTEMPTS) {
        if (err instanceof ReferoApiError) throw err;
        const msg = err instanceof Error ? err.message : "unknown network error";
        throw new ReferoApiError(
          `Refero request failed on ${path} after ${MAX_ATTEMPTS} attempts: ${msg}`,
          0,
          null,
        );
      }

      lastError = err;
    }
  }

  // Defensive — should be unreachable.
  if (lastError instanceof Error) throw lastError;
  throw new ReferoApiError(`Refero request failed on ${path}`, 0, null);
}

/** Fetch one page of the catalog. */
export async function listPage(page: number): Promise<StylesListResponse> {
  if (!Number.isInteger(page) || page < 1) {
    throw new ReferoApiError(
      `listPage: page must be a positive integer (got ${String(page)})`,
      0,
      null,
    );
  }
  return requestJson<StylesListResponse>(`/api/styles?page=${page}`);
}

/** Fetch a single style by uuid. */
export async function getById(id: string): Promise<StyleDetailResponse> {
  if (!id || typeof id !== "string") {
    throw new ReferoApiError(`getById: id is required`, 0, null);
  }
  // Refero ids are uuid-shaped — defend against accidental URL injection.
  if (!/^[0-9a-fA-F-]{8,}$/.test(id)) {
    throw new ReferoApiError(`getById: id is not a valid uuid (got ${id})`, 0, null);
  }
  return requestJson<StyleDetailResponse>(`/api/styles/${encodeURIComponent(id)}`);
}
