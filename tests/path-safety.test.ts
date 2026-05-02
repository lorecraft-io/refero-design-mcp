/**
 * refero-mcp — path-safety tests (SECURITY-CRITICAL).
 *
 * Verifies the contract documented in src/path-safety.ts:
 *   resolveProjectDir(name: string): string
 *
 * Maps a user-supplied "project name" to an absolute filesystem path under
 * `<vault>/05-Projects/<NAME>/`. Vault root is read from
 * REFERO_MCP_VAULT_DIR (via loadConfig) so this test never touches the real
 * BRAIN2 vault.
 *
 * The function MUST reject:
 *   1. Path-traversal segments: "..", anything containing "/" or "\\".
 *   2. Absolute paths.
 *   3. Empty / whitespace-only names.
 *   4. NUL bytes.
 *   5. URL-encoded traversal: "%2e%2e", "%2f", etc. — the function decodes
 *      its strict-charset regex to the raw input, so encoded payloads are
 *      blocked indirectly by the ALLOWED_NAME regex (`%` not in charset).
 *   6. Names beginning with "." (dotfile escape).
 *
 * Trailing-whitespace handling: implementation TRIMS first then validates.
 * `"PARZVL "` → "PARZVL" (allowed). All-whitespace → empty → rejected.
 *
 * Symlink semantics: resolveProjectDir is a pure path-join + lexical
 * resolve(). It does NOT call fs.realpath, so a symlink at
 * `<vault>/05-Projects/LINKED` resolves to its lexical path (under the
 * vault), not the target. Layered checks (write-time realpath comparison)
 * live elsewhere.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { resolveProjectDir, PathSafetyError } from "../src/path-safety.js";

// String.fromCharCode(0) keeps source files free of literal NUL bytes,
// which some editors and `git diff` mangle.
const NUL = String.fromCharCode(0);

let vaultRoot: string;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "refero-mcp-vault-"));
  fs.mkdirSync(path.join(vaultRoot, "05-Projects"), { recursive: true });
  fs.mkdirSync(path.join(vaultRoot, "05-Projects", "PARZVL"), {
    recursive: true,
  });

  process.env = { ...ORIGINAL_ENV };
  process.env.REFERO_MCP_VAULT_DIR = vaultRoot;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe("resolveProjectDir — happy path", () => {
  it("resolves PARZVL to <vault>/05-Projects/PARZVL/", () => {
    const got = resolveProjectDir("PARZVL");
    expect(got).toBe(path.join(vaultRoot, "05-Projects", "PARZVL"));
  });

  it("resolves a project name with hyphens and digits", () => {
    fs.mkdirSync(path.join(vaultRoot, "05-Projects", "BLOOM-HQ"), {
      recursive: true,
    });
    const got = resolveProjectDir("BLOOM-HQ");
    expect(got).toBe(path.join(vaultRoot, "05-Projects", "BLOOM-HQ"));
  });

  it("resolves names containing underscores", () => {
    const got = resolveProjectDir("my_project");
    expect(got).toBe(path.join(vaultRoot, "05-Projects", "my_project"));
  });

  it("does NOT require the directory to pre-exist (caller mkdirs)", () => {
    // resolveProjectDir is pure path resolution — it doesn't stat/mkdir.
    expect(() =>
      resolveProjectDir("DOES-NOT-EXIST-YET"),
    ).not.toThrow();
  });
});

describe("resolveProjectDir — traversal rejection", () => {
  it("throws PathSafetyError on '..'", () => {
    expect(() => resolveProjectDir("..")).toThrow(PathSafetyError);
  });

  it("throws on '../../../etc'", () => {
    expect(() => resolveProjectDir("../../../etc")).toThrow(PathSafetyError);
  });

  it("throws on '.' (current dir reference / leading dot)", () => {
    expect(() => resolveProjectDir(".")).toThrow(PathSafetyError);
  });

  it("throws on a forward-slash separator inside the name", () => {
    expect(() => resolveProjectDir("PARZVL/sub")).toThrow(PathSafetyError);
  });

  it("throws on a backslash separator inside the name", () => {
    expect(() => resolveProjectDir("PARZVL\\sub")).toThrow(PathSafetyError);
  });

  it("throws on '..' anywhere in the name (e.g. 'foo..bar')", () => {
    expect(() => resolveProjectDir("foo..bar")).toThrow(PathSafetyError);
  });
});

describe("resolveProjectDir — absolute path rejection", () => {
  it("throws on a Unix absolute path", () => {
    expect(() => resolveProjectDir("/absolute/path")).toThrow(PathSafetyError);
  });

  it("throws on a Windows-style drive root", () => {
    expect(() => resolveProjectDir("C:\\Windows\\System32")).toThrow(
      PathSafetyError,
    );
  });

  it("throws on a UNC path", () => {
    expect(() => resolveProjectDir("\\\\server\\share")).toThrow(
      PathSafetyError,
    );
  });
});

describe("resolveProjectDir — empty / whitespace", () => {
  it("throws on the empty string", () => {
    expect(() => resolveProjectDir("")).toThrow(PathSafetyError);
  });

  it("throws on whitespace-only input (trims to empty)", () => {
    expect(() => resolveProjectDir("   ")).toThrow(PathSafetyError);
  });

  it("normalizes trailing space (strict trim, then re-validate)", () => {
    // Behavioral choice (per the implementation): trim-then-validate.
    const got = resolveProjectDir("PARZVL ");
    expect(got).toBe(path.join(vaultRoot, "05-Projects", "PARZVL"));
  });

  it("normalizes leading whitespace too", () => {
    const got = resolveProjectDir("  PARZVL");
    expect(got).toBe(path.join(vaultRoot, "05-Projects", "PARZVL"));
  });
});

describe("resolveProjectDir — control characters", () => {
  it("throws on a trailing NUL byte", () => {
    expect(() => resolveProjectDir(`PARZVL${NUL}`)).toThrow(PathSafetyError);
  });

  it("throws on a NUL byte in the middle of the name", () => {
    expect(() => resolveProjectDir(`PA${NUL}RZVL`)).toThrow(PathSafetyError);
  });

  it("throws on an embedded newline character (not just trailing)", () => {
    // Trailing whitespace gets normalized via trim(); an EMBEDDED newline
    // survives the trim and must be rejected by the strict charset regex.
    expect(() => resolveProjectDir("PAR\nZVL")).toThrow(PathSafetyError);
  });

  it("throws on an embedded tab character", () => {
    expect(() => resolveProjectDir("PAR\tZVL")).toThrow(PathSafetyError);
  });
});

describe("resolveProjectDir — URL-encoded traversal", () => {
  // The implementation enforces a strict character set
  // (`^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$`), which means '%'
  // is rejected outright. So encoded traversal is blocked at the regex
  // gate even without an explicit decode-then-revalidate step.
  it("throws on '%2e%2e' (encoded ..)", () => {
    expect(() => resolveProjectDir("%2e%2e")).toThrow(PathSafetyError);
  });

  it("throws on '%2e%2e%2fetc' (encoded ../etc)", () => {
    expect(() => resolveProjectDir("%2e%2e%2fetc")).toThrow(PathSafetyError);
  });

  it("throws on '%2fabsolute' (encoded leading slash)", () => {
    expect(() => resolveProjectDir("%2fabsolute")).toThrow(PathSafetyError);
  });

  it("throws on a mixed-case URL-encoding ('%2E%2E')", () => {
    expect(() => resolveProjectDir("%2E%2E")).toThrow(PathSafetyError);
  });
});

describe("resolveProjectDir — leading-dot rejection", () => {
  it("throws on a name starting with '.' (dotfile escape)", () => {
    expect(() => resolveProjectDir(".hidden")).toThrow(PathSafetyError);
  });

  it("throws on '...'", () => {
    expect(() => resolveProjectDir("...")).toThrow(PathSafetyError);
  });
});

describe("resolveProjectDir — length limit", () => {
  it("throws on names exceeding 100 chars", () => {
    const name = "a".repeat(101);
    expect(() => resolveProjectDir(name)).toThrow(PathSafetyError);
  });

  it("accepts a name at the 100-char boundary", () => {
    const name = "a".repeat(100);
    expect(() => resolveProjectDir(name)).not.toThrow();
  });
});

describe("resolveProjectDir — symlink semantics", () => {
  it("returns the lexical (symlink) path, not the link target", () => {
    const realTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "refero-mcp-target-"),
    );
    const symPath = path.join(vaultRoot, "05-Projects", "LINKED");

    try {
      fs.symlinkSync(realTarget, symPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") {
        // Sandbox refuses symlinks — skip rather than fail. The rule still
        // applies on the user's real machine.
        return;
      }
      throw err;
    }

    const got = resolveProjectDir("LINKED");

    // resolveProjectDir is a pure path computation — it must not call
    // realpath() and "leak" the symlink target back to the caller. Layered
    // checks (write-time realpath comparison) live elsewhere.
    expect(got).toBe(symPath);
    expect(got).not.toBe(realTarget);

    fs.rmSync(realTarget, { recursive: true, force: true });
  });
});

describe("resolveProjectDir — type validation", () => {
  it("throws on non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolveProjectDir(123 as any)).toThrow(PathSafetyError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolveProjectDir(null as any)).toThrow(PathSafetyError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolveProjectDir(undefined as any)).toThrow(PathSafetyError);
  });
});
