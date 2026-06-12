# GH-REPO-SETTINGS

GitHub repo settings for `fidgetcoding/refero-design-mcp`. Pipeline Executor (#2) runs the `gh repo edit` block below verbatim after `gh repo create`. Everything in the UI checklist is verified by hand once the repo is live.

Owner: Nate Davidovich / Lorecraft. Visibility: public. License: MIT.

---

## 1. Description

Use this exact string for `--description` (97 chars, fits the 100-char ceiling):

```
MCP server that pipes the refero.design system into Claude — agentic design tokens, components, MD.
```

Voice notes: lowercase verb, "pipes ... into Claude" matches the morgen-mcp / motion-mcp blurb cadence, name-checks `MCP` and `design` per spec, no emoji.

---

## 2. Homepage

```
https://styles.refero.design
```

Upstream design system. Not a marketing page for the MCP — that's intentional, the homepage points at the source of truth, not a wrapper.

---

## 3. Topics

Eight topics, lowercase, hyphenated:

- `mcp`
- `model-context-protocol`
- `refero`
- `design-system`
- `design-md`
- `claude`
- `agentic-design`
- `design-tokens`

---

## 4. The verbatim command

Copy-paste, no edits. Run from anywhere — `gh repo edit` takes the `OWNER/REPO` arg, no `cd` needed.

```bash
gh repo edit fidgetcoding/refero-design-mcp \
  --description "MCP server that pipes the refero.design system into Claude — agentic design tokens, components, MD." \
  --homepage "https://styles.refero.design" \
  --visibility public \
  --enable-issues \
  --enable-discussions=false \
  --enable-projects=false \
  --enable-wiki=false \
  --add-topic mcp \
  --add-topic model-context-protocol \
  --add-topic refero \
  --add-topic design-system \
  --add-topic design-md \
  --add-topic claude \
  --add-topic agentic-design \
  --add-topic design-tokens
```

If the description em-dash (`—`, U+2014) gets mangled by a copy-paste through a non-UTF8 shell, fall back to `--` and re-run. Don't substitute a hyphen-minus silently — flag it.

### Sanity check (run after the edit)

```bash
gh repo view fidgetcoding/refero-design-mcp --json description,homepageUrl,visibility,hasIssuesEnabled,hasDiscussionsEnabled,hasProjectsEnabled,hasWikiEnabled,repositoryTopics,licenseInfo
```

Expected JSON shape (values, not field order):

```json
{
  "description": "MCP server that pipes the refero.design system into Claude — agentic design tokens, components, MD.",
  "homepageUrl": "https://styles.refero.design",
  "visibility": "PUBLIC",
  "hasIssuesEnabled": true,
  "hasDiscussionsEnabled": false,
  "hasProjectsEnabled": false,
  "hasWikiEnabled": false,
  "repositoryTopics": {
    "nodes": [
      { "topic": { "name": "mcp" } },
      { "topic": { "name": "model-context-protocol" } },
      { "topic": { "name": "refero" } },
      { "topic": { "name": "design-system" } },
      { "topic": { "name": "design-md" } },
      { "topic": { "name": "claude" } },
      { "topic": { "name": "agentic-design" } },
      { "topic": { "name": "design-tokens" } }
    ]
  },
  "licenseInfo": { "key": "mit", "name": "MIT License" }
}
```

If `licenseInfo` is `null`, jump to §6 below — the LICENSE file isn't being recognized.

---

## 5. UI verifications (checklist)

Open `https://github.com/fidgetcoding/refero-design-mcp/settings` and walk it top-to-bottom. The CLI covers most of this, but a few things only live in the UI.

### General

- [ ] Repository name: `refero-mcp`
- [ ] Description: matches §1 verbatim, em-dash renders correctly
- [ ] Website: `https://styles.refero.design` (no trailing slash)
- [ ] Topics: 8 chips, exactly the list in §3, no extras
- [ ] Default branch: `main`
- [ ] Visibility: `Public`

### Features

- [ ] Wikis: **off**
- [ ] Issues: **on**
- [ ] Sponsorships: **off**
- [ ] Preserve this repository: leave default (off)
- [ ] Discussions: **off**
- [ ] Projects: **off**

### Pull Requests

Per Nate's "no PRs" rule, this section doesn't get used — but the toggles still need a sane default for drive-by contributors:

- [ ] Allow merge commits: on (default, fine)
- [ ] Allow squash merging: on (default, fine)
- [ ] Allow rebase merging: on (default, fine)
- [ ] Always suggest updating pull request branches: off
- [ ] Allow auto-merge: off
- [ ] Automatically delete head branches: off (matches our push-direct-to-main workflow)

### Branches

- [ ] Default branch: `main`
- [ ] Branch protection rules: **NONE** (zero rules listed). This is deliberate per the global "no PRs, push direct to main" rule. Don't add a ruleset, don't add CODEOWNERS gating, don't require status checks.

### Code security

- [ ] Dependabot alerts: on (GitHub default for public repos)
- [ ] Dependabot security updates: on
- [ ] Secret scanning: on (free for public repos)
- [ ] Push protection: on

### Collaborators / Teams

- [ ] No outside collaborators
- [ ] `lorecraft-io` org default permissions apply
- [ ] No CODEOWNERS file (matches no-PRs rule)

### Webhooks / Integrations

- [ ] No webhooks (n8n W1 picks up commits via the org-wide push hook, not a per-repo one)
- [ ] No GitHub Apps installed beyond what the org already grants

---

## 6. License banner

GitHub auto-detects the license by reading the LICENSE file at the repo root and matching it against the choosealicense.com corpus. We don't set the license via API — it gets picked up.

After `git push` lands the LICENSE file:

- [ ] The repo header on `https://github.com/fidgetcoding/refero-design-mcp` shows an `MIT license` chip next to the description
- [ ] `gh repo view fidgetcoding/refero-design-mcp --json licenseInfo` returns `{ "licenseInfo": { "key": "mit", "name": "MIT License" } }` (not `null`)
- [ ] Settings → General → License shows `MIT License` (read-only, sourced from the file)

If the chip doesn't appear within ~60 seconds of the first push:

1. Confirm the file is named `LICENSE` (no extension, all caps) at the repo root
2. Confirm the first line contains `MIT License` and the body matches the canonical MIT text — Licensee, the parser GitHub uses, is whitespace-tolerant but does fingerprint the boilerplate
3. Push a no-op commit (e.g. README typo fix) to force a re-scan

Do not set a `license:` field anywhere via the API — there isn't one on `gh repo edit`. The file is the source of truth.

---

## 7. Social preview image

Deferred to **v0.2**.

Right now the OG card is the GitHub default (repo name + owner avatar on a grey gradient). That's fine for v0.1 — refero-mcp is shipping as a working tool, not a marketing artifact, and a half-baked preview image is worse than the default.

When v0.2 lands:

- [ ] Generate a 1280×640 PNG (GitHub's recommended OG dimensions, max 1MB)
- [ ] Match the morgen-mcp / motion-mcp visual language (dark bg, monospace title, lorecraft-io footer)
- [ ] Upload via Settings → General → Social preview → Edit
- [ ] Verify the OG card renders correctly with `https://www.opengraph.xyz/url/https%3A%2F%2Fgithub.com%2Florecraft-io%2Frefero-mcp` (or equivalent OG inspector)

This checklist item lives here so it doesn't get forgotten — if you're reading this during the v0.2 ship cycle, do the work, then strike this section.

---

## Summary for Pipeline Executor #2

Two things to run, in order:

1. **The `gh repo edit` block in §4** — copy-paste verbatim, no substitutions
2. **The sanity check `gh repo view` in §4** — diff the JSON against the expected shape, fail loudly on mismatch

Then hand off to the human for the §5 UI walk and the §6 license-chip confirmation.
