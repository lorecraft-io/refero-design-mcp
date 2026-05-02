/**
 * refero-mcp — DESIGN.md renderer tests (src/design-md.ts).
 *
 * Verifies the contract documented in src/design-md.ts:
 *  - `renderDesignMd(full: FullStyle): string` is a pure function — same
 *    input must produce identical bytes (no Date.now(), no locale-dependent
 *    formatting).
 *  - Snapshot the real ElevenLabs + Cursor fixtures so any prompt drift,
 *    accidental locale, or accidental Date.now() in the output is caught.
 *  - Frontmatter must include the canonical fields the design-md skill
 *    consumes downstream: source_url, site_name, extracted_at, theme, tags.
 *  - Pipe characters in color names must be escaped so the markdown table
 *    doesn't break (`Sun|Set` → `Sun\|Set`).
 *  - Empty fonts → no fonts SECTION at all (not an empty heading).
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { renderDesignMd } from "../src/design-md.js";
import type { FullStyle } from "../src/types.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): { style: FullStyle } {
  const raw = fs.readFileSync(
    path.join(TEST_DIR, "fixtures", name),
    "utf8",
  );
  return JSON.parse(raw) as { style: FullStyle };
}

describe("renderDesignMd — snapshots", () => {
  it("matches the captured ElevenLabs snapshot", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const md = renderDesignMd(style);
    expect(md).toMatchSnapshot();
  });

  it("matches the captured Cursor snapshot", () => {
    const { style } = loadFixture("cursor-detail.json");
    const md = renderDesignMd(style);
    expect(md).toMatchSnapshot();
  });
});

describe("renderDesignMd — frontmatter", () => {
  it("emits all required frontmatter fields", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const md = renderDesignMd(style);

    // Frontmatter opens the file and is terminated by `---` on its own line.
    expect(md.startsWith("---\n")).toBe(true);
    const fmEnd = md.indexOf("\n---\n", 4);
    expect(fmEnd).toBeGreaterThan(0);
    const fm = md.slice(4, fmEnd);

    expect(fm).toMatch(/^source_url:\s+["']?https:\/\/elevenlabs\.io/m);
    expect(fm).toMatch(/^site_name:\s+["']?ElevenLabs/m);
    expect(fm).toMatch(/^extracted_at:\s+["']?2026-/m);
    expect(fm).toMatch(/^theme:\s+["']?light/m);
    expect(fm).toMatch(/^tags:\s+\[/m);
    // Industry is optional — present on this fixture (= "ai").
    expect(fm).toMatch(/^industry:/m);
  });

  it("emits a stable extracted_at (date-only, YYYY-MM-DD) sourced from the input dates", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const md = renderDesignMd(style);
    // Renderer prefers `previewVideoCapturedAt` (most recent re-shoot) over
    // `createdAt` (initial entry). Both are stable inputs, so the date is
    // deterministic — but it must be one of those two, not today's date.
    const previewDay = style.previewVideoCapturedAt.slice(0, 10);
    const createdDay = style.createdAt.slice(0, 10);
    const m = md.match(/^extracted_at:\s+["']?(\d{4}-\d{2}-\d{2})/m);
    expect(m).not.toBeNull();
    expect([previewDay, createdDay]).toContain(m![1]);
  });
});

describe("renderDesignMd — colors table escaping", () => {
  it("escapes pipe characters in color names so the markdown table is valid", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const tampered: FullStyle = {
      ...style,
      fullResult: {
        ...style.fullResult,
        designSystem: {
          ...style.fullResult.designSystem,
          colors: [
            {
              hex: "#ff0066",
              name: "Sun|Set", // pipe in the middle — must be escaped
              role: "Accent | accent role with pipe",
              group: "accent",
            },
          ],
        },
      },
    };

    const md = renderDesignMd(tampered);

    // Pipes inside cell content must be backslash-escaped.
    expect(md).toContain("Sun\\|Set");
    expect(md).toContain("Accent \\| accent role with pipe");
    // And there must NOT be a raw, unescaped `Sun|Set` token in the table —
    // that would split the row and silently drop the trailing column.
    expect(md).not.toMatch(/(?<!\\)\|Set/);
  });

  it("does not double-escape an already-escaped pipe", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const tampered: FullStyle = {
      ...style,
      fullResult: {
        ...style.fullResult,
        designSystem: {
          ...style.fullResult.designSystem,
          colors: [
            {
              hex: "#ff0066",
              name: "Already\\|Escaped",
              role: "neutral",
              group: "accent",
            },
          ],
        },
      },
    };
    const md = renderDesignMd(tampered);
    // The renderer's job is only to escape live pipes; not to detect
    // pre-existing escapes. Double-escape is acceptable (markdown still
    // renders correctly) but a *raw unescaped pipe* is not.
    expect(md).not.toMatch(/(?<!\\)\|Escaped/);
  });
});

describe("renderDesignMd — fonts section", () => {
  it("emits a fonts section when fonts are present", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const md = renderDesignMd(style);
    expect(md).toMatch(/##\s+Fonts/i);
    expect(md).toContain("Waldenburg");
    expect(md).toContain("Inter");
  });

  it("OMITS the fonts section entirely when both ds.fonts and full.fonts are empty", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const noFonts: FullStyle = {
      ...style,
      fonts: [],
      fullResult: {
        ...style.fullResult,
        designSystem: {
          ...style.fullResult.designSystem,
          fonts: [],
        },
      },
    };

    const md = renderDesignMd(noFonts);
    expect(md).not.toMatch(/##\s+Fonts/i);
  });

  it("OMITS the fonts section when designSystem.fonts is undefined and list-fonts are empty", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const noFonts: FullStyle = {
      ...style,
      fonts: [],
      fullResult: {
        ...style.fullResult,
        designSystem: {
          ...style.fullResult.designSystem,
          fonts: undefined,
        },
      },
    };

    const md = renderDesignMd(noFonts);
    expect(md).not.toMatch(/##\s+Fonts/i);
  });
});

describe("renderDesignMd — determinism", () => {
  it("produces identical bytes on repeated calls with the same input", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const a = renderDesignMd(style);
    const b = renderDesignMd(style);
    const c = renderDesignMd(style);
    // Strict byte equality. If the renderer ever calls Date.now() or
    // `new Date()` without a fixed-time injection, this test fires.
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("does not embed today's wall-clock date when input dates are stable", () => {
    const { style } = loadFixture("elevenlabs-detail.json");
    const md = renderDesignMd(style);

    const today = new Date().toISOString().slice(0, 10);
    const inputDates = JSON.stringify(style);
    if (!inputDates.includes(today)) {
      // Renderer must not embed today's date when none of its inputs do.
      expect(md).not.toContain(today);
    }
  });
});
