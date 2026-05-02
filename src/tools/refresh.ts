/**
 * `refero_refresh` — walk every page of /api/styles?page=N until exhausted,
 * dedupe by id, and overwrite catalog.json.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { writeCatalog } from "../cache.js";
import { fetchFullCatalog } from "./shared.js";

export interface RefreshResult {
  totalStyles: number;
  pagesFetched: number;
  durationMs: number;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleRefresh(_args: Record<string, unknown> = {}): Promise<RefreshResult> {
  const started = Date.now();
  const { styles, pagesFetched } = await fetchFullCatalog();
  await writeCatalog(styles);
  return {
    totalStyles: styles.length,
    pagesFetched,
    durationMs: Date.now() - started,
  };
}
