/**
 * Unified scoring layer.
 *
 * Two backends behind one Scorer interface:
 *   - OpenAIScorer: lazy-imports `openai`, uses text-embedding-3-small,
 *     cosine similarity, caches item vectors keyed by id+text-hash.
 *   - KeywordScorer: BM25-lite over tokenized text. Always works, zero deps.
 *
 * `getScorer()` tries OpenAI, falls back to Keyword on any error, logs the
 * choice once at startup.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { createHash } from "node:crypto";
import { readEmbeddings, writeEmbeddings } from "./cache.js";
import { loadConfig } from "./config.js";

export interface ScorerItem {
  id: string;
  text: string;
}

export interface ScoredItem {
  id: string;
  score: number;
}

export interface Scorer {
  name: "openai" | "keyword";
  score(query: string, items: ScorerItem[]): Promise<ScoredItem[]>;
}

export class EmbeddingsUnavailableError extends Error {
  public override readonly name = "EmbeddingsUnavailableError";
}

const OPENAI_MODEL = "text-embedding-3-small";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------- Keyword (BM25-lite) ----------

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "in", "is", "it", "its", "of", "on", "or", "she",
  "that", "the", "they", "this", "to", "was", "were", "will", "with",
  "i", "you", "we", "our", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

class KeywordScorerImpl implements Scorer {
  public readonly name = "keyword" as const;

  // eslint-disable-next-line @typescript-eslint/require-await
  async score(query: string, items: ScorerItem[]): Promise<ScoredItem[]> {
    const queryTerms = Array.from(new Set(tokenize(query)));
    if (queryTerms.length === 0) {
      return items.map((item) => ({ id: item.id, score: 0 }));
    }

    return items.map((item) => {
      const itemTerms = tokenize(item.text);
      if (itemTerms.length === 0) return { id: item.id, score: 0 };
      const tf = new Map<string, number>();
      for (const t of itemTerms) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      for (const q of queryTerms) {
        const f = tf.get(q) ?? 0;
        if (f === 0) continue;
        // BM25-lite: f / (f + k1), k1 = 1.5.
        score += f / (f + 1.5);
      }
      return { id: item.id, score };
    });
  }
}

// ---------- OpenAI ----------

interface OpenAIClientLike {
  embeddings: {
    create(params: { model: string; input: string | string[] }): Promise<{
      data: { embedding: number[] }[];
    }>;
  };
}

async function loadOpenAI(): Promise<OpenAIClientLike> {
  const cfg = loadConfig();
  if (!cfg.openAiApiKey) {
    throw new EmbeddingsUnavailableError("OPENAI_API_KEY not set");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import shape varies by `openai` version
  let mod: any;
  try {
    mod = await import("openai");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new EmbeddingsUnavailableError(`openai package not installed: ${msg}`);
  }
  // openai >=4 exposes default export as the OpenAI class.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const Ctor: any = mod.default ?? mod.OpenAI ?? mod;
  if (typeof Ctor !== "function") {
    throw new EmbeddingsUnavailableError("openai package has no usable constructor export");
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  return new Ctor({ apiKey: cfg.openAiApiKey }) as OpenAIClientLike;
}

class OpenAIScorerImpl implements Scorer {
  public readonly name = "openai" as const;
  private client: OpenAIClientLike | null = null;

  private async getClient(): Promise<OpenAIClientLike> {
    if (!this.client) this.client = await loadOpenAI();
    return this.client;
  }

  private async embedOne(text: string): Promise<number[]> {
    const client = await this.getClient();
    const res = await client.embeddings.create({ model: OPENAI_MODEL, input: text });
    const first = res.data[0];
    if (!first) throw new EmbeddingsUnavailableError("OpenAI returned no embeddings");
    return first.embedding;
  }

  private async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const client = await this.getClient();
    const res = await client.embeddings.create({ model: OPENAI_MODEL, input: texts });
    if (res.data.length !== texts.length) {
      throw new EmbeddingsUnavailableError(
        `OpenAI returned ${res.data.length} embeddings for ${texts.length} inputs`,
      );
    }
    return res.data.map((d) => d.embedding);
  }

  async score(query: string, items: ScorerItem[]): Promise<ScoredItem[]> {
    if (items.length === 0) return [];
    const cache = (await readEmbeddings()) ?? {
      model: OPENAI_MODEL,
      vectors: {},
      textHashes: {},
    };

    // Drop cache if model changed.
    if (cache.model !== OPENAI_MODEL) {
      cache.model = OPENAI_MODEL;
      cache.vectors = {};
      cache.textHashes = {};
    }

    const textHashes = cache.textHashes ?? {};
    const missing: ScorerItem[] = [];
    for (const item of items) {
      const hash = sha256(item.text);
      const cached = cache.vectors[item.id];
      if (!cached || textHashes[item.id] !== hash) {
        missing.push(item);
      }
    }

    if (missing.length > 0) {
      // Batch in groups of 96 — keeps blast radius small if one item has
      // malformed text.
      const BATCH = 96;
      for (let i = 0; i < missing.length; i += BATCH) {
        const slice = missing.slice(i, i + BATCH);
        const vectors = await this.embedMany(slice.map((s) => s.text));
        for (let j = 0; j < slice.length; j++) {
          const item = slice[j];
          const vec = vectors[j];
          if (!item || !vec) continue;
          cache.vectors[item.id] = vec;
          textHashes[item.id] = sha256(item.text);
        }
      }
      cache.textHashes = textHashes;
      await writeEmbeddings(cache);
    }

    const queryVec = await this.embedOne(query);
    return items.map((item) => {
      const vec = cache.vectors[item.id];
      if (!vec) return { id: item.id, score: 0 };
      return { id: item.id, score: cosine(queryVec, vec) };
    });
  }
}

// ---------- factory ----------

let cachedScorer: Scorer | null = null;
let loggedChoice = false;

export async function getScorer(): Promise<Scorer> {
  if (cachedScorer) return cachedScorer;

  // Prefer OpenAI if both the env var and the package are available. Fall
  // back to keyword scoring on any error so the MCP server never fails just
  // because embeddings aren't configured.
  try {
    if (!loadConfig().openAiApiKey) {
      throw new EmbeddingsUnavailableError("OPENAI_API_KEY not set");
    }
    await import("openai");
    cachedScorer = new OpenAIScorerImpl();
  } catch (err) {
    cachedScorer = new KeywordScorerImpl();
    if (!loggedChoice) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[refero-mcp] embeddings: using keyword scorer (${msg}).`);
    }
  }

  if (!loggedChoice) {
    console.error(`[refero-mcp] embeddings: scorer = ${cachedScorer.name}`);
    loggedChoice = true;
  }
  return cachedScorer;
}

/** Test hook — reset the cached scorer (not exported through index). */
export function _resetScorerForTest(): void {
  cachedScorer = null;
  loggedChoice = false;
}
