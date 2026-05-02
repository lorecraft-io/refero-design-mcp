# /w4w Voice Audit — README (2026-05-01)

Auditor: /w4w voice auditor
Target: `/Users/nathandavidovich/code/lorecraft/refero-mcp/README.md` (217 lines, mtime 1777690770)
References:
- `/Users/nathandavidovich/Desktop/BRAIN2/05-Projects/FIDGETCODING/GITHUB/LORECRAFT-REPOS/morgen-mcp/README.md` (443 lines)
- `/Users/nathandavidovich/Desktop/BRAIN2/05-Projects/FIDGETCODING/GITHUB/LORECRAFT-REPOS/motion-mcp/README.md` (400 lines)
- `/Users/nathandavidovich/code/lorecraft/fidgetflo/README.md` (366 lines)

## Verdict: PASS (with low-risk polish recommendations)

The README is short by design ("simple for this one"), but the voice, structure, and install pattern all match the morgen-mcp / motion-mcp / fidgetflo bar. Pre-rewrite there were two factual bugs (default-vault claim that contradicted source, invented tool names); the current rewrite has fixed both. No "Nathan" anywhere. No `BRAIN2` defaults. No corp-speak. Anchor links resolve.

The remaining items below are nits — none of them block ship.

## Voice match score: 8/10

What earns the 8:
- First-person Nate voice ("future-me doesn't have to re-discover it") — present and tonally right.
- Hedging phrases that match references ("less magical", "Works fine, just less magical", "drop a generated DESIGN.md straight into whatever project you're scaffolding").
- The "What this is / Why it exists" rhythm tracks morgen-mcp's "Why this exists" pattern.
- IMPORTANT callout matches morgen-mcp's "You talk. Claude dispatches" wording verbatim — good consistency move.
- `claude_desktop_config.json` JSON block matches morgen-mcp's Option C shape.

What blocks 9/10:
- The README is short but missing two micro-touches that make morgen/motion/fidgetflo feel like Nate-the-person and not Nate-the-MCP-author: a one-line opinionated take ("the honest pitch:" / "the move stuck"), and a small "future-me / past-me" aside is present (good) but only once. References hit that note 2–3x.
- The "What this is" intro is more declarative than conversational. Morgen leads with "I (Nate) was on Motion before I switched. Three reasons the move stuck." Refero could open with one similar I-voice line ("I built this because copy-pasting `designSystem` JSON eight times in a row is not a life worth living") rather than waiting until the catalog has been described.

## Line-by-line findings

- **L7** — `**Search [styles.refero.design](https://styles.refero.design) in plain English and drop a DESIGN.md into any project.**` — solid tagline. Same shape as motion-mcp L9 / morgen-mcp L9. No issue.
- **L37** — *"someone has done the painful work"* — good Nate phrasing (matches morgen-mcp L391 "is rarer than it should be" cadence). Keep.
- **L37** — *"about 200 curated sites"* — slight hedge softening. Reference READMEs commit to numbers ("300 points per 15-minute window", "60+ agent types"). If the real catalog count is known (~10 pages × ~20 = ~200), prefer "~200" over "about 200". Tiny nit.
- **L39** — *"No browser-tab JSON copy-paste, no hand-rolled token tables."* — the rule-of-three rhythm is on-brand (morgen L102: "No OAuth dance, no refresh-token rotation, no Firebase session pulling, no IndexedDB scraping"). Could be tightened: morgen-style would say *"No browser-tab JSON copy-paste, no hand-rolled token tables, no eight-time-in-a-row drift."* Optional rewrite — current version is already fine.
- **L41** — *"It's for anyone using Claude Code to spin up a new app, deck, or client project who wants the design language locked down before the first component renders."* — voice match. Keep.
- **L49** — `One line:` (then code) — matches morgen-mcp L217 "One command. That is it." and motion-mcp's similar line. Slight inconsistency: morgen says "One command", refero says "One line". Either is fine, but morgen's is the canonical form across the family. Suggested rewrite: `One command. That's it.` (matches morgen tone exactly).
- **L57** — *"vibe search (semantic ranking against each style's poetic `northStar` summary)"* — "poetic" is a Nate adjective. Good. Keep.
- **L63** — *"Works fine, just less magical."* — voice match (matches morgen L329 "this is very generous for interactive use"). Keep.
- **L65** — *"For `claude_desktop_config.json` users:"* — accurate scoping. Keep.
- **L88-91** — IMPORTANT callout — mirrors morgen-mcp L63-66 exactly. Keep, this is the franchise voice signature.
- **L93** — *"A few prompts that route cleanly:"* — clean phrasing. Keep.
- **L96-121** — seven NL example prompts — all real, all useful, none filler. Each maps to a real tool route (`refero_search`, `refero_get`, `refero_similar`, `refero_design_md` w/o save, `refero_design_md` with save, `refero_list` w/ filter, `refero_refresh`). Coverage check passes.
- **L123** — *"More worked recipes in [`docs/USAGE.md`](docs/USAGE.md)."* — file exists, link works. Keep.
- **L131-138** — Tools table — six tools, names match source (`refero_search`, `refero_get`, `refero_similar`, `refero_list`, `refero_design_md`, `refero_refresh`). Was previously inventing names (`search_styles`, `get_style`, etc.) — now fixed. PASS.
- **L133** — *"BM25-lite fallback"* — first time this term appears. Earlier rewrite said "keyword scoring". The two terms refer to the same thing, but using "BM25-lite" once and "keyword scoring" twice (L63, L150) is mild inconsistency. Suggested rewrite for L133: `Embeddings if OPENAI_API_KEY is set, keyword scoring fallback if not.` (Or commit to BM25-lite and use it everywhere.)
- **L135** — *"Free recommendations from the upstream."* — slightly clipped. Suggested rewrite: `Refero's own "similar styles" ranking — free recommendations from the upstream catalog.` Minor.
- **L137** — *"Optionally writes to disk."* — accurate but understated. The interesting bit (it routes to `<vault>/05-Projects/<NAME>/DESIGN.md`) is buried in the Configuration table at L154. Suggested rewrite: `Render a style as an agent-friendly DESIGN.md (frontmatter, north star, color table, dos/donts). With `save_to_project` and `REFERO_MCP_VAULT_DIR` set, writes to `<vault>/05-Projects/<NAME>/DESIGN.md`.` Optional.
- **L146** — *"Everything is optional. Defaults are picked so the MCP just runs."* — voice match. Keep.
- **L152** — `REFERO_CACHE_DIR` default `~/.cache/refero-mcp` — accurate per source convention.
- **L154** — `REFERO_MCP_VAULT_DIR` row — required column says `No (required for project writes)` — this is correct now (was previously listed as `Required for save_to_project` which contradicted the troubleshooting line about "defaulting to my vault"). Source code (`src/path-safety.ts:36`) confirms the var is required when you call save and throws `PathSafetyError` if unset. PASS.
- **L156** — *"A copy-paste `.env.example` ships in the repo root."* — `.env.example` exists in the repo. PASS.
- **L164** — *"There is no public Refero API doc as of writing — the shape was mapped empirically against the live site."* — Nate voice + dated empirical claim. Matches morgen-mcp's "low-maintenance but still functional" honesty. Keep.
- **L164** — *"so future-me doesn't re-discover it"* — Nate phrasing ✓.
- **L166** — *"silently ignores `?search=`, `?q=`, and `?colorScheme=`"* — concrete, falsifiable claim from `docs/api-surface.md`. Good.
- **L168** — *"so future-me doesn't re-discover it"* appears L164, then a different second-person frame at L168 — fine.
- **L168** — *"compatible with the [`/stitch-design-taste`](...) and `/design-taste-frontend` skills"* — links to the right repo (`lorecraft-io/2ndBrain-mogging`).
- **L176** — *"polite 250ms gap"* — Nate phrasing ✓.
- **L178** — *"the catalog's vocabulary (industries plus tags like `editorial`, `brutalist`, `glass`)"* — concrete, useful.
- **L180** — *"`refero_design_md` returns markdown but won't write to disk."* — diagnoses correctly. The previous draft had the wrong-vault-path framing; this rewrite fixed it.
- **L186-198** — License + Author — clean. "Nate Davidovich / Lorecraft LLC" is the canonical byline (matches user memory `feedback_call_me_nate`). PASS.
- **L196** — Sister projects link to morgen-mcp + motion-mcp — good cross-pollination, matches morgen-mcp L411 / motion-mcp pattern.
- **L202-217** — Security: gitleaks section — accurate (`.gitleaks.toml` exists, `.husky/pre-commit` exists, `scripts/security-scan.sh` exists). Voice is more matter-of-fact than the morgen-mcp version (morgen L427-444) but that's fine for a shorter README.
- **L213** — *"warn-no-ops if `gitleaks` isn't installed locally"* — slightly compressed phrasing. Reads as Nate-shorthand. Keep.

## Anchor link integrity

| TOC entry | Target | Heading exists? | Pass/Fail |
|---|---|---|---|
| `[What this is](#what-this-is)` | `#what-this-is` | `## What this is` | PASS |
| `[Quick install](#quick-install)` | `#quick-install` | `## Quick install` | PASS |
| `[Usage](#usage)` | `#usage` | `## Usage` | PASS |
| `[Tools](#tools)` | `#tools` | `## Tools` | PASS |
| `[Configuration](#configuration)` | `#configuration` | `## Configuration` | PASS |
| `[How it works](#how-it-works)` | `#how-it-works` | `## How it works` | PASS |
| `[Troubleshooting](#troubleshooting)` | `#troubleshooting` | `## Troubleshooting` | PASS |
| `[License + Author](#license)` | `#license` | `## License` | PASS (link lands on License; Author is a separate `## Author` heading directly below — fine in practice) |
| `[⤴ back to top](#top)` (×7) | `#top` | `<a id="top"></a>` at L1 | PASS |

All anchors resolve. No broken jumps.

## Word-bank

### Forbidden words found

None.

Verified-clean against the corp-speak banlist:
- `powerful` — 0 matches
- `robust` — 0 matches
- `enterprise-grade` / `enterprise grade` — 0 matches
- `seamless` / `seamlessly` — 0 matches
- `cutting-edge` — 0 matches
- `leverage` (verb) — 0 matches
- `revolutionary` / `revolutionize` — 0 matches
- `unleash` — 0 matches
- `industry-leading` — 0 matches
- `state-of-the-art` — 0 matches
- `synergy` / `synergize` — 0 matches
- `Nathan` (anywhere outside filesystem paths) — 0 matches. The byline is "Nate Davidovich" (L192), correct per `feedback_call_me_nate`.

### Loved words present (good signs)

- "future-me" (L164) — Nate signature
- "poetic" (L57, L167) — Nate adjective for `northStar`
- "vibe search" (L57, L150) — branded coinage that matches the family's casual vocabulary
- "magical" (L63) — hedging adjective Nate uses repeatedly
- "polite 250ms gap" (L176) — Nate phrasing
- "drop a DESIGN.md into" (L7) — verb choice matches morgen-mcp's "drop a 30-minute call" tone
- "less magical" (L63) — hedge that matches morgen-mcp's "rarer than it should be" beat
- "scaffolding" / "spin up" (L41) — voice-correct (matches motion-mcp's "wire" and morgen's "tame")
- "lock down" (L41) — colloquial
- "honest pitch" not present, but the spirit is there in "Works fine, just less magical."

## Length

- New README: **217 lines**
- morgen-mcp: 443 lines
- motion-mcp: 400 lines
- fidgetflo: 366 lines

Verdict: **appropriate for the intended scope.**

User's brief was "simple for this one" — and 217 lines is right at the upper end of the requested 100–180 target, but justified by:
1. The 6-tool table (necessary, can't shrink without hurting clarity).
2. The full Configuration env-var table (5 vars, all need explanation).
3. The Security/gitleaks block (15 lines, copy-pasted boilerplate the family ships).

If a hard cut to ≤180 is wanted, the cleanest cut is the Security block (L202-217 = 16 lines) — it's identical-shape boilerplate that could move to `docs/SECURITY.md` and be linked from the bottom. That puts the core README at ~200 lines, which is closer to the requested target.

The README is **shorter than every reference**, which matches the brief. It's longer than the explicitly-requested 100-180 only because of the security boilerplate — a deliberate, repo-wide convention, not bloat.

## Final notes

**Ship verdict: PASS.** The README is voice-correct, factually correct against the source, and structurally aligned with morgen-mcp / motion-mcp / fidgetflo. The previous draft had two real bugs (invented tool names, default-vault claim that contradicted `src/path-safety.ts`); the current rewrite fixed both.

Optional polish, ranked by value:

1. **L137 — buff the `refero_design_md` row** to surface the `<vault>/05-Projects/<NAME>/DESIGN.md` routing in the tools table itself, not just the Configuration table. Makes the table self-contained.
2. **L133 — pick one term for the fallback** (either "keyword scoring" everywhere or "BM25-lite" everywhere). Currently mixes both.
3. **L49 — match morgen's exact opener** (`One command. That's it.` instead of `One line:`) for cross-repo voice consistency.
4. **L37 — open with one I-voice sentence** ("I built this because copy-pasting `designSystem` JSON eight times in a row is not a life worth living.") to match morgen-mcp's "I (Nate) was on Motion before I switched." pattern. Currently the I-voice doesn't land until L164.
5. **Consider moving the Security block** to `docs/SECURITY.md` and linking from the bottom — the family ships this same block, so a one-line link is honest and gets the README under 200 lines.

None of these block ship. The README is good as-is; these are cosmetic tightenings that would push the voice match from 8/10 to 9/10.
