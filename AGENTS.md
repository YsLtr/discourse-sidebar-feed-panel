# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 12:41:47 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一步为板块展示框添加展开和排序功能。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.39`
- Latest commits before this handoff:
  - `1354b4d fix(sidebar): clean theme colors and update handoff`
  - `947c943 fix(sidebar): use native unread dot styling`
  - `ee6e6f0 fix(sidebar): match incoming hint loading state`
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Fixed the original Discourse sidebar bottom horizontal scrollbar when the userscript is enabled but feed mode is closed.
- Feed-mode width handling now behaves like the reference Timeline drawer pattern:
  - no persistent sidebar width/resizer in closed mode,
  - opening animates from native sidebar width to saved feed width,
  - closing animates back to the pre-feed native width and then clears inline width/`--d-sidebar-width`,
  - drag resizing disables the animation class while dragging.
- Replicated the Horizon/native sidebar vertical scrollbar on `.sfp-feed-scroll`: transparent by default, theme-colored on hover via `--d-selected`.
- Validation run:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Steps

1. Add expansion behavior for the board/category display box.
2. Add sorting/reordering behavior for that board display box.
3. Inspect current tab/category state first: `CATEGORY_CONFIG`, `TAB_CATEGORIES`, `_buildTabBar()`, `_restoreTabState()`, and `TAB_KEY`.
4. Preserve existing category tab selection, current category id mapping, and saved state semantics.

## Suggested Skills

- `$agent-browser-cli` for live DOM/computed-style checks if the board display interaction needs browser verification.
- `/diagnose` only if the expansion/sorting behavior exposes a reproducible layout or state bug.
- `$handoff` again after the next feature pass.
