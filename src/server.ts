/**
 * MCP server factory.
 *
 * Registers seven tools and wires them to the handlers under `./tools/`. Mirrors
 * the morgen-mcp / motion-mcp request-handler pattern: a single
 * `CallToolRequestSchema` switch, all tool input is unknown until the
 * handler has validated it, and errors are sanitized before being returned.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { handleSearch } from "./tools/search.js";
import { handleGet } from "./tools/get.js";
import { handleDesignMd } from "./tools/design-md.js";
import { handleSimilar } from "./tools/similar.js";
import { handleList } from "./tools/list.js";
import { handleRefresh } from "./tools/refresh.js";
import { handleFacets } from "./tools/facets.js";

const SERVER_NAME = "refero";

// Read the version from package.json rather than restating it here — a
// hand-typed constant silently keeps reporting the old number after every
// release, so `initialize` ends up lying about what's actually running.
// `tsc` emits src/server.ts to dist/server.js, so ../package.json resolves to
// the repo root from both the built package and the vitest run of src/.
const PKG = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
) as { version: string };
const SERVER_VERSION = PKG.version;

const TOOLS: Tool[] = [
  {
    name: "refero_search",
    description:
      "Natural-language search over the styles.refero.design catalog. Returns the top matches scored by an embedding model (when OPENAI_API_KEY is set) or a BM25-lite keyword fallback. The local catalog is mirrored on first call and refreshed automatically every 24 hours.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language vibe query, e.g. \"playful neobrutalist saas\".",
        },
        theme: {
          type: "string",
          enum: ["light", "dark"],
          description: "Filter to light- or dark-themed sites only.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter to styles whose tags / name / northStar mention any of these terms.",
        },
        limit: {
          type: "number",
          description: "How many results to return (default 10, max 50).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "refero_get",
    description:
      "Fetch the full design system for a single style. Accepts a uuid, a hostname/URL (e.g. cursor.com), or a site name (e.g. \"Cursor\"). Fuzzy-matches site names within Levenshtein distance 2.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "uuid, hostname/URL, or site name.",
        },
      },
      required: ["identifier"],
      additionalProperties: false,
    },
  },
  {
    name: "refero_design_md",
    description:
      "Render a Refero style as an agent-friendly DESIGN.md (frontmatter, north star, color table, fonts, dos/donts, tags). When `save_to_project` is set, writes the file to <vault>/05-Projects/<NAME>/DESIGN.md.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "uuid, hostname/URL, or site name to render.",
        },
        save_to_project: {
          type: "string",
          description: "Vault project folder name (e.g. \"PARZVL\"). Sanitized; must be [A-Za-z0-9_.-].",
        },
      },
      required: ["identifier"],
      additionalProperties: false,
    },
  },
  {
    name: "refero_similar",
    description:
      "Refero's own \"similar styles\" recommendation list for a given style. Useful for follow-up exploration once you've found a candidate via refero_search.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "uuid, hostname/URL, or site name.",
        },
        limit: {
          type: "number",
          description: "How many similar styles to return (default 10, max 20).",
        },
      },
      required: ["identifier"],
      additionalProperties: false,
    },
  },
  {
    name: "refero_list",
    description:
      "Browse the local catalog mirror with optional theme/tag filters. Returns paginated, stably-ordered results (newest first, then site name).",
    inputSchema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          enum: ["light", "dark"],
          description: "Filter to light- or dark-themed sites only.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tag terms (matched against siteName + northStar in the catalog projection).",
        },
        page: {
          type: "number",
          description: "1-indexed page number (default 1).",
        },
        limit: {
          type: "number",
          description: "Items per page (default 20, max 50).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "refero_facets",
    description:
      "Discover what the catalog actually contains: ranked font stacks, color names, and theme counts. Call this BEFORE guessing search terms — the catalog has no tag taxonomy, so invented tags match nothing, while any font or color returned here can be passed straight to refero_search as a query.",
    inputSchema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          enum: ["light", "dark"],
          description: "Restrict the facet counts to light- or dark-themed sites.",
        },
        limit: {
          type: "number",
          description: "How many font and color values to return (default 25, max 100).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "refero_refresh",
    description:
      "Force a full re-fetch of the styles.refero.design catalog and overwrite the local mirror. Useful after the catalog has changed and you don't want to wait for the 24h TTL.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

type Args = Record<string, unknown> | undefined;

/** Dispatch a single tool call. Throws on unknown tool. */
async function dispatch(name: string, args: Args): Promise<unknown> {
  const a = args ?? {};
  switch (name) {
    case "refero_search":
      return handleSearch(a);
    case "refero_get":
      return handleGet(a);
    case "refero_design_md":
      return handleDesignMd(a);
    case "refero_similar":
      return handleSimilar(a);
    case "refero_list":
      return handleList(a);
    case "refero_facets":
      return handleFacets(a);
    case "refero_refresh":
      return handleRefresh(a);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Sanitize an error message so we never leak URLs, keys, or stack traces. */
function safeMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message.replace(/https?:\/\/[^\s)]+/g, "[redacted-url]");
  }
  return "An unexpected error occurred";
}

/**
 * Build a fully-wired MCP server. Caller is responsible for connecting it to
 * a transport (the cli entrypoint uses StdioServerTransport).
 */
export function createReferoServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // eslint-disable-next-line @typescript-eslint/require-await
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startedAt = Date.now();

    try {
      const result = await dispatch(name, args as Args);
      console.error(JSON.stringify({
        event: "tool_call",
        tool: name,
        status: "success",
        durationMs: Date.now() - startedAt,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = safeMessage(err);
      console.error(JSON.stringify({
        event: "tool_call",
        tool: name,
        status: "error",
        durationMs: Date.now() - startedAt,
        error: message,
      }));
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/** Convenience export — names mirror the architect's index.ts barrel. */
export const SERVER_INFO = { name: SERVER_NAME, version: SERVER_VERSION } as const;
