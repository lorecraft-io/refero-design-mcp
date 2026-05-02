#!/usr/bin/env node
/**
 * refero-mcp stdio entrypoint.
 *
 * Boots the MCP server, connects it to a stdio transport, and handles graceful
 * shutdown on SIGINT / SIGTERM. Mirrors the morgen-mcp / motion-mcp pattern.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createReferoServer } from "./server.js";

async function main(): Promise<void> {
  const server = createReferoServer();
  const transport = new StdioServerTransport();

  // Graceful shutdown: close transport then exit. SIGINT / SIGTERM both route
  // here so an MCP host (Claude Desktop, Claude Code) cleaning up child
  // processes doesn't leave a zombie behind.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await server.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[refero-mcp] Error during shutdown (${signal}):`, msg);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await server.connect(transport);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "Unknown error";
  console.error("[refero-mcp] Fatal startup error:", msg);
  process.exit(1);
});
