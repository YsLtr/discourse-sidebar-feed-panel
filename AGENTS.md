# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 18:12:00 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: README release documentation is prepared with Chinese as the default README and a separate English README; no active blocker is known.

## Current State

- Main userscript: `discourse-sidebar-feed-panel.user.js`, version `2.1.0`.
- `README.md` was rewritten into a publish-ready Chinese guide:
  - installation links for GitHub Raw, Greasy Fork, and ScriptCat;
  - detailed "怎么打开" instructions for users who miss the top-logo toggle button;
  - basic usage, settings behavior, FAQ, limitations, permissions, and update notes;
  - currently known built-in supported sites: `linux.do`, `www.nodeloc.com`, `forum.chrultrabook.com`, `community.openai.com`.
- `README.en.md` was added as the English release guide. It links back to Chinese with `[中文](README.md) | English`; no extra primary-doc label remains.
- `README.md` language switch is `中文 | [English](README.en.md)`.
- No userscript logic was changed in this README pass.

## Validation

- Passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- AGENTS.md README.md discourse-sidebar-feed-panel.user.js todo.md`
  - `rg -n "[ \t]+$" README.md README.en.md` returned no matches
- `git diff --check` only reported the normal Windows LF-to-CRLF warning for `README.md`.
- Live browser validation has not been rerun after the earlier hide-pinned changes.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse navigation/category-list data, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.

## Known Risks / Open Questions

- README content is based on current code and metadata; live validation of the published install flow and the four listed sites is still useful.
- Earlier hide-pinned manual checks are still useful: latest-activity settings visibility, top pinned-block trimming, load-more/incoming exclusion, and raw page-0 `topicPageSize`.

## Concrete Next Steps

1. Manually verify the README install/open instructions on at least one supported site.
2. Live-check the four listed built-in sites when convenient, especially sidebar availability and the top-logo toggle location.
3. If changing docs again, rerun `git diff --check` and the README trailing-space scan.

## Suggested Skills

- `$agent-browser-cli` for live browser validation on supported Discourse sites.
- `$handoff` again before ending a future session if more work remains.
