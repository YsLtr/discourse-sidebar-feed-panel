# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 21:45:21 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一轮从零开始审查 `discourse-sidebar-feed-panel.user.js`，重点找潜在 bug、状态耦合、布局/刷新回归，并提出代码结构优化方案。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.42`
- Latest work fixed board/category expanded picker regressions:
  - Header order/period custom selects, auto-refresh settings, and board expanded panel are now mutually exclusive.
  - Expanded-grid category selection scrolls the horizontal tab bar to the active tab.
  - The scroll now uses computed `scrollLeft` and preserves the pre-rerender position, so both forward and backward smooth scrolling behave correctly.
  - `_refreshCategoryTabs()` preserves tab-bar scroll unless an explicit pending active-tab scroll is requested.
- User confirmed the current effect is good and asked to commit before the next review pass.
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

1. Start from a clean read of `discourse-sidebar-feed-panel.user.js`; do not assume the previous feature work is the only risk.
2. Map global state, persistence keys, timers, message-bus subscriptions, route changes, and render/update flows.
3. Look for hidden coupling around `loadTopics()`, `_refreshCategoryTabs()`, `_syncDefaultViewControls()`, auto refresh, silent refresh, and infinite loading.
4. Review UI layering/overflow, mobile/touch behavior, drag sorting, and custom dropdown/settings/panel interactions.
5. Identify low-risk structure improvements, especially small helpers or state ownership cleanup that reduce future regressions.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` when a specific reproducible bug is found.
- `$improve-codebase-architecture` if the review turns into a refactor plan.
- `$handoff` again after the review if work remains.
