# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-21 21:40:00 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一轮修复“自动刷新挤下条目”问题，重点看静默/自动刷新应用新话题时是否改变滚动视口中的现有条目位置。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.46`
- Latest completed request: 新话题提醒已改为完全独占布局空间，出现时从上往下展开，并由 `.sfp-filter-bar` 覆盖其进入动效；用户反馈“没有问题”。
- Current new-topic hint behavior:
  - `_updateShowMoreHint()` still creates `.sfp-show-more-overlay` as the first child of `.sfp-content-wrapper`.
  - `.sfp-show-more-overlay` is now normal document flow, `display:flex`, `overflow:hidden`, with `sfp-show-more-enter` animation.
  - `.sfp-content-wrapper.sfp-has-show-more .sfp-topic-list { padding-top: ... }` was removed, so rows are pushed only by the hint's own layout box.
  - `.sfp-filter-bar` now has `position: relative; z-index: 3` so the hint enters underneath it.
- Current back-to-top behavior remains as previously approved:
  - Button is created by `_buildBackTopButton()` and stored in `feedBackTopBtn`.
  - Button is appended to `.sfp-feed-container` and positioned absolute at the lower-right.
  - Visibility threshold is `feedScrollEl.scrollTop > feedScrollEl.clientHeight`.
  - Click scrolls `.sfp-feed-scroll` to top with smooth behavior.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser verification was run after the 0.6.46 hint-layout change; user tested visually and approved.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Review Focus

1. Diagnose automatic refresh behavior around `_applySidebarIncomingTopics()`, auto silent refresh, and any full refresh path that inserts newer topics above the current list.
2. Preserve the user's visible scroll anchor when new topics are applied automatically, so existing visible rows are not visually pushed downward unless the user explicitly clicks the manual hint.
3. Recheck interactions with `autoSilentRefreshInterval === 0`, loading state, and default-view gating in `_updateShowMoreHint()`.
4. Optional follow-up still open: verify latest-activity settings split for auto silent refresh vs auto refresh.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` if the auto-refresh scroll-position bug needs reproduction and instrumentation.
- `$handoff` again after the next fix pass if work remains.
