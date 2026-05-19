# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 23:20:50 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一轮修复“最新活动”筛选下，自动静默刷新与自动刷新设置分配不正确的问题。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.43`
- Latest review/fix pass completed:
  - `FeedQuery` snapshot added; load/refresh/incoming paths now drop stale responses by token and view-key.
  - `loadMoreTopics()` now commits `currentPage` only after a successful response.
  - Pagination failure shows a retry footer; sparse-filter auto-load helper was removed.
  - Incoming queue now has a direct-apply cap and overflow fallback to manual refresh in default view.
  - `deactivateFeed()` now cancels in-flight work by invalidating tokens and clearing busy flags.
- Browser verification during review:
  - Current live linux.do tab showed the script working before the new patch set was injected.
  - Discourse source `frontend/discourse/app/models/topic-tracking-state.js` and `frontend/discourse/app/components/discovery/topics.gjs` were checked; upstream incoming queue is unbounded and `showInserted` uses `loadBefore(topicIds)` then `clearIncoming(topicIds)`.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

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

## Next Review Focus

1. Fix the settings split for latest-activity mode: silent refresh vs auto refresh should be assigned to the correct view/state.
2. Recheck `_buildSettingsControl()`, `_syncDefaultViewControls()`, `_startAutoSilentRefresh()`, `_startAutoRefresh()`, and the default-view predicate.
3. Verify the settings UI only exposes the correct control in each view and that toggling one mode does not leak into the other.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` if the settings split exposes a reproducible bug.
- `$improve-codebase-architecture` if the review turns into a refactor plan.
- `$handoff` again after the next fix pass if work remains.
