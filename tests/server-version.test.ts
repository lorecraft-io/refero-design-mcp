/**
 * The server's advertised version must track package.json.
 *
 * Regression guard: it used to be a hand-typed constant, which meant every
 * release shipped a server that introduced itself with the previous version.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { SERVER_INFO } from "../src/server.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function packageVersion(): string {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

describe("SERVER_INFO", () => {
  it("reports the version from package.json, not a hardcoded literal", () => {
    expect(SERVER_INFO.version).toBe(packageVersion());
  });

  it("still identifies as 'refero'", () => {
    expect(SERVER_INFO.name).toBe("refero");
  });

  it("exposes a non-empty semver-shaped version", () => {
    expect(SERVER_INFO.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
