# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 12:42:25 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Continue after category/tag cache persistence work; no active blocker is known.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.0.4`.
- Category metadata is now cached per site origin in GM storage as `sfp_category_data_cache_v1`.
  - `loadCategoryMetadata()` reads this cache first and only fetches `/site.json` plus `/categories_and_latest.json` when the cache is missing or invalid.
  - The cached source includes category records, navigation/category-list tabs, site filter/top-menu/period capabilities, and top tag metadata needed to avoid a startup `/site.json` request from the tag style path.
  - When the category cache is used, it primes `siteDataCache` before tag style indexing.
- Tag style cache remains the existing per-origin `sfp_tag_style_cache_v1` design.
- The only exposed cache clear entry is the combined clear:
  - userscript menu: `SFP: 清空分类和标签缓存`
  - console API: `SFPFeedPanel.clearCaches()`
  - Separate public clear/get APIs for category-only or tag-only cache were intentionally removed per user request.
- `todo.md` now marks "分类标签本地缓存" complete; pending items are double-click fast back-to-top and "隐藏置顶只隐藏已读".

## Validation Run

- Static checks passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js todo.md` passed, with only the normal Windows LF-to-CRLF warning.
- Local VM startup probe passed before the final public-API cleanup:
  - With an existing category cache, startup requested only `/latest.json?order=activity&page=0`.
  - It did not request `/site.json` or `/categories_and_latest.json`.
- The public clear-entry cleanup was then verified by `rg`: only `SFP: 清空分类和标签缓存` and `SFPFeedPanel.clearCaches()` remain.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse's category-list/navigation-like set, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.

## Known Risks / Open Questions

- Live visual verification after reinstall/reload is still useful, especially on `https://community.openai.com/*`, to confirm cached category tabs render as expected after the first fetch.
- Clearing caches intentionally reloads the feed if feed mode is active, so the next load will rebuild both category metadata and tag style cache.

## Concrete Next Steps

1. Reload/update the installed userscript and confirm category tabs still render on OpenAI community after first load and after a page reload.
2. Use the userscript menu `SFP: 清空分类和标签缓存` once to verify the next load refetches category/tag data and then returns to cached startup behavior.
3. If continuing feature work, pick from `todo.md`: double-click fast back-to-top or "隐藏置顶只隐藏已读".

## Suggested Skills

- `$agent-browser-cli` for live Discourse DOM inspection, screenshots, clicks, endpoint checks, and menu/API behavior validation.
- `$diagnose` for any site-specific layout, cache, or category-data regressions.
- `$handoff` again before ending the next session.
