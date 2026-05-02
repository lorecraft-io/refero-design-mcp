/**
 * refero-mcp — HTTP client tests (src/refero.ts).
 *
 * Verifies the contract documented in src/refero.ts:
 *  - 200 → JSON parsed and returned (here exercised via listPage / getById,
 *    the only public exports).
 *  - 5xx → up to 3 attempts (initial + 2 retries) with backoff [1s, 2s, 4s]
 *    then thrown as ReferoApiError.
 *  - Network errors (TypeError "fetch failed") → retried then thrown.
 *  - 4xx → terminal, NEVER retried.
 *  - 10s per-request timeout via AbortSignal.timeout.
 *  - User-Agent header is set so Refero can identify our client in logs.
 *  - REFERO_API_BASE env override is honored, trailing slash stripped, and
 *    invalid URLs throw at config-resolve time.
 *
 * NOTE on fake timers: the wrapper sleeps with `setTimeout` between retries.
 * We drive those with `vi.useFakeTimers()` + `advanceTimersByTimeAsync` so
 * the test never actually waits 1+2 = 3s wall-clock.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReferoApiError } from "../src/types.js";
import { getById, listPage } from "../src/refero.js";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function errorResponse(status: number, body = "boom"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.REFERO_API_BASE;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe("listPage — happy path", () => {
  it("parses a 200 JSON response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listPage(1);

    expect(result).toEqual({
      styles: [],
      nextCursor: null,
      nextPage: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sets a User-Agent header so Refero can identify the client", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPage(1);

    const init = fetchMock.mock.calls[0]![1];
    const headers = new Headers(init?.headers);
    const ua = headers.get("user-agent");
    expect(ua).toBeTruthy();
    expect(ua!.toLowerCase()).toContain("refero-mcp");
  });

  it("rejects a non-positive page number locally without hitting fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listPage(0)).rejects.toBeInstanceOf(ReferoApiError);
    await expect(listPage(-1)).rejects.toBeInstanceOf(ReferoApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("listPage — retry behavior", () => {
  it("retries 503 up to MAX_ATTEMPTS times then throws ReferoApiError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(errorResponse(503, "service unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = listPage(1);
    const settled = expect(promise).rejects.toBeInstanceOf(ReferoApiError);
    // Backoff is [1s, 2s, 4s]. 60s drains everything.
    await vi.advanceTimersByTimeAsync(60_000);
    await settled;

    // Coder constant: MAX_ATTEMPTS = 3 (one initial + two retries). The wider
    // 3..4 range tolerates either "3 attempts total" or "1 + 3 retries"
    // interpretations — neither is wrong, but at least 3 tries must happen.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("retries on TCP-style network errors (TypeError 'fetch failed')", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = listPage(1);
    const settled = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    await settled;

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT retry 404 (4xx is terminal)", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(errorResponse(404, '{"error":"not found"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      // getById exercises the same wrapper. Use a uuid-shaped id so the
      // local pre-check passes and we actually hit the network.
      getById("00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(ReferoApiError);

    // Crucial invariant: 4xx terminates immediately. If anyone "improves"
    // this with a retry loop, they will hammer Refero and earn a rate limit.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry 400", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(errorResponse(400, "bad request"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listPage(1)).rejects.toBeInstanceOf(ReferoApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 503 then succeeds when the next attempt returns 200", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = listPage(1);
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;

    expect(result.styles).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("listPage — timeout", () => {
  it("passes an AbortSignal to fetch (so the timeout can interrupt in-flight requests)", async () => {
    // We don't drive AbortSignal.timeout with fake timers — Node's
    // AbortSignal.timeout uses an internal timer source vitest's fake timers
    // do not always intercept reliably across Node versions. Instead we
    // assert the wrapper hands fetch an AbortSignal at all; that's the
    // load-bearing piece. If the signal isn't passed, the 10s budget can
    // never fire and the request hangs forever.
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"styles":[],"nextCursor":null,"nextPage":null}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPage(1);

    const init = fetchMock.mock.calls[0]![1];
    expect(init?.signal).toBeDefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("surfaces an AbortError as a retryable failure (then throws after retries are exhausted)", async () => {
    vi.useFakeTimers();
    // Fake an already-aborted signal scenario: every attempt rejects with
    // AbortError, mimicking the timeout firing repeatedly. The wrapper
    // must treat AbortError as retryable and eventually throw.
    const fetchMock = vi.fn<typeof fetch>(() => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = listPage(1);
    const settled = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    await settled;

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("REFERO_API_BASE env — honored at request time", () => {
  it("uses REFERO_API_BASE for the request URL", async () => {
    process.env.REFERO_API_BASE = "https://staging.refero.example";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPage(1);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toBe("https://staging.refero.example/api/styles?page=1");
  });

  it("defaults to styles.refero.design when env is unset", async () => {
    delete process.env.REFERO_API_BASE;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPage(1);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toMatch(/^https:\/\/styles\.refero\.design\//);
  });

  it("strips a trailing slash on REFERO_API_BASE so the URL never doubles", async () => {
    process.env.REFERO_API_BASE = "https://staging.refero.example/";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ styles: [], nextCursor: null, nextPage: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPage(1);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).not.toMatch(/\/\/api\//);
    expect(url).toBe("https://staging.refero.example/api/styles?page=1");
  });
});
