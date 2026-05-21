# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-21 22:41:53 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一步优化“最新活动”下叠加其他筛选项时的自动静默刷新设置与计数语义，重点让新话题/更新提示符合当前筛选。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.49`
- Latest completed request: 自动/静默刷新时保护当前可视话题和 hover 话题，避免新话题或活动更新导致瀑布流视口突变；用户反馈“现在效果不错”。
- Current automatic refresh behavior:
  - Only auto refresh / auto silent refresh passes `preserveViewport: true`.
  - Manual refresh, clicking the “查看新的或更新的话题” hint, switching filter/order/category, initial load, and load-more still use full render/reorder semantics.
  - Non-top auto refresh protects visible or hovered `.sfp-topic-item[data-topic-id]` nodes.
  - Protected items are not removed, reinserted, or rebuilt; `_renderTopicsPreservingProtected()` patches them in place and only replaces surrounding unprotected items.
  - Protected items keep DOM position and relative order, and only lightweight fields are patched: time/unread dot, read class, stats, hot/pinned badges.
  - If a protected item no longer matches the active filter, it gets `.sfp-filter-mismatch` and is shown gray until it leaves protection or the user performs an active refresh.
  - If a protected item is explicitly unavailable (`deleted_at`, `deleted`, `hidden`, `visible === false`), it also gets `.sfp-topic-unavailable`; the title line is struck through.
  - Incoming/highlighted protected items retrigger `.sfp-new-highlight` in place via `_triggerTopicHighlight()` so hover/focus should not reset.
- Current new-topic hint behavior remains:
  - `_updateShowMoreHint()` creates `.sfp-show-more-overlay` as normal document flow at the top of `.sfp-content-wrapper`.
  - Hint is hidden for default-view 0-second auto silent refresh because queued incoming topics are applied immediately.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser automation was run. User visually tested the 0.6.49 behavior and said it is good.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Review Focus

1. Optimize auto silent refresh settings for “最新活动” plus non-`all` filters such as unread/read and hide-pinned.
2. Make the incoming topic count/hint match the active filter when latest-activity is combined with other filters.
3. Recheck default-view gating in `_isDefaultFeedView()`, `_updateShowMoreHint()`, `_queueSidebarIncomingApply()`, and `_startAutoSilentRefresh()`; current code mostly treats only all-category + activity + all-filter as default.
4. Preserve the just-approved protected viewport behavior while changing filter-aware refresh logic.
5. If changing incoming filtering, verify interactions with `autoSilentRefreshInterval === 0`, interval-based silent refresh, and manual hint click.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `/diagnose` if filter-aware incoming counts are hard to reproduce deterministically.
- `$handoff` again after the next fix pass if work remains.
