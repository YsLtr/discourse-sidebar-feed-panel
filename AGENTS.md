# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 10:33:31 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下次“完全 review 脚本”，重点做代码审查、风险排查和回归测试建议，不要先重构。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.29`
- Pending commit this session: category/tag native badge rendering, tag icon persistent cache, and this handoff update.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Replaced hardcoded category badge rendering with Discourse-compatible `badge-category__wrapper` / `badge-category` markup.
- Category metadata now loads from `/site.json`, so Lv1/Lv2/Lv3 subcategory colors use the site’s real `0088CC / 874EFE / FF0000` style instead of inheriting parent category colors.
- Tag badges now render as native-compatible `discourse-tag box` markup.
- Tag icons are discovered once from a hidden same-origin `/tags` iframe, then persisted with `GM_setValue("sfp_tag_style_cache_v1", ...)`; refreshes use the userscript cache and do not refetch `/tags` unless the user clears script storage or cache version changes.
- Version bumped from `0.6.27` to `0.6.29`.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo’s LF/CRLF warning.
- `$agent-browser-cli` verified:
  - `/site.json` has the expected subcategory colors and icons.
  - Hidden iframe `/tags` can read 1169 tag anchors, 53 with icons.
  - Generated samples produce native category background color and tag icon/style for `开发调优, Lv2` and `快问快答`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the previous sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native category/tag DOM conventions over hardcoded approximations.

## Next Steps

1. Complete a review of `discourse-sidebar-feed-panel.user.js` in code-review mode: lead with bugs, regressions, maintainability risks, and missing tests.
2. Pay special attention to the new metadata/cache code around category/tag helpers, hidden iframe lifecycle, `GM_getValue`/`GM_setValue` payload shape, and async rendering refresh.
3. Re-check existing behavior: sidebar activation/deactivation, tab switching, sorting/period URLs, unread/read filtering, pagination, silent refresh, horizontal overflow, and tag/category rendering after reinstall.
4. Suggested skills: `$agent-browser-cli` for live DOM/API verification; `/diagnose` only if review finds a reproducible bug; `$handoff` after the review session.
