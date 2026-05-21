# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-21 21:14:40 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一轮优化“新话题提醒”样式：让提醒独占布局空间，并补上出现时的动效。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.45`
- Latest completed request: 为侧边栏添加“回到顶部”按钮；用户确认效果完美，动效、流畅度、出现时机都合理。
- Current back-to-top behavior:
  - Button is created by `_buildBackTopButton()` and stored in `feedBackTopBtn`.
  - Button is appended to `.sfp-feed-container` and positioned absolute at the lower-right.
  - Visibility threshold is `feedScrollEl.scrollTop > feedScrollEl.clientHeight`.
  - Click scrolls `.sfp-feed-scroll` to top with smooth behavior.
- Incoming queue remains unbounded; new-topic hint still says `查看 N 个新的或更新的话题`.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser verification was run after the 0.6.45 back-to-top change; user tested visually and approved.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Review Focus

1. Optimize `_updateShowMoreHint()` and the `.sfp-show-more-overlay` / `.sfp-content-wrapper.sfp-has-show-more` CSS.
2. Change the new-topic hint from overlay behavior to taking its own layout space so topic rows do not sit underneath it.
3. Add a polished enter animation for the hint appearing; avoid causing layout jumpiness during count updates.
4. Recheck interactions with loading state, `autoSilentRefreshInterval === 0`, and `_applySidebarIncomingTopics()`.
5. Optional follow-up still open from previous handoff: verify latest-activity settings split for auto silent refresh vs auto refresh.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` if the hint layout/animation exposes a reproducible edge case.
- `$handoff` again after the next fix pass if work remains.
