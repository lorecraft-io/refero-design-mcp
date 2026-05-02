/**
 * Path-safety helpers for `save_to_project`.
 *
 * SECURITY-CRITICAL. The MCP tool `refero_design_md` accepts a project name
 * from the LLM caller and writes a DESIGN.md inside the user's vault. A naive
 * implementation lets a prompt injection write to anywhere on disk. This
 * module enforces the contract:
 *
 *   - reject empty / non-string input
 *   - reject `..` anywhere in the name
 *   - reject any path separator (`/`, `\`)
 *   - reject absolute paths
 *   - reject NUL bytes
 *   - allow only [A-Za-z0-9_.-] (start/end alphanumeric); no leading dot
 *   - resolve against REFERO_MCP_VAULT_DIR (via loadConfig); throw if unset
 *   - return <vault>/05-Projects/<NAME>/
 *   - the resolved path MUST be inside the projects root (defence in depth)
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { resolve, sep } from "node:path";
import { loadConfig } from "./config.js";

const PROJECTS_SUBDIR = "05-Projects";
const MAX_NAME_LEN = 100;
const ALLOWED_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$/;

export class PathSafetyError extends Error {
  public override readonly name = "PathSafetyError";
}

function vaultRoot(): string {
  const cfg = loadConfig();
  if (cfg.vaultDir === null) {
    throw new PathSafetyError(
      "save_to_project: REFERO_MCP_VAULT_DIR is not set; cannot resolve vault root",
    );
  }
  return resolve(cfg.vaultDir);
}

/**
 * Sanitize a project name and resolve it to <vault>/05-Projects/<NAME>/.
 * Throws PathSafetyError if the name fails any check.
 */
export function resolveProjectDir(name: string): string {
  if (typeof name !== "string") {
    throw new PathSafetyError("save_to_project: name must be a string");
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new PathSafetyError("save_to_project: name is empty");
  }
  if (trimmed.length > MAX_NAME_LEN) {
    throw new PathSafetyError(`save_to_project: name exceeds ${MAX_NAME_LEN} chars`);
  }
  if (trimmed.includes("\0")) {
    throw new PathSafetyError("save_to_project: NUL byte in name");
  }
  if (trimmed.includes("..")) {
    throw new PathSafetyError("save_to_project: '..' is not allowed");
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new PathSafetyError("save_to_project: path separators are not allowed");
  }
  if (trimmed.startsWith(".")) {
    throw new PathSafetyError("save_to_project: name cannot start with '.'");
  }
  if (!ALLOWED_NAME.test(trimmed)) {
    throw new PathSafetyError(
      "save_to_project: name must match [A-Za-z0-9_.-] and start/end with alphanumeric",
    );
  }

  const root = vaultRoot();
  const projectsRoot = resolve(root, PROJECTS_SUBDIR);
  const target = resolve(projectsRoot, trimmed);

  // Defence in depth: the resolved path must be a direct child of projectsRoot.
  const expectedPrefix = projectsRoot + sep;
  if (!target.startsWith(expectedPrefix)) {
    throw new PathSafetyError(
      `save_to_project: resolved path escapes projects root (${target})`,
    );
  }
  if (target === projectsRoot) {
    throw new PathSafetyError("save_to_project: resolved to projects root itself");
  }

  return target;
}

/** Diagnostic helper. */
export function getVaultRoot(): string {
  return vaultRoot();
}
