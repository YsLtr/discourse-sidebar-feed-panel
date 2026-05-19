# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 13:02:40 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 进入最终 review 环节，重点检查刚加入的板块展开/排序功能是否有状态、拖拽、布局或持久化回归。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.41`
- Pending commit this session: board/category tab expansion and drag sorting, plus this handoff update.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Added a board/category tab shell with a right-side expand button.
- Expanded panel shows a compact icon grid for all main `TAB_CATEGORIES`; `全部` is fixed and not sortable.
- Main board categories are draggable in the expanded grid.
- Sort order is persisted in `GM_setValue("sfp_tab_order", order)` and read by `_getOrderedTabCategories()`.
- Initial save bug was fixed: final DOM order is now saved on `dragend`, not only on `drop`.
- Horizontal tab bar and expanded grid now share active state; selecting from the grid scrolls the matching horizontal tab into view.
- Category metadata refresh now rerenders the whole tab shell so names/icons stay consistent after `/site.json` metadata loads.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Review Focus

1. Check drag sorting persistence across close/reopen and userscript reload/update.
2. Inspect whether HTML5 drag behavior works acceptably in the target browser and whether touch support is needed.
3. Verify expanded panel z-index/overflow does not block filter controls, topic list clicks, or custom selects.
4. Review `_getOrderedTabCategories()`, `_saveTabOrderFromGrid()`, `_buildTabBar()`, `_rerenderTabBar()`, and `_refreshCategoryTabs()` for hidden state coupling.
5. Confirm tab click semantics still preserve `TAB_KEY`, `currentTab`, `currentCategoryId`, and current category id mapping.

## Suggested Skills

- `$agent-browser-cli` for live DOM/computed-style and persistence checks on linux.do.
- `/diagnose` only if final review finds a reproducible layout/state bug.
- `$handoff` again after the final review if new work remains.
