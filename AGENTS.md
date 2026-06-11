# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 11:26:36 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Continue from the current multi-site UI/category fixes; no active blocker is known.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.0.2`.
- Recent fixes completed:
  - NodeLoc order dropdown position: `.sfp-custom-select-dropdown` now uses `position: absolute` under `.sfp-custom-select` instead of viewport `fixed` positioning. This avoids NodeLoc `#main-outlet-wrapper { contain: layout; }` shifting the dropdown.
  - chrultrabook settings menu transparency: settings/refresh button and open settings shell backgrounds now use `var(--secondary)` instead of `var(--primary-very-low)`. chrultrabook sets `--primary-very-low: x`, which made those backgrounds compute transparent.
  - OpenAI community category tabs: `https://community.openai.com/*` was added to `@match`, and category record detection no longer treats any record with `slug` as a category. This prevents the `Resources` sidebar section (`id: 7`) from being mistaken for category `API`, allowing fallback to `/categories_and_latest.json` category-list tabs.
- `todo.md` currently keeps pending items for double-click fast back-to-top, "隐藏置顶只隐藏已读", and "分类标签本地缓存".

## Validation Run

- Static checks passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js` passed, with only the normal Windows LF-to-CRLF warning.
- Browser/API validation with `$agent-browser-cli`:
  - NodeLoc dropdown issue was confirmed fixed by switching to `absolute`; user confirmed.
  - chrultrabook settings menu issue was confirmed fixed by using `--secondary`; user confirmed.
  - OpenAI community category logic was tested against live `/site.json` and `/categories_and_latest.json`:
    - old logic produced only `API`.
    - patched logic produces 11 tabs: Announcements, API, ChatGPT Apps SDK, Open Models, Codex, Prompting, Documentation, GPT builders, Forum feedback, Community, ChatGPT.
  - Regression algorithm checks kept LinuxDO at 17 categories, NodeLoc at 11, chrultrabook at 4.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse's category-list/navigation-like set, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.

## Known Risks / Open Questions

- OpenAI community was validated with the extraction algorithm against live payloads; after updating/reloading the installed userscript, a final visual check should confirm 11 category tabs render in the live panel.
- `todo.md` has mixed historical line-ending churn plus one new pending item; it is included in the current snapshot for continuity.

## Concrete Next Steps

1. Reload/update the installed userscript and visually verify OpenAI community renders all 11 category tabs.
2. If continuing feature work, pick from `todo.md`: double-click fast back-to-top, "隐藏置顶只隐藏已读", or local category-tab cache.
3. Re-run `node --check discourse-sidebar-feed-panel.user.js` and targeted `$agent-browser-cli` validation after any further changes.

## Suggested Skills

- `$agent-browser-cli` for live Discourse DOM inspection, screenshots, clicks, and endpoint checks.
- `$diagnose` for any site-specific layout or category-data regressions.
- `$handoff` again before ending the next session.
