# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-21 21:05:15 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一轮继续修复“最新活动”筛选下，自动静默刷新与自动刷新设置分配不正确的问题。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.44`
- Latest user request completed: 移除“新话题提醒达到 100 后自动刷新”的设计，不再限制新话题提醒数量。
- Current patch set in the userscript includes:
  - `FeedQuery` snapshot/view-key gating for load, refresh, pagination, and incoming paths.
  - `loadMoreTopics()` commits `currentPage` only after a successful response.
  - Pagination failure renders a retry footer; sparse-filter auto-load helper was removed.
  - `deactivateFeed()` invalidates in-flight tokens and clears busy flags.
  - Incoming queue is now unbounded: no `MAX_INCOMING_TOPIC_IDS_DIRECT_APPLY`, no overflow state, no auto refresh triggered by count.
  - Incoming hint always shows the actual queued count: `查看 N 个新的或更新的话题`.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser verification was run after the 0.6.44 incoming-cap removal.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `展开.md`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Review Focus

1. Fix the settings split for latest-activity mode: silent refresh vs auto refresh should be assigned to the correct view/state.
2. Recheck `_buildSettingsControl()`, `_syncDefaultViewControls()`, `_startAutoSilentRefresh()`, `_startAutoRefresh()`, and `FeedQuery.isDefault()`.
3. Verify the settings UI only exposes the correct control in each view and that toggling one mode does not leak into the other.
4. If validating in browser, remember userscript metadata/code changes require updating/reinstalling the userscript, not just refreshing the page.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` if the settings split exposes a reproducible bug.
- `$handoff` again after the next fix pass if work remains.
