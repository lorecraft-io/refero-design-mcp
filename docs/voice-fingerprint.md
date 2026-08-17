# Voice Fingerprint — Nate Davidovich READMEs

Source READMEs sampled:
- `/Users/you/Desktop/MyVault/05-Projects/FIDGETCODING/GITHUB/LORECRAFT-REPOS/morgen-mcp/README.md`
- `/Users/you/Desktop/MyVault/05-Projects/FIDGETCODING/GITHUB/LORECRAFT-REPOS/motion-mcp/README.md`
- `/Users/you/code/lorecraft/fidgetflo/README.md`

Use this as a calibration sheet for the `refero-mcp` README. Match the rhythm and stance — do not copy phrases verbatim.

---

## Tone signature

**Stance:** honest-builder. Nate names the gap a tool fills, names what it isn't, names who else owns the work, and names the tradeoff. Pitch lines arrive next to caveats in the same paragraph. The prose feels like a senior engineer talking to another senior engineer at the bar — confident, specific, slightly self-deprecating, never hype.

**Recurring phrase patterns:**
- "That's it." / "That is it." / "That's why this MCP exists and feels thin."
- "The honest pitch:" / "The tradeoff is honest:" / "If X, I'll be genuinely happy."
- "That's what tiers 1–max do automatically:"
- "Until then, this is here."
- "The practical takeaway:"
- "for some reason, so I fixed it"
- "It just works." / "and it just works."
- "If you want the real thing, use Ruflo." (give the user the off-ramp)
- "If [vendor] ships a first-party MCP that covers this surface, I'll be genuinely happy — and honestly, this repo can probably retire the day they do."
- "ecosystem-friendly vendor behavior is rarer than it should be — when you see it, it's worth naming."

**Hedging style:** almost none. Nate states things flatly. When uncertain, he says "Assumption flag:" or "the honest pitch:" and continues. He does NOT use "may", "perhaps", "might want to consider", "in some cases". He uses "is", "does", "doesn't", "can't".

**Humor density:** low but present. Dry asides between em-dashes ("for some reason, so I fixed it" / "Expensive but decisive." / "Check back later." / "Just one API key. No browser scraping, no refresh tokens, no Firebase."). No exclamation points. No jokes-jokes. The humor is in the rhythm and the specificity, not in punchlines.

**Sentence cadence:** declarative. He earns long sentences by stacking concrete claims, then drops a 3–4 word coda. Example: *"Five agents, every one of them ultrathinking. Expensive but decisive."* The coda is a signature move.

---

## Sentence length

**Mixed, leaning short.** Typical paragraph: one long sentence (25–40 words) followed by a short one (4–10 words) that lands the point. Bullet lists for tools, env vars, comparison tables. Prose for "why this exists" and project-status sections.

**Bullet vs prose ratio:** roughly 50/50. Tool reference and comparison tables are always tables. Setup steps are numbered lists. The "why" sections and project-status notes are prose. Code blocks are dense; the surrounding prose is sparse.

**Paragraph length:** rarely more than 4 sentences. Each paragraph does one job and ends.

---

## Section header style

**Always `## Heading`** (level 2) for top-level sections. `### Subheading` (level 3) for sub-sections inside a section. `#### ` is rare to absent.

**Casing:** Title Case for most headers ("Quick Install", "Why This Exists", "Project Status", "Under the Hood"). Sentence case occasionally on subheaders ("Natural-language support (v0.1.6+)").

**No emoji in section headers.** Emoji shows up in three controlled places only:
1. Status-line indicator references in body copy (🐝 🍯 👑) — and these are *describing* indicators, not decorating.
2. Comparison-table cells (🟢 ✅ ❌) for visual scanning.
3. Callout admonition markers (`> [!IMPORTANT]`, `> [!NOTE]`) — GitHub renders the icon, Nate doesn't add one.

**Recurring header set Nate gravitates toward** — pick from this menu when wiring `refero-mcp`:
- `Quick Navigation` (table at top, with "Link / Section / What it does / Time" columns)
- `Why This Exists` (the gap-naming section)
- `How It Works`
- `Natural-Language Native (no commands needed)` or `Natural Language Examples`
- `Quick Install` / `Install`
- `Setup` / `Configuration` / `Configuration Reference`
- `Features` / `Tools`
- `Usage Examples`
- `Rate Limits`
- `Security`
- `Troubleshooting`
- `Development`
- `Under the Hood`
- `Acknowledgements`
- `One more thing` (lowercase — Jobs reference, used for an outbound link to a sister project)
- `Project Status`
- `License`

**Back-to-top after every section:** every section in all three READMEs ends with `<p align="right"><a href="#top">↑ back to top</a></p>` (or `#quick-navigation` if that's the chosen anchor). Use the same pattern.

---

## Install block

**Canonical one-liner — `claude mcp add` with `npx -y` and a scoped npm package name.** Examples seen verbatim:

```bash
claude mcp add morgen --env MORGEN_API_KEY=your_key_here -- npx -y fidgetcoding-morgen-mcp
```

```bash
claude mcp add motion -- npx -y fidgetcoding-motion-mcp
```

```bash
claude mcp add fidgetflo -- npx -y fidgetflo@latest
```

**Pattern:**
- `claude mcp add <short-name>` — short-name is one word, lowercase, no `-mcp` suffix.
- `--env KEY=value` inline only when there's a single required secret simple enough to paste at install time. Multi-credential setups (motion-mcp's Firebase tokens) get a separate `## Configuration` section with a JSON config block.
- Always `-- npx -y <package-name>`. The `-y` is non-negotiable.
- Package name uses the `fidgetcoding-` npm prefix (`fidgetcoding-morgen-mcp`, `fidgetcoding-motion-mcp`) — see `[[project_fidgetcoding_npm_naming]]` memory. GitHub repo names DROP the prefix (`fidgetcoding/morgen-mcp`).
- A "Then restart Claude Code and start talking to your calendar." closer is normal. One sentence, present-tense, second-person.

**Two install paths when applicable:**
1. `### Claude Code users` — the one-liner above.
2. `### From source (git clone path)` — `git clone … && cd … && npm install && npm link && claude mcp add … -- <bin> mcp`. Only include this if the repo is meant to be hacked on locally.

**Quickstart sub-block (optional):** a fenced `bash` block showing 3–4 representative commands with `# comments` above each.

---

## Banned words

Words and phrases that appear in **none** of the three READMEs (and would feel off-brand if added):

- "leverage" / "leveraging"
- "synergy" / "synergies"
- "seamless" / "seamlessly"
- "robust"
- "best-in-class" / "world-class" / "industry-leading"
- "cutting-edge" / "bleeding-edge" / "state-of-the-art"
- "delight" / "delightful"
- "empower" / "empowers" / "empowering"
- "unlock value" (Nate uses "unlock" once in MEMORY but never in a README pitch)
- "solution" as a noun ("our solution", "this solution") — Nate says "this MCP", "this repo", "the wrapper", "the shim".
- "blazing-fast" / "lightning-fast" / "supercharged"
- "AI-powered" used as a vibe word (Nate uses it only when literally describing AI: e.g., he'll write "Claude dispatches" not "AI-powered dispatch")
- "revolutionary" / "game-changing" / "next-generation"
- "stakeholder" / "ecosystem play"
- "we're excited to announce"
- "out of the box" — actually he uses this once ("out-of-the-box only if you have…") so it's allowed but rare.
- Marketing-y exclamation points generally — there are zero `!` characters at the end of declarative sentences in any README.
- Em-dashes are used **constantly** (`—`); hyphenated phrases use real hyphens. Do not substitute en-dashes.

---

## Loved words

Vocabulary that recurs across all three READMEs and signals voice:

- **"thin"** — "feels thin", "this MCP stays a thin layer", "thin rebrand", "a thin, predictable wrapper". Nate's highest compliment for a wrapper is that it's thin.
- **"surface"** — "calendar surface", "tool surface", "operational surface", "the whole surface", "API surface". The set of capabilities exposed by an API or tool.
- **"opinionated"** / **"opinionated defaults"** — used positively for Morgen's auto-scheduler and FidgetFlo's defaults.
- **"honest"** / **"honestly"** — "the honest pitch", "the tradeoff is honest", "honestly, this repo can probably retire the day they do".
- **"genuinely"** — "the auto-scheduler is genuinely opinionated", "I'll be genuinely happy".
- **"actually"** — "all of the actual engineering", "well-designed enough to actually wrap".
- **"the lot"** / **"the rest"** — Britishism-adjacent. "events, tasks, RSVPs, calendars, the lot."
- **"under the hood"** — section title and inline phrase.
- **"natural language"** / **"plain English"** / **"the sentence"** — used to mean "what you actually say to Claude".
- **"agentic"** — "agentic calendar access".
- **"low-maintenance mode"** — for projects he's stopped actively building.
- **"the gap"** — what an MCP exists to fill.
- **"wire up"** / **"wire it into"** — install/integration verb.
- **"reflow"** / **"dispatch"** — action verbs for what Claude does to your day or your tools.
- **"my daily default"** / **"the one I run daily"** / **"the MCP I use every day"** — first-person product-fit signals.

---

## First-person frequency

**"I" appears 6–12 times per README.** Always specific, never decorative. Used in three contexts:

1. **Origin story** — "I (Nate) was on Motion before I switched.", "I was a paying Motion user for a long time.", "I built [task-maxxing] for exactly that".
2. **Product fit / preference** — "My daily default.", "the combo I run daily", "the MCP I use every day", "If you like my opinionated defaults, use this."
3. **Honest meta-comment about the project itself** — "I waited, checked regularly, and eventually accepted that it wasn't coming.", "If Motion ships a first-party MCP that covers this surface, I'll be genuinely happy."

"We" / "our" / "us" — **not used.** No royal-we, no team-we. This is a one-builder voice. (The fidgetflo README uses "ruv's work" / "ruv wrote the engine, I wrote the wrapper" — credit is in third person, ownership is in first person.)

"You" — used heavily, second-person imperative for setup and usage.

---

## Code block style

**Always fenced.** Always with a language tag. Never bare triple-backticks.

- **`bash`** for shell — install commands, setup commands, curl/git/npm. Always `bash`, never `sh`. No `$ ` prompt prefix. Lines are ready to copy-paste.
- **`json`** for MCP config blocks (`mcpServers` shape).
- **`text`** for non-shell pseudo-code (the `/fswarm*` cheatsheet, conceptual examples).
- **`** ``` ** with no tag** appears only inside license MIT-text blocks.

**Inline code:** backticks for tool names (`list_events`), env vars (`MORGEN_API_KEY`), file paths (`.env`), and short literal strings (`"label1"`, `single`, `future`, `all`). Use them aggressively — almost every paragraph has at least two inline-code spans.

**Comments inside bash blocks** use `#` and sit on their own line above the command, not at end-of-line:

```bash
# Init a project
npx fidgetflo@latest init --wizard

# Spawn an agent
npx fidgetflo@latest agent spawn -t coder --name my-coder
```

**Quoted-prompt style** for natural-language examples — italics inside blockquotes:

> *"What's on my calendar today?"*

or fenced `text` blocks of bare quoted prompts.

---

## Footer style

**Author line at the bottom (post-content, pre-security-block):**

```
Built by [Nate Davidovich / Lorecraft](https://github.com/lorecraft-io)
```

or

```
Built by **Nate Davidovich** / [Lorecraft](https://github.com/lorecraft-io).
```

**License:** MIT, one-liner — `MIT — see [LICENSE](./LICENSE) for details.` — under a `## License` heading. Full license text inline only when there's a dual-copyright situation (fidgetflo).

**Badges (top of README, inside `<div align="center">`):**
- **Always present:** npm version (using `img.shields.io/npm/v/<package-name>`), MIT License, MCP Compatible.
- **Optional:** Node version requirement, project-specific tag (e.g., `FIDGETCODING`, `Claude Code`).
- **Always present social row, in this exact order:** X (`@fidgetcoding`), LinkedIn (`nate-davidovich`), YouTube (`@fidgetcoding`), Instagram (`fidgetcoding`). All four use `style=for-the-badge` with brand colors. The exact markdown is reusable across repos:

```markdown
[![Follow on X](https://img.shields.io/badge/FOLLOW%20%40fidgetcoding-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/fidgetcoding) [![LinkedIn](https://img.shields.io/badge/LINKEDIN-CONNECT-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white&labelColor=555555)](https://www.linkedin.com/in/nate-davidovich/) [![YouTube](https://img.shields.io/badge/YOUTUBE-SUBSCRIBE-FF0000?style=for-the-badge&logo=youtube&logoColor=white&labelColor=555555)](https://youtube.com/@fidgetcoding) [![Instagram](https://img.shields.io/badge/INSTAGRAM-FOLLOW-E4405F?style=for-the-badge&logo=instagram&logoColor=white&labelColor=555555)](https://instagram.com/fidgetcoding)
```

**Top-of-doc anchor:** `<a id="top"></a>` (or `<a id="quick-navigation"></a>` if the nav table doubles as the anchor target). Every back-to-top link points to it.

**Hero block:** `<div align="center">` containing project name as `# Heading`, hero image `![Name](url)`, a one-line tagline in bold, then the badge row, then close `</div>`. Then `---`. Then the Quick Navigation table.

**Hero image:** PNG hosted at `https://raw.githubusercontent.com/fidgetcoding/<repo>/main/<repo>.png`. The file exists in the repo root.

**Security: gitleaks pre-commit hook** section appears at the very bottom of all three READMEs, after License/Author. Same boilerplate every time — copy-paste it from morgen-mcp's README into refero-mcp's.

---

## Quick Navigation table — verbatim shape

Every README opens (right after the hero block) with this table. Four columns. Use it for refero-mcp.

```markdown
| Link | Section | What it does | Time |
|---|---|---|---|
| [Why X exists](#why-x-exists) | Overview | One-line gap-naming | ~2 min |
| [Quick Install](#quick-install) | Setup | One-liner to wire it in | ~1 min |
| [Tools](#tools) | Reference | All MCP tools exposed | ~2 min |
| [License](#license) | Meta | MIT | — |
```

The "Time" column reads `~N min` for content sections, `—` (em-dash) for License/Links/Author/short meta.

---

## VERBATIM voice samples

These are direct quotes from the three READMEs. Read them out loud to hear the rhythm before writing the new README. **Do not paste them in — they are calibration only.**

1. *"All of the actual engineering that makes this useful is Ruflo."*
   → Nate gives credit flat and early, no throat-clearing.

2. *"If you want the real thing, use Ruflo: https://github.com/ruvnet/ruflo. If you like my opinionated defaults, use this."*
   → Two sentences, parallel structure, hands the reader the off-ramp before the pitch.

3. *"That's it. Claude sees your Morgen calendars and tasks, understands your schedule, and takes action — all through natural conversation. No buttons, no UI, no context switching. You stay in your terminal and your day stays in sync."*
   → "That's it." opener. Triple-bullet rhythm in prose ("No buttons, no UI, no context switching."). Lands on a present-tense product claim.

4. *"What Motion's public API should have been, but they chose not to (for some reason, so I fixed it)."*
   → Subhead under the title. Dry parenthetical doing all the editorial work.

5. *"The MCP stays a thin layer: one `fetch` per Morgen endpoint, local rate-limit bookkeeping, input validation, and a natural-language front-end for dates and recurrence. No SDK middleware, no opinionated scheduling logic of our own."*
   → "Thin layer" claim followed by a colon-listed inventory of what's actually inside. The negation sentence ("No X, no Y") is a Nate signature for closing a paragraph.

6. *"Five agents, every one of them ultrathinking. Expensive but decisive."*
   → 7-word coda lands the use-case after a longer setup sentence. Adjective pair ("Expensive but decisive") instead of full prose.

7. *"Building a third-party MCP on top of someone else's product is a gamble — you're betting the vendor is okay with a community-built wrapper, responsive when the docs are ambiguous, and willing to treat small external builders as partners rather than noise."*
   → Long sentence, em-dash mid-clause, three-part "you're betting…" parallel. Ends without softening.

8. *"Until then, this is here."*
   → Five words. Closes the "Why This Exists" section. Maximum stance, minimum words.

9. *"That is the whole setup. No token refresh cycles, no IndexedDB spelunking."*
   → "That is the whole setup." beats "That's the whole setup." in Nate's hand. Negation pair lands the close. "Spelunking" is the kind of specific verb he reaches for.

10. *"It genuinely helped my ADHD. Having a single reliable home for every loose end — and knowing nothing falls through the cracks between three apps — was a real quality-of-life unlock."*
    → First-person testimonial used sparingly, only when product-fit is the actual point. "Quality-of-life unlock" is allowed; "unlock value" is not.

11. *"If Motion ships a first-party MCP that covers this surface, I'll be genuinely happy — and honestly, this repo can probably retire the day they do."*
    → The vendor off-ramp move. Naming the obsolescence condition signals the project isn't ego-attached.

---

## Quick checklist for the executor

Before submitting the refero-mcp README:

- [ ] Hero block is `<div align="center">` with `# Refero MCP`, hero image, bold tagline, badges, social row, `</div>`, `---`.
- [ ] `<a id="top"></a>` at line 1.
- [ ] Quick Navigation table (4 columns) right after the hero.
- [ ] Every `## Heading` ends with the back-to-top `<p align="right">` line.
- [ ] Install block uses `claude mcp add refero -- npx -y fidgetcoding-refero-mcp` (or whatever the actual scoped package name is — confirm before writing).
- [ ] Code fences are `bash`, `json`, or `text` — never bare, never `sh`.
- [ ] Zero exclamation points in declarative sentences.
- [ ] At least one "this MCP stays a thin layer"-style negation closer.
- [ ] At least one "Until then" / "That's it." / "If [X] ships [Y], I'll be genuinely happy" stance line.
- [ ] First-person "I" used 6–12 times, never as filler.
- [ ] No banned words (see list above).
- [ ] `Built by [Nate Davidovich / Lorecraft](https://github.com/lorecraft-io)` footer — never "Nathan".
- [ ] `## Security: gitleaks pre-commit hook` boilerplate at the bottom.
- [ ] MIT license one-liner under `## License`.
