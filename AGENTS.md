# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 00:12:46 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一步进入 UI 优化和上手提示优化；当前刷新、incoming 提醒、静默刷新语义已暂时稳定，用户反馈“OK，暂时没有什么发现的问题”。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.56`
- Latest completed work:
  - “最新活动”下设置面板始终显示 `新活动提醒` 和 `自动静默刷新`。
  - `新活动提醒` 是独立开关，默认开启；关闭只隐藏提示条，不影响静默刷新。
  - `最新活动 + 任意板块 + 全部/未读/已读` 都可使用自动静默刷新。
  - `最新活动 + 任意板块 + 全部` 才显示新活动提醒数量；计数只用 message-bus payload 的 `category_id` 做板块范围匹配，提醒前不拉 `/latest.json?topic_ids=...`。
  - `最新活动 + 任意板块 + 未读/已读` 不显示提示数量，但仍接收 incoming 候选；静默刷新触发时才拉取候选话题并由现有本地筛选决定显示。
  - `隐藏置顶` 不影响 incoming 提醒内容和数量；切换时只重渲染当前列表。
  - 0 秒静默刷新会立即应用 incoming；间隔静默刷新会按倒计时应用。非 latest 排序仍用普通自动刷新。
- Viewport protection behavior from 0.6.49 remains in force:
  - Auto refresh / auto silent refresh uses `preserveViewport: true`.
  - Non-top auto refresh protects visible or hovered topic DOM nodes and patches lightweight fields in place.
  - Manual refresh, hint click, filter/order/category switch, initial load, and load-more still use full render/reorder semantics.

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js`
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser automation was completed. `$agent-browser-cli` was attempted but the extension was not connected (`extension_not_connected`, active tabs 0).

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Review Focus

1. UI polish for the sidebar feed panel and settings/menu affordances.
2. Onboarding/first-use hints: explain feed mode, board tabs, latest activity, silent refresh, and incoming hint behavior without cluttering the main workflow.
3. Recheck compact settings layout on narrow sidebar widths and with Chinese labels.
4. If using browser validation, first restore `$agent-browser-cli` Chrome extension connectivity.
5. After UI changes, run `node --check discourse-sidebar-feed-panel.user.js` and `git diff --check -- discourse-sidebar-feed-panel.user.js`.

## Suggested Skills

- `$agent-browser-cli` for live linux.do UI, DOM, and layout checks once the extension is connected.
- `/diagnose` if UI state or refresh behavior regresses.
- `$handoff` again after the UI/onboarding pass if work remains.
